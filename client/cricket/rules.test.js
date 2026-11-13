// Cricket smash's rules (rules.js): what a swing is worth, how the six
// balls are made, how a ball flies, and where a hit one goes.

import { describe, it, expect } from 'vitest'
import {
  BALLS, MOST, TIMING, RUNS, BEYOND, REACH, OVER, SLOWER, BEST_KEY,
  judge, result, lateFor, stumpsAfter, timingWord, delivery, flight, stroke, readBest, keepBest,
} from './rules.js'

// A source of chance that gives the same numbers every time.
const dice = (...values) => { let i = 0; return () => values[i++ % values.length] }
// Every ball of the over, made a good many ways.
const every = (fn) => {
  for (let ball = 0; ball < BALLS; ball++) {
    for (let n = 0; n < 40; n++) fn(delivery(ball, dice((n * 0.137) % 1, (n * 0.311) % 1, (n * 0.53) % 1, (n * 0.71) % 1, (n * 0.19) % 1, (n * 0.83) % 1)), ball)
  }
}

describe('what a swing is worth', () => {
  it('is an over of six balls, and six sixes is the most there is', () => {
    expect(BALLS).toBe(6)
    expect(MOST).toBe(36)
  })

  it('is a six when all but exact, then a four, two, one and a touch, the same early as a little late', () => {
    expect(judge(0)).toBe('six')
    expect(judge(-TIMING.six)).toBe('six')
    expect(judge(TIMING.six)).toBe('six')
    expect(judge(-0.08)).toBe('four')
    expect(judge(0.08)).toBe('four')
    expect(judge(-0.15)).toBe('two')
    expect(judge(-0.2)).toBe('one')
    expect(judge(-0.28)).toBe('touch')
    expect(judge(-0.31)).toBe('miss')
    expect(judge(0.31)).toBe('miss')
  })

  it('misses with no swing at all, or a nonsense one', () => {
    for (const none of [null, undefined, NaN, Infinity, 'soon']) expect(judge(none)).toBe('miss')
  })

  it('misses when the swing is later than the bat can get to the ball, however near that is', () => {
    expect(judge(0.05, 0.07)).toBe('six')
    expect(judge(0.07, 0.07)).toBe('four')
    expect(judge(0.071, 0.07)).toBe('miss')
    // Early is not cut off the same way.
    expect(judge(-0.071, 0.07)).toBe('four')
  })

  it('scores the runs of a hit, and nothing for a touch', () => {
    expect(RUNS).toEqual({ six: 6, four: 4, two: 2, one: 1, touch: 0 })
    const d = delivery(0, dice(0.5))
    expect(result(d, 0)).toEqual({ kind: 'six', runs: 6, out: false })
    expect(result(d, -0.1)).toEqual({ kind: 'four', runs: 4, out: false })
    expect(result(d, -0.16)).toEqual({ kind: 'two', runs: 2, out: false })
    expect(result(d, -0.2)).toEqual({ kind: 'one', runs: 1, out: false })
    expect(result(d, -0.29)).toEqual({ kind: 'touch', runs: 0, out: false })
  })

  it('is bowled by a miss at a ball on the stumps, and a dot ball by a miss at one that is not', () => {
    const straight = { time: 1, straight: true }
    const wide = { time: 1, straight: false }
    for (const delta of [null, -0.4, 0.2]) {
      expect(result(straight, delta)).toEqual({ kind: 'bowled', runs: 0, out: true })
      expect(result(wide, delta)).toEqual({ kind: 'dot', runs: 0, out: false })
    }
  })

  it('cannot hit a ball that has reached the stumps: the bat stops reaching it just before', () => {
    expect(REACH).toBeLessThan(BEYOND)
    every((d) => {
      expect(lateFor(d)).toBeLessThan(stumpsAfter(d))
      expect(result(d, lateFor(d)).out).toBe(false)
      expect(result(d, lateFor(d)).runs).toBeGreaterThan(0)
      expect(result(d, lateFor(d) + 0.001).runs).toBe(0)
      expect(result(d, stumpsAfter(d)).runs).toBe(0)
    })
  })

  it('leaves room to be a little late for a six on every ball, the quickest too', () => {
    every((d) => expect(lateFor(d)).toBeGreaterThan(TIMING.six))
  })

  it('says a word on the timing, and nothing after a six', () => {
    expect(timingWord('six', 0.01)).toBe('')
    expect(timingWord('four', -0.08)).toBe('A little early')
    expect(timingWord('four', 0.08)).toBe('A little late')
    expect(timingWord('one', -0.2)).toBe('Early')
    expect(timingWord('two', 0.12)).toBe('Late')
    expect(timingWord('bowled', -0.5)).toBe('Too early')
    expect(timingWord('dot', 0.2)).toBe('Too late')
    expect(timingWord('bowled', null)).toBe('Tap to swing the bat')
    expect(timingWord('dot', undefined)).toBe('Tap to swing the bat')
  })
})

