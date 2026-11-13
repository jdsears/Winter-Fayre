// The sweets.
//
// A visitor whose score reaches a game's number here is told, on that
// game's finish panel, to show their screen at the sports stall. This is
// the one place the numbers are set: change a number here and the finish
// panel, the arcade's tile and the TV all follow.
//
// John asked for them to be harder than first suggested: 80% (13
// November 2026). Where a game has a fixed number of tries that is four
// in five. Where it has none, the first suggestion is doubled.
//
//   at       the score that wins a sweet, or more
//   target   what that is, in words, to finish "Win a sweet:"

export const PRIZES = {
  // Goals from your own five penalties. Sudden death does not count.
  penalties: { at: 4, target: 'score 4 of your 5 penalties' },
  // Keepy-uppies in one go.
  keepy: { at: 20, target: 'do 20 keepy-uppies' },
  // Goals from the ten free kicks.
  freekick: { at: 8, target: 'score 8 of your 10 free kicks' },
  // Head to head: 1 is a win.
  headtohead: { at: 1, target: 'win your match' },
}

// What the finish panel says to a winner. John's words.
export const PRIZE_WORDS = 'Show this screen at the sports stall to claim a sweet.'

// Whether a score wins a sweet in a game.
export function wonPrize(game, score) {
  const p = PRIZES[game]
  return Boolean(p && Number.isFinite(score) && score >= p.at)
}

// What to say of a go, for the finish panel: { won, words } or null for
// a game with no prize. A winner is told to show the screen; anyone else
// is told what to aim for.
export function prizeFor(game, score) {
  const p = PRIZES[game]
  if (!p) return null
  const won = wonPrize(game, score)
  return { won, words: won ? PRIZE_WORDS : `Win a sweet: ${p.target}.` }
}

// "Win a sweet: do 20 keepy-uppies." for a tile or the TV, or null.
export function prizeLine(game) {
  const p = PRIZES[game]
  return p ? `Win a sweet: ${p.target}.` : null
}
