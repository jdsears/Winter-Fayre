// Rugby conversion on the stage (play3d.js): where things are in the
// stadium, how the camera frames a kick and how a swipe on the screen is
// read.

import { describe, it, expect } from 'vitest'
import { cameraFor, teeAt, toWorld, swipeToShot, windWords, BALL_DOWN } from './play3d.js'
import { SPOTS, POSTS, BALL_R, outcome } from './rules.js'
import { GOAL } from '../shootout/physics.js'
import { project } from '../shootout/camera.js'

const SCREENS = [[360, 780], [390, 844], [740, 360], [1280, 800]]
const setups = SPOTS.flatMap((s, k) => (s.x ? [-1, 1] : [1]).map(side => ({ kick: k, d: s.d, x0: s.x * side, wind: 0 })))

describe('the stadium', () => {
  it('puts the tee the kick\'s distance out from the posts\' line, and the ball on it', () => {
    const setup = { kick: 2, d: 26, x0: -11, wind: 0 }
    expect(teeAt(setup)).toEqual({ x: -11, y: BALL_R, z: GOAL.lineZ + 26 })
    expect(toWorld(setup, { x: -11, y: 0, f: 0 })).toEqual(teeAt(setup))
    expect(toWorld(setup, { x: 0, y: 5, f: 26 })).toEqual({ x: 0, y: 5 + BALL_R, z: GOAL.lineZ })
  })
})

describe('the camera', () => {
  it('keeps the ball in the middle near the foot of the screen, on every kick and every screen', () => {
    for (const setup of setups) {
      for (const [w, h] of SCREENS) {
        const tee = project(cameraFor(setup), teeAt(setup), w, h)
        expect(Math.abs(tee.x - w / 2)).toBeLessThan(1)
        expect(tee.y / h).toBeCloseTo(0.5 + BALL_DOWN / 2, 2)
      }
    }
  })

  it('shows both posts, the bar and the tops of the posts on a phone held upright', () => {
    for (const setup of setups) {
      for (const [w, h] of SCREENS.slice(0, 2)) {
        const cam = cameraFor(setup)
        for (const x of [-POSTS.halfWidth, POSTS.halfWidth]) {
          for (const y of [0, POSTS.bar, POSTS.height]) {
            const p = project(cam, { x, y, z: GOAL.lineZ }, w, h)
            expect(p.x).toBeGreaterThan(8)
            expect(p.x).toBeLessThan(w - 8)
            expect(p.y).toBeGreaterThan(h * 0.08)
            expect(p.y).toBeLessThan(h * 0.8)
          }
        }
      }
    }
  })

  it('closes in for the long kicks, so the posts stay wide enough to aim at', () => {
    expect(cameraFor(setups[0]).fov).toBeGreaterThan(cameraFor(setups[setups.length - 1]).fov)
    for (const setup of setups) {
      const cam = cameraFor(setup)
      const l = project(cam, { x: -POSTS.halfWidth, y: POSTS.bar, z: GOAL.lineZ }, 390, 844)
      const r = project(cam, { x: POSTS.halfWidth, y: POSTS.bar, z: GOAL.lineZ }, 390, 844)
      expect(r.x - l.x).toBeGreaterThan(70)
    }
  })
})

describe('a swipe on the screen', () => {
  // A straight swipe from the ball towards a point of the stadium.
  function swipeAt(setup, target, w, h, share = 0.8) {
    const cam = cameraFor(setup)
    const from = project(cam, teeAt(setup), w, h)
    const to = project(cam, target, w, h)
    const end = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share }
    return [from, { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 }, end]
  }

  it('aimed at the middle of the bar is aimed at the middle of the posts, from every spot', () => {
    for (const setup of setups) {
      for (const [w, h] of SCREENS) {
        const shot = swipeToShot(swipeAt(setup, { x: 0, y: POSTS.bar, z: GOAL.lineZ }, w, h), setup, w, h)
        expect(Math.abs(shot.aim)).toBeLessThan(0.15)
        expect(shot.bend).toBe(0)
      }
    }
  })

  it('aimed at a post is aimed there, and outside it is wide', () => {
    for (const setup of setups) {
      const right = swipeToShot(swipeAt(setup, { x: POSTS.halfWidth, y: POSTS.bar, z: GOAL.lineZ }, 390, 844), setup, 390, 844)
      expect(right.aim).toBeCloseTo(POSTS.halfWidth, 0)
      const wide = swipeToShot(swipeAt(setup, { x: 6, y: POSTS.bar, z: GOAL.lineZ }, 390, 844), setup, 390, 844)
      expect(outcome(setup, { ...wide, power: 1 })).toBe('wide')
    }
  })

  it('a full swipe up a phone makes every kick in no wind, and a short flick does not get there', () => {
    for (const setup of setups) {
      const [w, h] = [390, 844]
      const cam = cameraFor(setup)
      const from = project(cam, teeAt(setup), w, h)
      const bar = project(cam, { x: 0, y: POSTS.bar, z: GOAL.lineZ }, w, h)
      const dir = { x: (bar.x - from.x) / (from.y - bar.y), y: -1 }
      const along = (len) => [from, { x: from.x + dir.x * len / 2, y: from.y - len / 2 }, { x: from.x + dir.x * len, y: from.y - len }]
      expect(outcome(setup, swipeToShot(along(h * 0.46), setup, w, h))).toBe('over')
      expect(outcome(setup, swipeToShot(along(h * 0.12), setup, w, h))).toBe('short')
    }
  })

  it('is nothing with no points', () => {
    expect(swipeToShot(null, setups[0], 390, 844)).toBeNull()
    expect(swipeToShot([{ x: 1, y: 1 }], setups[0], 390, 844)).toBeNull()
  })
})

describe('the wind in words', () => {
  it('says how hard and which way, or that there is none', () => {
    expect(windWords(0)).toBe('No wind')
    expect(windWords(6)).toBe('Wind 6 to the right')
    expect(windWords(-3)).toBe('Wind 3 to the left')
  })
})