describe('the six balls', () => {
  it('get quicker as the over goes on', () => {
    for (let i = 1; i < OVER.length; i++) {
      expect(OVER[i].time[1]).toBeLessThanOrEqual(OVER[i - 1].time[0])
      expect(OVER[i].runup).toBeLessThan(OVER[i - 1].runup)
      expect(OVER[i].straight).toBeGreaterThanOrEqual(OVER[i - 1].straight)
    }
  })

  it('are in the air for the time their place in the over gives, or a slower ball\'s', () => {
    every((d, ball) => {
      const span = d.slower ? SLOWER : OVER[ball].time
      expect(d.time).toBeGreaterThanOrEqual(span[0])
      expect(d.time).toBeLessThanOrEqual(span[1])
      expect(d.ball).toBe(ball)
      expect(d.runup).toBe(OVER[ball].runup)
    })
  })

  it('start with a ball that is never on the stumps and end with one that always is', () => {
    for (let n = 0; n < 50; n++) {
      const rng = dice((n * 0.37) % 1, (n * 0.61) % 1)
      expect(delivery(0, rng).straight).toBe(false)
      expect(delivery(5, rng).straight).toBe(true)
    }
  })

  it('slip a slower ball in only as the fourth or the fifth', () => {
    const slow = new Set()
    every((d, ball) => { if (d.slower) slow.add(ball) })
    expect([...slow].sort()).toEqual([3, 4])
    // And a slower ball is slower than the first ball of the over at its quickest.
    expect(SLOWER[0]).toBeGreaterThan(OVER[1].time[1])
  })

  it('send a straight one at the stumps and a wide one clear of them, to the off side', () => {
    const stumpsEdge = 0.115 + 0.022
    const ballRadius = 0.09
    every((d) => {
      if (d.straight) expect(Math.abs(d.line)).toBeLessThanOrEqual(0.04)
      else expect(d.line - ballRadius).toBeGreaterThan(stumpsEdge)
      expect(d.line).toBeLessThanOrEqual(0.42)
      expect(d.length).toBeGreaterThanOrEqual(0.6)
      expect(d.length).toBeLessThanOrEqual(0.68)
    })
  })

  it('take a ball number out of range as the first or the last', () => {
    expect(delivery(-3, dice(0.5)).ball).toBe(0)
    expect(delivery(99, dice(0.5)).ball).toBe(5)
    expect(delivery(2.7, dice(0.5)).ball).toBe(2)
  })
})

