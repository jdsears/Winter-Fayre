// The appeal's story in 3D on the stall's TV (path.js says where the
// camera goes; scene.js draws the field). John asked whether the 3D
// scene could be brought to the TV to catch the eye (13 November 2026).
//
// The TV's page is whole without this (server/render/tv.js): the
// appeal's turn is a screen of the PSA's words with a code to scan to
// donate, and client/tv.js gives it its turn. Where the television's
// browser can draw 3D, this puts the story's field behind those words
// while the appeal has the screen, and the camera flies down the row of
// things: past what has been funded, to the box goals and the covers
// that are being raised for. The words and the code stay where they can
// be read, over it. Of the appeal's two lists, the one the camera is at
// is shown, larger.
//
// The picture is drawn only while the appeal has the screen, so the
// television is at rest for the rest of the time. Where 3D will not run,
// with reduced motion, on a screen that is not a television's shape, on
// a television that draws it too slowly to be worth watching, or when
// the page is opened as /tv?plain, the appeal's turn is the screen it
// always was. Nothing is sent anywhere.

import { tvViewAt, tvListAt, tvPlaceAt, tvShape } from './path.js'
import { canDraw3d, boardWords, SLOW_MS, SAMPLE } from './index.js'
import { APPEAL } from '../../shared/appeal.js'
import { APPEAL_MS } from '../tv.js'
import { prefersReducedMotion } from '../shootout/motion.js'

// The screens the TV's layout is for (server/render/css.js says the same).
export const TV_WIDE = '(min-width:1000px) and (orientation:landscape)'

// Where the middle of the picture falls on the screen, as parts of its
// width and height: to the left, between the headline and the list,
// clear of the code on the right.
export const TV_MIDDLE = { x: 0.3, y: 0.42 }

// How many pixels the picture is drawn with. A television's picture is
// 1920 across, and one that says it has more is drawn at 1920 and
// stretched: four times the work would buy nothing that is seen from
// across a hall. LEAST is as far as it is let down on a slow one.
export const DRAWN_WIDE = 1920
export const LEAST = 0.5
export const tvRatio = (width, dpr = 1) => Math.max(LEAST, Math.min(dpr > 0 ? dpr : 1, DRAWN_WIDE / Math.max(1, width)))

// Keeping the picture worth watching on a slow television. The time
// between frames is averaged, as on the arcade page (index.js), leaving
// out the first few of all. Slower than twenty frames a second, the
// picture is drawn with fewer pixels and the count starts again
// ('ease'). If it cannot be drawn with fewer and is still under twelve
// frames a second, or is under four however it is drawn, the 3D is put
// away and the appeal's turn is the screen it always was ('stop'): a
// picture that stutters on a big screen is worse than none.
export const TV_WARM_UP = 6
export const STOP_MS = 80
export const HOPELESS_MS = 250
export const HOPELESS_SAMPLE = 12
export function tvPace({ average, counted, ratio, least = LEAST }) {
  if (counted >= HOPELESS_SAMPLE && average > HOPELESS_MS) return 'stop'
  if (counted < SAMPLE) return null
  if (average > SLOW_MS && ratio > least + 0.01) return 'ease'
  if (average > STOP_MS) return 'stop'
  return null
}
// How much of its pixels a picture that is drawn too slowly keeps.
export const EASE = 0.7

// The stall can ask for the appeal's screen of words alone, by opening
// the TV's page with ?plain on the end of its address: a way out on the
// day, with no change to the site, if a television draws the 3D badly
// in some way that cannot be seen from here.
export function wantsPlain(search) {
  try {
    return new URLSearchParams(String(search || '')).has('plain')
  } catch {
    return false
  }
}

