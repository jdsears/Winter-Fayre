// Netball shot's rules (rules.js): where each shot is taken from, what a
// flick becomes, how the ball flies and what scores.

import { describe, it, expect } from 'vitest'
import {
  SECONDS, RING, BALL_R, HANDS, APEX, CAPTURE, RIM, REACH, ASSIST, SPOT, FLIGHT, RISE, spotFor, shotFromSwipe, ballAt, missBy, outcome,
  SAID, BEST_KEY, readBest, keepBest,
} from './rules.js'

const always = (v) => () => v
// A straight flick up the screen by `up` pixels, slanting `dx` across.
const flick = (dx, up, from = { x: 200, y: 720 }) => [from, { x: from.x + dx / 2, y: from.y - up / 2 }, { x: from.x + dx, y: from.y - up }]
const PHONE = { tall: 844 }

describe('where a shot is taken from', () => {
  it('the first is close and straight in front; every goal moves the next further back, to a point', () => {
    expect(spotFor(0)).toEqual({ d: SPOT.first, turn: 0 })
    let last = 0
    for (let goals = 0; goals <= 12; goals++) {
      const s = spotFor(goals, always(0.5))
      expect(s.d).toBeGreaterThanOrEqual(last)
      expect(s.d).toBeLessThanOrEqual(SPOT.last)
      last = s.d
    }
    expect(spotFor(1, always(0.5)).d).toBeCloseTo(SPOT.first + SPOT.step, 9)
    expect(spotFor(8, always(0.5)).d).toBe(SPOT.last)
    expect(spotFor(40, always(0.5)).d).toBe(SPOT.last)
  })

  it('after the first it is somewhere round the goal circle, either side', () => {
    expect(spotFor(3, always(0)).turn).toBeCloseTo(-0.95, 9)
    expect(spotFor(3, always(0.999)).turn).toBeGreaterThan(0.9)
    expect(spotFor(3, always(0.5)).turn).toBe(0)
    for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) expect(Math.abs(spotFor(5, always(r)).turn)).toBeLessThanOrEqual(0.95)
  })

  it('every spot is inside the goal circle', () => {
    for (let goals = 0; goals < 20; goals++) expect(spotFor(goals).d).toBeLessThan(4.9)
  })
})

describe('a flick', () => {
  it('carries further the longer it is, from the least to the most', () => {
    const reaches = [50, 120, 180, 240, 300, 338, 500].map(up => shotFromSwipe(flick(0, up), PHONE).reach)
    expect(reaches[0]).toBe(REACH.min)
    for (let i = 1; i < 6; i++) expect(reaches[i]).toBeGreaterThan(reaches[i - 1])
    expect(reaches[5]).toBe(REACH.max)
    expect(reaches[6]).toBe(REACH.max)
  })

  it('goes the way it points, with a thumb\'s slant counted for less', () => {
    expect(shotFromSwipe(flick(0, 200), PHONE).aim).toBe(0)
    const right = shotFromSwipe(flick(40, 200), PHONE).aim
    expect(right).toBeGreaterThan(0)
    expect(right).toBeCloseTo(Math.atan2(40, 200) * ASSIST, 3)
    expect(shotFromSwipe(flick(-40, 200), PHONE).aim).toBe(-right)
  })

  it('is measured against the screen, so it is the same flick on a small phone and a big one', () => {
    const small = shotFromSwipe(flick(0, 780 * 0.25, { x: 180, y: 660 }), { tall: 780 })
    const big = shotFromSwipe(flick(0, 932 * 0.25, { x: 215, y: 800 }), { tall: 932 })
    expect(small.reach).toBeCloseTo(big.reach, 1)
  })

  it('is no shot when it is too short, goes down, or there is nothing to read it against', () => {
    expect(shotFromSwipe(flick(0, 15), PHONE)).toBeNull()
    expect(shotFromSwipe(flick(0, -200), PHONE)).toBeNull()
    expect(shotFromSwipe(flick(200, 10), PHONE)).toBeNull()
    expect(shotFromSwipe([{ x: 1, y: 1 }], PHONE)).toBeNull()
    expect(shotFromSwipe(null, PHONE)).toBeNull()
    expect(shotFromSwipe(flick(0, 200), { tall: 0 })).toBeNull()
  })
})