describe('a ball\'s flight', () => {
  const hand = { hand: 2.05, arm: 0.33, r: 0.09 }

  it('leaves the hand, bounces once on the pitch and comes up to the bat on its line', () => {
    every((d) => {
      const start = flight(d, 0, hand)
      expect(start).toEqual({ along: 0, side: hand.arm, y: hand.hand })
      const bounce = flight(d, d.length * d.time, hand)
      expect(bounce.along).toBeCloseTo(d.length, 9)
      expect(bounce.y).toBeCloseTo(hand.r, 6)
      const bat = flight(d, d.time, hand)
      expect(bat.along).toBeCloseTo(1, 9)
      expect(bat.side).toBeCloseTo(d.line, 9)
      expect(bat.y).toBeCloseTo(d.height, 6)
    })
  })

  it('never goes under the pitch, and does not jump as it bounces', () => {
    every((d) => {
      let last = flight(d, 0, hand)
      for (let t = 0.008; t <= d.time * (1 + BEYOND) + 0.2; t += 0.008) {
        const p = flight(d, t, hand)
        expect(p.y).toBeGreaterThanOrEqual(hand.r - 1e-9)
        expect(Math.abs(p.y - last.y)).toBeLessThan(0.12)
        expect(p.along).toBeGreaterThan(last.along)
        last = p
      }
    })
  })

  it('goes on past the bat, and a straight one is at the height of the stumps when it reaches them', () => {
    const stumpHeight = 0.71
    every((d) => {
      const at = flight(d, d.time + stumpsAfter(d), hand)
      expect(at.along).toBeCloseTo(1 + BEYOND, 9)
      if (d.straight) {
        expect(at.y).toBeGreaterThan(hand.r)
        expect(at.y).toBeLessThan(stumpHeight)
        expect(Math.abs(at.side)).toBeLessThan(0.1)
      }
    })
  })

  it('is in the hand before it is let go', () => {
    const d = delivery(0, dice(0.5))
    expect(flight(d, -1, hand)).toEqual(flight(d, 0, hand))
  })
})

describe('a ball that is hit', () => {
  it('goes straight back over the bowler when timed just right, to leg when early and to off when late', () => {
    expect(stroke('six', 0).turn).toBe(0)
    expect(stroke('four', -0.08).turn).toBeLessThan(0)
    expect(stroke('four', 0.08).turn).toBeGreaterThan(0)
    expect(stroke('one', -0.2).turn).toBeLessThan(stroke('four', -0.08).turn)
    // Never behind the batter: within a right angle of straight.
    for (const kind of ['six', 'four', 'two', 'one', 'touch']) {
      for (const delta of [-0.3, -0.1, 0, 0.1, 0.3]) expect(Math.abs(stroke(kind, delta).turn)).toBeLessThan(Math.PI / 2)
    }
  })

  it('is lofted for a six and along the ground for a four, and slower the worse it was timed', () => {
    expect(stroke('six', 0).loft).toBeGreaterThan(0.5)
    expect(stroke('four', 0).loft).toBeLessThan(0.15)
    const speeds = ['six', 'four', 'two', 'one', 'touch'].map(k => stroke(k, 0).speed)
    for (let i = 2; i < speeds.length; i++) expect(speeds[i]).toBeLessThan(speeds[i - 1])
    expect(speeds[1]).toBeGreaterThan(20)
  })
})

describe('the best score, kept on the device', () => {
  const fake = () => {
    const kept = new Map()
    return { getItem: k => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), kept }
  }

  it('starts at nothing, keeps the better score and is not fooled by nonsense', () => {
    const store = fake()
    expect(readBest(store)).toBe(0)
    expect(keepBest(store, 12)).toBe(12)
    expect(keepBest(store, 8)).toBe(12)
    expect(keepBest(store, 30)).toBe(30)
    expect(store.kept.get(BEST_KEY)).toBe('30')
    for (const junk of ['99', '-4', '2.5', 'lots', '']) {
      store.kept.set(BEST_KEY, junk)
      expect(readBest(store)).toBe(0)
    }
  })

  it('plays on where the browser keeps nothing', () => {
    const broken = { getItem() { throw new Error('no') }, setItem() { throw new Error('no') } }
    expect(readBest(broken)).toBe(0)
    expect(keepBest(broken, 7)).toBe(7)
    expect(readBest(null)).toBe(0)
    expect(keepBest(undefined, 5)).toBe(5)
  })
})
