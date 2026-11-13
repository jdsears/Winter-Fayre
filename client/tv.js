// The stall's TV screen (server/render/tv.js draws it whole).
//
// What this adds: the leaderboards take turns on the screen, a few
// seconds each, and are asked for again every quarter of a minute, so
// the screen follows the fayre with no one touching it. If the stall's
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

export function startTv(root, win = globalThis.window) {
  const doc = win.document
  const sections = [...root.querySelectorAll('[data-tv-board]')]
  const dots = [...(root.querySelector('[data-tv-dots]')?.children || [])]
  const dayEl = root.querySelector('[data-tv-day]')
  const version = root.getAttribute('data-version') || ''
  let at = Math.max(0, sections.findIndex(s => s.classList.contains('on')))

  function show(i) {
    at = i
    sections.forEach((s, n) => s.classList.toggle('on', n === i))
    dots.forEach((d, n) => d.classList.toggle('on', n === i))
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

  show(at)
  const rotate = win.setInterval(() => show(nextBoard(at, sections.length)), ROTATE_MS)
  const poll = win.setInterval(refresh, REFRESH_MS)
  doc.addEventListener('visibilitychange', onVisible)
  awake()
  refresh()

  return {
    refresh,
    stop() {
      win.clearInterval(rotate)
      win.clearInterval(poll)
      doc.removeEventListener('visibilitychange', onVisible)
    },
  }
}