describe('the flight', () => {
  it('leaves the hands, peaks above the ring and comes down to the ring\'s height when it has gone its distance', () => {
    const shot = { reach: 2.4, aim: 0 }
    expect(ballAt(shot, 0)).toEqual({ along: 0, side: 0, y: HANDS })
    const top = ballAt(shot, RISE / 9.81)
    expect(top.y).toBeCloseTo(APEX, 6)
    expect(APEX).toBeGreaterThan(RING.height + 0.5)
    const down = ballAt(shot, FLIGHT)
    expect(down.y).toBeCloseTo(RING.height, 6)
    expect(down.along).toBeCloseTo(2.4, 6)
    expect(down.side).toBeCloseTo(0, 9)
    // It is still coming down then, not going up.
    expect(ballAt(shot, FLIGHT + 0.05).y).toBeLessThan(RING.height)
  })

  it('takes the same time whatever the distance, a little over a second', () => {
    expect(FLIGHT).toBeGreaterThan(0.9)
    expect(FLIGHT).toBeLessThan(1.4)
    expect(ballAt({ reach: 1.3, aim: 0 }, FLIGHT).y).toBeCloseTo(ballAt({ reach: 3.7, aim: 0 }, FLIGHT).y, 9)
  })

  it('strays to the side it is aimed, and never goes under the ground', () => {
    expect(ballAt({ reach: 3, aim: 0.2 }, FLIGHT).side).toBeGreaterThan(0)
    expect(ballAt({ reach: 3, aim: -0.2 }, FLIGHT).side).toBeLessThan(0)
    expect(ballAt({ reach: 3, aim: 0 }, 30).y).toBe(BALL_R)
    expect(ballAt({ reach: 3, aim: 0 }, -1)).toEqual({ along: 0, side: 0, y: HANDS })
  })
})

describe('what scores', () => {
  const spot = { d: 2.5, turn: 0 }

  it('a ball that comes down in the ring is a goal, and near the middle is near enough', () => {
    expect(outcome(spot, { reach: 2.5, aim: 0 })).toBe('goal')
    expect(outcome(spot, { reach: 2.5 + CAPTURE - 0.01, aim: 0 })).toBe('goal')
    expect(outcome(spot, { reach: 2.5 - CAPTURE + 0.01, aim: 0 })).toBe('goal')
    expect(missBy(spot, { reach: 2.5, aim: 0 }).by).toBeCloseTo(0, 9)
  })

  it('just outside that it hits the ring and stays out', () => {
    expect(outcome(spot, { reach: 2.5 + CAPTURE + 0.02, aim: 0 })).toBe('rim')
    expect(outcome(spot, { reach: 2.5 - RIM + 0.01, aim: 0 })).toBe('rim')
  })

  it('further off it is short, long or wide', () => {
    expect(outcome(spot, { reach: 1.5, aim: 0 })).toBe('short')
    expect(outcome(spot, { reach: 3.6, aim: 0 })).toBe('long')
    expect(outcome(spot, { reach: 2.5, aim: 0.4 })).toBe('wide')
    expect(outcome(spot, { reach: 2.5, aim: -0.4 })).toBe('wide')
  })

  it('the ring is a real size: bigger than the ball, and kinder than a real one', () => {
    expect(RING.radius).toBeGreaterThan(BALL_R)
    expect(CAPTURE).toBeGreaterThan(RING.radius - BALL_R)
    expect(RIM).toBeGreaterThan(CAPTURE)
  })

  it('every spot can be scored from with a flick on a phone, and the right flick is a sensible length', () => {
    for (let goals = 0; goals <= 10; goals++) {
      const s = spotFor(goals, always(0.5))
      const lengths = []
      for (let up = 30; up <= 500; up += 1) {
        const shot = shotFromSwipe(flick(0, up), PHONE)
        if (shot && outcome(s, shot) === 'goal') lengths.push(up)
      }
      // A window a thumb can find: at least twenty pixels of flick score.
      expect(lengths.length).toBeGreaterThanOrEqual(20)
      expect(lengths[0]).toBeGreaterThan(60)
      expect(lengths[lengths.length - 1]).toBeLessThan(844 * 0.45)
    }
  })

  it('a flick that scores from close does not score from far back, and the other way round', () => {
    const near = shotFromSwipe(flick(0, 106), PHONE)
    const far = shotFromSwipe(flick(0, 265), PHONE)
    expect(outcome(spotFor(0), near)).toBe('goal')
    expect(outcome(spotFor(8), far)).toBe('goal')
    expect(outcome(spotFor(8), near)).toBe('short')
    expect(outcome(spotFor(0), far)).toBe('long')
  })

  it('has words for every outcome, and thirty seconds to play in', () => {
    for (const o of ['goal', 'rim', 'short', 'long', 'wide']) expect(SAID[o]).toMatch(/[.!]$/)
    expect(SECONDS).toBe(30)
  })
})

describe('the best on this device', () => {
  it('is kept, never lowered, and read with care', () => {
    const kept = new Map()
    const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) }
    expect(readBest(store)).toBe(0)
    expect(keepBest(store, 6)).toBe(6)
    expect(keepBest(store, 2)).toBe(6)
    expect(kept.get(BEST_KEY)).toBe('6')
    kept.set(BEST_KEY, 'lots')
    expect(readBest(store)).toBe(0)
    kept.set(BEST_KEY, '-4')
    expect(readBest(store)).toBe(0)
    expect(readBest(null)).toBe(0)
    expect(keepBest({ getItem() { throw new Error('no') }, setItem() { throw new Error('no') } }, 4)).toBe(4)
  })
})
