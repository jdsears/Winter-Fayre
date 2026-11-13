// Cricket smash: the rules, with no drawing and no browser in them.
//
// An over of six balls. The bowler runs in and bowls; a tap swings the
// bat, once a ball. What the swing is worth depends on how near it is to
// the moment the ball reaches the bat: a six when it is all but exact,
// then a four, two, one, and a touch that scores nothing. A swing far
// too early misses. So does one too late: the stumps stand close behind
// the bat, and a ball that has reached them cannot be hit. A miss at a
// ball that is on the stumps is bowled, and the next batter comes in; a
// miss at a ball wide of them is a dot ball. Either way all six balls
// are bowled, and the score is the runs.
//
// It is harder as it goes: the balls get quicker, more of them are on
// the stumps, and from the fourth ball on a slower one may be slipped in
// to catch a batter who has got used to the pace.
//
// Times are in seconds. A delivery's flight is counted from 0 as it
// leaves the bowler's hand to 1 as it reaches the bat, and on past it.

export const BALLS = 6
export const MOST = BALLS * 6
export const G = 9.81

// How near the right moment a swing must be, either side, for each
// result: within the first it is a six, within the second a four, and so
// on down to a touch. Outside the last it has missed.
export const TIMING = { six: 0.055, four: 0.115, two: 0.17, one: 0.225, touch: 0.3 }
export const RUNS = { six: 6, four: 4, two: 2, one: 1, touch: 0 }

// The stumps stand behind the bat. A ball that is not hit goes on past
// the bat and reaches them when it has gone this much further again
// than the way from the hand to the bat (BEYOND). The bat can get to it
// for most of that way (REACH); after that a swing is too late.
export const BEYOND = 0.114
export const REACH = 0.1

// How late a swing at a delivery can be, in seconds, and still meet it;
// and how long after it passes the bat the ball is at the stumps.
export const lateFor = (d) => Math.round(d.time * REACH * 1000) / 1000
export const stumpsAfter = (d) => d.time * BEYOND

// What a swing is worth, by how far it was from the moment the ball
// reached the bat (seconds, below nought for early): 'six', 'four',
// 'two', 'one', 'touch' or 'miss'. No swing at all (null) is a miss, and
// so is one later than `late`.
export function judge(delta, late = TIMING.touch) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return 'miss'
  if (delta > late) return 'miss'
  const off = Math.abs(delta)
  for (const kind of ['six', 'four', 'two', 'one', 'touch']) if (off <= TIMING[kind]) return kind
  return 'miss'
}

// What becomes of a ball: { kind, runs, out }. kind is the swing's worth,
// or for a miss 'bowled' (it was on the stumps) or 'dot' (it was not).
export function result(delivery, delta) {
  const kind = judge(delta, lateFor(delivery))
  if (kind !== 'miss') return { kind, runs: RUNS[kind], out: false }
  return delivery.straight ? { kind: 'bowled', runs: 0, out: true } : { kind: 'dot', runs: 0, out: false }
}

// A word on a swing's timing, to learn from. Nothing for a six.
export function timingWord(kind, delta) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return 'Tap to swing the bat'
  if (kind === 'six') return ''
  const way = delta < 0 ? 'early' : 'late'
  if (kind === 'four') return `A little ${way}`
  if (kind === 'dot' || kind === 'bowled') return `Too ${way}`
  return way === 'early' ? 'Early' : 'Late'
}

// The six balls' making: how long each is in the air (from, to), how
// likely it is to be on the stumps, how likely to be a slower ball, and
// how long the bowler's run up is.
export const OVER = [
  { time: [1.15, 1.25], straight: 0, slower: 0, runup: 1.7 },
  { time: [0.98, 1.06], straight: 0.5, slower: 0, runup: 1.5 },
  { time: [0.88, 0.95], straight: 0.6, slower: 0, runup: 1.4 },
  { time: [0.8, 0.87], straight: 0.7, slower: 0.35, runup: 1.3 },
  { time: [0.73, 0.8], straight: 0.8, slower: 0.3, runup: 1.2 },
  { time: [0.66, 0.72], straight: 1, slower: 0, runup: 1.1 },
]
// How long a slower ball is in the air.
export const SLOWER = [1.12, 1.26]

