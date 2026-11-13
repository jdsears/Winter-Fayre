// Cricket smash on the stage (ground.js, play3d.js): where things are
// in the stadium, the batter's stroke, how a tap meets the ball, the
// bowler's run and how the camera frames it all.

import { describe, it, expect } from 'vitest'
import { GROUND, PITCH_LENGTH, BALL_R, HAND, BAT, CONTACT, toWorld, strokeAt, batPoint, cameraFor } from './ground.js'
import { ballIn, bowlerAt, joggingBack, swingAt, meeting, hitBall, ballOffStumps, DOWN, FOLLOW, BACK, PAUSE, WAIT, JOG, JOG_AFTER, LAG } from './play3d.js'
import { BALLS, BEYOND, REACH, TIMING, OVER, delivery, lateFor, stumpsAfter, stroke } from './rules.js'
import { project } from '../shootout/camera.js'

const SCREENS = [[360, 780], [390, 844], [740, 360], [1280, 800]]
const PHONES = SCREENS.slice(0, 2)
const dice = (...values) => { let i = 0; return () => values[i++ % values.length] }
const balls = () => {
  const made = []
  for (let ball = 0; ball < BALLS; ball++) {
    for (let n = 0; n < 12; n++) made.push(delivery(ball, dice((n * 0.137) % 1, (n * 0.311) % 1, (n * 0.53) % 1, (n * 0.71) % 1, (n * 0.19) % 1, (n * 0.83) % 1)))
  }
  return made
}

describe('the ground', () => {
  it('is a pitch 22 yards long, the batter\'s end nearest the camera', () => {
    expect(GROUND.stumps - GROUND.far).toBeCloseTo(PITCH_LENGTH, 9)
    expect(PITCH_LENGTH).toBeCloseTo(20.12, 9)
    expect(GROUND.stumps).toBeGreaterThan(GROUND.far)
    expect(GROUND.stumps - GROUND.crease).toBeCloseTo(1.22, 9)
  })

  it('puts the bat in front of the crease, as far from the stumps as the rules say', () => {
    expect(GROUND.bat).toBeLessThan(GROUND.crease)
    expect(GROUND.crease - GROUND.bat).toBeLessThan(1)
    expect((GROUND.stumps - GROUND.bat) / (GROUND.bat - GROUND.release)).toBeCloseTo(BEYOND, 9)
  })

  it('carries a ball from the hand to the bat and on to the stumps', () => {
    expect(toWorld({ along: 0, side: 0.3, y: 2 })).toEqual({ x: 0.3, y: 2, z: GROUND.release })
    expect(toWorld({ along: 1, side: 0, y: 0.5 }).z).toBeCloseTo(GROUND.bat, 9)
    expect(toWorld({ along: 1 + BEYOND, side: 0, y: 0.5 }).z).toBeCloseTo(GROUND.stumps, 9)
    const d = delivery(0, dice(0.5))
    expect(ballIn(d, 0)).toEqual({ x: HAND.arm, y: HAND.hand, z: GROUND.release })
    expect(ballIn(d, d.time).z).toBeCloseTo(GROUND.bat, 9)
    expect(ballIn(d, d.time + stumpsAfter(d)).z).toBeCloseTo(GROUND.stumps, 9)
  })

  it('stands the batter to the leg side of the stumps and the bowler to the off side of his', () => {
    expect(GROUND.batterX).toBeLessThan(-GROUND.stumpGap * 2)
    expect(GROUND.bowlerX).toBeGreaterThan(GROUND.stumpGap * 2)
    // The bowling arm is the one nearer the stumps, and clear of them.
    expect(HAND.arm).toBeLessThan(GROUND.bowlerX)
    expect(HAND.arm).toBeGreaterThan(GROUND.stumpGap + 0.05)
    expect(Math.abs(GROUND.batterZ - GROUND.crease)).toBeLessThan(0.3)
  })
})

