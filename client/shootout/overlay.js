// The full-screen overlay the game plays in, and what makes it a proper
// dialog: focus moves in when it opens and back to Play when it closes,
// Escape and Leave game close it, Tab stays inside, the page behind is
// inert and cannot scroll or zoom, and an aria-live region says each
// outcome and the score.
//
// Built with createElement alone (no innerHTML), so it runs against the
// small stand-in document the tests use as well as a real one.

import { KICKS_EACH } from './rules.js'

export function h(doc, tag, attrs = {}, ...children) {
  const el = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k === 'style') Object.assign(el.style, v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue
    el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c)
  }
  return el
}

const show = (el, on) => {
  if (on) el.removeAttribute('hidden')
  else el.setAttribute('hidden', '')
}

export function buildOverlay(doc, config) {
  const c = config.colours
  const dots = (side) => Array.from({ length: KICKS_EACH }, () => h(doc, 'li', { class: 'tso-dot', 'data-state': 'empty', 'data-side': side }))
  const usDots = dots('us')
  const themDots = dots('them')
  const usScore = h(doc, 'span', { class: 'tso-score', text: '0' })
  const themScore = h(doc, 'span', { class: 'tso-score', text: '0' })
  const usRow = h(doc, 'div', { class: 'tso-row', 'data-side': 'us', 'data-next': 'true' },
    h(doc, 'span', { class: 'tso-name', text: 'You' }), h(doc, 'ol', { class: 'tso-dots', 'aria-hidden': 'true' }, usDots), usScore)
  const themRow = h(doc, 'div', { class: 'tso-row', 'data-side': 'them' },
    h(doc, 'span', { class: 'tso-name', text: config.opponentName }), h(doc, 'ol', { class: 'tso-dots', 'aria-hidden': 'true' }, themDots), themScore)
  const sudden = h(doc, 'p', { class: 'tso-sudden', hidden: true, text: 'Sudden death' })

  const soundState = h(doc, 'span', { class: 'tso-switch', 'aria-hidden': 'true', text: 'Off' })
  const sound = h(doc, 'button', { type: 'button', class: 'tso-pill tso-sound', role: 'switch', 'aria-checked': 'false' }, 'Sound ', soundState)
  // The tune has a switch of its own; it plays only while the sound is on.
  const musicState = h(doc, 'span', { class: 'tso-switch', 'aria-hidden': 'true', text: 'On' })
  const music = h(doc, 'button', { type: 'button', class: 'tso-pill tso-sound', role: 'switch', 'aria-checked': 'true' }, 'Music ', musicState)
  const leave = h(doc, 'button', { type: 'button', class: 'tso-pill tso-leave' }, 'Leave game')

  const fx = h(doc, 'canvas', { class: 'tso-fx', 'aria-hidden': 'true' })
  const hint = h(doc, 'p', { class: 'tso-hint', id: 'tso-hint' })
  const promptEyebrow = h(doc, 'p', { class: 'tso-prompt-eyebrow' })
  const promptTitle = h(doc, 'p', { class: 'tso-prompt-title' })
  const prompt = h(doc, 'div', { class: 'tso-prompt', hidden: true }, promptEyebrow, promptTitle)
  const stage = h(doc, 'div', {
    class: 'tso-stage',
    tabindex: '0',
    role: 'application',
    'aria-roledescription': 'penalty game',
    'aria-label': 'The pitch',
    'aria-describedby': 'tso-hint tso-keys',
  }, fx)
  const keys = h(doc, 'p', { class: 'tso-sr', id: 'tso-keys', text: 'On a keyboard: when it is your kick, the arrow keys aim and holding Space builds power; let go to shoot. When it is your save, the left, right and up arrows dive.' })

  const bannerWord = h(doc, 'span', { class: 'tso-banner-word' })
  const bannerSub = h(doc, 'span', { class: 'tso-banner-sub' })
  const banner = h(doc, 'div', { class: 'tso-banner', 'aria-hidden': 'true', hidden: true }, bannerWord, bannerSub)

  const powerFill = h(doc, 'div', { class: 'tso-power-fill' })
  const power = h(doc, 'div', { class: 'tso-power', 'aria-hidden': 'true', hidden: true }, h(doc, 'div', { class: 'tso-power-zone' }), powerFill)

  const diveLeft = h(doc, 'button', { type: 'button', class: 'tso-zone', 'data-dive': 'left' }, 'Dive left')
  const diveUp = h(doc, 'button', { type: 'button', class: 'tso-zone', 'data-dive': 'up' }, 'Jump')
  const diveRight = h(doc, 'button', { type: 'button', class: 'tso-zone', 'data-dive': 'right' }, 'Dive right')
  const zones = h(doc, 'div', { class: 'tso-zones', role: 'group', 'aria-label': 'Which way to dive', hidden: true }, diveLeft, diveUp, diveRight)

  const live = h(doc, 'p', { class: 'tso-sr tso-live', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
  const wipe = h(doc, 'div', { class: 'tso-wipe', 'aria-hidden': 'true' })
  const loading = h(doc, 'p', { class: 'tso-loading', text: 'Getting the pitch ready' })

  // The results.
  const resultsTitle = h(doc, 'h2', { class: 'tso-results-title', id: 'tso-results-title', tabindex: '-1' })
  const statGoals = h(doc, 'b')
  const statSaves = h(doc, 'b')
  const statBest = h(doc, 'b')
  const newBest = h(doc, 'p', { class: 'tso-newbest', hidden: true, text: 'A new best on this device' })
  const again = h(doc, 'button', { type: 'button', class: 'tso-btn tso-btn-main' }, 'Play again')
  const share = h(doc, 'button', { type: 'button', class: 'tso-btn' }, 'Share')
  const leave2 = h(doc, 'button', { type: 'button', class: 'tso-btn tso-btn-quiet' }, 'Leave game')
  const shareNote = h(doc, 'p', { class: 'tso-share-note', role: 'status', 'aria-live': 'polite' })
  const shareLinkBox = h(doc, 'input', { class: 'tso-share-link', type: 'text', readonly: true, 'aria-label': 'Link to share', hidden: true })
  // The score the leaderboard counts, and room for the leaderboard itself.
  const statPoints = h(doc, 'b')
  const extra = h(doc, 'div', { class: 'tso-extra gs-extra' })
  const resultsEyebrow = h(doc, 'p', { class: 'tso-eyebrow', text: 'Shootout over' })
  const results = h(doc, 'section', { class: 'tso-results', 'aria-labelledby': 'tso-results-title', hidden: true },
    h(doc, 'div', { class: 'tso-results-card' },
      resultsEyebrow,
      resultsTitle,
      h(doc, 'dl', { class: 'tso-stats' },
        h(doc, 'div', {}, h(doc, 'dt', { text: 'Goals scored' }), h(doc, 'dd', {}, statGoals)),
        h(doc, 'div', {}, h(doc, 'dt', { text: 'Saves made' }), h(doc, 'dd', {}, statSaves)),
        h(doc, 'div', {}, h(doc, 'dt', { text: 'Your score: goals and saves' }), h(doc, 'dd', {}, statPoints)),
        h(doc, 'div', {}, h(doc, 'dt', { text: 'Best on this device' }), h(doc, 'dd', {}, statBest)),
      ),
      newBest,
      extra,
      h(doc, 'div', { class: 'tso-actions' }, again, share, leave2),
      shareNote,
      shareLinkBox,
    ))

  const presented = config.presentedBy
    ? h(doc, 'p', { class: 'tso-presented' }, 'Shootout presented by ', h(doc, 'b', { text: config.presentedBy.name }))
    : null

  const root = h(doc, 'div', {
    class: 'tso',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'tso-title',
    'data-phase': 'loading',
    style: {},
  },
  stage,
  h(doc, 'div', { class: 'tso-top' },
    h(doc, 'h2', { class: 'tso-title', id: 'tso-title', text: (config.copy?.heading || 'Beat the keeper').replace(/\*/g, '') }),
    h(doc, 'div', { class: 'tso-top-actions' }, sound, music, leave)),
  h(doc, 'div', { class: 'tso-board', 'aria-hidden': 'true' }, usRow, themRow, sudden),
  presented,
  prompt,
  hint,
  banner,
  power,
  zones,
  keys,
  loading,
  wipe,
  live,
  results)
  root.style.setProperty?.('--tso-primary', c.primary)
  root.style.setProperty?.('--tso-deep', c.deep)
  root.style.setProperty?.('--tso-accent', c.accent)
  root.style.setProperty?.('--tso-ink', c.ink)

  return {
    root, stage, fx, prompt, promptEyebrow, promptTitle, hint, banner, bannerWord, bannerSub, power, powerFill,
    zones, diveButtons: [diveLeft, diveUp, diveRight], sound, soundState, music, musicState, leave, live, loading, wipe,
    tracker: { usDots, themDots, usScore, themScore, usRow, themRow, sudden },
    results: { root: results, title: resultsTitle, eyebrow: resultsEyebrow, goals: statGoals, saves: statSaves, points: statPoints, extra, best: statBest, newBest, again, share, leave: leave2, note: shareNote, link: shareLinkBox },
  }
}

// What Tab may reach inside the overlay right now.
export function focusables(ui) {
  const candidates = [ui.stage, ui.sound, ui.music, ui.leave, ...ui.diveButtons, ui.results.again, ui.results.share, ui.results.leave, ui.results.link]
  const visible = (el) => {
    for (let n = el; n && n !== ui.root.parentNode; n = n.parentNode) {
      if (n.hasAttribute?.('hidden')) return false
    }
    return !el.disabled
  }
  // While the results are up, only they and the top bar, Play again first.
  const resultsUp = !ui.results.root.hasAttribute('hidden')
  if (resultsUp) {
    // The leaderboard's box and buttons, when it is there, come first.
    const board = Array.from(ui.results.extra.querySelectorAll?.('input, button') ?? [])
    return [...board, ui.results.again, ui.results.share, ui.results.leave, ui.results.link, ui.sound, ui.music, ui.leave].filter(visible)
  }
  return candidates.filter(visible)
}

// Opens it: in the page, focus inside, the page behind locked. Returns a
// close function that undoes all of it and puts focus back.
export function openOverlay(ui, { doc, win, returnFocus, onLeave }) {
  const body = doc.body
  const html = doc.documentElement
  const saved = {
    htmlOverflow: html.style.overflow ?? '',
    bodyOverflow: body.style.overflow ?? '',
    htmlOverscroll: html.style.overscrollBehavior ?? '',
    bodyTouch: body.style.touchAction ?? '',
  }
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  body.style.touchAction = 'none'

  // Everything else on the page is inert while the game is up.
  const madeInert = []
  for (const el of Array.from(body.children)) {
    if (el === ui.root || el.hasAttribute('inert')) continue
    el.setAttribute('inert', '')
    madeInert.push(el)
  }
  body.appendChild(ui.root)

  const onKey = (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault?.()
      onLeave('escape')
      return
    }
    if (e.key === 'Tab') {
      const list = focusables(ui)
      if (!list.length) return
      const i = list.indexOf(doc.activeElement)
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i === -1 || i === list.length - 1 ? 0 : i + 1)
      e.preventDefault?.()
      list[next].focus()
    }
  }
  // No pinch, no pull to refresh, no page scroll while swiping.
  const stopTouch = (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault?.()
    else if (!e.target?.closest?.('.tso-results')) e.preventDefault?.()
  }
  const stopGesture = (e) => e.preventDefault?.()
  doc.addEventListener('keydown', onKey, true)
  ui.root.addEventListener('touchmove', stopTouch, { passive: false })
  ui.root.addEventListener('gesturestart', stopGesture)
  ui.root.addEventListener('dblclick', stopGesture)

  ui.leave.addEventListener('click', () => onLeave('button'))
  ui.results.leave.addEventListener('click', () => onLeave('button'))

  ui.stage.focus()

  let closed = false
  return function closeOverlay() {
    if (closed) return
    closed = true
    doc.removeEventListener('keydown', onKey, true)
    ui.root.removeEventListener('touchmove', stopTouch)
    ui.root.removeEventListener('gesturestart', stopGesture)
    ui.root.removeEventListener('dblclick', stopGesture)
    for (const el of madeInert) el.removeAttribute('inert')
    if (ui.root.parentNode) ui.root.parentNode.removeChild(ui.root)
    html.style.overflow = saved.htmlOverflow
    body.style.overflow = saved.bodyOverflow
    html.style.overscrollBehavior = saved.htmlOverscroll
    body.style.touchAction = saved.bodyTouch
    if (returnFocus && returnFocus.isConnected !== false && typeof returnFocus.focus === 'function') returnFocus.focus()
    void win
  }
}

