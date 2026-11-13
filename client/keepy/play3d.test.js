// The stadium version of keepy-uppies turns the rules' pixels into the
// stadium's metres and a touch on the screen back into the rules' pixels.
// The two must agree, or a tap on the ball would miss it.

import { describe, it, expect } from 'vitest'
import { cameraFor, screenToRules, rulesToWorld, MILESTONES } from './play3d.js'
import { W, H, R, GROUND } from './rules.js'
import { project } from '../shootout/camera.js'

describe('keepy-uppies in the stadium', () => {
  for (const [w, h] of [[360, 640], [375, 740], [390, 844], [1280, 720]]) {
    it(`a tap on the drawn ball is a tap on the rules' ball at ${w} by ${h}`, () => {
      const cam = cameraFor(w, h)
      for (const [x, y] of [[W / 2, H * 0.36], [R, GROUND - R], [W - R, R], [200, 300]]) {
        const s = project({ ...cam }, rulesToWorld(x, y), w, h)
        const back = screenToRules(cam, w, h, s.x, s.y)
        expect(back.x).toBeCloseTo(x, 3)
        expect(back.y).toBeCloseTo(y, 3)
      }
    })

    it(`the whole pitch is on the screen at ${w} by ${h}`, () => {
      const cam = cameraFor(w, h)
      for (const [x, y] of [[R, R], [W - R, R], [R, GROUND - R], [W - R, GROUND - R]]) {
        const s = project({ ...cam }, rulesToWorld(x, y), w, h)
        expect(s.x).toBeGreaterThanOrEqual(0)
        expect(s.x).toBeLessThanOrEqual(w)
        expect(s.y).toBeGreaterThanOrEqual(0)
        expect(s.y).toBeLessThanOrEqual(h)
      }
    })
  }

  it('the milestones rise', () => {
    expect([...MILESTONES].sort((a, b) => a - b)).toEqual(MILESTONES)
  })
})