describe('the batter\'s stroke', () => {
  it('waits with the bat lifted behind, the toe above the hands', () => {
    const s = strokeAt({ swing: 0 })
    expect(s.stand).toEqual({ x: GROUND.batterX, z: GROUND.batterZ })
    expect(s.angle).toBeLessThan(-Math.PI / 2)
    const toe = batPoint(s, BAT.handle - BAT.top + BAT.blade)
    expect(toe.y).toBeGreaterThan(s.grip.y)
    expect(toe.z).toBeGreaterThan(s.grip.z)
    expect(batPoint(s, 0)).toEqual(s.grip)
  })

  it('has the bat upright where the ball is met, and the blade at the ball\'s height and on its line', () => {
    for (const d of balls()) {
      const s = strokeAt({ swing: CONTACT, line: d.line })
      expect(s.angle).toBeCloseTo(0, 9)
      expect(s.grip.z).toBeCloseTo(GROUND.bat, 9)
      const top = batPoint(s, BAT.handle - BAT.top)
      const toe = batPoint(s, BAT.handle - BAT.top + BAT.blade)
      expect(toe.z).toBeCloseTo(s.grip.z, 9)
      expect(toe.y).toBeLessThan(d.height - BALL_R / 2)
      expect(top.y).toBeGreaterThan(d.height + BALL_R / 2)
      expect(toe.y).toBeGreaterThan(0.05)
      // The blade is across the ball: no gap between them.
      expect(Math.abs(s.grip.x - d.line)).toBeLessThan(BAT.width / 2 + BALL_R)
    }
  })

  it('steps to the off side for a wide ball and stays put for a straight one', () => {
    expect(strokeAt({ swing: CONTACT, line: 0 }).stand.x).toBeCloseTo(GROUND.batterX, 9)
    expect(strokeAt({ swing: CONTACT, line: 0.4 }).stand.x).toBeGreaterThan(GROUND.batterX + 0.3)
    // Not before the swing.
    expect(strokeAt({ swing: 0, line: 0.4 }).stand.x).toBe(GROUND.batterX)
  })

  it('strides down the pitch to a ball met at the right moment, and goes back for one met late', () => {
    expect(strokeAt({ swing: CONTACT }).stand.z).toBeLessThan(GROUND.batterZ - 0.2)
    const late = strokeAt({ swing: CONTACT, meet: 1.5 })
    expect(late.stand.z).toBeGreaterThan(GROUND.batterZ + 0.2)
    // Never back on to his stumps.
    expect(late.stand.z).toBeLessThan(GROUND.stumps - 0.6)
  })

  it('meets a late ball where the ball is, as far back as the bat can reach it, and still in front of the stumps', () => {
    for (const d of balls()) {
      const furthest = (GROUND.bat - GROUND.release) * (lateFor(d) / d.time)
      for (const meet of [0, 0.4, 0.9, furthest]) {
        const s = strokeAt({ swing: CONTACT, meet, line: d.line })
        expect(s.grip.z).toBeCloseTo(GROUND.bat + meet, 9)
        expect(s.grip.z).toBeLessThan(GROUND.stumps - 0.15)
        // The hands stay within reach of where he stands.
        expect(Math.abs(s.grip.z - s.stand.z)).toBeLessThan(0.65)
      }
    }
    expect(REACH * (GROUND.bat - GROUND.release)).toBeLessThanOrEqual(1.75)
  })

  it('finishes with the bat up past the front shoulder, towards the bowler', () => {
    const s = strokeAt({ swing: 1 })
    expect(s.angle).toBeGreaterThan(Math.PI / 2)
    const toe = batPoint(s, BAT.handle - BAT.top + BAT.blade)
    expect(toe.y).toBeGreaterThan(s.grip.y)
    expect(toe.z).toBeLessThan(s.grip.z)
    expect(s.grip.y).toBeGreaterThan(1.3)
  })

  it('turns the bat one way all through the swing, with no jump', () => {
    let last = strokeAt({ swing: 0 })
    for (let w = 0.01; w <= 1.0001; w += 0.01) {
      const s = strokeAt({ swing: w, line: 0.36, meet: 0.5 })
      expect(s.angle).toBeGreaterThanOrEqual(last.angle - 1e-9)
      expect(s.angle - last.angle).toBeLessThan(0.45)
      expect(Math.hypot(s.grip.x - last.grip.x, s.grip.y - last.grip.y, s.grip.z - last.grip.z)).toBeLessThan(0.12)
      last = s
    }
  })

  it('takes a swing out of range as waiting or finished, and no swing as waiting', () => {
    expect(strokeAt({ swing: -3 })).toEqual(strokeAt({ swing: 0 }))
    expect(strokeAt({ swing: 9 })).toEqual(strokeAt({ swing: 1 }))
    expect(strokeAt()).toEqual(strokeAt({ swing: 0 }))
  })
})

