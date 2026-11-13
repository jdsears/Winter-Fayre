// The free kick challenge (rules.js): what a swipe becomes, how the ball
// flies and what becomes of the shot.
//
// Run with: npx vitest run client/freekick/rules.test.js

import { describe, it, expect } from 'vitest'
import { KICKS, POST_LEFT, POST_RIGHT, CENTRE, WALL_AT, WALL_H, REACH_UP, kickSetup, shotFromSwipe, flightAt, keeperReach, outcome, SAID, readBest, keepBest, BEST_KEY } from './rules.js'

const setup = { x0: 180, wallX: 180, keeperX: 154 }

describe('a kick', () => {
  it('is set up with the wall on the ball\'s line and the keeper toward the open side', () => {
    for (let i = 0; i < 50; i++) {
      const s = kickSetup(() => ((i * 37) % 50) / 50)
      expect(s.x0).toBeGreaterThanOrEqual(110)
      expect(s.x0).toBeLessThanOrEqual(250)
      expect(Math.abs(s.wallX - (s.x0 + (CENTRE - s.x0) * WALL_AT))).toBeLessThanOrEqual(25)
      expect(Math.sign(s.keeperX - CENTRE)).toBe(s.wallX < CENTRE ? 1 : -1)
    }
  })

  it('can always be scored: a top corner clears the wall and beats the keeper', () => {
    for (let i = 0; i < 50; i++) {
      const s = kickSetup(() => ((i * 13) % 50) / 50)
      const corners = [{ aim: POST_LEFT + 14, height: 0.92, bend: 0 }, { aim: POST_RIGHT - 14, height: 0.92, bend: 0 }]
      expect(corners.some(shot => outcome(s, shot) === 'goal')).toBe(true)
    }
  })
})

describe('a swipe', () => {
  const up = (dx, length) => [{ x: 180, y: 430 }, { x: 180 + dx, y: 430 - length }]

  it('sets the aim by its direction and the height by its length', () => {
    expect(shotFromSwipe(up(0, 150), 180).aim).toBe(180)
    expect(shotFromSwipe(up(40, 150), 180).aim).toBe(Math.round(180 + 40 * (REACH_UP / 150)))
    expect(shotFromSwipe(up(-40, 150), 180).aim).toBeLessThan(180)
    expect(shotFromSwipe(up(0, 220), 180).height).toBeGreaterThan(shotFromSwipe(up(0, 120), 180).height)
    expect(shotFromSwipe(up(0, 150), 180).bend).toBe(0)
  })

  it('that curls bends the ball the way it curled', () => {
    const curl = (side) => [{ x: 180, y: 430 }, { x: 180 + side * 30, y: 350 }, { x: 180, y: 270 }]
    expect(shotFromSwipe(curl(1), 180).bend).toBeGreaterThan(0)
    expect(shotFromSwipe(curl(-1), 180).bend).toBeLessThan(0)
  })

  it('too short, or downward, is not a kick', () => {
    expect(shotFromSwipe(up(0, 20), 180)).toBe(null)
    expect(shotFromSwipe([{ x: 180, y: 300 }, { x: 180, y: 430 }], 180)).toBe(null)
    expect(shotFromSwipe([{ x: 180, y: 430 }], 180)).toBe(null)
    expect(shotFromSwipe(null, 180)).toBe(null)
  })
})

describe('the flight', () => {
  it('starts at the ball on the ground and ends at the aim, at its height', () => {
    const shot = { aim: 250, height: 0.6, bend: 0 }
    expect(flightAt(setup, shot, 0)).toEqual({ x: 180, h: 0 })
    const end = flightAt(setup, shot, 1)
    expect(end.x).toBeCloseTo(250)
    expect(end.h).toBeCloseTo(0.6)
  })

  it('bends out and comes back', () => {
    const straight = flightAt(setup, { aim: 180, height: 0.5, bend: 0 }, 0.5)
    const bent = flightAt(setup, { aim: 180, height: 0.5, bend: 80 }, 0.5)
    expect(bent.x).toBeGreaterThan(straight.x + 30)
    expect(flightAt(setup, { aim: 180, height: 0.5, bend: 80 }, 1).x).toBeCloseTo(180)
  })
})

