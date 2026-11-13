// The free kick challenge in the stadium: the rules' places become the
// stadium's, and a swipe on the screen is read as the rules read one, so
// a swipe that points at a part of the goal is aimed there.

import { describe, it, expect } from 'vitest'
import { acrossToWorld, ballAt, cameraFor, swipeToShot, Z0 } from './play3d.js'
import { CENTRE, POST_LEFT, POST_RIGHT, outcome } from './rules.js'
import { BALL_R, GOAL } from '../shootout/physics.js'
import { project } from '../shootout/camera.js'

const SIZES = [[360, 640], [375, 740], [390, 844], [1280, 720]]
const setups = [{ x0: 180, wallX: 180, keeperX: 206 }, { x0: 115, wallX: 150, keeperX: 206 }, { x0: 245, wallX: 215, keeperX: 154 }]

describe('the free kick challenge in the stadium', () => {
  it('puts the posts where the goal is, and the ball twenty metres out', () => {
    expect(acrossToWorld(POST_LEFT)).toBeCloseTo(-GOAL.halfWidth, 6)
    expect(acrossToWorld(POST_RIGHT)).toBeCloseTo(GOAL.halfWidth, 6)
    expect(acrossToWorld(CENTRE)).toBe(0)
    const shot = { aim: 100, height: 0.8, bend: 0 }
    const start = ballAt(setups[0], shot, 0)
    const end = ballAt(setups[0], shot, 1)
    expect(start).toEqual({ x: 0, y: BALL_R, z: Z0 })
    expect(end.z).toBeCloseTo(GOAL.lineZ, 6)
    expect(end.x).toBeCloseTo(acrossToWorld(100), 6)
    expect(end.y).toBeCloseTo(BALL_R + 0.8 * GOAL.height, 6)
    expect(Z0 - GOAL.lineZ).toBe(20)
  })

  for (const [w, h] of SIZES) {
    it(`shows the ball and the whole goal at ${w} by ${h}`, () => {
      for (const setup of setups) {
        const cam = cameraFor(setup, w, h)
        const pts = [{ x: acrossToWorld(setup.x0), y: BALL_R, z: Z0 }, { x: -GOAL.halfWidth, y: 0, z: GOAL.lineZ }, { x: GOAL.halfWidth, y: GOAL.height, z: GOAL.lineZ }]
        for (const p of pts) {
          const s = project({ ...cam }, p, w, h)
          expect(s.x).toBeGreaterThan(0)
          expect(s.x).toBeLessThan(w)
          expect(s.y).toBeGreaterThan(0)
          expect(s.y).toBeLessThan(h)
        }
      }
    })

    it(`a swipe that points at a place in the goal is aimed there at ${w} by ${h}`, () => {
      for (const setup of setups) {
        const cam = cameraFor(setup, w, h)
        const ball = project({ ...cam }, { x: acrossToWorld(setup.x0), y: BALL_R, z: Z0 }, w, h)
        for (const aim of [90, 180, 270]) {
          const target = project({ ...cam }, { x: acrossToWorld(aim), y: GOAL.height / 2, z: GOAL.lineZ }, w, h)
          // Half way from the ball towards the target.
          const swipe = [0, 0.25, 0.5].map(k => ({ x: ball.x + (target.x - ball.x) * k, y: ball.y + (target.y - ball.y) * k }))
          const shot = swipeToShot(swipe, setup, w, h)
          expect(shot).not.toBeNull()
          expect(Math.abs(shot.aim - aim)).toBeLessThanOrEqual(3)
          expect(Math.abs(shot.bend)).toBe(0)
        }
      }
    })
  }

  it('a longer swipe goes higher, a swipe down is no kick, and every kick has an end', () => {
    const [w, h] = [375, 740]
    const setup = setups[0]
    const cam = cameraFor(setup, w, h)
    const ball = project({ ...cam }, { x: 0, y: BALL_R, z: Z0 }, w, h)
    const up = (px) => swipeToShot([{ x: ball.x, y: ball.y }, { x: ball.x, y: ball.y - px }], setup, w, h)
    expect(up(140).height).toBeGreaterThan(up(80).height)
    expect(swipeToShot([{ x: ball.x, y: ball.y }, { x: ball.x, y: ball.y + 120 }], setup, w, h)).toBeNull()
    expect(swipeToShot([{ x: 1, y: 1 }], setup, w, h)).toBeNull()
    for (const px of [60, 100, 140, 180, 240]) expect(['goal', 'saved', 'wall', 'wide', 'over']).toContain(outcome(setup, up(px)))
  })
})
