// Keepy-uppies (rules.js): what a tap does, how the ball falls and what
// is kept.
//
// Run with: npx vitest run client/keepy/rules.test.js

import { describe, it, expect } from 'vitest'
import { W, H, R, GROUND, TOUCH_GAP, newGo, tap, keyTouch, step, gravity, readBest, keepBest, BEST_KEY } from './rules.js'

const fall = (go, seconds) => { let g = go; for (let i = 0; i < seconds * 60; i++) g = step(g, 1 / 60); return g }

describe('a go', () => {
  it('waits, with the ball hanging, until the ball is first tapped', () => {
    const go = newGo()
    expect(fall(go, 3)).toEqual(go)
    expect(tap(go, 10, 10)).toBe(go)
    const started = tap(go, go.x, go.y)
    expect(started.started).toBe(true)
    expect(started.score).toBe(1)
    expect(started.vy).toBeLessThan(0)
  })

  it('ends when the ball touches the ground, and nothing moves it after', () => {
    const down = fall(tap(newGo(), W / 2, H * 0.36), 6)
    expect(down.over).toBe(true)
    expect(down.y).toBe(GROUND - R)
    expect(tap(down, down.x, down.y)).toBe(down)
    expect(keyTouch(down)).toBe(down)
    expect(step(down, 1)).toBe(down)
  })
})

describe('a tap', () => {
  // A ball on its way down, a second after it was last touched.
  const coming = { ...newGo(), started: true, score: 3, y: 300, vy: 200, since: 1 }

  it('counts one when it lands on the ball, and none when it misses', () => {
    expect(tap(coming, coming.x, coming.y).score).toBe(4)
    expect(tap(coming, coming.x + R * 1.5, coming.y).score).toBe(4)
    expect(tap(coming, coming.x + R * 3, coming.y)).toBe(coming)
  })

  it('to one side of the ball sends it the other way', () => {
    expect(tap(coming, coming.x - 20, coming.y).vx).toBeGreaterThan(0)
    expect(tap(coming, coming.x + 20, coming.y).vx).toBeLessThan(0)
    expect(tap(coming, coming.x, coming.y).vx).toBeCloseTo(0)
  })

  it('cannot be counted twice on a ball still rising', () => {
    const up = tap(coming, coming.x, coming.y)
    expect(tap(up, up.x, up.y)).toBe(up)
    expect(tap({ ...up, vy: -100 }, up.x, up.y).score).toBe(up.score)
  })

  it('cannot be counted again straight after a touch, even on a ball coming down', () => {
    const justTouched = { ...coming, since: TOUCH_GAP / 2 }
    expect(tap(justTouched, justTouched.x, justTouched.y)).toBe(justTouched)
    expect(keyTouch({ ...justTouched, y: 330 })).toEqual({ ...justTouched, y: 330 })
    expect(tap({ ...coming, since: TOUCH_GAP + 0.01 }, coming.x, coming.y).score).toBe(4)
  })

  it('the time since the last touch runs from each touch', () => {
    const up = tap(coming, coming.x, coming.y)
    expect(up.since).toBe(0)
    expect(fall(up, 0.5).since).toBeCloseTo(0.5, 1)
  })
})

describe('the ball', () => {
  it('falls faster as the count rises, up to a point', () => {
    expect(gravity(20)).toBeGreaterThan(gravity(0))
    expect(gravity(500)).toBe(gravity(60))
  })

  it('comes back off the sides, and has no roof: sent high it leaves the top and comes back', () => {
    let go = { ...newGo(), started: true, score: 1, y: 60, vx: -400, vy: -900 }
    let top = go.y
    for (let i = 0; i < 400 && !go.over; i++) {
      go = step(go, 1 / 60)
      expect(go.x).toBeGreaterThanOrEqual(R)
      expect(go.x).toBeLessThanOrEqual(W - R)
      top = Math.min(top, go.y)
    }
    expect(top).toBeLessThan(0)
    expect(go.over).toBe(true)
  })

  it('cannot be kept up by tapping fast on a ball in a top corner', () => {
    // The trick that gamed the first version: the ball pinned high in a
    // corner and tapped as fast as a thumb can go, sixty times a second
    // here, for ten seconds.
    let go = { ...newGo(), started: true, score: 1, x: W - R, y: 40, vy: -300, since: 1 }
    let frames = 0
    for (; frames < 600 && !go.over; frames++) {
      go = tap(go, go.x, go.y)
      go = step(go, 1 / 60)
    }
    // Every touch still has to wait for the ball to come down.
    expect(go.score).toBeLessThan(2 + (frames / 60) * 2.5)
  })

  it('does not jump when a frame is late', () => {
    const go = { ...newGo(), started: true, y: 100, vy: 0 }
    expect(step(go, 5).y).toBeLessThan(110)
  })
})

describe('on a keyboard', () => {
  it('starts the go, then counts a touch only as the ball comes down low', () => {
    const started = keyTouch(newGo())
    expect(started.score).toBe(1)
    expect(keyTouch(started)).toBe(started)
    const high = { ...started, y: 100, vy: 100, since: 1 }
    expect(keyTouch(high)).toBe(high)
    const low = { ...started, x: 90, y: 330, vy: 250, since: 1 }
    const touched = keyTouch(low)
    expect(touched.score).toBe(2)
    expect(touched.vx).toBeGreaterThan(0)
  })
})

describe('the best count', () => {
  const store = () => { const kept = {}; return { kept, getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v } } }

  it('is kept on the device, and only rises', () => {
    const s = store()
    expect(readBest(s)).toBe(0)
    expect(keepBest(s, 7)).toBe(7)
    expect(keepBest(s, 3)).toBe(7)
    expect(s.kept[BEST_KEY]).toBe('7')
  })

  it('plays on in a browser that keeps nothing, and ignores nonsense', () => {
    expect(readBest(null)).toBe(0)
    expect(keepBest(null, 4)).toBe(4)
    expect(readBest({ getItem: () => 'lots' })).toBe(0)
    expect(readBest({ getItem: () => { throw new Error('blocked') } })).toBe(0)
  })
})
