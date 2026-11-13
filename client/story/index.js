// The 3D story of the appeal on the arcade page (path.js says where the
// camera goes; scene.js draws the field).
//
// The page tells the appeal's story in words, whole, with no script
// (server/render/appeal.js), and opens on the story's picture: a room
// for it at the top of the page, drawn as a winter's night. Where a
// phone can draw 3D, this fills that room with the field in 3D and pins
// it to the top of the screen while the page is scrolled through, and
// the camera flies from thing to thing as each is read about. John asked
// for a 3D animated story to be scrolled through on the way to the
// games, and for it to open the page (13 November 2026).
//
// The words are not changed, moved or hidden: the picture is beside
// them, and says nothing a screen reader needs. Its room is in the page
// from the start, so nothing moves when the 3D arrives. Where 3D will
// not run, or a visitor has asked for less motion, the room keeps its
// drawn night and the story reads as it always did. Nothing is sent
// anywhere.

import { STOPS, progressAt, stopAt, captionFor } from './path.js'
import { APPEAL } from '../../shared/appeal.js'
import { prefersReducedMotion } from '../shootout/motion.js'

// Whether this browser will draw 3D at all.
export function canDraw3d(doc = globalThis.document) {
  try {
    const canvas = doc.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension?.('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

// Where on the screen the words are being read: a little above the
// middle of the room under the stage, or of the whole screen where the
// stage does not reach across it.
export function focusLine(stage, screenHeight) {
  const under = Math.max(0, Math.min(screenHeight, stage.bottom))
  return under + (screenHeight - under) * 0.42
}

// The shortest screen the stage is pinned on, in pixels.
export const SHORT = 480

// The words for the boards along the back of the field, as the page
// gives them (the ones round the games' pitch): a few short names, and
// nothing else. None, where the page gives none that can be used.
export function boardWords(root) {
  try {
    const names = JSON.parse(root.getAttribute('data-boards') || '[]')
    return names.filter(n => typeof n === 'string' && /^[A-Za-z][A-Za-z ']{1,38}$/.test(n.trim())).map(n => n.trim()).slice(0, 6)
  } catch {
    return []
  }
}

// Whether the page was opened at its games menu, below the story.
export const pastTheStory = (hash) => String(hash || '') === '#games'

// How quickly the camera catches up with the scroll: most of the way in
// a fifth of a second, so a flick of the thumb is followed smoothly.
export const follow = (shown, target, dt) => shown + (target - shown) * (1 - Math.exp(-Math.max(0, dt) * 7))

export async function startStory(root, win = globalThis.window) {
  const doc = win.document
  // Not on a screen too short to share between a picture and the words
  // (a phone on its side): there the story reads as it always did.
  if (!(win.innerHeight >= SHORT)) return null
  // Nor for a visitor sent straight to the games menu, as the links back
  // from a game do: they scrolled through the story when they arrived.
  if (pastTheStory(win.location?.hash)) return null
  if (prefersReducedMotion(win) || !canDraw3d(doc)) return null
  const stage = root.querySelector('[data-stage]')
  const stops = STOPS.map(name => root.querySelector(`[data-stop="${name}"]`))
  if (!stage || stops.some(s => !s)) return null

  // Into the picture's room go the 3D and, under it, the name of the
  // thing in view.
  const el = (tag, cls) => { const node = doc.createElement(tag); node.className = cls; return node }
  const canvas = el('canvas', 'st-canvas')
  const cap = el('p', 'st-cap')
  cap.hidden = true
  const label = el('span', 'k')
  const amount = el('b', 'am')
  const name = el('span', 'n')
  cap.append(label, amount, name)
  stage.append(canvas, cap)
  root.classList.add('s3d')
  // Without the 3D the room is the drawn night it was, and is not pinned.
  const off = () => {
    root.classList.remove('s3d')
    stage.classList.remove('on')
    canvas.remove()
    cap.remove()
  }

  let scene = null
  try {
    const m = await import('./scene.js')
    scene = m.createStoryScene({ canvas, win, words: APPEAL.name, boards: boardWords(root.querySelector('[data-boards]') || root) })
  } catch {
    off()
    return null
  }

  const size = () => {
    const r = stage.getBoundingClientRect()
    scene.resize(Math.round(r.width), Math.round(r.height))
  }

  let said = null
  const caption = (stop) => {
    if (stop === said) return
    said = stop
    const c = captionFor(stop, APPEAL)
    label.textContent = c.label
    amount.textContent = c.amount
    name.textContent = c.name
    cap.hidden = !c.name
  }

  let shown = 0
  let last = 0
  let raf = 0
  let seen = false
  let stopped = false
  let drawn = false
  const frame = (ms) => {
    raf = 0
    if (stopped) return
    const now = ms / 1000
    const dt = last ? Math.min(0.1, now - last) : 0
    last = now
    const centres = stops.map((s) => { const r = s.getBoundingClientRect(); return (r.top + r.bottom) / 2 })
    const target = progressAt(focusLine(stage.getBoundingClientRect(), win.innerHeight), centres)
    shown = dt ? follow(shown, target, dt) : target
    scene.render(shown, now)
    caption(stopAt(shown))
    // The picture is shown once there is one to show.
    if (!drawn) {
      drawn = true
      stage.classList.add('on')
    }
    if (seen) raf = win.requestAnimationFrame(frame)
  }
  const wake = () => { if (!raf && !stopped && seen) { last = 0; raf = win.requestAnimationFrame(frame) } }

  // The picture is drawn only while it is on the screen.
  const watch = new win.IntersectionObserver((entries) => {
    seen = entries.some(e => e.isIntersecting)
    wake()
  }, { rootMargin: '60px' })
  watch.observe(stage)
  const onSize = () => { size(); wake() }
  win.addEventListener('resize', onSize)
  const onLost = (e) => { e.preventDefault?.(); stop() }
  canvas.addEventListener('webglcontextlost', onLost)

  function stop() {
    if (stopped) return
    stopped = true
    if (raf) win.cancelAnimationFrame(raf)
    watch.disconnect()
    win.removeEventListener('resize', onSize)
    canvas.removeEventListener('webglcontextlost', onLost)
    try { scene.dispose() } catch { /* already gone */ }
    off()
  }

  size()
  caption(STOPS[0])
  return { stop, stage }
}
