// A swipe, a drag, a tap or the keys, as a kick or a dive: a swipe aims
// where it ends on the goal mouth, its speed sets the power and its bow
// the bend; the arrows aim and holding Space builds power; and all of
// them aim at the same spot when they point at the same spot.
//
// Run with: npx vitest run client/shootout/input.test.js

import { describe, it, expect } from 'vitest'
import { KEYS, SWIPE, aimWords, isShootKey, keyToDive, keyboardAim, keyboardShot, pointToAim, powerAfter, swipeToDive, swipeToShot } from './input.js'
import { aimToScreen, cameraFor, project, screenGeometry, screenToAim } from './camera.js'
import { GOAL, aimPoint, launch, liftFor } from './physics.js'

// A phone held upright, the goal and ball where the camera puts them.
const geom = screenGeometry('shoot', 390, 844)

// A swipe from the ball: to dx, dy (pixels) over ms, bowed sideways by bow
// pixels at its middle, as pointer events would report it.
function swipe({ dx, dy, ms = 160, bow = 0, from = geom.ball, steps = 12 }) {
  const points = []
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const len = Math.hypot(dx, dy) || 1
    const px = -dy / len
    const py = dx / len
    const off = Math.sin(k * Math.PI) * bow
    points.push({ x: from.x + dx * k + px * off, y: from.y + dy * k + py * off, t: 1000 + ms * k })
  }
  return points
}

describe('a swipe to shoot', () => {
  // A swipe from the ball that ends at a point on the screen.
  const to = (pt, ms = 160, bow = 0) => swipe({ dx: pt.x - geom.ball.x, dy: pt.y - geom.ball.y, ms, bow })
  const at = (aim) => aimToScreen('shoot', 390, 844, aim)

  it('aims where it ends on the goal mouth, height and all', () => {
    for (const aim of [{ aimX: 0, aimY: 0.5 }, { aimX: -0.8, aimY: 0.2 }, { aimX: 0.9, aimY: 0.85 }, { aimX: 0.4, aimY: 0.05 }]) {
      const shot = swipeToShot(to(at(aim)), geom)
      expect(shot.aimX).toBeCloseTo(aim.aimX, 2)
      expect(shot.aimY).toBeCloseTo(aim.aimY, 2)
    }
    // Past the bar on the screen is over it, past a post wide.
    expect(swipeToShot(to(at({ aimX: 0, aimY: 1.3 })), geom).aimY).toBeGreaterThan(1)
    expect(swipeToShot(to(at({ aimX: 1.3, aimY: 0.4 })), geom).aimX).toBeGreaterThan(1)
  })

  it('keeps a natural swipe on target: ending on the goal does not send it over', () => {
    // A brisk swipe, not a flick at full power, which is meant to rise.
    for (const ms of [140, 200, 320]) {
      for (const aim of [{ aimX: -0.6, aimY: 0.3 }, { aimX: 0.7, aimY: 0.7 }, { aimX: 0, aimY: 0.9 }]) {
        const shot = swipeToShot(to(at(aim), ms), geom)
        const f = launch(shot)
        expect(f.aimed.y, `${ms} ms to ${JSON.stringify(aim)}`).toBeLessThan(2.44)
      }
    }
    // A flick that hard rises, but no further than a little over the bar.
    const flick = launch(swipeToShot(to(at({ aimX: 0.2, aimY: 0.4 }), 90), geom))
    expect(flick.aimed.y).toBeLessThan(2.44 + 0.9)
  })

  it('stops short of the goal as a shot along the ground, the way it was going', () => {
    const short = swipeToShot(swipe({ dx: -40, dy: -90 }), geom)
    expect(short.aimY).toBe(SWIPE.groundAim)
    expect(short.aimX).toBeLessThan(-0.2)
  })

  it('hits harder the faster it is, and lifts only near full power', () => {
    const goal = at({ aimX: 0.3, aimY: 0.5 })
    const slow = swipeToShot(to(goal, 900), geom)
    const brisk = swipeToShot(to(goal, 200), geom)
    const flick = swipeToShot(to(goal, 50), geom)
    expect(slow.power).toBeLessThan(0.15)
    expect(brisk.power).toBeGreaterThan(slow.power)
    expect(flick.power).toBeGreaterThan(brisk.power)
    expect(flick.power).toBeLessThanOrEqual(1)
    expect(liftFor(brisk.power)).toBe(0)
  })

  it('bends with its bow: bowed right, it comes back left', () => {
    const goal = at({ aimX: 0, aimY: 0.5 })
    expect(swipeToShot(to(goal), geom).curve).toBeCloseTo(0, 5)
    expect(swipeToShot(to(goal, 160, 30), geom).curve).toBeLessThan(-0.3)
    expect(swipeToShot(to(goal, 160, -30), geom).curve).toBeGreaterThan(0.3)
    expect(swipeToShot(to(goal, 160, 200), geom).curve).toBe(-1)
  })

  it('is not a kick when it is a tap, goes down the screen, or starts up by the goal', () => {
    expect(swipeToShot(swipe({ dx: 5, dy: -10 }), geom)).toBe(null)
    expect(swipeToShot(swipe({ dx: 0, dy: 200 }), geom)).toBe(null)
    expect(swipeToShot(swipe({ dx: 200, dy: -5 }), geom)).toBe(null)
    expect(swipeToShot(swipe({ dx: 0, dy: -100, from: { x: 195, y: geom.goal.top } }), geom)).toBe(null)
    expect(swipeToShot([{ x: 1, y: 1, t: 0 }], geom)).toBe(null)
    expect(SWIPE.minLength).toBeGreaterThan(20)
  })
})

