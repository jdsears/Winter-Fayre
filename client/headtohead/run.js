// The run of wins that is on the leaderboard: the three letters it was
// added under, the count, and the ticket the site gave for it, which lets
// the next win take the entry's place (server/board.js). Kept on this
// device beside the run itself, so a run carried on another day still
// grows on the board. It is cleared when the run ends.

export const RUN_KEY = 'winterfayre:headtohead:run'

// The kept run, if it is one for a run of this many wins.
export function readRun(store, streak) {
  try {
    const r = JSON.parse(store?.getItem(RUN_KEY) || 'null')
    if (!r || typeof r.ticket !== 'string' || r.ticket.length > 120 || !/^[A-Z]{3}$/.test(r.initials)) return null
    if (!Number.isInteger(r.score) || r.score < 1 || r.score !== streak) return null
    return { ticket: r.ticket, initials: r.initials, score: r.score }
  } catch {
    return null
  }
}

export function keepRun(store, run) {
  try {
    if (run) store?.setItem(RUN_KEY, JSON.stringify({ ticket: run.ticket, initials: run.initials, score: run.score }))
    else store?.removeItem(RUN_KEY)
  } catch { /* a browser that keeps nothing still plays */ }
}

// Where a run sits on a board as it is shown, counting from 1, or 0.
export function placeOf(entries, run) {
  if (!run) return 0
  return entries.findIndex(e => e.initials === run.initials && e.score === run.score) + 1
}
