// The stall's TV screen (server/render/tv.js draws it whole).
//
// What this adds: the leaderboards take turns on the screen, a few
// seconds each, and are asked for again every quarter of a minute, so
// the screen follows the fayre with no one touching it. After every
// three leaderboards the appeal the stall is in aid of fills the screen
// for ten seconds, with its code to scan to donate. If the stall's
// wifi drops, what is on the screen stays and it is asked for again. If
// the site has been deployed again since the page was opened, the page
// reloads itself, once the site has answered. It also asks the screen
// to stay awake, where a browser lets it.
//
// Nothing is sent anywhere: it only reads the day's leaderboards.

import { footballTv } from '../shared/prizes.js'

export const ROTATE_MS = 9000
export const REFRESH_MS = 15000
export const TOP = 10
// The appeal's turn: how long it is on the screen, and how many
// leaderboards are shown between its turns. Ten seconds in every
// thirty-seven (John asked for about ten in every forty).
export const APPEAL_MS = 10000
export const APPEAL_EVERY = 3

// A board's rows as they will be written: three capital letters and a
// whole score each, ten at most. Anything else is left out.
export function cleanEntries(entries) {
  const out = []
  for (const e of Array.isArray(entries) ? entries : []) {
    const initials = String(e?.initials ?? '')
    const score = Number(e?.score)
    if (!/^[A-Z]{3}$/.test(initials) || !Number.isInteger(score) || score < 1 || score > 99999) continue
    out.push({ initials, score })
    if (out.length >= TOP) break
  }
  return out
}

// How the football stands, from what the site answers, read with the
// same care: { closed, leader } with a leader of three capital letters
// and a whole score, or none. Null for anything else.
export function cleanFootball(f) {
  if (!f || typeof f !== 'object') return null
  const leader = cleanEntries(f.leader ? [f.leader] : [])[0] || null
  return { closed: f.closed === true, leader }
}

// The board after this one, round and round.
export const nextBoard = (at, count) => (count > 0 ? (at + 1) % count : 0)

// What the screen shows, a turn at a time: { board, appeal, since }.
//   board    the leaderboard that is on, or was last on while the appeal is
//   appeal   whether the appeal fills the screen
//   since    how many leaderboards have had a turn since the appeal did
// The leaderboards go round in their order, and the appeal takes a turn
// after every APPEAL_EVERY of them, where the page has one.
export const firstTurn = (board = 0) => ({ board, appeal: false, since: 1 })
export function nextTurn(turn, count, hasAppeal = true) {
  if (turn.appeal) return { board: nextBoard(turn.board, count), appeal: false, since: 1 }
  if (hasAppeal && turn.since >= APPEAL_EVERY) return { board: turn.board, appeal: true, since: 0 }
  return { board: nextBoard(turn.board, count), appeal: false, since: turn.since + 1 }
}
// How long a turn lasts.
export const turnMs = (turn) => (turn.appeal ? APPEAL_MS : ROTATE_MS)

export function startTv(root, win = globalThis.window) {
  const doc = win.document
  const sections = [...root.querySelectorAll('[data-tv-board]')]
  const dots = [...(root.querySelector('[data-tv-dots]')?.children || [])]
  const dayEl = root.querySelector('[data-tv-day]')
  const appeal = root.querySelector('[data-tv-appeal]')
  const version = root.getAttribute('data-version') || ''
  let turn = firstTurn(Math.max(0, sections.findIndex(s => s.classList.contains('on'))))
  let timer = null

  function show(i) {
    sections.forEach((s, n) => s.classList.toggle('on', n === i))
    dots.forEach((d, n) => d.classList.toggle('on', n === i))
  }

  // A turn is put on the screen, and the one after it is set to follow.
  function take(next) {
    turn = next
    appeal?.classList.toggle('on', turn.appeal)
    show(turn.board)
    timer = win.setTimeout(() => take(nextTurn(turn, sections.length, Boolean(appeal))), turnMs(turn))
  }

  // Writes a board's rows, made with createElement so nothing read from
  // the network is ever treated as markup.
  function fill(section, entries) {
    const list = section.querySelector('.tvl')
    const empty = section.querySelector('.tve')
    if (!list) return
    const rows = cleanEntries(entries).map((e, i) => {
      const li = doc.createElement('li')
      for (const [cls, text] of [['n', i + 1], ['i', e.initials], ['s', e.score]]) {
        const span = doc.createElement('span')
        span.className = cls
        span.textContent = String(text)
        li.append(span)
      }
      return li
    })
    list.replaceChildren(...rows)
    list.hidden = rows.length === 0
    if (empty) empty.hidden = rows.length > 0
  }

  let reloading = false
  async function refresh() {
    if (reloading) return
    try {
      const res = await win.fetch('/api/boards', { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      // The site has been deployed again: this page is an old one. The
      // site has just answered, so asking for the page again is safe.
      if (version && typeof data.version === 'string' && data.version && data.version !== version) {
        reloading = true
        win.location.reload()
        return
      }
      if (dayEl && typeof data.name === 'string') dayEl.textContent = data.name.slice(0, 40)
      for (const b of Array.isArray(data.boards) ? data.boards : []) {
        const section = sections.find(s => s.getAttribute('data-tv-board') === b?.key)
        if (!section) continue
        fill(section, b.entries)
        // The football's line, on the board that has one.
        const line = section.querySelector('[data-tv-football]')
        const football = cleanFootball(b.football)
        if (line && football) {
          line.textContent = footballTv(football)
          line.classList.toggle('won', football.closed && Boolean(football.leader))
        }
      }
    } catch { /* the wifi dropped: what is on the screen stays, and it is asked for again */ }
  }

  // The screen is asked to stay awake while the page is on it.
  const awake = () => { try { win.navigator.wakeLock?.request('screen').catch(() => {}) } catch { /* not here: the screen's own setting stands */ } }
  const onVisible = () => { if (doc.visibilityState === 'visible') { awake(); refresh() } }

  take(turn)
  const poll = win.setInterval(refresh, REFRESH_MS)
  doc.addEventListener('visibilitychange', onVisible)
  awake()
  refresh()

  return {
    refresh,
    stop() {
      win.clearTimeout(timer)
      win.clearInterval(poll)
      doc.removeEventListener('visibilitychange', onVisible)
    },
  }
}