describe('the swing of the bat', () => {
  it('comes down to the ball and follows through, never going back', () => {
    expect(swingAt(-1)).toBe(0)
    expect(swingAt(0)).toBe(0)
    expect(swingAt(DOWN)).toBeCloseTo(CONTACT, 9)
    expect(swingAt(DOWN + FOLLOW)).toBeCloseTo(1, 9)
    expect(swingAt(9)).toBe(1)
    let last = 0
    for (let t = 0; t < DOWN + FOLLOW + 0.1; t += 0.005) {
      expect(swingAt(t)).toBeGreaterThanOrEqual(last)
      last = swingAt(t)
    }
  })

  it('comes down more slowly for a ball that is not there yet, to meet it as it arrives', () => {
    expect(swingAt(0.2, 0.2)).toBeCloseTo(CONTACT, 9)
    expect(swingAt(0.1, 0.2)).toBeCloseTo(CONTACT / 2, 9)
    expect(swingAt(0.2 + FOLLOW, 0.2)).toBeCloseTo(1, 9)
  })

  it('is quick: down in under a tenth of a second, and back in time for the next ball', () => {
    expect(DOWN).toBeLessThan(0.1)
    expect(DOWN + FOLLOW + BACK).toBeLessThan(PAUSE)
    expect(LAG).toBeLessThan(TIMING.six)
  })
})

describe('a tap at a ball', () => {
  const d = delivery(2, dice(0.5))
  const arrives = 10

  it('meets it when it is near enough the right moment, and says what it is worth', () => {
    expect(meeting(d, arrives, arrives).kind).toBe('six')
    expect(meeting(d, arrives - 0.08, arrives).kind).toBe('four')
    expect(meeting(d, arrives - 0.2, arrives).kind).toBe('one')
    expect(meeting(d, arrives - 0.2, arrives).delta).toBeCloseTo(-0.2, 9)
  })

  it('misses when it is far too early, or after the bat can reach the ball', () => {
    expect(meeting(d, arrives - 0.31, arrives)).toBeNull()
    expect(meeting(d, arrives + lateFor(d) + 0.001, arrives)).toBeNull()
    expect(meeting(d, arrives + lateFor(d) - 0.001, arrives)).not.toBeNull()
  })

  it('has the bat wait for a ball that is not there yet, and meet it as it arrives', () => {
    const m = meeting(d, arrives - 0.2, arrives)
    expect(m.holds).toBe(arrives)
    expect(m.meets).toBe(arrives)
  })

  it('stops a ball that is there already until the bat gets down to it', () => {
    const late = meeting(d, arrives + 0.05, arrives)
    expect(late.holds).toBeCloseTo(arrives + 0.05, 9)
    expect(late.meets).toBeCloseTo(arrives + 0.05 + DOWN, 9)
    const just = meeting(d, arrives - 0.02, arrives)
    expect(just.holds).toBe(arrives)
    expect(just.meets).toBeCloseTo(arrives - 0.02 + DOWN, 9)
  })

  it('never stops the ball for longer than the bat takes to come down, short of the bat, or at the stumps', () => {
    for (const ball of balls()) {
      for (let delta = -TIMING.touch + 0.001; delta < lateFor(ball) - 0.001; delta += 0.01) {
        const m = meeting(ball, arrives + delta, arrives)
        expect(m).not.toBeNull()
        expect(m.meets - m.holds).toBeGreaterThanOrEqual(0)
        expect(m.meets - m.holds).toBeLessThanOrEqual(DOWN + 1e-9)
        expect(m.holds).toBeGreaterThanOrEqual(arrives)
        const held = ballIn(ball, ball.time + (m.holds - arrives))
        expect(held.z).toBeGreaterThanOrEqual(GROUND.bat - 1e-9)
        expect(held.z).toBeLessThan(GROUND.stumps - 0.15)
      }
    }
  })
})

