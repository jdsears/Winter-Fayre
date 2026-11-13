// The computer's keeper and takers, the visitor in goal, and how hard the
// game is.
//
// The keeper guesses before most kicks and reads the rest sharply, a
// fraction of a second late; the more time the ball gives it the further
// it gets, and it remembers where the visitor's kicks have gone over the
// whole shootout. The takers each have their own run up and tells,
// honest most of the time, and punish a keeper who goes early. A visitor
// who dives after the strike goes for a rough read of the ball that
// settles as it travels; the first shootout on a device is a little
// kinder in goal.
//
// The tuning:
//   no aim and power scores more than about four times in five, against
//   a keeper with nothing to remember, or taken over and over, or turn
//   and turn about, or mixed at random, or set up to bait its memory;
//   reading the tells perfectly saves at most about 45 in 100, whenever
//   the dive goes;
//   a skilled visitor (mixing the corners and reacting to the ball) wins
//   at most about 85 in 100 shootouts;
//   a first-time visitor scores about three of five and wins about half,
//   on a phone held upright, on its side or with a mouse on a desktop.
// A first-timer is modelled below as real swipes (aimed roughly, at any
// speed, some stopping short) and dives that half the time react to the
// ball, and otherwise follow the tells or guess. Thousands of kicks and
// shootouts are played with fixed seeds.
//
// Run with: npx vitest run client/shootout/keeper.test.js

import { describe, it, expect } from 'vitest'
import { makeRng } from './rng.js'
import { inReach, launch, predictCrossing, simulate } from './physics.js'
import { aimToScreen, screenGeometry } from './camera.js'
import { swipeToShot } from './input.js'
import {
  FIRST_GAME, KEEPER, PLAYER_KEEPER, SUDDEN_DEATH, TAKER, TAKERS, answerEarlyDive, habit, keeperLevel, keeperPlan, kickSeen,
  playerDivePlan, playerKeeperLevel, runupProgress, runupTime, takerFlight, takerFor, takerLevel, takerOrder, takerPlan,
} from './keeper.js'
import * as R from './rules.js'

const READY = { kind: 'ready', start: 0, duration: 1 }
const EARLIEST_MOVE = -0.32 // as the game: a dive sooner is seen, but sets off here
const either = (rng) => (rng() < 0.5 ? -1 : 1)
const SHAPES = { upright: [390, 844], side: [844, 390], desktop: [1280, 800] }

// A first-time visitor's swipe on a screen of the shape given: more often
// at a side than the middle, ending a finger's width off where they meant
// (and a little high), now and then stopping short, at any speed from a
// flick to a push, with a slight bow. Sizes are a phone's upright, and
// grow with the goal on the screen.
function firstTimer([w, h] = SHAPES.upright) {
  const geom = screenGeometry('shoot', w, h)
  const u = (geom.goal.right - geom.goal.left) / 316
  return (rng) => {
    const m = rng()
    const across = m < 0.35 ? rng.range(0.6, 1.0) : m < 0.8 ? rng.range(0.2, 0.65) : rng.range(0, 0.25)
    const at = aimToScreen('shoot', w, h, { aimX: either(rng) * across, aimY: rng.range(0, 0.95) })
    const ball = geom.ball
    let end = { x: at.x + rng.normal(16 * u), y: at.y + rng.normal(14 * u) - Math.abs(rng.normal(10 * u)) }
    if (rng() < 0.2) {
      const k = rng.range(0.45, 0.9)
      end = { x: ball.x + (end.x - ball.x) * k, y: ball.y + (end.y - ball.y) * k }
    }
    const ms = rng.range(90, 320)
    const from = { x: ball.x + rng.normal(8 * u), y: ball.y + 8 * u + rng.normal(6 * u) }
    const bow = rng.normal(8 * u)
    const len = Math.hypot(end.x - from.x, end.y - from.y) || 1
    const px = -(end.y - from.y) / len
    const py = (end.x - from.x) / len
    const points = []
    for (let i = 0; i <= 14; i++) {
      const k = i / 14
      const off = Math.sin(k * Math.PI) * bow
      points.push({ x: from.x + (end.x - from.x) * k + px * off, y: from.y + (end.y - from.y) * k + py * off, t: ms * k ** 0.85 })
    }
    return swipeToShot(points, geom) || { aimX: 0, aimY: SWIPE_SHORT, power: 0.3, curve: 0 }
  }
}
const SWIPE_SHORT = 0.05
const firstTimerShot = firstTimer()