// load fetches the field's drawing (scene.js), which brings three.js
// with it: only where it will be used.
export function startTvStory(root, win = globalThis.window, { load = () => import('./scene.js') } = {}) {
  const doc = win.document
  const appeal = root.querySelector('[data-tv-appeal]')
  const lists = appeal ? [...appeal.querySelectorAll('[data-tv-list]')] : []
  if (!appeal || lists.length < 2) return null
  if (wantsPlain(win.location?.search)) return null
  if (prefersReducedMotion(win) || !canDraw3d(doc)) return null
  const wide = win.matchMedia?.(TV_WIDE)
  if (!wide) return null

  let stopped = false
  let scene = null
  let canvas = null
  // Whether the appeal's turn has been laid out round the picture. It
  // is done between turns, never while the appeal is on the screen.
  let armed = false
  let on = false
  let raf = 0
  let began = -1
  let shape = 1
  let shown = ''
  let eased = Infinity
  // The real time between frames, to notice a television that is struggling.
  let lastMs = 0
  let frames = 0
  let counted = 0
  let total = 0

  const show = (which) => {
    if (which === shown) return
    shown = which
    for (const l of lists) l.classList.toggle('now', l.getAttribute('data-tv-list') === which)
  }
  const size = () => {
    if (!scene) return
    const w = root.clientWidth || win.innerWidth
    const h = root.clientHeight || win.innerHeight
    scene.resize(Math.round(w), Math.round(h))
    scene.setRatio(Math.min(eased, tvRatio(w, win.devicePixelRatio || 1)))
    shape = tvShape(w / Math.max(1, h))
  }
  const arm = () => {
    if (armed || stopped || !scene || appeal.classList.contains('on')) return
    armed = true
    show(tvListAt(0))
    appeal.classList.add('s3')
  }

  const pace = (ms) => {
    const gap = lastMs ? ms - lastMs : 0
    lastMs = ms
    // A very long gap is the page having been away, not a slow frame.
    if (!(gap > 0 && gap < 3000)) return
    frames += 1
    if (frames <= TV_WARM_UP) return
    counted += 1
    total += gap
    const what = tvPace({ average: total / counted, counted, ratio: scene.ratio })
    if (what === 'ease') {
      eased = scene.ratio * EASE
      scene.setRatio(eased)
      counted = 0
      total = 0
    } else if (what === 'stop') stop()
  }
  const frame = (ms) => {
    raf = 0
    if (stopped || !on) return
    if (began < 0) began = ms
    pace(ms)
    if (stopped) return
    const u = Math.min(1, Math.max(0, ms - began) / APPEAL_MS)
    try {
      scene.render(tvPlaceAt(u), ms / 1000, tvViewAt(u, shape))
    } catch {
      // A picture that cannot be drawn is put away, not left half drawn.
      stop()
      return
    }
    show(tvListAt(u))
    raf = win.requestAnimationFrame(frame)
  }

  // The appeal's turn begins and ends as client/tv.js says, by putting
  // the appeal on the screen and taking it off.
  const turn = () => {
    const now = appeal.classList.contains('on')
    if (now === on) return
    on = now
    if (raf) win.cancelAnimationFrame(raf)
    raf = 0
    if (!on) {
      arm()
      return
    }
    if (!armed || !wide.matches) return
    began = -1
    lastMs = 0
    // The first picture of the turn is drawn at once, so the screen
    // never comes on with the last picture of the turn before.
    frame(win.performance.now())
  }
  const watch = new win.MutationObserver(turn)
  const onSize = () => size()
  const onLost = (e) => { e.preventDefault?.(); stop() }

  // Without the 3D the appeal's turn is the screen it always was.
  function stop() {
    if (stopped) return
    stopped = true
    if (raf) win.cancelAnimationFrame(raf)
    raf = 0
    watch.disconnect()
    wide.removeEventListener?.('change', begin)
    win.removeEventListener('resize', onSize)
    appeal.classList.remove('s3')
    for (const l of lists) l.classList.remove('now')
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.remove()
    }
    try { scene?.dispose() } catch { /* already gone */ }
  }

  // The field is made once, when the screen is first a television's
  // shape, and drawn once out of sight so the first turn starts smoothly.
  let making = false
  async function begin() {
    if (making || stopped || !wide.matches) return
    making = true
    canvas = doc.createElement('canvas')
    canvas.className = 'tvx-c'
    canvas.setAttribute('aria-hidden', 'true')
    appeal.prepend(canvas)
    try {
      const m = await load()
      if (stopped) return
      scene = m.createStoryScene({ canvas, win, words: APPEAL.name, boards: boardWords(appeal), least: LEAST })
      scene.centre(TV_MIDDLE.x, TV_MIDDLE.y)
      size()
      scene.render(tvPlaceAt(0), 0, tvViewAt(0, shape))
    } catch {
      stop()
      return
    }
    canvas.addEventListener('webglcontextlost', onLost)
    win.addEventListener('resize', onSize)
    watch.observe(appeal, { attributes: true, attributeFilter: ['class'] })
    arm()
    turn()
  }
  wide.addEventListener?.('change', begin)
  // made is settled when the field has been made, or has not.
  const made = begin()

  return { stop, made }
}