describe('a ball off the bat, and one on to the stumps', () => {
  const from = { x: 0, y: 0.6, z: GROUND.bat }

  it('flies a six high towards the stand', () => {
    const s = stroke('six', 0)
    const later = hitBall(from, s, 1)
    expect(hitBall(from, s, 0)).toEqual(from)
    expect(later.z).toBeLessThan(from.z - 15)
    expect(later.y).toBeGreaterThan(8)
    expect(later.x).toBeCloseTo(0, 9)
  })

  it('runs a four along the ground, slowing, and never under it', () => {
    const s = stroke('four', 0)
    let last = from
    let step = Infinity
    for (let t = 0.1; t <= 2; t += 0.1) {
      const p = hitBall(from, s, t)
      expect(p.y).toBeGreaterThanOrEqual(BALL_R)
      expect(p.y).toBeLessThan(1.5)
      expect(last.z - p.z).toBeGreaterThan(0)
      expect(last.z - p.z).toBeLessThanOrEqual(step + 1e-9)
      step = last.z - p.z
      last = p
    }
    expect(from.z - last.z).toBeGreaterThan(25)
  })

  it('goes to the leg side off an early swing and to the off side off a late one', () => {
    expect(hitBall(from, stroke('four', -0.09), 0.5).x).toBeLessThan(-1)
    expect(hitBall(from, stroke('four', 0.09), 0.5).x).toBeGreaterThan(1)
  })

  it('drops a ball that has hit the stumps just behind them', () => {
    const at = { x: 0.02, y: 0.5, z: GROUND.stumps }
    expect(ballOffStumps(at, 0).y).toBe(0.5)
    for (const t of [0, 0.1, 0.4, 2]) {
      const p = ballOffStumps(at, t)
      expect(p.z).toBeGreaterThan(GROUND.stumps)
      expect(p.z).toBeLessThan(GROUND.stumps + 0.7)
      expect(p.y).toBeGreaterThanOrEqual(BALL_R)
    }
    expect(ballOffStumps(at, 2).y).toBe(BALL_R)
  })
})

describe('the bowler', () => {
  const d = delivery(0, dice(0.5))

  it('waits at the top of his run, the ball in his hand', () => {
    expect(bowlerAt(d, -99)).toEqual({ x: GROUND.bowlerX, z: GROUND.runFrom, stride: 0, run: 0, bowl: 0 })
    expect(bowlerAt(d, -d.runup).z).toBeCloseTo(GROUND.runFrom, 9)
  })

  it('runs in to the crease, gathering pace, and never goes back', () => {
    let last = bowlerAt(d, -d.runup)
    let step = 0
    for (let t = -d.runup + 0.05; t <= 0; t += 0.05) {
      const b = bowlerAt(d, t)
      expect(b.z).toBeGreaterThan(last.z)
      expect(b.z - last.z).toBeGreaterThanOrEqual(step - 1e-9)
      step = b.z - last.z
      last = b
    }
    for (let t = 0.05; t <= 3; t += 0.05) {
      const b = bowlerAt(d, t)
      expect(b.z).toBeGreaterThanOrEqual(last.z)
      last = b
    }
  })

  it('lets the ball go from his hand as his arm passes the top, just short of the crease', () => {
    for (const ball of balls()) {
      const b = bowlerAt(ball, 0)
      expect(b.bowl).toBeGreaterThan(0.5)
      expect(b.bowl).toBeLessThan(0.66)
      expect(b.run).toBe(1)
      // His feet are behind the ball, less than an arm's length.
      expect(GROUND.release - b.z).toBeGreaterThan(0.2)
      expect(GROUND.release - b.z).toBeLessThan(0.6)
      expect(b.x - HAND.arm).toBeCloseTo(0.29, 9)
    }
    expect(bowlerAt(d, -0.5).bowl).toBe(0)
    expect(bowlerAt(d, 0.3).bowl).toBe(1)
  })

  it('pulls up in a few steps, well short of the batter, at any pace', () => {
    for (const ball of balls()) {
      const end = bowlerAt(ball, 5)
      expect(end.run).toBe(0)
      expect(end.z - GROUND.release).toBeGreaterThan(0.5)
      expect(end.z - GROUND.release).toBeLessThan(4)
      // No jump as he lets go.
      expect(bowlerAt(ball, 0.001).z - bowlerAt(ball, -0.001).z).toBeLessThan(0.03)
    }
  })

  it('has a shorter run for each ball of the over', () => {
    for (let i = 1; i < OVER.length; i++) expect(OVER[i].runup).toBeLessThan(OVER[i - 1].runup)
  })

  it('jogs back to the top of his run between balls, turned away, and is there before the next run starts', () => {
    const from = bowlerAt(d, 3).z
    expect(joggingBack(from, 0, 0)).toEqual({ x: GROUND.bowlerX, z: from, stride: 0, run: 0, bowl: 0, turn: 0 })
    const there = joggingBack(from, 1, JOG)
    expect(there.z).toBeCloseTo(GROUND.runFrom, 9)
    expect(there.turn).toBe(0)
    expect(there.run).toBe(0)
    let last = from
    for (let k = 0.05; k < 1; k += 0.05) {
      const b = joggingBack(from, k, k * JOG)
      expect(b.z).toBeLessThan(last)
      expect(b.x).toBe(GROUND.bowlerX)
      expect(b.bowl).toBe(0)
      last = b.z
    }
    expect(joggingBack(from, 0.5, 1).turn).toBe(1)
    // He sets off once the result has been seen, when he has pulled up,
    // and is back before the next ball's run begins.
    expect(JOG_AFTER).toBeGreaterThan(0.4)
    expect(bowlerAt(d, d.time + JOG_AFTER).run).toBe(0)
    expect(JOG_AFTER + JOG).toBeLessThan(PAUSE + WAIT)
    expect(JOG_AFTER + JOG).toBeGreaterThan(PAUSE)
  })
})

