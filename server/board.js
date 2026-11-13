// The games' leaderboards: one for each game, for the day.
//
// What it keeps: three letters, a score and the time, for the fifty best
// goes of the day. Nothing else: no name, no address, nothing about the
// device. A new board starts each day (UK time), and the day before's is
// deleted when it does, so nothing is kept after the fayre.
//
// Where it is kept: in this service's memory, and in one small file a
// game a day (boards/keepy-2026-11-14.json) when the service has a
// folder to write to (server/store.js). No database, no bucket.
//
// What it guards against:
//   Anything but three letters A to Z, and three letters that spell
//   something rude (BLOCKED): refused.
//   Made-up scores: a go needs a ticket this service handed out, each
//   ticket is used once, and a score higher than the time since the
//   ticket allows is refused. This stops the casual cheat, not a
//   determined one, which is why an entry can be taken off (remove).
//   A flood: a fixed number of new entries a minute, for everyone.
//
// A run that is still going (head to head): a run of wins can be added
// after any win, and the entry grows with the run. The answer to an add
// carries a ticket that names the entry just made (its letters and
// score, signed); the next add with that ticket takes the old entry's
// place, by three wins at most and no faster than matches can be won.
// Nothing more is kept with an entry for this: the ticket is held by
// the visitor's browser, not by the site.

import crypto from 'node:crypto'
import { createStore } from './store.js'
import { GAMES } from '../shared/games.js'
import { FOOTBALL } from '../shared/prizes.js'

export const BOARD_SIZE = 50
export const TICKET_MAX_AGE_MS = 3 * 60 * 60 * 1000
export const ADDS_A_MINUTE = 30
// A ticket that names a run's entry lasts the day, and the most a run
// may grow between two adds.
export const RUN_TICKET_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const RUN_STEP = 3

// Three letters that are not let on the board.
export const BLOCKED = new Set(`
ASS ARS ANL BUM BJS BJJ BOO COC COK CUM CNT CUN DIK DIC DCK DIE DIX FAG FAP FCK FUC FUK FKU FKN FFS FML FUX GAZ HOE HOR JIZ JIS
KKK KOK KUM KYS KNT NAZ NIG NGR NOB PAK PED PIS POO PRK PUS RAP SEX SHT SHI SLT SUK SUC TIT TWT VAG WNK WTF WOG XXX
`.split(/\s+/).filter(Boolean))

// Three capital letters, or null.
export function cleanInitials(value) {
  const v = String(value ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(v) || BLOCKED.has(v)) return null
  return v
}

const LONDON = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
// '2026-11-14' in the UK.
export const londonDay = (ms) => LONDON.format(new Date(ms))
// The moment a time of day falls on a day in the UK: '2026-11-14' and
// '13:30' give that half past one, summer time or winter.
const LONDON_CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function londonMoment(day, time) {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  // As if the UK kept to UTC, then put right by however far its clocks
  // stand from it at that moment.
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const p = Object.fromEntries(LONDON_CLOCK.formatToParts(new Date(guess)).map(part => [part.type, part.value]))
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
  return guess - (shown - guess)
}

// 'Saturday 14 November'.
export function dayName(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))).replace(',', '')
}

// A file's entries, read with care: only three letters, a whole score
// and a time are kept, best first, fifty at most.
export function readEntries(raw, maxScore = 1000) {
  const list = Array.isArray(raw?.entries) ? raw.entries : []
  const out = []
  for (const e of list) {
    const i = cleanInitials(e?.i)
    const s = Number(e?.s)
    if (!i || !Number.isInteger(s) || s < 1 || s > maxScore) continue
    out.push({ i, s, t: Number.isInteger(e?.t) && e.t > 0 ? e.t : null })
  }
  // Best first; of two the same, the earlier stays ahead (the sort is stable).
  return out.sort((a, b) => b.s - a.s).slice(0, BOARD_SIZE)
}