// A first-time visitor in goal: half react to the ball once it is struck
// (the right way four times in five, at a human reaction time), some
// follow the tells around the strike, and the rest guess at any moment.
function firstTimerDive(rng, plan) {
  const m = rng()
  if (m < 0.5) {
    const right = rng() < 0.8
    const dir = plan.dir === 0 ? (right ? 0 : either(rng)) : right ? plan.dir : -plan.dir
    return { dir, start: rng.range(0.22, 0.45) }
  }
  if (m < 0.8) return { dir: plan.tell.dir, start: rng.range(-0.3, 0.12) }
  const k = rng.pick({ left: 0.4, right: 0.4, up: 0.1, none: 0.1 })
  return { dir: k === 'left' ? -1 : k === 'right' ? 1 : k === 'up' ? 0 : null, start: rng.range(-0.5, 0.25) }
}

// A skilled visitor in goal: watches the ball and goes the right way
// nearly always, as soon as a person can.
const reactor = (rng, plan) => ({ dir: rng() < 0.85 ? plan.dir : (plan.dir === 0 ? either(rng) : -plan.dir), start: rng.range(0.25, 0.35) })

// Our kick, as the game takes it: the keeper remembers this shootout.
function ourKick(rng, shot, suddenDeath, history) {
  const flight = launch(shot, rng)
  const scored = simulate(flight, keeperPlan(flight, keeperLevel({ suddenDeath }), rng, history)).scored
  history.push(kickSeen(flight))
  return scored
}

// Their kick, as the game plays it: a dive before the strike may be seen
// and answered, one after it goes for the visitor's read of the ball, and
// one after the ball has arrived is no dive at all.
function theirKick(rng, pick, suddenDeath, kind, level = PLAYER_KEEPER) {
  let plan = takerPlan(rng, takerLevel({ suddenDeath }), kind)
  const d = pick(rng, plan)
  if (d.dir === null) return simulate(takerFlight(plan, rng), READY).scored
  if (d.start < 0) {
    plan = answerEarlyDive(plan, d.dir, d.start, rng)
    const keeper = playerDivePlan(d.dir, Math.max(d.start, EARLIEST_MOVE), launch(plan.shot), rng, level) || READY
    return simulate(takerFlight(plan, rng), keeper).scored
  }
  const flight = takerFlight(plan, rng)
  if (d.start >= predictCrossing(flight, 1).t) return simulate(flight, READY).scored
  return simulate(flight, playerDivePlan(d.dir, d.start, flight, rng, level) || READY).scored
}

// shoot(rng, kick) is our kick-th shot of the shootout.
function shootout(rng, shoot = firstTimerShot, pick = firstTimerDive) {
  let s = R.newShootout()
  const order = takerOrder(rng)
  const history = []
  let ours = 0
  let theirs = 0
  while (!R.isOver(s)) {
    const sd = R.isSuddenDeath(s)
    const scored = R.nextSide(s) === 'us'
      ? ourKick(rng, shoot(rng, ours++), sd, history)
      : theirKick(rng, pick, sd, takerFor(order, theirs++, rng))
    s = R.addKick(s, scored)
  }
  return s
}

function shootouts(seed, n, shoot, pick) {
  const rng = makeRng(seed)
  let goals = 0
  let shots = 0
  let wins = 0
  let conceded = 0
  let faced = 0
  for (let i = 0; i < n; i++) {
    const s = shootout(rng, shoot, pick)
    for (const k of s.kicks) {
      if (k.side === 'us') { shots++; if (k.scored) goals++ } else { faced++; if (k.scored) conceded++ }
    }
    if (R.winner(s) === 'us') wins++
  }
  return { score: goals / shots, perFive: (goals / shots) * 5, concede: conceded / faced, win: wins / n }
}

// A run of five kicks a shootout, the keeper remembering: seq(rng, j) is
// kick j's shot.
function patternRate(rng, seq, n) {
  let goals = 0
  for (let i = 0; i < n / 5; i++) {
    const history = []
    for (let j = 0; j < 5; j++) if (ourKick(rng, seq(rng, j), false, history)) goals++
  }
  return goals / n
}