describe('the camera', () => {
  const cam = cameraFor()
  const on = (p, w, h) => project(cam, p, w, h)
  const inside = (q, w, h, margin = 0) => q.x >= margin && q.x <= w - margin && q.y >= margin && q.y <= h - margin

  it('is behind the batter\'s stumps, looking down the pitch', () => {
    expect(cam.pos.z).toBeGreaterThan(GROUND.stumps + 3)
    expect(cam.pos.x).toBe(0)
    expect(cam.look.z).toBeLessThan(GROUND.crease)
  })

  it('shows the whole of the near wicket and the batter, in the lower half, on every screen', () => {
    for (const [w, h] of SCREENS) {
      const foot = on({ x: 0, y: 0, z: GROUND.stumps }, w, h)
      const top = on({ x: 0, y: GROUND.stumpHeight, z: GROUND.stumps }, w, h)
      expect(inside(foot, w, h, 8)).toBe(true)
      expect(top.y).toBeGreaterThan(h / 2)
      expect(top.y).toBeLessThan(foot.y)
      for (const swing of [0, CONTACT, 1]) {
        const s = strokeAt({ swing, line: 0.4 })
        expect(inside(on({ x: s.stand.x - 0.3, y: 0, z: s.stand.z }, w, h), w, h, 4)).toBe(true)
        expect(inside(on({ x: s.stand.x, y: 1.8, z: s.stand.z }, w, h), w, h, 4)).toBe(true)
        expect(inside(on(batPoint(s, BAT.handle - BAT.top + BAT.blade), w, h), w, h, 4)).toBe(true)
      }
      expect(on({ x: GROUND.batterX, y: 1.8, z: GROUND.batterZ }, w, h).y).toBeGreaterThan(h * 0.4)
    }
  })

  it('shows the bowler all the way in, clear of the buttons at the top and to one side of the batter', () => {
    for (const [w, h] of SCREENS) {
      const d = delivery(0, dice(0.5))
      for (const t of [-99, -1, -0.3, 0, 0.5, 3]) {
        const b = bowlerAt(d, t)
        const head = on({ x: b.x, y: 1.85, z: b.z }, w, h)
        const feet = on({ x: b.x, y: 0, z: b.z }, w, h)
        expect(inside(head, w, h)).toBe(true)
        expect(inside(feet, w, h)).toBe(true)
        if (h > w) expect(head.y).toBeGreaterThan(130)
        // He is to the right of the batter's head, not behind it.
        expect(feet.x).toBeGreaterThan(on({ x: GROUND.batterX + 0.2, y: 1.7, z: GROUND.batterZ }, w, h).x)
      }
    }
  })

  it('shows the ball all the way from the hand to the bat and on to the stumps', () => {
    for (const [w, h] of SCREENS) {
      for (const d of balls()) {
        for (let t = 0; t <= d.time + stumpsAfter(d); t += 0.03) {
          const at = on(ballIn(d, t), w, h)
          expect(inside(at, w, h)).toBe(true)
          if (h > w) expect(at.y).toBeGreaterThan(130)
        }
      }
    }
  })

  it('shows the ball big enough to follow on a phone, and bigger as it comes', () => {
    for (const [w, h] of PHONES) {
      const d = delivery(0, dice(0.5))
      const leaving = on(ballIn(d, 0), w, h)
      const arriving = on(ballIn(d, d.time), w, h)
      expect(leaving.scale * BALL_R * 2).toBeGreaterThan(5)
      expect(arriving.scale * BALL_R * 2).toBeGreaterThan(leaving.scale * BALL_R * 2 * 2)
      // It comes down the screen towards the batter.
      expect(arriving.y).toBeGreaterThan(leaving.y)
    }
  })

  it('puts off to the right, as the batter\'s end sees it', () => {
    const mid = on({ x: 0, y: 0.5, z: GROUND.bat }, 390, 844)
    expect(Math.abs(mid.x - 195)).toBeLessThan(1)
    expect(on({ x: 0.4, y: 0.5, z: GROUND.bat }, 390, 844).x).toBeGreaterThan(mid.x)
  })
})
