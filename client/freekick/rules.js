// The free kick challenge: the rules, with no drawing and no browser in
// them.
//
// Ten free kicks, each from a different spot, with a wall and a keeper
// to beat. A swipe from the ball sets where the shot is aimed and how
// high, and a swipe that curls bends the ball's flight. The ball must
// go over the wall or round it, inside the posts, under the bar, and
// out of the keeper's reach.
//
// The pitch is 360 wide and 480 high as it is drawn. Across the pitch a
// place is counted in those units. Height is counted in bar heights:
// the ground is 0 and the crossbar is 1. How far the ball has flown is
// counted from 0 at the kick to 1 at the goal line.

export const W = 360
export const H = 480
export const KICKS = 10
export const POST_LEFT = 70
export const POST_RIGHT = 290
export const CENTRE = 180
export const BALL_R = 9
// The wall stands two fifths of the way to goal, and is a little under
// three quarters of the bar's height.
export const WALL_AT = 0.4
export const WALL_H = 0.72
export const WALL_W = 104
// How much the ball's flight rises above a straight line to its target.
export const LIFT = 0.5
// How far up the drawing the goal line is from the ball.
export const REACH_UP = 252
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// A kick's set-up: where the ball is, where the wall stands and where
// the keeper starts. The wall covers the near side of the goal, and the
// keeper stands toward the side it leaves open.
//
// The kicks get harder as they go (kick is 0 for the first and 9 for the
// last): the keeper reaches further across the goal and the wall jumps
// higher, so the gap to hit shrinks from kick to kick.
export function kickSetup(rng = Math.random, kick = 0) {
  const x0 = Math.round(110 + rng() * 140)
  const wallX = Math.round(x0 + (CENTRE - x0) * WALL_AT + (rng() - 0.5) * 50)
  const keeperX = CENTRE + (wallX < CENTRE ? 26 : -26)
  const k = clamp(kick, 0, KICKS - 1)
  return { x0, wallX, keeperX, reach: Math.round(KEEPER_REACH + k * 2.8), wallH: Math.round((WALL_H + k * 0.013) * 1000) / 1000 }
}

// A swipe, as the points it passed through, turned into a shot: where
// it is aimed across the goal (the way the swipe points), how high (by
// the swipe's length), and how much it bends. Null
// for a swipe too short to be a kick, or one that does not go up.
export function shotFromSwipe(points, x0) {
  if (!points || points.length < 2) return null
  const a = points[0]
  const b = points[points.length - 1]
  const dx = b.x - a.x
  const dy = a.y - b.y
  const length = Math.hypot(dx, dy)
  if (dy < 30 || length < 45) return null
  // The furthest the swipe strayed from a straight line, to one side.
  let stray = 0
  for (const p of points) {
    const side = ((p.x - a.x) * dy + (p.y - a.y) * dx) / length
    if (Math.abs(side) > Math.abs(stray)) stray = side
  }
  // The swipe points at its target: its line is carried on to the goal
  // line, which is REACH_UP above the ball on the drawing.
  return {
    aim: Math.round(clamp(x0 + dx * (REACH_UP / dy), -60, W + 60)),
    height: Math.round(clamp((length - 50) / 200, 0.02, 1.5) * 100) / 100,
    bend: Math.round(clamp(stray * 2.4, -120, 120)),
  }
}

// Where the ball is at a point in its flight: across the pitch, and how
// high.
export function flightAt(setup, shot, t) {
  const mid = (setup.x0 + shot.aim) / 2 + shot.bend
  const u = 1 - t
  return {
    x: u * u * setup.x0 + 2 * u * t * mid + t * t * shot.aim,
    h: shot.height * t + LIFT * 4 * t * u,
  }
}

// How far the keeper reaches across the goal for a ball at a height:
// less for a high ball, so the top corners are the places to aim.
export const KEEPER_REACH = 58
export function keeperReach(height, reach = KEEPER_REACH) {
  return reach - 28 * clamp(height, 0, 1)
}

// What becomes of a shot: 'wall', 'over', 'wide', 'saved' or 'goal'.
export function outcome(setup, shot) {
  const atWall = flightAt(setup, shot, WALL_AT)
  if (Math.abs(atWall.x - setup.wallX) <= WALL_W / 2 + BALL_R * 0.5 && atWall.h < (setup.wallH ?? WALL_H)) return 'wall'
  if (shot.height > 1) return 'over'
  if (shot.aim < POST_LEFT + BALL_R * 0.5 || shot.aim > POST_RIGHT - BALL_R * 0.5) return 'wide'
  if (Math.abs(shot.aim - setup.keeperX) <= keeperReach(shot.height, setup.reach)) return 'saved'
  return 'goal'
}

// What is said of each outcome.
export const SAID = {
  goal: 'Goal!',
  saved: 'Saved by the keeper.',
  wall: 'Into the wall.',
  wide: 'Wide of the post.',
  over: 'Over the bar.',
}

// The best score kept on this device, and nowhere else.
export const BEST_KEY = 'winterfayre:freekick:best'
export function readBest(store) {
  try {
    const n = Number(store?.getItem(BEST_KEY))
    return Number.isInteger(n) && n > 0 && n <= KICKS ? n : 0
  } catch {
    return 0
  }
}
export function keepBest(store, score) {
  const best = Math.max(readBest(store), score)
  try { store?.setItem(BEST_KEY, String(best)) } catch { /* a browser that keeps nothing still plays */ }
  return best
}