// One kick at a time, the keeper with nothing to remember.
function tally(rng, shot, n) {
  const out = {}
  for (let i = 0; i < n; i++) {
    const f = launch(typeof shot === 'function' ? shot(rng) : shot, rng)
    const r = simulate(f, keeperPlan(f, keeperLevel(), rng))
    out[r.outcome] = (out[r.outcome] || 0) + 1 / n
  }
  return { goal: 0, saved: 0, over: 0, ...out }
}
const shot = (aimX, aimY, power) => ({ aimX, aimY, power, curve: 0 })

describe('the computer keeper', { timeout: 120000 }, () => {
  it('guesses about as often as it is set to, and reads the rest', () => {
    const rng = makeRng(1)
    let guessed = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const plan = keeperPlan(launch(shot(0.6, 0.4, 0.6)), keeperLevel(), rng)
      if (plan.guessed) guessed++
    }
    expect(guessed / n).toBeGreaterThan(KEEPER.guessRate - 0.03)
    expect(guessed / n).toBeLessThan(KEEPER.guessRate + 0.03)
  })

  it('moves within fair bounds: a guess near the strike, a read a moment after, never out of reach', () => {
    const rng = makeRng(2)
    for (let i = 0; i < 2000; i++) {
      const flight = launch({ aimX: rng.range(-1, 1), aimY: rng(), power: rng() })
      const plan = keeperPlan(flight, keeperLevel(), rng)
      if (plan.guessed) {
        expect(plan.start).toBeGreaterThanOrEqual(-0.08)
        expect(plan.start).toBeLessThanOrEqual(0.04)
      } else {
        expect(plan.start).toBeGreaterThanOrEqual(KEEPER.reaction[0])
        expect(plan.start).toBeLessThanOrEqual(KEEPER.reaction[1])
      }
      const time = predictCrossing(flight, 1).t - plan.start
      expect(inReach(plan.target, keeperLevel().reach + 1e-6, time)).toBe(true)
      expect(plan.duration).toBeGreaterThan(0.1)
      expect(plan.duration).toBeLessThan(1)
    }
  })

  it('reacts to placement: a read dives the way the ball goes', () => {
    const rng = makeRng(3)
    let right = 0
    let reads = 0
    for (let i = 0; i < 2000; i++) {
      const plan = keeperPlan(launch(shot(0.75, 0.4, 0.6)), keeperLevel(), rng)
      if (plan.guessed) continue
      reads++
      if (plan.target.x > 0) right++
    }
    expect(right / reads).toBeGreaterThan(0.95)
  })

  it('saves a shot at the middle more often than one at a corner, and gives up a placed corner only about one time in five', () => {
    const rng = makeRng(4)
    const at = (aimX, aimY, power) => (r) => shot(either(r) * aimX, aimY, power)
    const middle = tally(rng, at(0.1, 0.3, 0.6), 2000)
    const corner = tally(rng, at(0.84, 0, 0.5), 2000)
    expect(middle.saved).toBeGreaterThan(corner.saved + 0.1)
    expect(corner.goal).toBeGreaterThan(0.7)
    expect(corner.goal).toBeLessThan(0.82)
  })

  it('gets to a soft placed shot more than a firm one', () => {
    const rng = makeRng(5)
    const low = (power) => (r) => shot(either(r) * 0.84, 0.1, power)
    const high = (power) => (r) => shot(either(r) * 0.84, 0.8, power)
    expect(tally(rng, low(0.1), 2000).saved).toBeGreaterThan(tally(rng, low(0.5), 2000).saved + 0.05)
    expect(tally(rng, high(0.1), 2000).saved).toBeGreaterThan(tally(rng, high(0.5), 2000).saved + 0.05)
  })

  it('leaves a hard hit corner to luck: it beats the keeper, but often misses', () => {
    const rng = makeRng(6)
    const corner = (power) => (r) => shot(either(r) * 0.84, 0.8, power)
    const firm = tally(rng, corner(0.5), 2000)
    const hard = tally(rng, corner(0.9), 2000)
    expect(hard.saved).toBeLessThan(0.08)
    expect(1 - hard.goal - hard.saved).toBeGreaterThan(0.3)
    expect(hard.goal).toBeLessThan(firm.goal - 0.1)
  })

  it('remembers the whole shootout: a side and a height used, the later kicks counting more, and a visitor who always switches', () => {
    expect(habit([])).toEqual({ side: 0, sideBy: 0, height: null, heightBy: 0 })
    expect(habit([{ side: 1, low: true }])).toEqual({ side: 0, sideBy: 0, height: null, heightBy: 0 })
    const same = habit([{ side: 1, low: true }, { side: 1, low: true }, { side: 1, low: true }])
    expect(same).toMatchObject({ side: 1, height: 'low' })
    expect(same.sideBy).toBe(1)
    // Three to the right then one to the left: still expected right, less surely.
    const mostly = habit([{ side: 1, low: true }, { side: 1, low: false }, { side: 1, low: true }, { side: -1, low: false }])
    expect(mostly.side).toBe(1)
    expect(mostly.sideBy).toBeLessThan(0.5)
    // Left, right, left: the next is expected right, and so is the height's switch.
    const switching = habit([{ side: -1, low: true }, { side: 1, low: false }, { side: -1, low: true }])
    expect(switching).toMatchObject({ side: 1, height: 'high' })
    // Mixed: nothing to go on.
    expect(habit([{ side: -1, low: true }, { side: 1, low: true }, { side: 1, low: false }, { side: -1, low: false }]).sideBy).toBeLessThan(0.2)

    const rng = makeRng(7)
    const history = [{ side: 1, low: true }, { side: 1, low: true }, { side: 1, low: true }]
    let guessed = 0
    let thatWay = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const plan = keeperPlan(launch(shot(0.7, 0.2, 0.5)), keeperLevel(), rng, history)
      if (!plan.guessed) continue
      guessed++
      if (plan.target.x > 0) thatWay++
    }
    expect(guessed / n).toBeGreaterThan(KEEPER.guessRate + KEEPER.habitGuess - 0.04)
    expect(thatWay / guessed).toBeGreaterThan(0.7)
  })

  it('makes one aim and power taken every time score less as it learns it', () => {
    const rng = makeRng(8)
    let first = 0
    let later = 0
    const n = 3000
    for (let i = 0; i < n; i++) {
      const history = []
      for (let j = 0; j < 5; j++) {
        const scored = ourKick(rng, shot(0.84, 0, 0.5), false, history)
        if (j < 2 && scored) first++
        if (j >= 2 && scored) later++
      }
    }
    expect(later / (n * 3)).toBeLessThan(first / (n * 2) - 0.05)
  })

  it('has no aim and power that scores much more than four times in five, whatever there is to remember', () => {
    // A grid over the goal and every power, one kick at a time against a
    // keeper with nothing to remember, the side at random; the best few
    // are measured again more closely.
    const rng = makeRng(9)
    const grid = []
    for (const x of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      for (const y of [0, 0.2, 0.4, 0.6, 0.75, 0.85]) {
        for (const p of [0.1, 0.2, 0.35, 0.5, 0.65, 0.8]) grid.push({ x, y, p, rate: tally(rng, (r) => shot(either(r) * x, y, p), 150).goal })
      }
    }
    grid.sort((a, b) => b.rate - a.rate)
    const best = grid.slice(0, 3).map((g) => ({ ...g, rate: tally(rng, (r) => shot(either(r) * g.x, g.y, g.p), 3000).goal }))
    best.sort((a, b) => b.rate - a.rate)
    expect(best[0].rate).toBeLessThan(0.81)
    // And the same shots taken five times a shootout every way a visitor
    // might: the same every time, turn and turn about, switching height
    // too, at random, or two one way then two the other to bait the memory.
    const { x, y, p } = best[0]
    const ways = {
      same: () => shot(x, y, p),
      alternate: (r, j) => shot((j % 2 ? -1 : 1) * x, y, p),
      alternateHeights: (r, j) => shot((j % 2 ? -1 : 1) * 0.75, j % 2 ? 0.75 : 0, 0.5),
      random: (r) => shot(either(r) * x, y, p),
      randomCorners: (r) => shot(either(r) * 0.8, r() < 0.5 ? 0 : 0.75, 0.5),
      bait: (r, j) => shot([1, 1, -1, -1, 1][j] * x, y, p),
      baitLow: (r, j) => shot([1, 1, -1, -1, 1][j] * 0.7, 0, 0.65),
    }
    for (const [way, seq] of Object.entries(ways)) expect(patternRate(rng, seq, 2500), way).toBeLessThan(0.81)
  })

  it('is a little sharper in sudden death, and no more', () => {
    const sd = keeperLevel({ suddenDeath: true })
    expect(sd.guessRate).toBeCloseTo(KEEPER.guessRate + SUDDEN_DEATH.guessRate)
    expect(sd.reach).toBeGreaterThan(KEEPER.reach)
    expect(sd.reach).toBeLessThanOrEqual(KEEPER.reach * 1.06)
    expect(sd.reaction[0]).toBeLessThan(KEEPER.reaction[0])
    const rng = makeRng(10)
    const rate = (suddenDeath) => {
      let scored = 0
      for (let i = 0; i < 8000; i++) {
        const f = launch(firstTimerShot(rng), rng)
        if (simulate(f, keeperPlan(f, keeperLevel({ suddenDeath }), rng)).scored) scored++
      }
      return scored / 8000
    }
    const normal = rate(false)
    const sudden = rate(true)
    expect(sudden).toBeLessThan(normal)
    expect(normal - sudden).toBeLessThan(0.06)
  })
})

