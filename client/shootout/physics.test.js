// The ball's flight and what it meets: a goal, a save, the post, the
// crossbar, over and wide, the net catching it, and the frame sending
// it back the way a frame does. And the picture agreeing with the
// result: a goal stays in the goal, a miss stays out of it.
//
// Run with: npx vitest run client/shootout/physics.test.js

import { describe, it, expect } from 'vitest'
import {
  BALL_R, BOARDS_Z, GOAL, KEEPER_Z, SHOT, aimPoint, clampToReach, diveDuration, inReach, keeperPose, launch,
  liftFor, pathAt, predictCrossing, reachShape, simulate, speedFor, spreadFor,
} from './physics.js'
import { keeperLevel, keeperPlan } from './keeper.js'
import { makeRng } from './rng.js'

const NOBODY = null
const READY = { kind: 'ready', start: 0, duration: 1 }
const fly = (shot, plan = NOBODY) => simulate(launch(shot), plan)
const last = (path) => ({ x: path[path.length - 3], y: path[path.length - 2], z: path[path.length - 1] })

describe('a shot', () => {
  it('goes where it is aimed, with no error drawn', () => {
    const f = launch({ aimX: 0.5, aimY: 0.3, power: 0.6, curve: 0 })
    const at = predictCrossing(f, 1)
    const aim = aimPoint({ aimX: 0.5, aimY: 0.3 })
    // The keeper's line is a step in front of the goal line.
    expect(at.x).toBeCloseTo(aim.x * (Math.abs(KEEPER_Z) / Math.abs(GOAL.lineZ)), 1)
    expect(f.aimed.x).toBeCloseTo(aim.x, 6)
    expect(f.aimed.y).toBeCloseTo(aim.y, 6)
  })

  it('is faster, lifts and strays more with power', () => {
    expect(speedFor(1)).toBeGreaterThan(speedFor(0.5))
    expect(liftFor(0.5)).toBe(0)
    expect(liftFor(1)).toBeCloseTo(SHOT.maxLift)
    expect(spreadFor(1)).toBeGreaterThan(spreadFor(0.3))
    expect(spreadFor(0.5, 1)).toBeGreaterThan(spreadFor(0.5, 0))
  })

  it('bends the way its curve says and finishes past its aim', () => {
    const straight = launch({ aimX: 0.3, aimY: 0.5, power: 0.6, curve: 0 })
    const bent = launch({ aimX: 0.3, aimY: 0.5, power: 0.6, curve: 1 })
    expect(bent.a.x).toBeGreaterThan(0)
    expect(bent.aimed.x).toBeGreaterThan(straight.aimed.x)
    // It sets off to the left of the straight shot, and swings back.
    expect(bent.v.x).toBeLessThan(straight.v.x)
  })

  it('draws its error from the random source, the same every time for a seed', () => {
    const a = launch({ aimX: 0.4, aimY: 0.4, power: 0.9 }, makeRng(5))
    const b = launch({ aimX: 0.4, aimY: 0.4, power: 0.9 }, makeRng(5))
    expect(a.aimed).toEqual(b.aimed)
    expect(a.aimed.x).not.toBeCloseTo(aimPoint({ aimX: 0.4, aimY: 0.4 }).x, 3)
  })
})