// One ball: { ball, time, straight, slower, line, length, height, runup }.
//   time      seconds from the bowler's hand to the bat
//   straight  it is on the stumps: miss it and you are bowled
//   line      where it passes the bat, in metres to the off side of the middle stump
//   length    how far down its flight it bounces (0 to 1)
//   height    how high it is at the bat, in metres: one on the stumps is
//             kept low enough to hit them
export function delivery(ball = 0, rng = Math.random) {
  const n = Math.max(0, Math.min(BALLS - 1, Math.floor(ball)))
  const plan = OVER[n]
  const slower = rng() < plan.slower
  const span = slower ? SLOWER : plan.time
  const straight = rng() < plan.straight
  const round = (v) => Math.round(v * 1000) / 1000
  return {
    ball: n,
    time: round(span[0] + rng() * (span[1] - span[0])),
    straight,
    slower,
    line: round(straight ? (rng() - 0.5) * 0.08 : 0.3 + rng() * 0.12),
    length: round(0.6 + rng() * 0.08),
    height: round(straight ? 0.38 + rng() * 0.16 : 0.55 + rng() * 0.25),
    runup: plan.runup,
  }
}

// Where the ball is in its flight from the hand (t is 0) to the bat (t
// is the delivery's time) and on past it: how far along (0 at the hand,
// 1 at the bat), how far to the off side, and how high. It leaves the
// hand `hand` metres up and `arm` metres to the side, bounces once on
// the pitch and comes up to the bat. r is the ball's radius.
export function flight(d, t, { hand = 2.05, arm = -0.3, r = 0.09 } = {}) {
  const along = Math.max(0, t) / d.time
  const t1 = d.length * d.time
  const t2 = d.time - t1
  let y
  if (t <= t1) {
    // From the hand down to the pitch.
    const v = (r - hand + 0.5 * G * t1 * t1) / t1
    const s = Math.max(0, t)
    y = hand + v * s - 0.5 * G * s * s
  } else {
    // Up off the pitch to the bat's height, and on.
    const v = (d.height - r + 0.5 * G * t2 * t2) / t2
    const s = t - t1
    y = r + v * s - 0.5 * G * s * s
  }
  return { along, side: arm + (d.line - arm) * along, y: Math.max(r, y) }
}

// Where a ball that was hit goes: how far to the off side of straight
// back past the bowler it flies (radians: early swings go to leg, below
// nought, late ones to off), how fast and how steeply. Timed just right
// it goes straight back over the bowler's head.
export function stroke(kind, delta = 0) {
  const turn = Math.max(-1, Math.min(1, delta / TIMING.four)) * 0.85
  if (kind === 'six') return { turn, speed: 27, loft: 0.62 }
  if (kind === 'four') return { turn, speed: 26, loft: 0.07 }
  if (kind === 'two') return { turn: turn * 1.2, speed: 11, loft: 0.12 }
  if (kind === 'one') return { turn: turn * 1.3, speed: 7, loft: 0.1 }
  return { turn: turn * 1.4, speed: 2.4, loft: 0 }
}

// What is said of each ball.
export const SAID = {
  six: 'Six!',
  four: 'Four!',
  two: 'Two runs.',
  one: 'One run.',
  touch: 'A touch on it. No run.',
  dot: 'Missed it. A dot ball.',
  bowled: 'Bowled!',
}

// The best score kept on this device, and nowhere else.
export const BEST_KEY = 'winterfayre:cricket:best'
export function readBest(store) {
  try {
    const n = Number(store?.getItem(BEST_KEY))
    return Number.isInteger(n) && n > 0 && n <= MOST ? n : 0
  } catch {
    return 0
  }
}
export function keepBest(store, score) {
  const best = Math.max(readBest(store), score)
  try { store?.setItem(BEST_KEY, String(best)) } catch { /* a browser that keeps nothing still plays */ }
  return best
}
