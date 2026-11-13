// The shooter's arms in netball (arms.js): where they are, and how they
// follow the ball through.

import { describe, it, expect } from 'vitest'
import { armsAt, facing, liftAt, HAND_OUT, FOREARM, LIFT } from './arms.js'
import { cameraFor, shooterAt, toWorld } from './play3d.js'
import { HANDS, BALL_R, SPOT } from './rules.js'
import { project } from '../shootout/camera.js'

const SCREENS = [[360, 780], [390, 844], [740, 360], [1280, 800]]
const spots = [{ d: SPOT.first, turn: 0 }, { d: 2.2, turn: 0.6 }, { d: SPOT.last, turn: -0.95 }, { d: SPOT.last, turn: 0.95 }]
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('the shooter\'s arms', () => {
  it('face the way the camera faces: its right is to the right of the screen and its up is up', () => {
    for (const spot of spots) {
      const cam = cameraFor(spot)
      const f = facing(cam)
      const at = toWorld(spot, { along: 0, side: 0, y: HANDS })
      const here = project(cam, at, 390, 844)
      const right = project(cam, { x: at.x + f.right.x, y: at.y + f.right.y, z: at.z + f.right.z }, 390, 844)
      const up = project(cam, { x: at.x + f.up.x * 0.3, y: at.y + f.up.y * 0.3, z: at.z + f.up.z * 0.3 }, 390, 844)
      expect(right.x).toBeGreaterThan(here.x + 20)
      expect(Math.abs(right.y - here.y)).toBeLessThan(2)
      expect(up.y).toBeLessThan(here.y - 10)
      expect(Math.abs(up.x - here.x)).toBeLessThan(2)
    }
  })

  it('hold the ball with a hand either side of it, the left arm first, the elbows below and nearer the shooter', () => {
    for (const spot of spots) {
      const cam = cameraFor(spot)
      const at = toWorld(spot, { along: 0, side: 0, y: HANDS })
      const [left, right] = armsAt(cam, at, 0)
      expect([left.side, right.side]).toEqual([-1, 1])
      for (const arm of [left, right]) {
        // The hand is at the ball's side, touching it.
        expect(dist(arm.hand, at)).toBeGreaterThan(BALL_R)
        expect(dist(arm.hand, at)).toBeLessThan(BALL_R + 0.08)
        expect(dist(arm.hand, arm.elbow)).toBeGreaterThan(FOREARM * 0.9)
        expect(arm.elbow.y).toBeLessThan(arm.hand.y - 0.3)
        // Not as far in front of the camera as the hand is.
        const on = facing(cam).on
        const ahead = (p) => (p.x - cam.pos.x) * on.x + (p.y - cam.pos.y) * on.y + (p.z - cam.pos.z) * on.z
        expect(ahead(arm.elbow)).toBeLessThan(ahead(arm.hand))
        expect(ahead(arm.elbow)).toBeGreaterThan(0.6)
      }
      expect(dist(left.hand, right.hand)).toBeCloseTo(HAND_OUT * 2, 6)
    }
  })

  it('come up from the foot of the screen to the ball, one each side of it, on every screen', () => {
    for (const spot of spots) {
      for (const [w, h] of SCREENS) {
        const cam = cameraFor(spot)
        const at = toWorld(spot, { along: 0, side: 0, y: HANDS })
        const ball = project(cam, at, w, h)
        const [left, right] = armsAt(cam, at, 0).map(a => ({ hand: project(cam, a.hand, w, h), elbow: project(cam, a.elbow, w, h) }))
        expect(left.hand.x).toBeLessThan(ball.x)
        expect(right.hand.x).toBeGreaterThan(ball.x)
        for (const arm of [left, right]) {
          // The hand is by the ball and on the screen; the elbow is off its foot.
          expect(Math.abs(arm.hand.y - ball.y)).toBeLessThan(h * 0.06)
          expect(arm.hand.y).toBeLessThan(h)
          expect(arm.elbow.y).toBeGreaterThan(h * 0.98)
          expect(arm.hand.x).toBeGreaterThan(0)
          expect(arm.hand.x).toBeLessThan(w)
        }
      }
    }
  })

  it('follow the ball through: the hands rise, reach for the ring and stay on the screen', () => {
    for (const spot of spots) {
      const cam = cameraFor(spot)
      const at = toWorld(spot, { along: 0, side: 0, y: HANDS })
      const held = armsAt(cam, at, 0)
      const through = armsAt(cam, at, 1)
      const under = shooterAt(spot)
      for (let i = 0; i < 2; i++) {
        expect(through[i].hand.y).toBeGreaterThan(held[i].hand.y + LIFT.up * 0.6)
        // Nearer the ring than they were (it is spot.d from where the shooter stands).
        const ring = { x: under.x - Math.sin(spot.turn) * spot.d, z: under.z - Math.cos(spot.turn) * spot.d }
        expect(Math.hypot(through[i].hand.x - ring.x, through[i].hand.z - ring.z)).toBeLessThan(Math.hypot(held[i].hand.x - ring.x, held[i].hand.z - ring.z))
        const here = project(cam, through[i].hand, 390, 844)
        expect(here.y).toBeGreaterThan(130)
        expect(here.y).toBeLessThan(project(cam, held[i].hand, 390, 844).y)
        expect(here.x).toBeGreaterThan(0)
        expect(here.x).toBeLessThan(390)
      }
      // A lift out of range is the nearest end.
      expect(armsAt(cam, at, -4)).toEqual(held)
      expect(armsAt(cam, at, 9)).toEqual(through)
    }
  })

  it('go up quickly as the ball is let go, stay up, and come down for the next ball', () => {
    expect(liftAt(-1)).toBe(0)
    expect(liftAt(0)).toBe(0)
    expect(liftAt(0.16)).toBe(1)
    expect(liftAt(0.6)).toBe(1)
    let last = 0
    for (let t = 0; t <= 0.16; t += 0.01) {
      expect(liftAt(t)).toBeGreaterThanOrEqual(last)
      last = liftAt(t)
    }
    // Down again from a moment given.
    expect(liftAt(1, 1)).toBe(1)
    expect(liftAt(1.09, 1)).toBeLessThan(1)
    expect(liftAt(1.09, 1)).toBeGreaterThan(0)
    expect(liftAt(1.2, 1)).toBe(0)
  })
})