describe('what happens to it', () => {
  it('is a goal inside the posts and under the bar, and the net catches it', () => {
    const r = fly({ aimX: 0.5, aimY: 0.2, power: 0.6 })
    expect(r.outcome).toBe('goal')
    expect(r.scored).toBe(true)
    const types = r.events.map((e) => e.type)
    expect(types).toContain('line')
    expect(types).toContain('net')
    // Caught by the net: it ends in the goal, behind the line, not far beyond it.
    const end = last(r.path)
    expect(end.z).toBeLessThan(GOAL.lineZ)
    expect(end.z).toBeGreaterThan(GOAL.lineZ - GOAL.depthBottom - GOAL.post - 0.01)
    expect(Math.abs(end.x)).toBeLessThan(GOAL.halfWidth)
    expect(r.decidedAt).toBeCloseTo(r.events.find((e) => e.type === 'line').t, 5)
  })

  it('is saved when the keeper is where it goes', () => {
    const r = fly({ aimX: 0, aimY: 0.35, power: 0.5 }, READY)
    expect(r.outcome).toBe('saved')
    expect(r.keeperTouch).toBe(true)
    expect(r.events[0].type).toBe('keeper')
  })

  it('is a goal past a keeper who dives the wrong way', () => {
    const plan = { kind: 'dive', start: 0, duration: diveDuration({ x: -2.4, y: 1 }), target: { x: -2.4, y: 1 } }
    expect(fly({ aimX: 0.7, aimY: 0.3, power: 0.6 }, plan).outcome).toBe('goal')
  })

  it('is saved by a dive the right way, in time', () => {
    const target = { x: 2.3, y: 0.9 }
    const plan = { kind: 'dive', start: -0.05, duration: diveDuration(target), target }
    expect(fly({ aimX: 0.62, aimY: 0.35, power: 0.5 }, plan).outcome).toBe('saved')
  })

  it('goes in past a dive that comes too late', () => {
    const target = { x: 2.3, y: 0.9 }
    const plan = { kind: 'dive', start: 0.45, duration: diveDuration(target), target }
    expect(fly({ aimX: 0.62, aimY: 0.35, power: 0.8 }, plan).outcome).toBe('goal')
  })

  it('hits the post, rings and comes back out', () => {
    const r = fly({ aimX: 1.02, aimY: 0.4, power: 0.6 })
    expect(r.outcome).toBe('post')
    expect(r.woodwork).toBe('post')
    const hit = r.events.find((e) => e.type === 'post')
    expect(hit).toBeTruthy()
    expect(r.decidedAt).toBeCloseTo(hit.t, 5)
    // It bounces back towards the pitch.
    expect(last(r.path).z).toBeGreaterThan(GOAL.lineZ)
  })

  it('can go in off the post, and is a goal', () => {
    const r = fly({ aimX: 0.985, aimY: 0.4, power: 0.6 })
    expect(r.outcome).toBe('goal')
    expect(r.woodwork).toBe('post')
    const types = r.events.map((e) => e.type)
    expect(types.indexOf('post')).toBeLessThan(types.indexOf('line'))
  })

  it('hits the crossbar, and the bar sends it down and back', () => {
    const r = fly({ aimX: 0.3, aimY: 1.0, power: 0.6 })
    expect(r.outcome).toBe('bar')
    const i = r.events.findIndex((e) => e.type === 'bar')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(last(r.path).z).toBeGreaterThan(GOAL.lineZ)
  })

  it('goes over with too much power', () => {
    const r = fly({ aimX: 0.3, aimY: 0.8, power: 1 })
    expect(r.outcome).toBe('over')
    // The same aim with less power is on target.
    expect(fly({ aimX: 0.3, aimY: 0.8, power: 0.7 }).outcome).toBe('goal')
  })

  it('strays more aimed at a post or under the bar', () => {
    expect(spreadFor(0.5, 0, 0.9)).toBeGreaterThan(spreadFor(0.5, 0, 0.5))
    expect(spreadFor(0.5, 0, 0.5, 0.9)).toBeGreaterThan(spreadFor(0.5, 0, 0.5, 0.4))
    expect(spreadFor(0.5, 0, 0.5, 0.4)).toBe(spreadFor(0.5, 0, 0.5, 0))
  })

  it('goes wide past the post', () => {
    expect(fly({ aimX: 1.25, aimY: 0.3, power: 0.6 }).outcome).toBe('wide')
    expect(fly({ aimX: -1.25, aimY: 0.3, power: 0.6 }).outcome).toBe('wide')
  })

  it('settles every shot, with a time it was settled', () => {
    const rng = makeRng(11)
    for (let i = 0; i < 300; i++) {
      const shot = { aimX: rng.range(-1.4, 1.4), aimY: rng.range(0, 1.3), power: rng(), curve: rng.range(-1, 1) }
      const r = simulate(launch(shot, rng), READY)
      expect(['goal', 'saved', 'post', 'bar', 'over', 'wide']).toContain(r.outcome)
      expect(r.decidedAt).toBeGreaterThan(0)
      expect(r.decidedAt).toBeLessThan(2)
      expect(r.path.length % 4).toBe(0)
    }
  })
})

describe('the keeper', () => {
  it('reaches the middle more easily than the corners', () => {
    expect(inReach({ x: 0, y: 1 })).toBe(true)
    expect(inReach({ x: 2.5, y: 1 })).toBe(true)
    expect(inReach({ x: 3.4, y: 2.2 })).toBe(false)
    expect(inReach({ x: 3.3, y: 0.15 })).toBe(false)
    const corner = clampToReach({ x: 3.6, y: 2.3 })
    expect(Math.hypot(corner.x - 3.6, corner.y - 2.3)).toBeGreaterThan(0.6)
    expect(diveDuration({ x: 3, y: 1 })).toBeGreaterThan(diveDuration({ x: 1, y: 1 }))
  })

  it('stands ready until the plan starts, then stretches to the target', () => {
    const target = { x: 2.4, y: 1.0 }
    const plan = { kind: 'dive', start: 0.2, duration: 0.5, target }
    expect(keeperPose(plan, 0.1).kind).toBe('ready')
    const mid = keeperPose(plan, 0.45)
    const end = keeperPose(plan, 0.8)
    expect(mid.hands.x).toBeGreaterThan(0.3)
    expect(mid.hands.x).toBeLessThan(end.hands.x)
    expect(end.hands.x).toBeCloseTo(target.x, 5)
    expect(end.hands.y).toBeCloseTo(target.y, 5)
    expect(end.lean).toBeGreaterThan(0.5)
  })

  it('gets further the more time the ball gives, across most and more down to the grass than up', () => {
    const quick = reachShape(1, 0.25)
    const slow = reachShape(1, 1)
    expect(slow.x).toBeGreaterThan(quick.x)
    expect(slow.down - quick.down).toBeGreaterThan(slow.up - quick.up)
    expect(inReach({ x: 3.3, y: 0.2 }, 1, 0.25)).toBe(false)
    expect(inReach({ x: 3.3, y: 0.2 }, 1, 1)).toBe(true)
  })

  it('holds a gentle shot at the body', () => {
    const r = fly({ aimX: 0, aimY: 0.35, power: 0.3 }, READY)
    expect(r.caught).toBe(true)
    const end = last(r.path)
    expect(end.z).toBeGreaterThan(KEEPER_Z - 0.01)
    expect(end.y).toBeGreaterThan(BALL_R)
  })
})

