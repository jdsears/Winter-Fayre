// How a swipe, a drag, a tap or the keys become a kick or a dive. Pure:
// the game hands in the points and the goal's place on the screen.
//
// A shot is { aimX, aimY, power, curve }:
//   aimX   -1 to 1 is post to post (past 1 is wide)
//   aimY   0 to 1 is grass to bar (past 1 is over)
//   power  0 to 1; only near full power does the ball lift
//   curve  -1 to 1; bends the ball left or right at the end
//
// A swipe aims where it ends: the point on the goal mouth under the
// finger, as a tap on the flat pitch does and as the keyboard's marker
// shows. One that stops short of the goal is a shot along the ground,
// the way it was going.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export const SWIPE = {
  minLength: 28, // px: anything shorter is a tap, not a kick
  minRise: 20, // px it must travel up the screen
  flickWindow: 110, // ms at the end of the swipe that set its speed
  // Speed is measured against the distance on the screen from the ball
  // to the middle of the goal mouth, so a flick to the goal is as hard on
  // a phone upright, on its side or with a mouse on a desktop.
  powerFrom: 1.13, // ball to goal distances a second: slower is no power
  powerSpan: 10.6, // and this much faster is full power
  bendFull: 0.17, // a swipe bowed out by this share of its length is full bend
  groundAim: 0.04, // the height of one that stops short of the goal
}

// The aim under a point on the screen: the goal mouth's left and right
// posts are -1 and 1, the line 0 and the bar 1.
export function pointToAim(geom, x, y) {
  const g = geom.goal
  return {
    aimX: clamp(((x - g.left) / Math.max(1, g.right - g.left)) * 2 - 1, -1.6, 1.6),
    aimY: clamp((g.bottom - y) / Math.max(1, g.bottom - g.top), 0, 1.5),
  }
}

// Where a swipe from p0 to p1 aims: where it ends, on the goal mouth, or
// along the ground the way it was going if it stopped short.
export function swipeAim(p0, p1, geom) {
  if (p1.y <= geom.goal.bottom) return pointToAim(geom, p1.x, p1.y)
  const rise = p0.y - p1.y
  const x = rise > 0 ? p0.x + ((p1.x - p0.x) * (p0.y - geom.goal.bottom)) / rise : p1.x
  return { aimX: pointToAim(geom, x, geom.goal.bottom).aimX, aimY: SWIPE.groundAim }
}

// points: [{ x, y, t }] in CSS pixels and milliseconds, in order.
// geom: { ball: { x, y }, goal: { left, right, top, bottom } } where goal
// is the goal mouth on screen.

// The distance on the screen from the ball to the middle of the goal.
export function ballToGoal(geom) {
  const g = geom.goal
  return Math.max(1, Math.hypot((g.left + g.right) / 2 - geom.ball.x, (g.top + g.bottom) / 2 - geom.ball.y))
}
export function swipeToShot(points, geom) {
  if (!points || points.length < 2) return null
  const p0 = points[0]
  const p1 = points[points.length - 1]
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const len = Math.hypot(dx, dy)
  if (len < SWIPE.minLength || -dy < SWIPE.minRise) return null
  // Started up by the goal: not a kick.
  if (p0.y < geom.goal.bottom) return null

  // Where it ends, on the goal.
  const { aimX, aimY } = swipeAim(p0, p1, geom)

  // Power: the speed of the flick at the end, in ball to goal distances
  // a second.
  const reach = ballToGoal(geom)
  let from = p0
  for (let i = points.length - 2; i >= 0; i--) {
    from = points[i]
    if (p1.t - points[i].t >= SWIPE.flickWindow) break
  }
  const ms = Math.max(8, p1.t - from.t)
  const speed = (Math.hypot(p1.x - from.x, p1.y - from.y) / ms) * 1000 / reach
  const power = clamp((speed - SWIPE.powerFrom) / SWIPE.powerSpan, 0, 1)

  // Bend: how far the swipe bows out from its straight line. Bowed to
  // the right, it comes back left at the end, and so does the ball.
  const ux = dx / len
  const uy = dy / len
  let bow = 0
  for (const p of points) {
    const d = (p.x - p0.x) * -uy + (p.y - p0.y) * ux
    if (Math.abs(d) > Math.abs(bow)) bow = d
  }
  const curve = clamp(-bow / (len * SWIPE.bendFull), -1, 1)

  return { aimX, aimY, power, curve }
}

// A swipe in goal: sideways for a dive that way, upwards for a jump.
// Returns 'left', 'right' or 'up' (as the screen shows them), or null.
export function swipeToDive(points) {
  if (!points || points.length < 2) return null
  const p0 = points[0]
  const p1 = points[points.length - 1]
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  if (Math.hypot(dx, dy) < 24) return null
  if (-dy > Math.abs(dx) * 1.2) return 'up'
  if (Math.abs(dx) < 16) return null
  return dx < 0 ? 'left' : 'right'
}

// ── The keyboard ────────────────────────────────────────────────────────
// The arrows move an aim on the goal; holding Space builds power and
// letting go shoots. Holding on past full power keeps it at full, where
// the ball lifts.

export const KEYS = {
  step: 0.12,
  aimX: [-1.15, 1.15],
  aimY: [0, 1.15],
  start: { aimX: 0, aimY: 0.35 },
  chargeMs: 1100,
}

export function keyboardAim(aim, key) {
  const a = { ...aim }
  if (key === 'ArrowLeft') a.aimX -= KEYS.step
  else if (key === 'ArrowRight') a.aimX += KEYS.step
  else if (key === 'ArrowUp') a.aimY += KEYS.step
  else if (key === 'ArrowDown') a.aimY -= KEYS.step
  else return null
  a.aimX = clamp(Math.round(a.aimX * 100) / 100, KEYS.aimX[0], KEYS.aimX[1])
  a.aimY = clamp(Math.round(a.aimY * 100) / 100, KEYS.aimY[0], KEYS.aimY[1])
  return a
}

export function powerAfter(ms) {
  return clamp(ms / KEYS.chargeMs, 0, 1)
}

export function keyboardShot(aim, heldMs) {
  return { aimX: aim.aimX, aimY: aim.aimY, power: powerAfter(heldMs), curve: 0 }
}

export function keyToDive(key) {
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'ArrowUp') return 'up'
  return null
}

export const isShootKey = (key) => key === ' ' || key === 'Spacebar'

// Where an aim is, in words, for a screen reader.
export function aimWords(aim) {
  const across = aim.aimX < -1 ? 'wide left' : aim.aimX > 1 ? 'wide right'
    : aim.aimX <= -0.6 ? 'left corner' : aim.aimX >= 0.6 ? 'right corner'
      : aim.aimX < -0.2 ? 'left of centre' : aim.aimX > 0.2 ? 'right of centre' : 'centre'
  const up = aim.aimY > 1 ? 'over the bar' : aim.aimY >= 0.66 ? 'high' : aim.aimY >= 0.33 ? 'middle height' : 'low'
  if (across.startsWith('wide') || up === 'over the bar') return `Aiming ${up === 'over the bar' ? `${up}, ${across}` : `${across}, ${up}`}`
  return `Aiming ${up}, ${across}`
}
