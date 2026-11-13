// The full-screen stage the site's games share with the penalty
// shootout: its stadium (shootout/scene3d.js), its sound and its
// confetti, with a small bar of the game's own numbers over the top.
//
// A game opens the stage, hands it a function that says what to draw
// each frame, and is told of touches and keys. The stage fills the
// screen, so a game starts where the visitor's thumb is, with nothing to
// scroll past. Where the 3D will not run, a game that brings a painter
// of its own (flat) is played on the same stage with the stadium drawn
// flat (flat.js); for a game without one, openStage resolves to null and
// the page's flat version of the game is played in its place.
//
// Nothing here asks anything of any other site, and nothing is sent
// anywhere.

import { createAudio } from '../shootout/audio.js'
import { createFx } from '../shootout/fx.js'
import { effects, prefersReducedMotion } from '../shootout/motion.js'
import { themeColours } from '../shootout/config.js'
import { kits as makeKits } from '../shootout/kit.js'
import { pageColours } from '../shootout/index.js'
import { HOME_KEEPER_LOOK } from '../shootout/looks.js'
import { boardLogosFrom, topSignFrom } from '../shootout/boards.js'
import { drawPrize, clearPrize } from './prize.js'

export function webglAvailable(doc = globalThis.document) {
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

function el(doc, tag, attrs = {}, ...children) {
  const node = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue
    if (k === 'class') node.className = v
    else if (k === 'hidden') node.hidden = Boolean(v)
    else node.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c)
  return node
}

// Stops a phone zooming or dragging the page while a game is played with
// two thumbs: no pinch, no double-tap zoom and no page drag. A panel that
// scrolls (the finish panel) still scrolls. Returns a function that
// takes the guards off again.
export function lockTouch(shell, win = globalThis.window) {
  const doc = win.document
  const scrolls = (target) => Boolean(target?.closest?.('.gs-end, .hh-pick'))
  const stop = (e) => { if (e.cancelable) e.preventDefault() }
  // A drag or a pinch: never the page's to take, except inside a panel
  // that scrolls, and never with more than one finger.
  const onMove = (e) => { if (e.touches.length > 1 || !scrolls(e.target)) stop(e) }
  // A second quick tap: a zoom on some phones, unless it is stopped.
  let lastEnd = 0
  const onEnd = (e) => {
    const t = Date.now()
    if (t - lastEnd < 350 && !e.target?.closest?.('button, a, input')) stop(e)
    lastEnd = t
  }
  const gestures = ['gesturestart', 'gesturechange', 'gestureend']
  shell.addEventListener('touchmove', onMove, { passive: false })
  shell.addEventListener('touchend', onEnd, { passive: false })
  shell.addEventListener('dblclick', stop)
  for (const g of gestures) doc.addEventListener(g, stop, { passive: false })
  return () => {
    shell.removeEventListener('touchmove', onMove)
    shell.removeEventListener('touchend', onEnd)
    shell.removeEventListener('dblclick', stop)
    for (const g of gestures) doc.removeEventListener(g, stop)
  }
}

// The words for the boards round the pitch: the ones the page lists
// (data-boards), or the fayre's name.
export function boardsFrom(root) {
  try {
    const names = JSON.parse(root.getAttribute('data-boards') || '[]')
    const clean = names.filter(n => typeof n === 'string' && n.trim()).map(n => n.trim().slice(0, 40)).slice(0, 24)
    if (clean.length) return clean
  } catch { /* no list: the fayre's name stands */ }
  return ['Winter Fayre']
}

