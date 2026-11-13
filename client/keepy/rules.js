// Keepy-uppies: the rules, with no drawing and no browser in them.
//
// A ball hangs over the pitch until it is first tapped. Each tap on the
// ball as it comes down sends it back up, and counts one. A tap to one
// side of the ball's middle sends it the other way, as a real touch
// does. The ball falls a little faster as the count rises. When it
// touches the ground the go is over.
//
// A touch counts only on a ball that is on its way down, and a moment
// after the last one. There is no roof: a ball sent high leaves the top
// of the pitch and comes back. So the count cannot be run up by tapping
// fast on a ball pinned in a top corner, which is how the first version
// was gamed.
//
// The pitch is 360 wide and 480 high, whatever size it is drawn at.

export const W = 360
export const H = 480
export const R = 26
export const GROUND = H - 18
// How near the ball a tap must land, as a share of its radius: generous,
// for thumbs.
export const REACH = 1.9
// A ball still rising cannot be touched again: one tap is one touch,
// however fast the screen is tapped. It may be touched from just before
// the top of its flight.
const STILL_RISING = -60
// The least time between two touches, in seconds.
export const TOUCH_GAP = 0.3
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function newGo() {
  return { x: W / 2, y: H * 0.36, vx: 0, vy: 0, score: 0, started: false, over: false, since: 0 }
}

// How hard the ball is pulled down: a little harder with every touch,
// up to sixty.
export function gravity(score) {
  return 880 + Math.min(score, 60) * 9
}

function lift(go, vx) {
  return { ...go, started: true, since: 0, score: go.score + 1, vy: -(545 + Math.min(go.score, 40) * 2), vx: clamp(vx, -270, 270) }
}

// A tap at a point on the pitch. Away from the ball, on a ball still
// rising, or after the go is over, it does nothing.
export function tap(go, px, py) {
  if (go.over) return go
  const dx = px - go.x
  const dy = py - go.y
  if (Math.hypot(dx, dy) > R * REACH) return go
  if (go.started && (go.vy < STILL_RISING || go.since < TOUCH_GAP)) return go
  return lift(go, -dx * 8.5)
}

// The same touch from a keyboard: it counts once the ball is coming
// down in the lower part of the pitch, and nudges it back to the middle.
export function keyTouch(go) {
  if (go.over) return go
  if (!go.started) return lift(go, 0)
  if (go.vy < STILL_RISING || go.since < TOUCH_GAP || go.y < H * 0.42) return go
  return lift(go, (W / 2 - go.x) * 1.4)
}

// The ball a moment later. dt is in seconds.
export function step(go, dt) {
  if (!go.started || go.over) return go
  const t = Math.min(dt, 0.034)
  let { x, y, vx, vy } = go
  vy += gravity(go.score) * t
  x += vx * t
  y += vy * t
  if (x < R) { x = R; vx = Math.abs(vx) * 0.8 }
  if (x > W - R) { x = W - R; vx = -Math.abs(vx) * 0.8 }
  if (y >= GROUND - R) return { ...go, x, y: GROUND - R, vx: 0, vy: 0, over: true }
  return { ...go, x, y, vx, vy, since: go.since + t }
}

// The best count kept on this device, and nowhere else.
export const BEST_KEY = 'winterfayre:keepy:best'
export function readBest(store) {
  try {
    const n = Number(store?.getItem(BEST_KEY))
    return Number.isInteger(n) && n > 0 && n < 100000 ? n : 0
  } catch {
    return 0
  }
}
export function keepBest(store, score) {
  const best = Math.max(readBest(store), score)
  try { store?.setItem(BEST_KEY, String(best)) } catch { /* a browser that keeps nothing still plays */ }
  return best
}
