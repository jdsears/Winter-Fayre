// Rugby conversion's rules (rules.js): the five kicks, what a swipe
// becomes, how the ball flies in the wind and what counts.

import { describe, it, expect } from 'vitest'
import {
  KICKS, POSTS, SPOTS, SPEED, BEND_MAX, kickSetup, shotFromSwipe, launch, ballAt, crossing, outcome, metresFor, MOST_METRES,
  SAID, BEST_KEY, readBest, keepBest, WIND_MOST } from './rules.js'

const always = (v) => () => v
// A straight swipe up the screen from (x, y) by (dx, up).
const swipe = (dx, up, from = { x: 200, y: 700 }) => [from, { x: from.x + dx / 2, y: from.y - up / 2 }, { x: from.x + dx, y: from.y - up }]
// A phone held upright: a metre along the posts' line is 30 pixels at
// the posts, the bar is 400 pixels above the ball.
const SCREEN = { across: 30, up: 400, from: 0, tall: 800 }
const first = { kick: 0, d: 18, x0: 0, wind: 0 }

describe('the five kicks', () => {
  it('each is further out and wider than the last, into more wind', () => {
    expect(SPOTS).toHaveLength(KICKS)
    for (let k = 1; k < KICKS; k++) {
      expect(SPOTS[k].d).toBeGreaterThan(SPOTS[k - 1].d)
      expect(SPOTS[k].x).toBeGreaterThan(SPOTS[k - 1].x)
      expect(SPOTS[k].wind[0]).toBeGreaterThanOrEqual(SPOTS[k - 1].wind[1])
    }
    expect(SPOTS[0]).toEqual({ d: 18, x: 0, wind: [0, 0] })
  })

  it('the wind rises steeply: a kick aimed at the middle of the posts is blown wide from the fourth on, and every kick can still be made by aiming into the wind', () => {
    for (let k = 0; k < SPOTS.length; k++) {
      for (const wind of SPOTS[k].wind) {
        const setup = { kick: k, d: SPOTS[k].d, x0: SPOTS[k].x, wind }
        const straight = outcome(setup, { aim: 0, power: 1, bend: 0 })
        if (k >= 3) expect(straight, `kick ${k + 1} in a wind of ${wind}`).toBe('wide')
        if (k === 0) expect(straight).toBe('over')
        // Somewhere upwind of the posts there is an aim that goes over, at full power.
        let made = null
        for (let aim = 0; aim >= -30 && made === null; aim -= 0.25) if (outcome(setup, { aim, power: 1, bend: 0 }) === 'over') made = aim
        expect(made, `kick ${k + 1} in a wind of ${wind}`).not.toBeNull()
        // From the fourth kick it is well off the middle, and on the last
        // in its strongest wind it is outside the upwind post.
        if (k >= 3) expect(made).toBeLessThan(-0.5)
        if (k === 4 && wind === SPOTS[4].wind[1]) expect(made).toBeLessThan(-2.8)
        // But never so far that the place to aim at is off a phone's
        // screen, which shows eight metres or so either side of the posts.
        expect(made).toBeGreaterThan(-7.5)
      }
    }
    expect(WIND_MOST).toBe(SPOTS[4].wind[1])
    expect(WIND_MOST).toBeGreaterThanOrEqual(12)
  })

  it('the first is straight in front with no wind; the rest fall to either side with the wind either way', () => {
    expect(kickSetup(always(0.3), 0)).toEqual({ kick: 0, d: 18, x0: 0, wind: 0 })
    expect(kickSetup(always(0.1), 4)).toEqual({ kick: 4, d: 34, x0: -19, wind: -12 })
    expect(kickSetup(always(0.9), 4)).toEqual({ kick: 4, d: 34, x0: 19, wind: 14 })
    for (let k = 1; k < KICKS; k++) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
        const s = kickSetup(always(r), k)
        expect(Math.abs(s.x0)).toBe(SPOTS[k].x)
        expect(Math.abs(s.wind)).toBeGreaterThanOrEqual(SPOTS[k].wind[0])
        expect(Math.abs(s.wind)).toBeLessThanOrEqual(SPOTS[k].wind[1])
        expect(Number.isInteger(s.wind)).toBe(true)
      }
    }
    // A kick number that is not one is taken as the nearest that is.
    expect(kickSetup(always(0.3), -2).kick).toBe(0)
    expect(kickSetup(always(0.3), 99).kick).toBe(4)
  })
})