describe('the picture agrees with the result', { timeout: 60000 }, () => {
  // Wholly over the line, inside the posts, under the bar and in front of
  // the net: in the goal.
  const OVER = GOAL.lineZ - GOAL.post - BALL_R
  const netBack = (y) => GOAL.lineZ - GOAL.post - (GOAL.depthBottom + (GOAL.depthTop - GOAL.depthBottom) * Math.min(1, Math.max(0, y / GOAL.height)))
  const inGoal = (x, y, z) => z < OVER && z > netBack(y) && Math.abs(x) < GOAL.halfWidth && y < GOAL.height
  const points = (path) => {
    const out = []
    for (let j = 0; j < path.length; j += 4) out.push({ t: path[j], x: path[j + 1], y: path[j + 2], z: path[j + 3] })
    return out
  }
  // Shots of every kind, at nobody, a keeper standing, and the computer keeper.
  const shots = (seed, n, each) => {
    const rng = makeRng(seed)
    for (let i = 0; i < n; i++) {
      const shot = { aimX: rng.range(-1.4, 1.4), aimY: rng.range(0, 1.4), power: rng(), curve: rng.range(-1, 1) }
      const flight = launch(shot, rng)
      const m = rng()
      const plan = m < 0.3 ? null : m < 0.4 ? READY : keeperPlan(flight, keeperLevel(), rng)
      each(simulate(flight, plan), plan, shot)
    }
  }

  it('keeps every goal in the goal once it is over the line, however hard it was hit', () => {
    let goals = 0
    shots(41, 2000, (r) => {
      if (!r.scored) return
      goals++
      const line = r.events.find((e) => e.type === 'line')
      for (const p of points(r.path).filter((q) => q.t > line.t)) {
        expect(p.z).toBeLessThanOrEqual(OVER + 1e-4)
        expect(p.z).toBeGreaterThanOrEqual(netBack(p.y) - 1e-4)
        expect(Math.abs(p.x)).toBeLessThanOrEqual(GOAL.halfWidth + 1e-4)
        expect(p.y).toBeLessThanOrEqual(GOAL.height + 1e-4)
      }
    })
    expect(goals).toBeGreaterThan(500)
  })

  it('never lets a miss or a save into the goal, by the mouth or through the net', () => {
    const seen = new Set()
    shots(42, 2000, (r, plan, shot) => {
      if (r.scored) return
      seen.add(r.outcome)
      for (const p of points(r.path)) expect(inGoal(p.x, p.y, p.z), `${r.outcome} ${JSON.stringify(shot)} at ${p.t}`).toBe(false)
    })
    expect([...seen].sort()).toEqual(['bar', 'over', 'post', 'saved', 'wide'])
  })

  it('lands a miss on the outside of the net, and stops one past it at the boards', () => {
    const roof = fly({ aimX: 0.2, aimY: 1.12, power: 0.45 })
    expect(roof.outcome).toBe('over')
    const end = last(roof.path)
    expect(end.z).toBeLessThan(GOAL.lineZ)
    expect(end.z).toBeGreaterThanOrEqual(BOARDS_Z)
    // Nothing that missed comes back out in front of the goal.
    shots(43, 1500, (r) => {
      if (r.outcome !== 'over' && r.outcome !== 'wide') return
      expect(last(r.path).z).toBeLessThan(GOAL.lineZ)
    })
  })

  it('settles a caught ball in the keeper\'s arms, at the chest', () => {
    let caught = 0
    shots(44, 2000, (r, plan) => {
      if (!r.caught) return
      caught++
      const end = last(r.path)
      const pose = keeperPose(plan, r.path[r.path.length - 4])
      expect(end.x).toBeCloseTo(pose.chest.x, 2)
      expect(end.y).toBeCloseTo(Math.max(BALL_R, pose.chest.y), 2)
      expect(end.z).toBeCloseTo(KEEPER_Z + 0.24, 2)
      // Between the feet and the gloves, never up by the head.
      expect(end.y).toBeLessThan(Math.max(pose.hands.y, BALL_R) + 0.1)
    })
    expect(caught).toBeGreaterThan(40)
  })
})

describe('the path', () => {
  it('is read at any time, between its points', () => {
    const r = fly({ aimX: 0.4, aimY: 0.3, power: 0.6 })
    const start = pathAt(r.path, 0)
    expect(start.z).toBeCloseTo(0, 5)
    const a = pathAt(r.path, 0.2)
    const b = pathAt(r.path, 0.21)
    expect(b.z).toBeLessThan(a.z)
    expect(pathAt(r.path, 99)).toEqual(last(r.path))
  })
})