describe('the swipe, the tap, the mouse and the keys agree', () => {
  it('aim at the same spot when they point at the same spot', () => {
    for (const [w, h] of [[390, 844], [360, 780], [844, 390], [1280, 800]]) {
      const g = screenGeometry('shoot', w, h)
      const cam = cameraFor('shoot', w / h)
      for (const aim of [{ aimX: -0.9, aimY: 0.1 }, { aimX: -0.3, aimY: 0.6 }, { aimX: 0.5, aimY: 0.9 }, { aimX: 0.85, aimY: 0.35 }]) {
        // The keyboard's marker, drawn on the goal where the aim is.
        const world = aimPoint(aim)
        const marker = project(cam, { x: world.x, y: world.y, z: GOAL.lineZ }, w, h)
        // A finger or a mouse that ends there, and a tap there.
        const pts = [{ x: g.ball.x, y: g.ball.y, t: 0 }, { x: marker.x, y: marker.y, t: 150 }]
        const swiped = swipeToShot(pts, g)
        const tapped = screenToAim('shoot', w, h, marker.x, marker.y)
        const pointed = pointToAim(g, marker.x, marker.y)
        for (const got of [swiped, tapped, pointed]) {
          expect(Math.abs(got.aimX - aim.aimX), `${w}x${h} across`).toBeLessThan(0.03)
          expect(Math.abs(got.aimY - aim.aimY), `${w}x${h} up`).toBeLessThan(0.03)
        }
        // And the marker under a finger is drawn where the finger is.
        const back = aimToScreen('shoot', w, h, pointed)
        expect(Math.hypot(back.x - marker.x, back.y - marker.y)).toBeLessThan(1)
      }
    }
  })
})

describe('a swipe or tap to dive', () => {
  it('reads sideways as a dive that way and upwards as a jump', () => {
    expect(swipeToDive(swipe({ dx: -120, dy: -10 }))).toBe('left')
    expect(swipeToDive(swipe({ dx: 120, dy: 20 }))).toBe('right')
    expect(swipeToDive(swipe({ dx: 10, dy: -120 }))).toBe('up')
    expect(swipeToDive(swipe({ dx: 4, dy: 4 }))).toBe(null)
  })
})

describe('the keyboard', () => {
  it('moves the aim in steps with the arrows, and no further than off target', () => {
    let aim = { ...KEYS.start }
    aim = keyboardAim(aim, 'ArrowLeft')
    expect(aim.aimX).toBeCloseTo(-KEYS.step)
    aim = keyboardAim(aim, 'ArrowUp')
    expect(aim.aimY).toBeCloseTo(KEYS.start.aimY + KEYS.step)
    for (let i = 0; i < 30; i++) aim = keyboardAim(aim, 'ArrowLeft')
    expect(aim.aimX).toBe(KEYS.aimX[0])
    for (let i = 0; i < 30; i++) aim = keyboardAim(aim, 'ArrowDown')
    expect(aim.aimY).toBe(0)
    expect(keyboardAim(aim, 'a')).toBe(null)
  })

  it('builds power while Space is held, to full and no more', () => {
    expect(isShootKey(' ')).toBe(true)
    expect(isShootKey('Enter')).toBe(false)
    expect(powerAfter(0)).toBe(0)
    expect(powerAfter(KEYS.chargeMs / 2)).toBeCloseTo(0.5)
    expect(powerAfter(KEYS.chargeMs * 3)).toBe(1)
    expect(keyboardShot({ aimX: 0.5, aimY: 0.4 }, KEYS.chargeMs)).toEqual({ aimX: 0.5, aimY: 0.4, power: 1, curve: 0 })
  })

  it('dives with the arrows', () => {
    expect(keyToDive('ArrowLeft')).toBe('left')
    expect(keyToDive('ArrowRight')).toBe('right')
    expect(keyToDive('ArrowUp')).toBe('up')
    expect(keyToDive('ArrowDown')).toBe(null)
  })

  it('says where the aim is, in words', () => {
    expect(aimWords({ aimX: 0, aimY: 0.1 })).toBe('Aiming low, centre')
    expect(aimWords({ aimX: -0.8, aimY: 0.8 })).toBe('Aiming high, left corner')
    expect(aimWords({ aimX: 1.1, aimY: 0.4 })).toBe('Aiming wide right, middle height')
    expect(aimWords({ aimX: 0.3, aimY: 1.1 })).toBe('Aiming over the bar, right of centre')
  })
})