describe('a swipe', () => {
  it('points at its target: straight up is the middle, and its line is carried on to the posts', () => {
    expect(shotFromSwipe(swipe(0, 300), SCREEN).aim).toBe(0)
    // 30 pixels across in 300 up is 40 across by the bar, which is 1.33 metres.
    expect(shotFromSwipe(swipe(30, 300), SCREEN).aim).toBeCloseTo(1.33, 2)
    expect(shotFromSwipe(swipe(-30, 300), SCREEN).aim).toBeCloseTo(-1.33, 2)
    // A ball that sits to one side of the posts on the screen starts from there.
    expect(shotFromSwipe(swipe(0, 300), { ...SCREEN, from: 2 }).aim).toBe(2)
  })

  it('is harder the longer it is, from nothing to all it has', () => {
    const powers = [80, 150, 220, 300, 368, 500].map(up => shotFromSwipe(swipe(0, up), SCREEN).power)
    expect(powers[0]).toBe(0)
    for (let i = 1; i < powers.length - 1; i++) expect(powers[i]).toBeGreaterThan(powers[i - 1])
    expect(powers[4]).toBe(1)
    expect(powers[5]).toBe(1)
  })

  it('bends the ball when it curls, the way it curls, and not when it is straight', () => {
    expect(shotFromSwipe(swipe(0, 300), SCREEN).bend).toBe(0)
    const curl = (side) => [{ x: 200, y: 700 }, { x: 200 + side * 40, y: 550 }, { x: 200, y: 400 }]
    const right = shotFromSwipe(curl(1), SCREEN).bend
    const left = shotFromSwipe(curl(-1), SCREEN).bend
    expect(right).toBeGreaterThan(0)
    expect(left).toBe(-right)
    expect(Math.abs(shotFromSwipe([{ x: 200, y: 700 }, { x: 700, y: 550 }, { x: 200, y: 400 }], SCREEN).bend)).toBeLessThanOrEqual(BEND_MAX)
  })

  it('is no kick when it is too short, goes down, or there is nothing to read it against', () => {
    expect(shotFromSwipe(swipe(0, 20), SCREEN)).toBeNull()
    expect(shotFromSwipe(swipe(0, -200), SCREEN)).toBeNull()
    expect(shotFromSwipe(swipe(200, 10), SCREEN)).toBeNull()
    expect(shotFromSwipe([{ x: 1, y: 1 }], SCREEN)).toBeNull()
    expect(shotFromSwipe(null, SCREEN)).toBeNull()
    expect(shotFromSwipe(swipe(0, 300), { across: 0, up: 400, tall: 800 })).toBeNull()
  })
})

describe('the flight', () => {
  it('leaves the tee towards the aim, faster the harder it is kicked', () => {
    const soft = launch(first, { aim: 0, power: 0, bend: 0 })
    const hard = launch(first, { aim: 0, power: 1, bend: 0 })
    expect(Math.hypot(soft.vx, soft.vf, soft.vy)).toBeCloseTo(SPEED.min, 5)
    expect(Math.hypot(hard.vx, hard.vf, hard.vy)).toBeCloseTo(SPEED.max, 5)
    expect(soft.vx).toBe(0)
    expect(launch(first, { aim: 3, power: 0.5, bend: 0 }).vx).toBeGreaterThan(0)
    expect(launch({ ...first, x0: 10 }, { aim: 0, power: 0.5, bend: 0 }).vx).toBeLessThan(0)
  })

  it('starts on the tee, rises and comes down, and never goes under the grass', () => {
    const shot = { aim: 0, power: 0.6, bend: 0 }
    expect(ballAt(first, shot, 0)).toEqual({ x: 0, y: 0, f: 0 })
    expect(ballAt(first, shot, 0.5).y).toBeGreaterThan(3)
    expect(ballAt(first, shot, 30).y).toBe(0)
    expect(ballAt(first, shot, -1)).toEqual({ x: 0, y: 0, f: 0 })
    const c = crossing(first, shot)
    expect(ballAt(first, shot, c.t).f).toBeCloseTo(18, 6)
    expect(ballAt(first, shot, c.t).y).toBeCloseTo(c.y, 6)
  })

  it('is pushed sideways by the wind all the way, and less when it is kicked harder', () => {
    const windy = { ...first, d: 34, wind: 8 }
    const full = crossing(windy, { aim: 0, power: 1, bend: 0 })
    const less = crossing(windy, { aim: 0, power: 0.7, bend: 0 })
    expect(full.x).toBeGreaterThan(1)
    expect(less.x).toBeGreaterThan(full.x)
    expect(crossing({ ...windy, wind: -8 }, { aim: 0, power: 1, bend: 0 }).x).toBeCloseTo(-full.x, 6)
    expect(crossing({ ...windy, wind: 0 }, { aim: 0, power: 1, bend: 0 }).x).toBeCloseTo(0, 6)
    // A bend pushes it the same way a wind does.
    expect(crossing({ ...windy, wind: 0 }, { aim: 0, power: 1, bend: 2 }).x).toBeGreaterThan(1)
  })
})

