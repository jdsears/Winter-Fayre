// The computer's side: its keeper, who guesses or reads the shot, and its
// takers, each with a run up and tells of their own, who pick a corner,
// give it away (mostly honestly) and punish a keeper who goes too early.
// And the visitor in goal, who picks a way to go and when. Pure, with the
// random source passed in, so the tuning can be measured in a test.
//
// Tuned so a first-time visitor scores about three of five and wins
// about half their shootouts, while no aim and power scores more than
// about four times in five however it is mixed, reading the tells saves
// at most about 45 in 100, and a skilled visitor wins at most about 85 in
// 100; see keeper.test.js for the measures.

import { BODY, clampToReach, diveDuration, launch, predictCrossing } from './physics.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// The computer keeper.
export const KEEPER = {
  // A keeper who guesses often but reads sharply when it waits: it beats
  // a placed corner about one time in five, and a shot down the middle
  // (where a guess goes the wrong way) is no surer than one to a side.
  guessRate: 0.7, // commits before the kick this often
  guessSides: { left: 0.45, right: 0.45, stay: 0.1 },
  guessHigh: 0.42, // a guess goes high this often (most penalties go low)
  guessAcross: [1.7, 2.9], // metres from the middle a guess dives to
  reaction: [0.14, 0.21], // seconds after the strike a reading keeper moves
  readNoise: 0.38, // metres out in reading where it is going, with no time
  bendRead: 0.5, // how much of a shot's bend the keeper allows for
  // Memory, over the whole shootout: how far the keeper leans its
  // guesses towards the side it expects, how much more often it guesses
  // then, and how much better it reads a shot that goes where it expects
  // (a side, or a height). Each is scaled by how sure it is (0 to 1).
  habitLean: 0.32,
  habitGuess: 0.1,
  habitRead: 0.45,
  memoryFade: 0.7, // an earlier kick counts this much less than the next
  reach: 1,
  speed: 1.4,
}

// Sudden death: a little sharper, never out of reach.
export const SUDDEN_DEATH = {
  guessRate: 0.04,
  reaction: -0.02,
  readNoise: -0.06,
  reach: 0.04,
  speed: 0.05,
}

export function keeperLevel({ suddenDeath = false } = {}) {
  if (!suddenDeath) return { ...KEEPER, reaction: [...KEEPER.reaction] }
  return {
    ...KEEPER,
    guessRate: KEEPER.guessRate + SUDDEN_DEATH.guessRate,
    reaction: KEEPER.reaction.map((r) => r + SUDDEN_DEATH.reaction),
    readNoise: KEEPER.readNoise + SUDDEN_DEATH.readNoise,
    reach: KEEPER.reach + SUDDEN_DEATH.reach,
    speed: KEEPER.speed + SUDDEN_DEATH.speed,
  }
}

// time is how long the ball takes to arrive once the keeper sets off:
// the more there is, the further the keeper gets, most of all low down.
function divePlan(target, start, level, time) {
  const t = clampToReach(target, level.reach, time)
  return { kind: 'dive', start, duration: diveDuration(t, level.speed), target: t }
}

// Where the hands go for a shot read at (x, y): stay big for one at the
// body, spring up for one over it, dive for the rest.
export function planFor(read, start, level, time = 0) {
  if (Math.abs(read.x) < 0.55 && read.y < 1.45) {
    return { kind: 'set', start, duration: 0.18 / level.speed, target: { x: 0, y: 0.95 } }
  }
  if (Math.abs(read.x) < 1.15 && read.y >= 1.45) {
    const target = clampToReach({ x: read.x, y: Math.max(read.y, 2.0) }, level.reach, time)
    return { kind: 'jump', start, duration: diveDuration(target, level.speed) * 0.9, target }
  }
  return divePlan(read, start, level, time)
}