// store                where it is kept (server/store.js)
// name                 the board's name in its file: a game's key
// maxScore             the highest score it will take
// perSecond, slack     how fast a score can honestly be made: a score over
//                      slack + perSecond for each second since the ticket is refused
// runs                 an entry can grow: an add answers with a ticket for its entry
// ticketKey            what tickets are signed with
// football  { until: '13:30' } for the board whose leader at that time
//           of day wins the football (shared/prizes.js), or null
export function createBoard({ store = createStore(), name = 'keepy', maxScore = 1000, perSecond = 2.5, slack = 2, runs = false, football = null, now = () => Date.now(), ticketKey = store.secret() } = {}) {
  const used = new Map()
  let queue = Promise.resolve()
  let recent = []
  let lastDay = null

  const fileOf = (day) => `boards/${name}-${day}`

  // Today, and the first time a new day is seen the days before are
  // deleted, for every game.
  function today() {
    const day = londonDay(now())
    if (day !== lastDay) {
      lastDay = day
      store.prune('boards', n => n.endsWith(`-${day}`)).catch(() => {})
    }
    return day
  }

  const load = async (day) => readEntries(await store.read(fileOf(day)), maxScore)
  const save = (day, entries) => store.write(fileOf(day), { entries })

  const sign = (...parts) => crypto.createHmac('sha256', ticketKey).update([name, ...parts].join('.')).digest('base64url').slice(0, 22)

  // A ticket for one go: when it was handed out, signed. With an entry,
  // it also names that entry (its letters and score), for a run to grow.
  function ticket(entry = null) {
    const t = now().toString(36)
    const nonce = crypto.randomBytes(9).toString('base64url')
    if (entry) return `${t}.${nonce}.${entry.i}.${entry.s}.${sign(t, nonce, entry.i, entry.s)}`
    return `${t}.${nonce}.${sign(t, nonce)}`
  }

  // When a ticket was handed out, or null for one that is not ours, is
  // too old or has been used.
  function ticketTime(value) {
    const m = /^([0-9a-z]{6,12})\.([\w-]{12})\.(?:([A-Z]{3})\.([1-9]\d{0,3})\.)?([\w-]{22})$/.exec(String(value ?? ''))
    if (!m) return null
    const was = m[3] ? { i: m[3], s: Number(m[4]) } : null
    if (was && !runs) return null
    const want = Buffer.from(was ? sign(m[1], m[2], m[3], m[4]) : sign(m[1], m[2]))
    if (!crypto.timingSafeEqual(Buffer.from(m[5]), want)) return null
    const at = parseInt(m[1], 36)
    const age = now() - at
    const life = was ? RUN_TICKET_MAX_AGE_MS : TICKET_MAX_AGE_MS
    if (!(age >= 0 && age <= life) || used.has(m[2])) return null
    return { at, nonce: m[2], was, life }
  }

  const shown = (entries) => entries.map(e => ({ initials: e.i, score: e.s }))

  // The football. An entry counts if it was added by the cut-off; the
  // best of those leads, and once the cut-off has passed has won. The
  // winner's code is four digits made from the entry and this service's
  // own secret: the phone that added the entry is told it, and the
  // numbers page shows it, so the stall can tell the winner from someone
  // who only says so. Nothing is kept for it.
  const cutoff = (day) => (football ? londonMoment(day, football.until) : null)
  const codeOf = (day, e) => String(crypto.createHmac('sha256', ticketKey).update(['football', name, day, e.i, e.s, e.t].join('.')).digest().readUInt32BE(0) % 10000).padStart(4, '0')
  const leading = (day, entries) => entries.find(e => e.t !== null && e.t <= cutoff(day)) || null
  const footballOf = (day, entries) => {
    if (!football) return {}
    const lead = leading(day, entries)
    return { football: { until: football.until, closed: now() > cutoff(day), leader: lead ? { initials: lead.i, score: lead.s } : null } }
  }

  return {
    on: true,
    name,
    ticket,

    // { day, name, entries: [{ initials, score }] }, best first. On the
    // football's board, also { football: { until, closed, leader } }.
    async top() {
      const day = today()
      const entries = await load(day)
      return { day, name: dayName(day), entries: shown(entries), ...footballOf(day, entries) }
    },

    // The football's leader with the winner's code, for the numbers page
    // alone: { until, closed, leader: { initials, score, at, code } | null },
    // or null on a board with no football.
    async winner() {
      if (!football) return null
      const day = today()
      const lead = leading(day, await load(day))
      return { until: football.until, closed: now() > cutoff(day), leader: lead ? { initials: lead.i, score: lead.s, at: lead.t, code: codeOf(day, lead) } : null }
    },

    // { ok: true, rank, day, name, entries } or { ok: false, reason }:
    // 'initials', 'score', 'ticket', 'busy' or 'low' (not in the fifty).
    add({ initials, score, ticket: given }) {
      const i = cleanInitials(initials)
      if (!i) return Promise.resolve({ ok: false, reason: 'initials' })
      if (!Number.isInteger(score) || score < 1 || score > maxScore) return Promise.resolve({ ok: false, reason: 'score' })
      const t = ticketTime(given)
      if (!t) return Promise.resolve({ ok: false, reason: 'ticket' })
      // A run that has grown since its ticket takes its old entry's place;
      // anything else is a new entry, counted from nothing.
      const grown = t.was && score > t.was.s ? t.was : null
      const honest = ((now() - t.at) / 1000) * perSecond + slack
      if (score - (grown ? grown.s : 0) > (grown ? Math.min(RUN_STEP, honest) : honest)) return Promise.resolve({ ok: false, reason: 'score' })
      recent = recent.filter(at => now() - at < 60 * 1000)
      if (recent.length >= ADDS_A_MINUTE) return Promise.resolve({ ok: false, reason: 'busy' })
      recent.push(now())
      used.set(t.nonce, t.at + t.life)
      for (const [n, until] of used) if (now() > until) used.delete(n)
      // One change at a time: read the board as it is now, add, write.
      const work = queue.then(async () => {
        const day = today()
        const all = await load(day)
        // The run's old entry, if it is still there, makes way.
        const old = grown ? all.findIndex(e => e.i === grown.i && e.s === grown.s) : -1
        const before = old < 0 ? all : all.filter((_, n) => n !== old)
        // Of two scores the same, the earlier stays ahead.
        const rank = before.filter(e => e.s >= score).length + 1
        if (rank > BOARD_SIZE) return { ok: false, reason: 'low' }
        const entry = { i, s: score, t: now() }
        const entries = readEntries({ entries: [...before, entry] }, maxScore)
        await save(day, entries)
        // An entry added in time for the football is told its code, for
        // the phone that added it to keep.
        const inTime = football && entry.t <= cutoff(day)
        return { ok: true, rank, day, name: dayName(day), entries: shown(entries), ...footballOf(day, entries), ...(inTime ? { claim: codeOf(day, entry) } : {}), ...(runs ? { ticket: ticket({ i, s: score }) } : {}) }
      })
      // A go that could not be kept can be sent again with its ticket.
      queue = work.catch(() => { used.delete(t.nonce) })
      return work
    },

    // Takes an entry off today's board: the one at a place (1 is the
    // top) whose letters and score are the ones given, so a board that
    // has changed since it was looked at never loses the wrong entry.
    remove({ place, initials, score }) {
      const work = queue.then(async () => {
        const day = today()
        const all = await load(day)
        const at = Number(place) - 1
        const hit = all[at]
        if (!hit || hit.i !== String(initials) || hit.s !== Number(score)) return { ok: false }
        const entries = all.filter((_, n) => n !== at)
        await save(day, entries)
        return { ok: true, entries: shown(entries), ...footballOf(day, entries) }
      })
      queue = work.catch(() => {})
      return work
    },
  }
}

// A board for every game in the arcade, by the game's key.
export function createBoards({ store = createStore(), now = () => Date.now(), ticketKey = store.secret() } = {}) {
  const boards = {}
  for (const g of GAMES) boards[g.key] = createBoard({ store, name: g.key, now, ticketKey, ...g.board, football: g.key === FOOTBALL.game ? { until: FOOTBALL.until } : null })
  return boards
}