// name      the game's name, for a screen reader
// hud       [{ key, label }] the numbers in the bar, set with stage.set
// others    [{ href, label }] the other games, offered when a go ends
// boards    the names for the advertising boards
// onPoint   (x, y) a touch or click on the pitch, in the stage's pixels
// onKey     (key) Space or Enter and the arrow keys
// onLost    the 3D was lost after it opened
// sport     which sport the stadium is dressed for: 'football' unless said
// flat      (g, picture) paints the game on a flat stadium, where the 3D will not run
export async function openStage({ name, hud = [], others = [], boards = [], sport = 'football', flat = null, onPoint = () => {}, onPointer = null, onKey = () => {}, onLost = () => {}, win = globalThis.window }) {
  const doc = win.document
  const can3d = webglAvailable(doc)
  if (!can3d && !flat) return null
  const reduce = prefersReducedMotion(win)
  const fxOn = effects(reduce)
  const colours = themeColours(null, pageColours(doc))
  const allKits = makeKits(colours)

  const canvas = el(doc, 'canvas', { class: 'gs-view' })
  const fxCanvas = el(doc, 'canvas', { class: 'gs-fx' })
  const pitch = el(doc, 'div', { class: 'gs-pitch', tabindex: '0', role: 'img', 'aria-label': `${name}: the pitch` }, canvas, fxCanvas)
  const numbers = {}
  const hudEl = el(doc, 'p', { class: 'gs-hud' }, ...hud.map((h) => {
    numbers[h.key] = el(doc, 'b', {}, '0')
    return el(doc, 'span', {}, numbers[h.key], ` ${h.label}`)
  }))
  const soundState = el(doc, 'span', { class: 'gs-on' }, 'Off')
  const sound = el(doc, 'button', { type: 'button', class: 'gs-b', role: 'switch', 'aria-checked': 'false' }, 'Sound ', soundState)
  const musicState = el(doc, 'span', { class: 'gs-on' }, 'On')
  const musicSwitch = el(doc, 'button', { type: 'button', class: 'gs-b', role: 'switch', 'aria-checked': 'true' }, 'Music ', musicState)
  const leave = el(doc, 'a', { class: 'gs-b', href: '/' }, 'Leave')
  // A line under the top bar for what a kick must reckon with: the wind,
  // with an arrow for the way it blows.
  const noteArrow = el(doc, 'span', { class: 'gs-arrow', 'aria-hidden': 'true', hidden: true })
  const noteText = el(doc, 'span', {})
  const note = el(doc, 'p', { class: 'gs-note', hidden: true }, noteArrow, noteText)
  const big = el(doc, 'p', { class: 'gs-big', 'aria-hidden': 'true' })
  const prompt = el(doc, 'p', { class: 'gs-prompt' })
  const banner = el(doc, 'p', { class: 'gs-banner', 'aria-hidden': 'true', hidden: true })
  const endTitle = el(doc, 'h2', { class: 'gs-end-t' })
  const endLine = el(doc, 'p', { class: 'gs-end-l' })
  const again = el(doc, 'button', { type: 'button', class: 'btn y' }, 'Play again')
  const endExtra = el(doc, 'div', { class: 'gs-extra' })
  // Where the prize is said: to a winner, to show the screen at the stall.
  const endPrize = el(doc, 'p', { class: 'gs-prize', hidden: true })
  const end = el(doc, 'div', { class: 'gs-end', hidden: true },
    endTitle, endLine, endPrize, endExtra, again,
    el(doc, 'p', { class: 'gs-more' }, ...others.map(o => el(doc, 'a', { class: 'btn o', href: o.href }, o.label))))
  const status = el(doc, 'p', { class: 'vh', role: 'status' })
  const root = el(doc, 'div', { class: 'gs', role: 'dialog', 'aria-modal': 'true', 'aria-label': name },
    pitch, el(doc, 'div', { class: 'gs-top' }, hudEl, el(doc, 'div', { class: 'gs-btns' }, sound, musicSwitch, leave)),
    note, big, prompt, banner, end, status)
  if (reduce) root.setAttribute('data-reduced', 'true')

  let view = null
  let stopped = false
  let lost = false
  if (can3d) {
    try {
      const { createScene3D } = await import('../shootout/scene3d.js')
      view = await createScene3D({ canvas, colours, kits: allKits, boards, boardLogos: boardLogosFrom(doc), topSign: topSignFrom(doc), sport, win, doc, onLost: () => { lost = true; close(); onLost() } })
    } catch {
      view = null
    }
  }
  // No 3D here: the game's own painter, on a stadium drawn flat.
  if (!view && flat) {
    try {
      const { createFlatView } = await import('./flat.js')
      view = createFlatView({ canvas, paint: flat, colours, boards, sign: topSignFrom(doc), reduce })
    } catch {
      view = null
    }
  }
  if (!view) return null
  root.setAttribute('data-renderer', view.kind)
  view.setTeams({ taker: allKits.home, keeper: allKits.homeKeeper, keeperLook: HOME_KEEPER_LOOK, number: '9' })

  doc.body.append(root)
  doc.documentElement.classList.add('gs-open')
  const unlockTouch = lockTouch(root, win)
  try { win.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open: true } })) } catch { /* old browser */ }

  const audio = createAudio(win)
  const fx = createFx(fxCanvas, { accent: colours.accent, primary: colours.primary, win })
  let size = { width: 1, height: 1 }
  function resize() {
    const r = pitch.getBoundingClientRect()
    size = { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) }
    const dpr = Math.min(2, win.devicePixelRatio || 1)
    view.resize(size.width, size.height, dpr)
    fx.resize(size.width, size.height, dpr)
  }
  resize()

  let frameFn = null
  let raf = 0
  let last = 0
  function frame(now) {
    if (stopped) return
    raf = win.requestAnimationFrame(frame)
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
    last = now
    if (!frameFn) return
    const state = frameFn(dt, now / 1000, size)
    if (state) view.draw({ now: now / 1000, ...state })
    fx.draw(dt, now)
  }

  const point = (e) => {
    const r = pitch.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onDown = (e) => {
    if (e.button > 0) return
    e.preventDefault()
    const p = point(e)
    if (onPointer) {
      try { pitch.setPointerCapture(e.pointerId) } catch { /* no capture: the moves still come */ }
      onPointer('down', p.x, p.y)
    } else {
      onPoint(p.x, p.y)
    }
  }
  const onMove = (e) => { if (onPointer) { const p = point(e); onPointer('move', p.x, p.y) } }
  const onUp = (e) => { if (onPointer) { const p = point(e); onPointer('up', p.x, p.y) } }
  const onCancel = () => { if (onPointer) onPointer('cancel', 0, 0) }
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { win.location.assign('/'); return }
    if (e.target.closest?.('button, a, input')) return
    if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
      if (!e.repeat || e.key.startsWith('Arrow')) onKey(e.key)
    }
  }
  const onVisibility = () => {
    last = 0
    if (doc.hidden) audio.suspend()
    else audio.resume()
  }
  pitch.addEventListener('pointerdown', onDown)
  pitch.addEventListener('pointermove', onMove)
  pitch.addEventListener('pointerup', onUp)
  pitch.addEventListener('pointercancel', onCancel)
  root.addEventListener('keydown', onKeyDown)
  win.addEventListener('resize', resize)
  doc.addEventListener('visibilitychange', onVisibility)
  sound.addEventListener('click', () => {
    const on = sound.getAttribute('aria-checked') !== 'true'
    const state = audio.setEnabled(on)
    sound.setAttribute('aria-checked', String(state))
    soundState.textContent = state ? 'On' : 'Off'
    if (state) audio.kick(0.3)
  })
  // The tune's own switch: it plays only while the sound is on.
  musicSwitch.addEventListener('click', () => {
    const on = audio.setMusic(musicSwitch.getAttribute('aria-checked') !== 'true')
    musicSwitch.setAttribute('aria-checked', String(on))
    musicState.textContent = on ? 'On' : 'Off'
  })

  let bannerTimer = 0
  function close() {
    if (stopped) return
    stopped = true
    win.cancelAnimationFrame(raf)
    win.clearTimeout(bannerTimer)
    win.removeEventListener('resize', resize)
    doc.removeEventListener('visibilitychange', onVisibility)
    audio.dispose()
    fx.dispose()
    try { view.dispose() } catch { /* already gone */ }
    unlockTouch()
    root.remove()
    doc.documentElement.classList.remove('gs-open')
    try { win.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open: false } })) } catch { /* old browser */ }
  }

  raf = win.requestAnimationFrame(frame)
  pitch.focus({ preventScroll: true })

  return {
    root, pitch, audio, fx, fxOn, reduce, endExtra, again,
    get size() { return size },
    get lost() { return lost },
    onFrame(fn) { frameFn = fn },
    set(key, value) { if (numbers[key]) numbers[key].textContent = String(value) },
    big(text, pop = false) {
      big.textContent = text
      if (pop && !reduce) {
        big.classList.remove('pop')
        void big.offsetWidth
        big.classList.add('pop')
      }
    },
    prompt(text) {
      prompt.textContent = text
      prompt.hidden = !text
    },
    say(text) { status.textContent = text },
    // The line under the top bar: its words, and the way its arrow points
    // (to the right above nought, to the left below, none at nought; the
    // further from nought, the longer the arrow, up to three).
    note(text, way = 0) {
      noteText.textContent = text
      note.hidden = !text
      noteArrow.hidden = !way
      noteArrow.className = `gs-arrow ${way < 0 ? 'l' : 'r'} n${Math.min(3, Math.max(1, Math.ceil(Math.abs(way) / 3)))}`
    },
    banner(text, ms = 1200) {
      banner.textContent = text
      banner.hidden = false
      banner.classList.remove('in')
      void banner.offsetWidth
      banner.classList.add('in')
      win.clearTimeout(bannerTimer)
      bannerTimer = win.setTimeout(() => { banner.hidden = true }, ms)
    },
    cheer(seconds = 2) { view.celebrate(seconds) },
    setTeams(teams) { view.setTeams(teams) },
    kits: allKits,
    ripple(p, strength) { view.ripple(p, strength) },
    confetti(count) { if (fxOn.confetti) fx.confetti(count) },
    showEnd({ title, line }) {
      endTitle.textContent = title
      endLine.textContent = line
      end.hidden = false
      again.focus({ preventScroll: true })
    },
    // The prize for a game and a score (shared/prizes.js), on the finish
    // panel. Returns what was said, to be read out with the result.
    prize(game, score) { return drawPrize(doc, endPrize, game, score) },
    hideEnd() {
      end.hidden = true
      clearPrize(endPrize)
      fx.stopConfetti()
      pitch.focus({ preventScroll: true })
    },
    get ended() { return !end.hidden },
    close,
  }
}