describe('the computer takers', { timeout: 60000 }, () => {
  it('gives the side away about as honestly as each taker is set to', () => {
    const rng = makeRng(11)
    for (const [kind, t] of Object.entries(TAKERS)) {
      let honest = 0
      let sided = 0
      for (let i = 0; i < 4000; i++) {
        const p = takerPlan(rng, takerLevel(), kind)
        if (p.dir === 0) continue
        sided++
        if (p.tell.dir === p.dir) honest++
      }
      expect(honest / sided, kind).toBeGreaterThan(t.honesty - 0.03)
      expect(honest / sided, kind).toBeLessThan(t.honesty + 0.03)
    }
    // The stutter sells a dummy more often than the rest.
    expect(TAKERS.stutter.honesty).toBeLessThan(Math.min(TAKERS.steady.honesty, TAKERS.striker.honesty, TAKERS.chipper.honesty))
  })

  it('never runs up to the same rhythm: run ups from 1.1 to 1.8 s, with stops in some', () => {
    const rng = makeRng(12)
    const times = []
    let paused = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const kind = takerFor(takerOrder(rng), Math.floor(rng() * 6), rng)
      const p = takerPlan(rng, takerLevel(), kind)
      expect(p.runup.duration).toBeGreaterThanOrEqual(1.1)
      expect(p.runup.duration).toBeLessThanOrEqual(1.8)
      if (p.runup.pause > 0) paused++
      if (kind === 'stutter') expect(p.runup.pause).toBeGreaterThan(0.2)
      times.push(runupTime(p))
    }
    const mean = times.reduce((a, b) => a + b, 0) / n
    const spread = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
    expect(spread).toBeGreaterThan(0.2)
    expect(paused / n).toBeGreaterThan(0.2)
    expect(paused / n).toBeLessThan(0.6)
  })

  it('stands still in a stop, then finishes the run up', () => {
    const plan = { runup: { duration: 1.4, pauseAt: 0.5, pause: 0.4 } }
    expect(runupTime(plan)).toBeCloseTo(1.8)
    expect(runupProgress(plan, 0.35)).toEqual({ u: 0.25, paused: false })
    expect(runupProgress(plan, 0.8)).toEqual({ u: 0.5, paused: true })
    expect(runupProgress(plan, 1.2).u).toBeCloseTo(0.8 / 1.4)
    expect(runupProgress(plan, 1.2).paused).toBe(false)
    expect(runupProgress(plan, 1.8).u).toBeCloseTo(1)
  })

  it('has five takers of their own kinds, in a fresh order, and any of them in sudden death, none with a look of its own', () => {
    const rng = makeRng(13)
    const orders = new Set()
    for (let i = 0; i < 50; i++) {
      const order = takerOrder(rng)
      expect([...order].sort()).toEqual(['chipper', 'steady', 'steady', 'striker', 'stutter'])
      orders.add(order.join())
      for (let k = 0; k < 5; k++) expect(takerFor(order, k, rng)).toBe(order[k])
      expect(Object.keys(TAKERS)).toContain(takerFor(order, 5 + i, rng))
    }
    expect(orders.size).toBeGreaterThan(10)
    // How a taker looks is the game's to pick at random, never the kind's.
    for (const kind of Object.keys(TAKERS)) {
      expect(TAKERS[kind].look).toBeUndefined()
      expect(takerPlan(rng, takerLevel(), kind).look).toBeUndefined()
    }
  })

  it('has a striker who hits it harder and a chipper who now and then chips it down the middle', () => {
    const rng = makeRng(14)
    const mean = (kind, key) => {
      let sum = 0
      for (let i = 0; i < 2000; i++) sum += takerPlan(rng, takerLevel(), kind).shot[key]
      return sum / 2000
    }
    expect(mean('striker', 'power')).toBeGreaterThan(mean('steady', 'power') + 0.2)
    let chips = 0
    for (let i = 0; i < 4000; i++) {
      const p = takerPlan(rng, takerLevel(), 'chipper')
      if (!p.chip) continue
      chips++
      expect(p.dir).toBe(0)
      expect(Math.abs(p.shot.aimX)).toBeLessThan(0.3)
      expect(p.shot.power).toBeLessThan(0.25)
      expect(p.tell.dir).not.toBe(0)
    }
    expect(chips / 4000).toBeGreaterThan(TAKERS.chipper.chip - 0.03)
    expect(chips / 4000).toBeLessThan(TAKERS.chipper.chip + 0.03)
    for (const kind of ['steady', 'stutter', 'striker']) expect(takerPlan(rng, takerLevel(), kind).chip).toBe(false)
  })

  it('switches sides on a keeper who goes too early, and never on one who waits', () => {
    const rng = makeRng(15)
    let switched = 0
    for (let i = 0; i < 2000; i++) {
      const plan = { ...takerPlan(rng), dir: 1 }
      const early = answerEarlyDive(plan, 1, -0.5, rng)
      if (early.switched) {
        switched++
        expect(early.shot.aimX).toBeLessThan(0)
      }
      expect(answerEarlyDive(plan, 1, -0.2, rng).switched).toBe(false)
      expect(answerEarlyDive(plan, null, -0.6, rng).switched).toBe(false)
    }
    expect(switched / 2000).toBeGreaterThan(TAKER.punishEarly - 0.04)
    expect(switched / 2000).toBeLessThan(TAKER.punishEarly + 0.04)
  })

  it('misses now and then, as takers do, and a little less in sudden death', () => {
    const rng = makeRng(16)
    const offTarget = (suddenDeath) => {
      let off = 0
      for (let i = 0; i < 4000; i++) {
        const kind = takerFor(takerOrder(rng), Math.floor(rng() * 5), rng)
        if (!simulate(takerFlight(takerPlan(rng, takerLevel({ suddenDeath }), kind), rng), null).scored) off++
      }
      return off / 4000
    }
    const normal = offTarget(false)
    expect(normal).toBeGreaterThan(0.08)
    expect(normal).toBeLessThan(0.22)
    expect(offTarget(true)).toBeLessThan(normal)
  })
})

