// Netball shot on the stage (play3d.js): where things are in the
// stadium, and how the camera frames a shot.

import { describe, it, expect } from 'vitest'
import { HOOP, shooterAt, toWorld, cameraFor, BALL_DOWN } from './play3d.js'
import { RING, HANDS, SPOT, FLIGHT, ballAt, spotFor } from './rules.js'
import { GOAL } from '../shootout/physics.js'
import { project } from '../shootout/camera.js'

const SCREENS = [[360, 780], [390, 844], [740, 360], [1280, 800]]
const spots = [{ d: SPOT.first, turn: 0 }, { d: 2.2, turn: 0.6 }, { d: 2.2, turn: -0.6 }, { d: SPOT.last, turn: 0.95 }, { d: SPOT.last, turn: -0.95 }, { d: SPOT.last, turn: 0 }]

describe('the stadium', () => {
  it('holds the ring out in front of the post, 3.05 metres up', () => {
    expect(HOOP.y).toBe(RING.height)
    expect(HOOP.x).toBe(0)
    expect(HOOP.z).toBeGreaterThan(GOAL.lineZ)
    expect(HOOP.z - GOAL.lineZ).toBeGreaterThan(RING.radius)
  })

  it('stands the shooter the spot\'s distance from under the ring, in front of the line, wherever round the circle', () => {
    for (const spot of spots) {
      const s = shooterAt(spot)
      expect(Math.hypot(s.x - HOOP.x, s.z - HOOP.z)).toBeCloseTo(spot.d, 9)
      expect(s.z).toBeGreaterThan(GOAL.lineZ)
    }
    expect(shooterAt({ d: 2, turn: 0.5 }).x).toBeGreaterThan(0)
    expect(shooterAt({ d: 2, turn: -0.5 }).x).toBeLessThan(0)
  })

  it('a shot of the spot\'s distance, straight, comes down in the middle of the ring from anywhere', () => {
    for (const spot of spots) {
      const down = toWorld(spot, ballAt({ reach: spot.d, aim: 0 }, FLIGHT))
      expect(down.x).toBeCloseTo(HOOP.x, 6)
      expect(down.z).toBeCloseTo(HOOP.z, 6)
      expect(down.y).toBeCloseTo(HOOP.y, 6)
      // In the hands it is where the shooter stands.
      const hands = toWorld(spot, { along: 0, side: 0, y: HANDS })
      expect(hands).toEqual({ x: shooterAt(spot).x, y: HANDS, z: shooterAt(spot).z })
    }
  })

  it('to the side is to the shooter\'s right, whichever way they face', () => {
    // Straight in front of the post, facing it: right is towards greater x.
    expect(toWorld({ d: 2, turn: 0 }, { along: 0, side: 1, y: 1 }).x).toBeCloseTo(1, 9)
    // On the camera's screen it is to the right too, from every spot.
    for (const spot of spots) {
      const cam = cameraFor(spot)
      const mid = project(cam, toWorld(spot, { along: 1, side: 0, y: 1.5 }), 390, 844)
      const right = project(cam, toWorld(spot, { along: 1, side: 0.5, y: 1.5 }), 390, 844)
      expect(right.x).toBeGreaterThan(mid.x)
    }
  })
})

describe('the camera', () => {
  it('keeps the ball in the middle near the foot of the screen, from every spot on every screen', () => {
    for (const spot of spots) {
      for (const [w, h] of SCREENS) {
        const ball = project(cameraFor(spot), toWorld(spot, { along: 0, side: 0, y: HANDS }), w, h)
        expect(Math.abs(ball.x - w / 2)).toBeLessThan(1)
        expect(ball.y / h).toBeCloseTo(0.5 + BALL_DOWN / 2, 2)
      }
    }
  })

  it('shows the ring above the ball, clear of the buttons at the top, from every spot', () => {
    for (let goals = 0; goals <= 10; goals++) {
      for (const turn of [-0.95, 0, 0.95]) {
        const spot = { ...spotFor(goals, () => 0.5), turn }
        for (const [w, h] of SCREENS.slice(0, 2)) {
          const ring = project(cameraFor(spot), HOOP, w, h)
          expect(Math.abs(ring.x - w / 2)).toBeLessThan(2)
          expect(ring.y).toBeGreaterThan(130)
          expect(ring.y).toBeLessThan(h * 0.5)
          // And wide enough to see: the ring is at least 36 pixels across.
          expect(ring.scale * RING.radius * 2).toBeGreaterThan(36)
        }
      }
    }
  })
})