describe('what becomes of a shot', () => {
  it('hits the wall when it goes low through it, and clears it when high enough', () => {
    expect(outcome(setup, { aim: 180, height: 0.3, bend: 0 })).toBe('wall')
    expect(flightAt(setup, { aim: 180, height: 0.3, bend: 0 }, WALL_AT).h).toBeLessThan(WALL_H)
    expect(outcome(setup, { aim: 270, height: 0.95, bend: 0 })).toBe('goal')
  })

  it('goes round the wall when it bends', () => {
    expect(outcome(setup, { aim: 275, height: 0.3, bend: 0 })).toBe('wall')
    expect(outcome(setup, { aim: 275, height: 0.3, bend: 110 })).toBe('goal')
  })

  it('is over the bar, or wide of a post', () => {
    expect(outcome(setup, { aim: 270, height: 1.2, bend: 0 })).toBe('over')
    expect(outcome(setup, { aim: POST_RIGHT + 20, height: 0.95, bend: 0 })).toBe('wide')
    expect(outcome(setup, { aim: POST_LEFT - 20, height: 0.95, bend: 0 })).toBe('wide')
  })

  it('is saved within the keeper\'s reach, which is shorter up high', () => {
    expect(keeperReach(0)).toBeGreaterThan(keeperReach(1))
    expect(outcome(setup, { aim: 160, height: 0.95, bend: 0 })).toBe('saved')
    expect(outcome({ ...setup, wallX: 40 }, { aim: 200, height: 0.2, bend: 0 })).toBe('saved')
    expect(outcome({ ...setup, wallX: 40 }, { aim: 275, height: 0.2, bend: 0 })).toBe('goal')
  })

  it('has words for every outcome', () => {
    for (const o of ['goal', 'saved', 'wall', 'wide', 'over']) expect(SAID[o]).toBeTruthy()
  })
})

describe('the kicks get harder as they go', () => {
  it('the keeper reaches further and the wall jumps higher, kick by kick', () => {
    const first = kickSetup(() => 0.5, 0)
    const last = kickSetup(() => 0.5, KICKS - 1)
    expect(last.reach).toBeGreaterThan(first.reach + 20)
    expect(last.wallH).toBeGreaterThan(first.wallH + 0.1)
    expect(last.wallH).toBeLessThan(0.9)
    expect(kickSetup(() => 0.5).reach).toBe(first.reach)
    expect(kickSetup(() => 0.5, 99)).toEqual(last)
    for (let k = 1; k < KICKS; k++) expect(kickSetup(() => 0.5, k).reach).toBeGreaterThan(kickSetup(() => 0.5, k - 1).reach)
  })

  it('a shot that scores on the first kick can be saved on the last, and the top corner still scores', () => {
    // With the wall stood out of the way, so only the keeper is tested.
    const first = { ...kickSetup(() => 0.5, 0), wallX: -400 }
    const last = { ...kickSetup(() => 0.5, KICKS - 1), wallX: -400 }
    const side = first.keeperX > CENTRE ? 1 : -1
    const shot = { aim: first.keeperX + side * 50, height: 0.85, bend: 0 }
    expect(outcome(first, shot)).toBe('goal')
    expect(outcome(last, shot)).toBe('saved')
    const corner = { aim: side > 0 ? POST_RIGHT - 8 : POST_LEFT + 8, height: 0.95, bend: 0 }
    expect(outcome(last, corner)).toBe('goal')
  })

  it('a ball that clears the first wall can be stopped by the last', () => {
    const first = { ...kickSetup(() => 0.5, 0), x0: 180, wallX: 180 }
    const last = { ...kickSetup(() => 0.5, KICKS - 1), x0: 180, wallX: 180 }
    let caught = null
    for (let h = 0.2; h <= 1; h += 0.01) {
      const shot = { aim: 180, height: Math.round(h * 100) / 100, bend: 0 }
      if (outcome(first, shot) !== 'wall' && outcome(last, shot) === 'wall') { caught = shot; break }
    }
    expect(caught).not.toBeNull()
  })
})

describe('the best score', () => {
  const store = () => { const kept = {}; return { kept, getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v } } }

  it('is kept on the device, only rises, and is never more than the kicks there are', () => {
    const s = store()
    expect(readBest(s)).toBe(0)
    expect(keepBest(s, 6)).toBe(6)
    expect(keepBest(s, 4)).toBe(6)
    expect(s.kept[BEST_KEY]).toBe('6')
    expect(readBest({ getItem: () => String(KICKS + 5) })).toBe(0)
    expect(readBest(null)).toBe(0)
    expect(keepBest(null, 3)).toBe(3)
  })
})