describe('the visitor in goal', { timeout: 120000 }, () => {
  // Their kicks faced with one way of diving.
  const savedBy = (pick, n = 4000, seed = 17, level = PLAYER_KEEPER) => {
    const rng = makeRng(seed)
    let saved = 0
    for (let i = 0; i < n; i++) {
      const kind = takerFor(takerOrder(rng), Math.floor(rng() * 5), rng)
      if (!theirKick(rng, pick, false, kind, level)) saved++
    }
    return saved / n
  }
  const trueSide = (start) => (rng, p) => ({ dir: p.dir, start })

  it('saves more going the right way than the wrong way', () => {
    const right = savedBy(trueSide(0.02))
    const wrong = savedBy((rng, p) => ({ dir: p.dir === 0 ? 1 : -p.dir, start: 0.02 }))
    expect(right).toBeGreaterThan(wrong + 0.15)
    expect(wrong).toBeLessThan(0.3)
  })

  it('cannot save by reading the tells alone: a perfect reader saves at most about 45 in 100, whenever the dive goes', () => {
    const at = [-0.2, -0.1, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((start) => savedBy((rng, p) => ({ dir: p.tell.dir, start }), 2500))
    expect(Math.max(...at)).toBeLessThan(0.46)
    expect(Math.max(...at)).toBeGreaterThan(0.35)
  })

  it('goes for a rough read of the ball as it is struck, a sharper one as it travels, and a rougher one still off the run up', () => {
    const rng = makeRng(18)
    const flight = launch(shot(0.6, 0.3, 0.3))
    const spread = (start) => {
      const xs = []
      for (let i = 0; i < 600; i++) xs.push(playerDivePlan(1, start, flight, rng).target.x)
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
    }
    expect(spread(0.02)).toBeGreaterThan(0.3)
    expect(spread(0.4)).toBeLessThan(spread(0.02))
    expect(spread(PLAYER_KEEPER.readSettles)).toBeLessThan(1e-9)
    // With no random source there is no read before the strike: only a side.
    const early = playerDivePlan(1, -0.1, flight)
    expect(early.target).toEqual({ x: PLAYER_KEEPER.generic.side.x, y: PLAYER_KEEPER.generic.side.y })
  })

  it('pays for going too early: a dive the taker sees is beaten more often', () => {
    const early = savedBy(trueSide(-0.5))
    const onTime = savedBy(trueSide(-0.1))
    expect(early).toBeLessThan(onTime - 0.1)
  })

  it('does better reacting quickly to the ball than diving at the strike, and nothing once it is there', () => {
    const atStrike = savedBy(trueSide(0.02))
    const quick = savedBy(trueSide(0.25))
    expect(quick).toBeGreaterThan(atStrike)
    expect(savedBy(trueSide(3), 1500)).toBe(savedBy(() => ({ dir: null, start: 0 }), 1500))
  })

  it('is a little kinder in a device\'s first shootout, for the first two saves only', () => {
    expect(FIRST_GAME.saves).toBe(2)
    expect(playerKeeperLevel({ kind: false })).toBe(PLAYER_KEEPER)
    const kind = playerKeeperLevel({ kind: true })
    expect(kind.reach).toBeGreaterThan(PLAYER_KEEPER.reach)
    expect(kind.speed).toBeGreaterThan(PLAYER_KEEPER.speed)
    expect(kind.grace).toBeGreaterThan(0)
    // A slow child, tapping late and the right way three times in five.
    const late = (rng, p) => ({ dir: rng() < 0.6 ? (p.dir === 0 ? either(rng) : p.dir) : (p.dir === 0 ? either(rng) : -p.dir), start: rng.range(0.3, 0.55) })
    const usual = savedBy(late, 4000, 19)
    const kinder = savedBy(late, 4000, 19, kind)
    expect(kinder).toBeGreaterThan(usual + 0.03)
    expect(kinder).toBeLessThan(usual + 0.2)
  })
})

describe('the tuning, against a first-time visitor and a skilled one', { timeout: 120000 }, () => {
  it('a first-timer on a phone held upright scores about three of five, concedes about as many and wins about half', () => {
    const b = shootouts(20261110, 3000, firstTimerShot, firstTimerDive)
    expect(b.perFive).toBeGreaterThan(2.7)
    expect(b.perFive).toBeLessThan(3.3)
    expect(Math.abs(b.score - b.concede)).toBeLessThan(0.06)
    expect(b.win).toBeGreaterThan(0.42)
    expect(b.win).toBeLessThan(0.56)
  })

  it('plays the same on a phone on its side and with a mouse on a desktop: the flick is measured against the goal, not the screen', () => {
    const rate = (shape) => tally(makeRng(21), firstTimer(shape), 6000)
    const upright = rate(SHAPES.upright)
    for (const shape of ['side', 'desktop']) {
      const other = rate(SHAPES[shape])
      expect(Math.abs(other.goal - upright.goal), shape).toBeLessThan(0.04)
      expect(Math.abs(other.over - upright.over), shape).toBeLessThan(0.03)
    }
    expect(upright.over).toBeLessThan(0.1)
    const side = shootouts(22, 1500, firstTimer(SHAPES.side), firstTimerDive)
    expect(side.perFive).toBeGreaterThan(2.7)
    expect(side.win).toBeGreaterThan(0.4)
  })

  it('a skilled visitor who mixes the corners and reacts to the ball wins at most about 85 in 100', () => {
    const mix = (rng) => shot(either(rng) * 0.75, rng() < 0.5 ? 0 : 0.7, 0.6)
    const e = shootouts(23, 2000, mix, reactor)
    expect(e.win).toBeGreaterThan(0.72)
    expect(e.win).toBeLessThan(0.86)
    expect(e.score).toBeLessThan(0.81)
    // Turn and turn about, low then high, is no better.
    const alternate = shootouts(24, 1500, (rng, j) => shot((j % 2 ? -1 : 1) * 0.7, j % 2 ? 0.7 : 0, 0.65), reactor)
    expect(alternate.win).toBeLessThan(0.86)
  })
})
