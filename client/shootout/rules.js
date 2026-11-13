// The rules of a penalty shootout, kept pure so they can be tested on
// their own: five kicks each taken in turn, finished early as soon as one
// side cannot catch the other, then sudden death a round at a time.
//
// A shootout is { first, kicks }: who kicked first ('us' or 'them') and
// each kick in order as { side, scored }. Nothing here reads the clock,
// the page or a random number.
//
// A shootout made with full: true is never finished early: both sides
// take all five kicks, so every visitor has the same five to score from
// and the same five to save. The arcade plays it this way, for its
// leaderboard and its prize.

export const KICKS_EACH = 5
export const SIDES = ['us', 'them']

export const other = (side) => (side === 'us' ? 'them' : 'us')

export function newShootout({ first = 'us', full = false } = {}) {
  return full ? { first, kicks: [], full: true } : { first, kicks: [] }
}

export function tally(state) {
  const t = { us: 0, them: 0, usTaken: 0, themTaken: 0 }
  for (const k of state.kicks) {
    t[`${k.side}Taken`] += 1
    if (k.scored) t[k.side] += 1
  }
  return t
}

// The number of kicks each side will have taken when the round in play
// is complete: five, or more once sudden death has started.
function roundLength(t) {
  return Math.max(KICKS_EACH, t.usTaken, t.themTaken)
}

// Who has won, if anyone: a side wins once the other cannot reach its
// score with the kicks it has left in this round.
export function winner(state) {
  const t = tally(state)
  // All five each are taken before anyone has won.
  if (state.full && Math.min(t.usTaken, t.themTaken) < KICKS_EACH) return null
  const n = roundLength(t)
  const leftUs = n - t.usTaken
  const leftThem = n - t.themTaken
  if (t.us > t.them + leftThem) return 'us'
  if (t.them > t.us + leftUs) return 'them'
  return null
}

export function isOver(state) {
  return winner(state) !== null
}

// Sudden death: level after five each. A shootout settled by the tenth
// kick never reached it.
export function isSuddenDeath(state) {
  const n = state.kicks.length
  if (n < KICKS_EACH * 2) return false
  return n > KICKS_EACH * 2 || !isOver(state)
}

// Whose kick is next, or null once it is over.
export function nextSide(state) {
  if (isOver(state)) return null
  return state.kicks.length % 2 === 0 ? state.first : other(state.first)
}

// The round the next kick belongs to, from 1.
export function roundOf(state) {
  return Math.floor(state.kicks.length / 2) + 1
}

export function addKick(state, scored) {
  const side = nextSide(state)
  if (!side) throw new Error('The shootout is already over')
  return { ...state, kicks: [...state.kicks, { side, scored: Boolean(scored) }] }
}

// Whether the next kick settles it either way, and how: what the result
// would be if it went in, and if it did not.
export function stakes(state) {
  const side = nextSide(state)
  if (!side) return null
  const ifScored = winner(addKick(state, true))
  const ifMissed = winner(addKick(state, false))
  return { side, ifScored, ifMissed, deciding: Boolean(ifScored || ifMissed) }
}

// The classic tracker: a row of five dots for each side, each filled for
// a goal, crossed for a miss or empty, with the next kick's dot marked.
// In sudden death the rows start again at the first sudden death round,
// five at a time.
export function trackerRows(state) {
  const sudden = isSuddenDeath(state)
  const next = nextSide(state)
  const rows = { us: [], them: [] }
  for (const side of SIDES) {
    const kicks = state.kicks.filter((k) => k.side === side)
    let start = 0
    if (sudden) {
      const sdTaken = Math.max(0, kicks.length - KICKS_EACH)
      // The page of five that holds this side's latest or next kick.
      const sdIndex = next === side ? sdTaken : Math.max(0, sdTaken - 1)
      start = KICKS_EACH + Math.floor(sdIndex / KICKS_EACH) * KICKS_EACH
    }
    for (let i = 0; i < KICKS_EACH; i++) {
      const kick = kicks[start + i]
      const isNext = !kick && next === side && start + i === kicks.length
      rows[side].push(kick ? (kick.scored ? 'scored' : 'missed') : isNext ? 'next' : 'empty')
    }
  }
  return { suddenDeath: sudden, rows }
}

// "5 to 4": the site has no en dash for scores, so the words carry it.
export function scoreWords(a, b) {
  return `${a} to ${b}`
}

export function resultLine(state) {
  const t = tally(state)
  const w = winner(state)
  if (w === 'us') return `You won the shootout ${scoreWords(t.us, t.them)}`
  if (w === 'them') return `You lost the shootout ${scoreWords(t.us, t.them)}`
  return null
}

// The score after a kick, in words, from the visitor's side: who leads,
// or level.
export function standing(state, opponentName) {
  const t = tally(state)
  if (t.us === t.them) return `Level at ${t.us} each.`
  if (t.us > t.them) return `You lead ${scoreWords(t.us, t.them)}.`
  return `${opponentName} lead ${scoreWords(t.them, t.us)}.`
}