// What the keeper expects of the visitor's next kick, from every kick
// they have taken this shootout, the later ones counting more: the side
// they favour and the height (low or high), each with how sure it is (0
// to 1). A visitor who has switched every time so far is expected to
// switch again. Each kick in history is { side: -1, 0 or 1, low }.
export function habit(history = [], fade = KEEPER.memoryFade) {
  const none = { side: 0, sideBy: 0, height: null, heightBy: 0 }
  if (history.length < 2) return none
  let total = 0
  let side = 0
  let low = 0
  history.forEach((k, i) => {
    const w = fade ** (history.length - 1 - i)
    total += w
    side += w * k.side
    low += w * (k.low ? 1 : -1)
  })
  side /= total
  low /= total
  const pairs = history.slice(1).map((k, i) => [history[i], k])
  const last = history[history.length - 1]
  const sided = pairs.filter(([a, b]) => a.side !== 0 && b.side !== 0)
  if (sided.length >= 2 && sided.length === pairs.length && sided.every(([a, b]) => a.side !== b.side)) {
    side = -last.side * Math.min(1, 0.4 + 0.2 * sided.length)
  }
  if (pairs.length >= 2 && pairs.every(([a, b]) => a.low !== b.low)) {
    low = (last.low ? -1 : 1) * Math.min(1, 0.4 + 0.2 * pairs.length)
  }
  const sure = (v) => clamp((Math.abs(v) - 0.15) / 0.85, 0, 1)
  return {
    side: sure(side) > 0 ? Math.sign(side) : 0,
    sideBy: sure(side),
    height: sure(low) > 0 ? (low > 0 ? 'low' : 'high') : null,
    heightBy: sure(low),
  }
}

// The computer keeper's plan for a shot already struck: a guess made
// before the kick, or a read of the ball off the boot, sharper the more
// time the ball gives. history is where the visitor's earlier kicks in
// this shootout went (kickSeen). What it expects leans its guesses that
// way and sharpens its read of a shot that goes there; a shot that goes
// the other way is read no worse than with no memory at all.
export function keeperPlan(flight, level, rng, history = []) {
  const arrives = predictCrossing(flight, 1).t
  const usual = habit(history, level.memoryFade)
  if (rng.chance(level.guessRate + level.habitGuess * usual.sideBy)) {
    const lean = level.habitLean * usual.sideBy * usual.side
    const g = level.guessSides
    const weights = { left: Math.max(0.05, g.left - lean), right: Math.max(0.05, g.right + lean), stay: g.stay * (1 - usual.sideBy * 0.5) }
    const side = rng.pick(weights)
    const start = rng.range(-0.08, 0.04)
    if (side === 'stay') return { ...planFor({ x: 0, y: 0.8 }, start, level, arrives - start), guessed: true }
    const s = side === 'left' ? -1 : 1
    // Most penalties go low, so most guesses do too, unless this visitor
    // keeps going high.
    const high = usual.height === 'high' ? usual.heightBy : usual.height === 'low' ? -usual.heightBy : 0
    const y = rng.chance(level.guessHigh + 0.4 * high) ? rng.range(1.0, 1.9) : 0.3 + 0.8 * rng() ** 1.4
    const target = { x: s * rng.range(level.guessAcross[0], level.guessAcross[1]), y }
    return { ...divePlan(target, start, level, arrives - start), guessed: true }
  }
  const start = rng.range(level.reaction[0], level.reaction[1])
  const time = arrives - start
  const read = predictCrossing(flight, level.bendRead)
  const expectedSide = usual.side !== 0 && Math.sign(read.x) === usual.side ? usual.sideBy : 0
  const expectedHeight = (usual.height === 'low' && read.y < 0.9) || (usual.height === 'high' && read.y >= 0.9) ? usual.heightBy : 0
  const expected = (1 - level.habitRead * expectedSide) * (1 - level.habitRead * expectedHeight)
  const noise = level.readNoise * clamp(1.45 - time, 0.4, 1) * expected
  const noisy = { x: read.x + rng.normal(noise), y: read.y + rng.normal(noise * 0.6) }
  return { ...planFor(noisy, start, level, time), guessed: false }
}

// ── The computer's takers ───────────────────────────────────────────────
// Four kinds, each its own run up and tells, so no two kicks have the same
// rhythm. Times are seconds; a pause is a stop in the run up, at pauseAt
// of the way.
//   steady    a plain run up, honest tells
//   stutter   stops in the run up, and sells a dummy more often
//   striker   a short, quick run up and a hard shot
//   chipper   a long run up, and now and then a soft chip down the middle

