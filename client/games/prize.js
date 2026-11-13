// The sweet on a game's finish panel (shared/prizes.js sets the numbers).
//
// One sweet each (John, 13 November 2026). The first go on a phone that
// reaches its game's number wins the sweet, and is told to show the
// screen at the sports stall, with the time it was won. The phone
// remembers that for the day:
//
//   until the sweet is given, every finish panel shows it again, so it
//   can be claimed whenever the winner gets to the stall;
//   at the stall the helper taps "Stall: sweet given", twice, and from
//   then on the phone says the sweet has been had, so one winning screen
//   cannot be shown for a second sweet.
//
// A go that has not won is told what to aim for. All of it is kept on
// the phone alone, in the browser's own storage: the site is told
// nothing, and knows nothing of who has won.

import { prizeFor, PRIZE_WORDS, ONE_EACH } from '../../shared/prizes.js'
import { GAME_NAMES } from '../../shared/games.js'

export const SWEET_KEY = 'winterfayre:sweet'
// How long the button waits for its second tap.
export const CONFIRM_MS = 4000

const two = (n) => String(n).padStart(2, '0')
const clock = (now) => `${two(now.getHours())}:${two(now.getMinutes())}`
// The day, as the phone has it.
export const dayOf = (now = new Date()) => `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`

// 'Won at 10:42' in the visitor's own time.
export function wonAt(now = new Date()) {
  return `Won at ${clock(now)}`
}

// Where the sweet is remembered: the browser's storage, or, where there
// is none to be had, the page itself for as long as it is open.
const held = new WeakMap()
function storeOf(doc) {
  try {
    const s = doc?.defaultView?.localStorage
    if (s) return s
  } catch { /* storage is shut: the page remembers */ }
  if (!doc || typeof doc !== 'object') return null
  if (!held.has(doc)) {
    const kept = new Map()
    held.set(doc, { getItem: k => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)) } })
  }
  return held.get(doc)
}

// The sweet this phone has won today: { day, game, at, given }, where
// given is the time it was handed over or null. Null when none has been
// won today, or what is kept cannot be read.
export function readSweet(store, now = new Date()) {
  try {
    const raw = JSON.parse(store?.getItem(SWEET_KEY) || 'null')
    if (!raw || raw.day !== dayOf(now)) return null
    if (!(raw.game in GAME_NAMES) || !/^\d\d:\d\d$/.test(raw.at)) return null
    return { day: raw.day, game: raw.game, at: raw.at, given: /^\d\d:\d\d$/.test(raw.given) ? raw.given : null }
  } catch {
    return null
  }
}

function keepSweet(store, sweet) {
  try { store?.setItem(SWEET_KEY, JSON.stringify(sweet)) } catch { /* not kept: the next win is a first win */ }
}

const empty = (into) => { while (into.firstChild) into.removeChild(into.firstChild) }

// Draws a sweet that is waiting, or one that has been given, into its
// place: on a finish panel, and on the arcade page. fresh says it was
// won by the go just ended. Returns what was said.
export function drawSweet(doc, into, sweet, { fresh = false, again = false, store = storeOf(doc), now = () => new Date() } = {}) {
  empty(into)
  const add = (tag, cls, text) => {
    const node = doc.createElement(tag)
    if (cls) node.className = cls
    node.textContent = text
    into.appendChild(node)
    return node
  }
  into.removeAttribute('hidden')
  if (sweet.given) {
    into.className = 'gs-prize had'
    add('b', '', again ? 'Target beaten again' : 'You have had your sweet')
    add('span', '', `Your sweet was given at ${sweet.given}. ${ONE_EACH}`)
    return `${again ? 'Target beaten again. ' : ''}You have had your sweet today. ${ONE_EACH}`
  }
  into.className = 'gs-prize won'
  add('b', '', fresh ? 'You have won a sweet' : 'You have a sweet to collect')
  add('span', '', PRIZE_WORDS)
  add('span', 't', fresh ? `Won at ${sweet.at}` : `Won at ${sweet.at} in ${GAME_NAMES[sweet.game]}`)
  // The stall's button: two taps, so a thumb that slips does not lose a
  // child their sweet.
  const button = add('button', 'gs-given', 'Stall: sweet given')
  button.setAttribute('type', 'button')
  let armed = false
  let timer = null
  const win = doc.defaultView
  button.addEventListener?.('click', () => {
    if (!armed) {
      armed = true
      button.textContent = 'Tap again to confirm'
      timer = win?.setTimeout?.(() => { armed = false; button.textContent = 'Stall: sweet given' }, CONFIRM_MS)
      return
    }
    win?.clearTimeout?.(timer)
    const given = { ...sweet, given: clock(now()) }
    keepSweet(store, given)
    drawSweet(doc, into, given, { store, now })
  })
  return `${fresh ? 'You have won a sweet' : 'You have a sweet to collect'}. ${PRIZE_WORDS}`
}

// Fills the prize's place in a finish panel for a game and a score.
// Returns what was said, for a screen reader, or '' when nothing was.
export function drawPrize(doc, into, game, score, now = new Date(), store = storeOf(doc)) {
  const prize = prizeFor(game, score)
  empty(into)
  if (!prize) {
    into.setAttribute('hidden', '')
    return ''
  }
  let sweet = readSweet(store, now)
  const fresh = !sweet && prize.won
  if (fresh) {
    sweet = { day: dayOf(now), game, at: clock(now), given: null }
    keepSweet(store, sweet)
  }
  if (sweet) return drawSweet(doc, into, sweet, { fresh, again: prize.won && Boolean(sweet.given), store })
  // Nothing won yet: what to aim for.
  const node = doc.createElement('span')
  node.textContent = `${prize.words} ${ONE_EACH}`
  into.appendChild(node)
  into.removeAttribute('hidden')
  into.className = 'gs-prize'
  return prize.words
}

// Empties the prize's place, for the next go.
export function clearPrize(into) {
  empty(into)
  into.setAttribute('hidden', '')
}