describe('what counts', () => {
  const kick = (setup, shot) => outcome(setup, { bend: 0, ...shot })

  it('over the bar and between the posts counts', () => {
    expect(kick(first, { aim: 0, power: 0.6 })).toBe('over')
    expect(kick(first, { aim: 2.4, power: 0.6 })).toBe('over')
    expect(kick(first, { aim: -2.4, power: 1 })).toBe('over')
  })

  it('a kick with too little on it falls short or goes under the bar', () => {
    expect(kick(first, { aim: 0, power: 0 })).toBe('short')
    expect(kick(first, { aim: 0, power: 0.2 })).toBe('under')
    // The long kicks need more: what clears the bar from 18 metres falls short from 34.
    expect(kick(first, { aim: 0, power: 0.35 })).toBe('over')
    expect(kick({ ...first, d: 34 }, { aim: 0, power: 0.35 })).toBe('short')
    expect(kick({ ...first, d: 34 }, { aim: 0, power: 0.8 })).toBe('over')
  })

  it('outside the posts is wide, on one is the post, and on the bar is the bar', () => {
    expect(kick(first, { aim: 4, power: 0.6 })).toBe('wide')
    expect(kick(first, { aim: -4, power: 0.6 })).toBe('wide')
    expect(kick(first, { aim: POSTS.halfWidth, power: 0.6 })).toBe('post')
    expect(kick(first, { aim: -POSTS.halfWidth - 0.1, power: 0.6 })).toBe('post')
    // The power at which the ball meets the bar, found by trying them.
    const powers = Array.from({ length: 1001 }, (_, i) => i / 1000)
    const onBar = powers.filter(p => kick(first, { aim: 0, power: p }) === 'bar')
    expect(onBar.length).toBeGreaterThan(0)
    expect(Math.abs(crossing(first, { aim: 0, power: onBar[0], bend: 0 }).y - POSTS.bar)).toBeLessThan(0.25)
  })

  it('every kick can be made, straight at the posts in no wind, and aimed off in the wind', () => {
    for (const [k, spot] of SPOTS.entries()) {
      for (const side of [-1, 1]) {
        const calm = { kick: k, d: spot.d, x0: spot.x * side, wind: 0 }
        expect(kick(calm, { aim: 0, power: 1 })).toBe('over')
        // In the strongest wind for this kick: aimed at the middle it may
        // miss, but there is an aim that makes it.
        const windy = { ...calm, wind: spot.wind[1] }
        const made = Array.from({ length: 161 }, (_, i) => -8 + i * 0.1).some(aim => kick(windy, { aim, power: 1 }) === 'over')
        expect(made).toBe(true)
      }
    }
    // The last kick, aimed straight at the middle in its wind, is blown wide.
    expect(kick({ kick: 4, d: 34, x0: 19, wind: SPOTS[4].wind[1] }, { aim: 0, power: 1 })).not.toBe('over')
  })

  it('a kick that counts adds the metres it was kicked from', () => {
    expect(metresFor(first)).toBe(18)
    expect(MOST_METRES).toBe(130)
    for (const o of ['over', 'short', 'under', 'wide', 'post', 'bar']) expect(SAID[o]).toMatch(/\.$/)
  })
})

describe('the best on this device', () => {
  it('is kept, never lowered, and read with care', () => {
    const kept = new Map()
    const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) }
    expect(readBest(store)).toBe(0)
    expect(keepBest(store, 3)).toBe(3)
    expect(keepBest(store, 2)).toBe(3)
    expect(kept.get(BEST_KEY)).toBe('3')
    kept.set(BEST_KEY, '99')
    expect(readBest(store)).toBe(0)
    kept.set(BEST_KEY, 'lots')
    expect(readBest(store)).toBe(0)
    expect(readBest(null)).toBe(0)
    expect(keepBest({ getItem() { throw new Error('no') }, setItem() { throw new Error('no') } }, 4)).toBe(4)
  })
})
