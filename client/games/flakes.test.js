// The poster's snowflakes and stars (flakes.js): how they are drawn, and
// where they hang in a stadium's sky.

import { describe, it, expect } from 'vitest'
import { drawFlake, drawSparkle, stadiumFlakes, swayAt, POSTER, KINDS } from './flakes.js'

// A drawing surface that draws nothing and notes what it was asked to do.
function surface() {
  const log = { strokes: 0, fills: 0, saves: 0, restores: 0, rotates: [], points: [], inks: [], widths: [] }
  const g = {
    save() { log.saves++ },
    restore() { log.restores++ },
    rotate(a) { log.rotates.push(a) },
    beginPath() {},
    closePath() {},
    moveTo(x, y) { log.points.push([x, y]) },
    lineTo(x, y) { log.points.push([x, y]) },
    arc(x, y, r) { log.points.push([x + r, y + r]) },
    stroke() { log.strokes++; log.inks.push(g.strokeStyle); log.widths.push(g.lineWidth) },
    fill() { log.fills++; log.inks.push(g.fillStyle) },
  }
  return { g, log }
}

describe('a snowflake', () => {
  it('has six arms, a sixth of a turn apart, in each of its three patterns', () => {
    expect(KINDS).toBe(3)
    for (let kind = 0; kind < KINDS; kind++) {
      const { g, log } = surface()
      drawFlake(g, 128, kind)
      const turns = log.rotates.filter(a => Math.abs(a % (Math.PI / 3)) < 1e-9 || Math.abs((a % (Math.PI / 3)) - Math.PI / 3) < 1e-9)
      expect(turns.slice(0, 6).length).toBe(6)
      expect(new Set(log.rotates.filter(a => a !== Math.PI / 6).map(a => Math.round(a * 1000))).size).toBe(6)
      expect(log.strokes).toBeGreaterThanOrEqual(12)
    }
  })

  it('differs from pattern to pattern', () => {
    const drawn = [0, 1, 2].map((kind) => { const { g, log } = surface(); drawFlake(g, 128, kind); return JSON.stringify(log.points) })
    expect(new Set(drawn).size).toBe(3)
  })

  it('keeps inside its square, leaves the surface as it found it, and is drawn in the ink it is given', () => {
    for (const size of [20, 128, 400]) {
      for (let kind = 0; kind < KINDS; kind++) {
        const { g, log } = surface()
        drawFlake(g, size, kind, POSTER.teal)
        for (const [x, y] of log.points) expect(Math.hypot(x, y)).toBeLessThanOrEqual(size / 2)
        expect(log.saves).toBe(log.restores)
        expect(new Set(log.inks)).toEqual(new Set([POSTER.teal]))
        // Its line is in keeping with its size, and never thinner than a pixel.
        for (const w of log.widths) { expect(w).toBeGreaterThanOrEqual(1); expect(w).toBeLessThanOrEqual(size * 0.05 + 1) }
      }
    }
  })
})

describe('a four-pointed star', () => {
  it('has four long points and four short hollows between them, filled in its ink', () => {
    const { g, log } = surface()
    drawSparkle(g, 128, POSTER.gold)
    expect(log.fills).toBe(1)
    expect(log.inks).toEqual([POSTER.gold])
    const reach = log.points.map(([x, y]) => Math.hypot(x, y))
    expect(reach.length).toBe(8)
    reach.forEach((r, i) => expect(r).toBeCloseTo(i % 2 ? 8 : 128 * 0.47, 6))
    expect(log.saves).toBe(log.restores)
  })
})

describe('the snowflakes in a stadium\'s sky', () => {
  const behind = -34
  const hung = stadiumFlakes(behind)

  it('hang above the stand and behind it, all the way across', () => {
    expect(hung.length).toBe(30)
    for (const f of hung) {
      expect(f.y).toBeGreaterThan(12)
      expect(f.y).toBeLessThanOrEqual(30)
      expect(f.z).toBeLessThan(behind)
      expect(f.z).toBeGreaterThanOrEqual(behind - 16)
      expect(Math.abs(f.x)).toBeLessThanOrEqual(45)
    }
    expect(Math.min(...hung.map(f => f.x))).toBeLessThan(-35)
    expect(Math.max(...hung.map(f => f.x))).toBeGreaterThan(35)
  })

  it('are a mix of the three patterns and of stars, in the poster\'s teal, ice blue, gold and white', () => {
    expect(hung.filter(f => f.star).length).toBe(7)
    expect(new Set(hung.filter(f => !f.star).map(f => f.kind))).toEqual(new Set([0, 1, 2]))
    for (const f of hung) {
      expect(f.star ? f.kind === KINDS : f.kind < KINDS).toBe(true)
      expect(Object.values(POSTER)).toContain(f.ink)
      expect(f.size).toBeGreaterThan(1.3)
      expect(f.size).toBeLessThan(4.3)
    }
    expect(new Set(hung.map(f => f.ink)).size).toBeGreaterThanOrEqual(3)
  })

  it('are the same every time, so the 3D stadium and the flat one hang them in the same places', () => {
    expect(stadiumFlakes(behind)).toEqual(hung)
    expect(stadiumFlakes(behind, 30, 7)).not.toEqual(hung)
  })

  it('sway a little, the stars twinkle, and with reduced motion nothing moves', () => {
    const flake = hung.find(f => !f.star)
    const star = hung.find(f => f.star)
    const lifts = [0, 1, 2, 3, 4, 5].map(t => swayAt(flake, t).lift)
    expect(Math.max(...lifts.map(Math.abs))).toBeLessThanOrEqual(0.22)
    expect(new Set(lifts.map(l => l.toFixed(3))).size).toBeGreaterThan(3)
    expect(swayAt(flake, 2).scale).toBe(1)
    const scales = [0, 0.4, 0.8, 1.2, 1.6].map(t => swayAt(star, t).scale)
    for (const k of scales) { expect(k).toBeGreaterThanOrEqual(0.44); expect(k).toBeLessThanOrEqual(1) }
    expect(new Set(scales.map(k => k.toFixed(2))).size).toBeGreaterThan(2)
    expect(swayAt(star, 3, true)).toEqual({ lift: 0, scale: 1 })
  })
})
