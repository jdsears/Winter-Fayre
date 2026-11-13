// The site's own numbers: how many pages were looked at and how many
// games were played, a day at a time.
//
// What is kept: for each day, a count for each of the site's pages and,
// for each game, how many times it was started and finished. Nothing
// else. No cookie is set, and nothing about a visitor or their device is
// kept or even read for this, so these are visits, not visitors: one
// person looking at three pages is three.
//
// What can be counted is fixed here. A page is counted under one of the
// names it is given, never under whatever address was asked for, and a
// game under one of the arcade's games, so nothing a visitor types or
// sends can become a name in the file.
//
// Where it is kept: in this service's memory, and in one small file a
// day (counts/2026-11-14.json) when the service has a folder to write to
// (server/store.js). The day's totals are written out once a minute
// while they are changing, so a restart loses a minute at most. Days are
// UK days.

import { createStore } from './store.js'
import { londonDay } from './board.js'
import { GAME_KEYS, GAME_NAMES } from '../shared/games.js'

export const GAMES = GAME_KEYS
export { GAME_NAMES }
export const MOMENTS = ['play', 'done']
// The most game counts taken in a minute, from everyone.
export const TALLIES_A_MINUTE = 900
export const FLUSH_MS = 60 * 1000
// Asked for by a machine and not a person: not a visit.
const MACHINE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|monitor|uptime|curl|wget|headless|python|node-fetch|axios|go-http/i
export const isMachine = (userAgent) => !userAgent || MACHINE.test(String(userAgent))

const emptyDay = (day) => ({ day, pages: {}, games: Object.fromEntries(GAMES.map(g => [g, { play: 0, done: 0 }])) })
const whole = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0)

// A day's file, read with care: only the page names given and the
// arcade's games come through, each a whole number.
export function readDay(raw, day, pageNames = []) {
  const out = emptyDay(day)
  for (const name of pageNames) {
    const n = whole(raw?.pages?.[name])
    if (n) out.pages[name] = n
  }
  for (const g of GAMES) out.games[g] = { play: whole(raw?.games?.[g]?.play), done: whole(raw?.games?.[g]?.done) }
  return out
}

export const dayTotal = (d) => Object.values(d.pages).reduce((a, b) => a + b, 0)

// The days before one, newest first: '2026-11-12' and 2 gives
// ['2026-11-12', '2026-11-11'].
export function daysBack(day, count) {
  const [y, m, d] = day.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10))
}

// store   where the numbers are kept (server/store.js)
// pages   the names a page may be counted under
export function createCounts({ store = createStore(), pages = [], now = () => Date.now(), log = console } = {}) {
  const names = new Set(pages)
  const kept = new Map()
  let today = null
  let dirty = false
  let loading = null
  let recent = []

  const fileOf = (day) => `counts/${day}`
  const load = async (day) => readDay(await store.read(fileOf(day)), day, pages)
  const save = (d) => store.write(fileOf(d.day), { pages: { ...d.pages }, games: structuredClone(d.games) })

  // Today's totals, picked up from the file the first time and when the
  // day changes. What was counted while they loaded is added on.
  function day() {
    const d = londonDay(now())
    if (today && today.day === d) return today
    const before = today
    today = emptyDay(d)
    if (before && dirty) save(before).catch(err => log.warn?.(`Numbers: ${err.message}`))
    dirty = false
    const fresh = today
    loading = load(d).then((was) => {
      for (const [name, n] of Object.entries(was.pages)) fresh.pages[name] = (fresh.pages[name] || 0) + n
      for (const g of GAMES) for (const m of MOMENTS) fresh.games[g][m] += was.games[g][m]
    }).catch(err => log.warn?.(`Numbers: ${err.message}`)).finally(() => { loading = null })
    return today
  }

  return {
    on: true,

    // A page was looked at. name must be one of the names given.
    page(name) {
      if (!names.has(name)) return false
      const d = day()
      d.pages[name] = (d.pages[name] || 0) + 1
      dirty = true
      return true
    },

    // A game was started ('play') or finished ('done').
    game(game, moment) {
      if (!GAMES.includes(game) || !MOMENTS.includes(moment)) return false
      recent = recent.filter(at => now() - at < 60 * 1000)
      if (recent.length >= TALLIES_A_MINUTE) return false
      recent.push(now())
      day().games[game][moment] += 1
      dirty = true
      return true
    },

    // Writes today's totals out, if they have changed.
    async flush() {
      if (!today || !dirty) return false
      if (loading) await loading
      dirty = false
      try {
        await save(today)
        return true
      } catch (err) {
        dirty = true
        throw err
      }
    },

    // The last `count` days, newest first, today's as they stand now.
    async days(count = 30) {
      const current = day()
      if (loading) await loading
      const out = []
      for (const d of daysBack(current.day, count)) {
        if (d === current.day) { out.push(structuredClone(current)); continue }
        const hit = kept.get(d)
        if (hit) { out.push(hit); continue }
        const got = await load(d)
        // A day that is over does not change, so it is read once.
        kept.set(d, got)
        out.push(got)
      }
      return out
    },
  }
}