const SIDES = { left: 0.42, right: 0.42, centre: 0.16 }
export const TAKERS = {
  steady: { number: '7', runup: [1.25, 1.6], pauseChance: 0.15, pause: [0.15, 0.3], honesty: 0.8, aimX: [0.4, 0.88], aimY: [0.08, 0.9], power: [0.34, 0.62], chip: 0, nerves: 0.2 },
  stutter: { number: '4', runup: [1.1, 1.45], pauseChance: 1, pause: [0.25, 0.55], honesty: 0.62, aimX: [0.45, 0.88], aimY: [0.05, 0.75], power: [0.32, 0.58], chip: 0, nerves: 0.19 },
  striker: { number: '9', runup: [1.1, 1.3], pauseChance: 0, pause: [0, 0], honesty: 0.82, aimX: [0.35, 0.86], aimY: [0.25, 0.95], power: [0.62, 0.84], chip: 0, nerves: 0.24 },
  chipper: { number: '10', runup: [1.4, 1.8], pauseChance: 0.3, pause: [0.2, 0.4], honesty: 0.75, aimX: [0.4, 0.88], aimY: [0.08, 0.85], power: [0.38, 0.66], chip: 0.3, nerves: 0.19 },
}

export const TAKER = {
  earlyWindow: 0.3, // a dive this long before the strike is seen
  punishEarly: 0.65, // and then the ball goes the other way this often
}

