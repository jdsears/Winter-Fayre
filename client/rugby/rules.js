// Rugby conversion: the rules, with no drawing and no browser in them.
//
// Five kicks at the posts. A swipe from the ball sets where the kick is
// aimed and how hard it is struck, and a swipe that curls bends the
// ball's flight. To count, the ball must cross the posts' line between
// the uprights and over the bar.
//
// Each kick is harder than the last: further out, from a wider angle,
// and into a stronger crosswind, which pushes the ball sideways all the
// way. A harder kick is in the air for less time, so the wind moves it
// less.
//
// Everything is in metres and seconds. Across the pitch, x is 0 at the
// middle of the posts and grows to the right as the kicker sees it. A
// kick is taken d metres out from the posts' line, x0 to one side.

export const KICKS = 5
export const G = 9.81
// The posts: 5.6 metres apart, the bar 3 metres up, as on a real pitch.
export const POSTS = { halfWidth: 2.8, bar: 3, height: 11, radius: 0.09 }
export const BALL_R = 0.12
// Every kick leaves the tee at the same angle; how hard it is struck
// sets how far and how high it goes.
export const ELEVATION = (35 * Math.PI) / 180
export const SPEED = { min: 11.5, max: 27 }
// How hard a metre a second of wind pushes the ball sideways, in metres
// a second each second.
export const WIND_PUSH = 0.36
// The most a curled swipe can bend the ball, the same way.
export const BEND_MAX = 3
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The five kicks: how far out, how far to one side, and the wind's
// strength from and to, in metres a second. The wind rises steeply
// (John found the game too easy, 13 November 2026): by the fourth kick
// the ball must be aimed outside the posts to come back between them,
// and on the fifth a long way outside.
export const SPOTS = [
  { d: 18, x: 0, wind: [0, 0] },
  { d: 22, x: 6, wind: [3, 5] },
  { d: 26, x: 11, wind: [6, 8] },
  { d: 30, x: 15, wind: [9, 11] },
  { d: 34, x: 19, wind: [12, 14] },
]
// The strongest wind there is, for the arrow that shows it.
export const WIND_MOST = SPOTS[SPOTS.length - 1].wind[1]

// A kick's set-up: where the ball is and how the wind blows. kick is 0
// for the first and 4 for the last. The side of the pitch and the way
// the wind blows are left to chance; a wind above nought blows to the
// right.
export function kickSetup(rng = Math.random, kick = 0) {
  const k = clamp(Math.floor(kick), 0, KICKS - 1)
  const spot = SPOTS[k]
  const side = rng() < 0.5 ? -1 : 1
  const blows = rng() < 0.5 ? -1 : 1
  const strength = Math.round(spot.wind[0] + rng() * (spot.wind[1] - spot.wind[0]))
  return { kick: k, d: spot.d, x0: spot.x ? spot.x * side : 0, wind: strength ? strength * blows : 0 }
}

// A swipe, as the points it passed through on the screen, turned into a
// kick. The screen is read against where the ball and the posts are
// drawn: `across` is how many pixels a metre along the posts' line takes
// at the posts, `up` how many pixels the bar is above the ball, `from`
// where on the posts' line the ball sits under, and `tall` the screen's
// height. The swipe points at its target (its line is carried on to the
// posts), its length is how hard the kick is, and how far it strays from
// a straight line is how much it bends. Null for a swipe too short to be
// a kick, or one that does not go up.
export function shotFromSwipe(points, { across, up, from = 0, tall }) {
  if (!points || points.length < 2 || !(across > 0) || !(up > 0) || !(tall > 0)) return null
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
  const power = clamp((length / tall - 0.1) / 0.36, 0, 1)
  // To the nearest hundredth (adding nought leaves no minus nought).
  const tidy = (v) => Math.round(v * 100) / 100 + 0
  return {
    aim: tidy(clamp(from + (dx * (up / dy)) / across, -40, 40)),
    power: tidy(power),
    bend: tidy(clamp((stray / tall) * 14, -BEND_MAX, BEND_MAX) * (0.4 + 0.6 * power)),
  }
}

// How the ball leaves the tee: its speed across, towards the posts and
// up, and the push sideways it feels all the way (the wind and the bend).
export function launch(setup, shot) {
  const v = SPEED.min + (SPEED.max - SPEED.min) * clamp(shot.power, 0, 1)
  const dx = shot.aim - setup.x0
  const reach = Math.hypot(dx, setup.d)
  const level = v * Math.cos(ELEVATION)
  return { vx: (level * dx) / reach, vf: (level * setup.d) / reach, vy: v * Math.sin(ELEVATION), ax: setup.wind * WIND_PUSH + (shot.bend || 0) }
}

// Where the ball is t seconds after the kick: across the pitch, how high
// (0 is the grass) and how far it has gone towards the posts' line.
export function ballAt(setup, shot, t) {
  const l = launch(setup, shot)
  const s = Math.max(0, t)
  return { x: setup.x0 + l.vx * s + 0.5 * l.ax * s * s, y: Math.max(0, l.vy * s - 0.5 * G * s * s), f: l.vf * s }
}

// The moment the ball reaches the posts' line, and where it is then. If
// it has come down before that, landed is true and it never gets there.
export function crossing(setup, shot) {
  const l = launch(setup, shot)
  const t = setup.d / l.vf
  const down = (2 * l.vy) / G
  return { t, down, landed: down < t, x: setup.x0 + l.vx * t + 0.5 * l.ax * t * t, y: l.vy * t - 0.5 * G * t * t }
}

// What becomes of a kick: 'over' (it counts), 'short' (it came down
// before the posts), 'under' (it reached them below the bar), 'wide',
// 'post' or 'bar'.
export function outcome(setup, shot) {
  const c = crossing(setup, shot)
  if (c.landed) return 'short'
  const fromPost = Math.abs(Math.abs(c.x) - POSTS.halfWidth)
  if (fromPost <= POSTS.radius + BALL_R && c.y < POSTS.height) return 'post'
  if (Math.abs(c.x) > POSTS.halfWidth) return 'wide'
  if (Math.abs(c.y - POSTS.bar) <= POSTS.radius + BALL_R) return 'bar'
  if (c.y < POSTS.bar) return 'under'
  return 'over'
}

// What a kick that counts adds to the leaderboard's score: the metres it
// was kicked from. So five from five is 130, and the long ones are worth
// the most.
export const metresFor = (setup) => setup.d
export const MOST_METRES = SPOTS.reduce((a, s) => a + s.d, 0)

// What is said of each outcome.
export const SAID = {
  over: 'Over the bar and between the posts.',
  short: 'It fell short.',
  under: 'Under the bar.',
  wide: 'Wide of the posts.',
  post: 'Off the post.',
  bar: 'Off the bar.',
}

// The best number of kicks kept on this device, and nowhere else.
export const BEST_KEY = 'winterfayre:rugby:best'
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
