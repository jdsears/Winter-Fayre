// Netball shot: the rules, with no drawing and no browser in them.
//
// Thirty seconds to score as many goals as you can. A flick up the
// screen sends the ball up in an arc: the way the flick points is the way
// the ball goes, and the longer the flick the further the ball carries.
// To score, the ball must come down through the ring.
//
// It is harder as it goes: after every goal the next shot is from
// further back, and from a different place round the goal circle. A
// miss is taken again from the same place.
//
// Everything is in metres and seconds. A shot is taken d metres out from
// under the ring. Along is how far the ball has gone towards the ring;
// side is how far it has strayed to the right of that line.

export const SECONDS = 30
export const G = 9.81
// The ring is 3.05 metres up, as on a real post. The ball leaves the
// hands at chest height and every shot peaks at the same height above
// the ring, so every shot is in the air for the same time.
export const RING = { height: 3.05, radius: 0.19 }
export const BALL_R = 0.11
export const HANDS = 1.15
export const APEX = 3.85
// How near the middle of the ring the ball must come down to score, and
// how near to hit the rim. Kinder than a real ring: a phone is not a hand.
export const CAPTURE = 0.21
export const RIM = 0.37
// How far the shortest and the longest flick carry the ball.
export const REACH = { min: 0.6, max: 4.8 }
// A flick's slant counts for this much: a thumb is not a ruler.
export const ASSIST = 0.6
// The first shot's distance, how much further each goal moves the next,
// and the furthest it gets.
export const SPOT = { first: 1.3, step: 0.3, last: 3.7 }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Where the next shot is taken from, after this many goals: how far out,
// and how far round the goal circle (in radians, nought straight in
// front of the post). The first is straight in front.
export function spotFor(goals = 0, rng = Math.random) {
  const n = Math.max(0, Math.floor(goals))
  const d = Math.round(Math.min(SPOT.last, SPOT.first + SPOT.step * n) * 100) / 100
  return { d, turn: n ? Math.round((rng() - 0.5) * 1.9 * 100) / 100 + 0 : 0 }
}

// How long every shot is in the air before it comes down to the ring's
// height, and how fast it leaves the hands upwards.
export const RISE = Math.sqrt(2 * G * (APEX - HANDS))
export const FLIGHT = (RISE + Math.sqrt(RISE * RISE - 2 * G * (RING.height - HANDS))) / G

// A flick, as the points it passed through on the screen, turned into a
// shot: how far it will carry (by the flick's length, against the
// screen's height) and which way it goes (by the flick's slant, in
// radians to the right of straight ahead). Null for a flick too short to
// be a shot, or one that does not go up.
export function shotFromSwipe(points, { tall }) {
  if (!points || points.length < 2 || !(tall > 0)) return null
  const a = points[0]
  const b = points[points.length - 1]
  const dx = b.x - a.x
  const dy = a.y - b.y
  const length = Math.hypot(dx, dy)
  if (dy < 24 || length < 36) return null
  const power = clamp((length / tall - 0.07) / 0.33, 0, 1)
  return {
    reach: Math.round((REACH.min + (REACH.max - REACH.min) * power) * 100) / 100,
    aim: Math.round(Math.atan2(dx, dy) * ASSIST * 1000) / 1000 + 0,
  }
}

// Where the ball is t seconds after it leaves the hands: how far towards
// the ring, how far to the side, and how high. It never goes under the
// ground.
export function ballAt(shot, t) {
  const s = Math.max(0, t)
  const pace = shot.reach / FLIGHT
  return { along: Math.cos(shot.aim) * pace * s, side: Math.sin(shot.aim) * pace * s, y: Math.max(BALL_R, HANDS + RISE * s - 0.5 * G * s * s) }
}

// How far from the middle of the ring the ball comes down through the
// ring's height, for a shot from a spot.
export function missBy(spot, shot) {
  const along = Math.cos(shot.aim) * shot.reach - spot.d
  const side = Math.sin(shot.aim) * shot.reach
  return { along, side, by: Math.hypot(along, side) }
}

// What becomes of a shot: 'goal', 'rim' (it hit the ring and stayed
// out), 'short', 'long' or 'wide'.
export function outcome(spot, shot) {
  const m = missBy(spot, shot)
  if (m.by <= CAPTURE) return 'goal'
  if (m.by <= RIM) return 'rim'
  if (Math.abs(m.side) > Math.abs(m.along)) return 'wide'
  return m.along < 0 ? 'short' : 'long'
}

// What is said of each outcome.
export const SAID = {
  goal: 'Goal!',
  rim: 'Off the ring.',
  short: 'Short of the ring.',
  long: 'Over the ring.',
  wide: 'Wide of the ring.',
}

// The best count kept on this device, and nowhere else.
export const BEST_KEY = 'winterfayre:netball:best'
export function readBest(store) {
  try {
    const n = Number(store?.getItem(BEST_KEY))
    return Number.isInteger(n) && n > 0 && n < 1000 ? n : 0
  } catch {
    return 0
  }
}
export function keepBest(store, score) {
  const best = Math.max(readBest(store), score)
  try { store?.setItem(BEST_KEY, String(best)) } catch { /* a browser that keeps nothing still plays */ }
  return best
}
