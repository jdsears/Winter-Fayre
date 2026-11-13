// The prizes: the sweets, and the football.
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
  // Rugby: kicks over the bar and between the posts, of five.
  rugby: { at: 4, target: 'kick 4 of your 5 conversions' },
  // Netball: goals in the thirty seconds.
  netball: { at: 8, target: 'score 8 goals in 30 seconds' },
  // Cricket: runs from the six balls. 80% of the 36 there are is 28.8:
  // 28 is the nearest score that can be made without a single.
  cricket: { at: 28, target: 'score 28 runs from your six balls' },
}

// What the finish panel says to a winner. John's words.
export const PRIZE_WORDS = 'Show this screen at the sports stall to claim a sweet.'

// One sweet each (John, 13 November 2026). The first go on a phone that
// reaches its game's number wins the sweet, and the phone remembers it
// for the day: later goes are told so. At the stall the helper taps
// "sweet given" on the winner's phone, so one winning screen cannot be
// shown twice. All of this is kept on the phone alone
// (client/games/prize.js): the site knows nothing of who has won.
export const ONE_EACH = 'One sweet each.'

// The football (John, 13 November 2026). Aside from the sweets, the best
// keepy-uppies score of the day wins a FIFA approved football. A score
// counts once it is on the leaderboard, and whoever leads at the cut-off
// (UK time) has won it. The leaderboard carries on after that, for
// sweets and for fun.
export const FOOTBALL = {
  game: 'keepy',
  until: '13:30',
  said: '1:30pm',
  prize: 'a FIFA approved football',
}

// "Best score on the leaderboard by 1:30pm wins a FIFA approved football."
export const footballLine = () => `Best score on the leaderboard by ${FOOTBALL.said} wins ${FOOTBALL.prize}.`

// The football in one line, for the stall's TV, where the leaderboard
// under it already shows who leads.
export function footballTv(state) {
  if (state?.closed) return footballWords(state)
  return `${FOOTBALL.prize.replace(/^a /, 'A ')} for the best score by ${FOOTBALL.said}`
}

// What is said of the football, from what the leaderboard answers
// ({ closed, leader: { initials, score } | null }): who leads while it is
// open, and who won once it has closed.
export function footballWords(state) {
  if (!state) return footballLine()
  const { closed, leader } = state
  if (!closed) return leader ? `${footballLine()} Leading now: ${leader.initials} with ${leader.score}.` : footballLine()
  return leader
    ? `The football is won: ${leader.initials} with ${leader.score}. Come to the sports stall.`
    : `The football was not won: no score was on the leaderboard by ${FOOTBALL.said}.`
}

// The football at the head of the arcade page (John, 13 November 2026):
// what it is and how it is won, while it can be, and who has won it once
// it has closed. game is the name of the game it is won in, as it is
// written in the middle of a sentence ("keepy-uppies"). Nothing, once it
// has closed with no score on the leaderboard: there is no prize left to
// tell of.
export function footballHero(state, game) {
  if (state?.closed) return state.leader ? footballWords(state) : ''
  return `The best ${game} score on the leaderboard by ${FOOTBALL.said} wins ${FOOTBALL.prize}.`
}

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