// Says something in the live region. The same words twice in a row are
// still said: the region is cleared first.
export function announce(ui, text, win = globalThis.window) {
  ui.live.textContent = ''
  const set = () => { ui.live.textContent = text }
  if (win && typeof win.setTimeout === 'function') win.setTimeout(set, 30)
  else set()
}

export function setPrompt(ui, { eyebrow = '', title = '', hint = '' } = {}) {
  ui.promptEyebrow.textContent = eyebrow
  ui.promptTitle.textContent = title
  ui.hint.textContent = hint
  show(ui.hint, Boolean(hint))
  show(ui.prompt, Boolean(title || eyebrow))
}

export function setTracker(ui, tracker, totals) {
  const paint = (dots, states) => dots.forEach((d, i) => d.setAttribute('data-state', states[i]))
  paint(ui.tracker.usDots, tracker.rows.us)
  paint(ui.tracker.themDots, tracker.rows.them)
  ui.tracker.usScore.textContent = String(totals.us)
  ui.tracker.themScore.textContent = String(totals.them)
  ui.tracker.usRow.setAttribute('data-next', String(tracker.rows.us.includes('next')))
  ui.tracker.themRow.setAttribute('data-next', String(tracker.rows.them.includes('next')))
  show(ui.tracker.sudden, tracker.suddenDeath)
}

export { show }