// The five who take the computer's kicks, in a fresh order each time;
// sudden death brings any of them back.
export function takerOrder(rng) {
  const order = ['steady', 'stutter', 'striker', 'chipper', 'steady']
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function takerFor(order, kickIndex, rng) {
  return kickIndex < order.length ? order[kickIndex] : rng.pick({ steady: 2, stutter: 1, striker: 1, chipper: 1 })
}

// Sudden death: steadier takers.
export function takerLevel({ suddenDeath = false } = {}) {
  return { nervesScale: suddenDeath ? 0.6 : 1 }
}

// dir: -1 is the taker's left, 1 their right, 0 the middle. The run up is
// { duration, pauseAt, pause }; the strike comes after both.
export function takerPlan(rng, level = takerLevel(), kind = 'steady') {
  const t = TAKERS[kind] || TAKERS.steady
  const runup = {
    duration: rng.range(t.runup[0], t.runup[1]),
    pauseAt: rng.range(0.45, 0.7),
    pause: rng.chance(t.pauseChance) ? rng.range(t.pause[0], t.pause[1]) : 0,
  }
  if (rng.chance(t.chip)) {
    // The chip: soft, down the middle, sold with a side.
    const shot = { aimX: rng.normal(0.06), aimY: rng.range(0.55, 0.8), power: rng.range(0.12, 0.22), curve: 0 }
    return { kind, number: t.number, dir: 0, chip: true, shot, runup, tell: { dir: rng.chance(0.5) ? -1 : 1, high: false, honest: false } }
  }
  const side = rng.pick(SIDES)
  const dir = side === 'left' ? -1 : side === 'right' ? 1 : 0
  const shot = {
    aimX: dir === 0 ? rng.range(-0.18, 0.18) : dir * rng.range(t.aimX[0], t.aimX[1]),
    aimY: rng.range(t.aimY[0], t.aimY[1]),
    power: rng.range(t.power[0], t.power[1]),
    curve: clamp(rng.normal(0.15), -0.5, 0.5),
  }
  if (rng.chance(t.nerves * level.nervesScale)) {
    if (dir !== 0 && rng.chance(0.5)) shot.aimX = dir * rng.range(1.0, 1.15)
    else shot.aimY = rng.range(1.0, 1.2)
  }
  const honest = rng.chance(t.honesty)
  const tellDir = honest ? dir : dir === 0 ? (rng.chance(0.5) ? -1 : 1) : -dir
  const high = honest ? shot.aimY > 0.6 : rng.chance(0.3)
  return { kind, number: t.number, dir, chip: false, shot, runup, tell: { dir: tellDir, high, honest } }
}

// How long from setting off to the strike.
export function runupTime(plan) {
  return plan.runup.duration + plan.runup.pause
}

// How far through the run up the taker is, t seconds after setting off,
// and whether they are stopped in it.
export function runupProgress(plan, t) {
  const { duration, pauseAt, pause } = plan.runup
  const stopAt = duration * pauseAt
  if (t < stopAt) return { u: clamp(t / duration, 0, 1), paused: false }
  if (t < stopAt + pause) return { u: pauseAt, paused: true }
  return { u: clamp((t - pause) / duration, 0, 1), paused: false }
}

// A keeper who moves too soon is seen: the taker may switch to the
// other side. diveDir is -1, 1 (a dive) or 0 (a jump), in the taker's
// terms; start is seconds from the strike.
export function answerEarlyDive(plan, diveDir, start, rng, taker = TAKER) {
  if (diveDir === null || diveDir === undefined || start > -taker.earlyWindow) return { ...plan, switched: false }
  if (!rng.chance(taker.punishEarly)) return { ...plan, switched: false }
  const away = diveDir === 0 ? (rng.chance(0.5) ? -1 : 1) : -diveDir
  const shot = { ...plan.shot, aimX: away * rng.range(0.5, 0.85), aimY: diveDir === 0 ? rng.range(0.08, 0.35) : plan.chip ? rng.range(0.1, 0.5) : plan.shot.aimY, power: plan.chip ? rng.range(0.35, 0.55) : plan.shot.power }
  return { ...plan, dir: away, chip: false, shot, switched: true }
}

// ── The visitor in goal ─────────────────────────────────────────────────
// The visitor only picks a way to go and when. Before the strike the
// keeper goes that way to where the taker's run up suggests, a rough
// read (flight is then the shot the taker means); after it the keeper
// goes for the ball, from a read that is rough at first and settles as
// the ball travels, by which time most shots are nearly there. dir is -1
// or 1 for a dive, 0 for a jump, null for no move.

export const PLAYER_KEEPER = {
  reach: 1.05,
  speed: 1.4,
  readNoise: 0.8, // metres out at the strike
  earlyNoise: 0.55, // metres out before it, read off the run up
  readSettles: 0.8, // seconds until the read is true
  generic: { side: { x: 2.45, y: 0.85 }, up: { x: 0, y: 2.2 } },
}

// A device's first shootout is a little kinder in goal: for the first
// two saves the window is wider (a dive after the strike counts from a
// moment sooner, grace seconds), and the keeper reaches a little
// further, dives a little quicker and reads the ball sooner, so a late
// tap still has a chance. Scoring is not changed.
export const FIRST_GAME = { saves: 2, grace: 0.12, reach: 0.1, speed: 0.3, readSettles: -0.3 }

export function playerKeeperLevel({ kind = false } = {}, level = PLAYER_KEEPER) {
  if (!kind) return level
  return {
    ...level,
    grace: FIRST_GAME.grace,
    reach: level.reach + FIRST_GAME.reach,
    speed: level.speed + FIRST_GAME.speed,
    readSettles: Math.max(0.2, level.readSettles + FIRST_GAME.readSettles),
  }
}

export function playerDivePlan(dir, start, flight, rng = null, level = PLAYER_KEEPER) {
  if (dir === null || dir === undefined) return null
  if (start > 0 && level.grace) start = Math.max(0, start - level.grace)
  const ball = predictCrossing(flight, 1)
  const time = ball.t - start
  let read = null
  if (start >= 0 || rng) {
    const sigma = start >= 0 ? level.readNoise * clamp(1 - start / level.readSettles, 0, 1) : level.earlyNoise
    read = { x: ball.x + (rng ? rng.normal(sigma) : 0), y: ball.y + (rng ? rng.normal(sigma * 0.6) : 0) }
  }
  if (dir === 0) {
    const aimed = read && Math.abs(read.x) < 1.6 ? { x: read.x, y: Math.max(read.y, 1.4) } : level.generic.up
    const target = clampToReach(aimed, level.reach, time)
    return { kind: 'jump', start, duration: diveDuration(target, level.speed) * 0.9, target }
  }
  const generic = { x: dir * level.generic.side.x, y: level.generic.side.y }
  const aimed = read && Math.sign(read.x) === dir && Math.abs(read.x) > 0.3 ? read : generic
  const target = clampToReach(aimed, level.reach, time)
  return { kind: 'dive', start, duration: diveDuration(target, level.speed), target }
}

// Where a kick went, for the keeper's memory.
export function kickSeen(flight) {
  const at = predictCrossing(flight, 1)
  return { side: Math.abs(at.x) < 1 ? 0 : Math.sign(at.x), low: at.y < 0.9 }
}

// For tests and the tuning: the computer's flight for a plan.
export function takerFlight(plan, rng) {
  return launch(plan.shot, rng)
}

export { BODY }
