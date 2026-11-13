// The football on this phone (shared/prizes.js sets the game and the
// cut-off; server/board.js says who leads).
//
// The best keepy-uppies score on the leaderboard at the cut-off wins the
// football. The leaderboard shows three letters and a score, and anyone
// could say those letters are theirs. So when a phone adds a score in
// time, the site hands it a four digit code for that entry, and the
// phone keeps it. If that entry wins, the phone says so and shows the
// code; the stall's numbers page shows the same code, and the two are
// compared. The code is kept on the phone alone.

import { FOOTBALL, footballWords } from '../../shared/prizes.js'

export const CLAIMS_KEY = 'winterfayre:football'
const MOST = 12

// The entries this phone has added today, each with its code:
// [{ initials, score, claim }]. day is the leaderboard's own day.
export function readClaims(store, day) {
  try {
    const raw = JSON.parse(store?.getItem(CLAIMS_KEY) || 'null')
    if (!raw || raw.day !== day || !Array.isArray(raw.entries)) return []
    return raw.entries.filter(e => /^[A-Z]{3}$/.test(e?.initials) && Number.isInteger(e?.score) && /^\d{4}$/.test(e?.claim)).map(e => ({ initials: e.initials, score: e.score, claim: e.claim }))
  } catch {
    return []
  }
}

// Keeps an entry's code. The best few of the day are kept: only the best
// can win.
export function keepClaim(store, day, entry) {
  if (!/^[A-Z]{3}$/.test(entry?.initials) || !Number.isInteger(entry?.score) || !/^\d{4}$/.test(entry?.claim)) return false
  const entries = [...readClaims(store, day), { initials: entry.initials, score: entry.score, claim: entry.claim }].sort((a, b) => b.score - a.score).slice(0, MOST)
  try {
    store?.setItem(CLAIMS_KEY, JSON.stringify({ day, entries }))
    return true
  } catch {
    return false
  }
}

// What to say of the football on this phone, from what the leaderboard
// answers (state: { closed, leader: { initials, score } | null }) and
// the codes the phone holds: { words, mine, won, code }. Null where the
// board has no football.
export function footballFor(state, claims = []) {
  if (!state) return null
  const mine = state.leader ? claims.find(c => c.initials === state.leader.initials && c.score === state.leader.score) || null : null
  if (mine && state.closed) return { mine: true, won: true, code: mine.claim, words: `You have won the football. Show this screen at the sports stall. Winner's code ${mine.claim}.` }
  if (mine) return { mine: true, won: false, code: mine.claim, words: `You are leading for the football with ${state.leader.score}. If no one beats it by ${FOOTBALL.said} it is yours. Keep this phone: it holds your winner's code.` }
  return { mine: false, won: false, code: null, words: footballWords(state) }
}
