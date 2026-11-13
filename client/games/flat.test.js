// The flat stadium's cutting off (flat.js): nothing behind the camera
// is ever drawn, wherever the camera stands and whichever way it looks.

import { describe, it, expect } from 'vitest'
import { clipLine, clipShape, NEAR, createFlatView } from './flat.js'
import { cameraFor as rugbyCamera, teeAt } from '../rugby/play3d.js'
import { cameraFor as netballCamera, HOOP } from '../netball/play3d.js'
import { paintRugby } from '../rugby/paint.js'
import { paintNetball } from '../netball/paint.js'
import { cameraFor as cricketCamera } from '../cricket/ground.js'
import { ballIn, bowlerAt } from '../cricket/play3d.js'
import { paintCricket } from '../cricket/paint.js'

// A camera at the origin looking down the z axis: depth is z.
const depth = (p) => p.z

describe('cutting off what is behind the camera', () => {
  it('keeps a line in front, drops one behind and cuts one that crosses', () => {
    const front = [{ x: 0, y: 0, z: 2 }, { x: 5, y: 0, z: 9 }]
    expect(clipLine(front[0], front[1], depth)).toEqual(front)
    expect(clipLine({ x: 0, y: 0, z: -2 }, { x: 5, y: 0, z: 0.1 }, depth)).toBeNull()
    const cut = clipLine({ x: 0, y: 0, z: -1 }, { x: 10, y: 0, z: 9 }, depth)
    expect(cut[1]).toEqual({ x: 10, y: 0, z: 9 })
    expect(cut[0].z).toBeCloseTo(NEAR, 9)
    expect(cut[0].x).toBeCloseTo(1 + NEAR, 9)
    // The other way round, the far end is the one cut.
    const back = clipLine({ x: 10, y: 0, z: 9 }, { x: 0, y: 0, z: -1 }, depth)
    expect(back[0]).toEqual({ x: 10, y: 0, z: 9 })
    expect(back[1].z).toBeCloseTo(NEAR, 9)
  })

  it('keeps a shape in front, drops one behind and cuts one that crosses, leaving it a shape', () => {
    const square = (z0, z1) => [{ x: -1, y: 0, z: z0 }, { x: 1, y: 0, z: z0 }, { x: 1, y: 0, z: z1 }, { x: -1, y: 0, z: z1 }]
    expect(clipShape(square(2, 5), depth)).toEqual(square(2, 5))
    expect(clipShape(square(-5, -2), depth)).toEqual([])
    const cut = clipShape(square(-3, 5), depth)
    expect(cut.length).toBe(4)
    for (const p of cut) expect(p.z).toBeGreaterThanOrEqual(NEAR - 1e-9)
    expect(Math.min(...cut.map(p => p.z))).toBeCloseTo(NEAR, 9)
  })
})

// A canvas that draws nothing and notes how wide each line was and
// where each shape's corners were put.
function fakeCanvas() {
  const seen = { widths: [], points: [] }
  const g = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }) }, {
    get(t, k) {
      if (k in t) return t[k]
      if (k === 'moveTo' || k === 'lineTo') return (x, y) => seen.points.push([x, y])
      if (k === 'stroke') return () => seen.widths.push(t.lineWidth)
      return () => {}
    },
    set(t, k, v) { t[k] = v; return true },
  })
  return { canvas: { getContext: () => g, width: 0, height: 0 }, seen }
}

const colours = { primary: '#22344f', deep: '#141f33', accent: '#f0c05a', ink: '#0c1626' }

describe('the flat stadium, drawn from wherever a game stands', () => {
  const cases = [
    ...[[18, 0], [34, 19], [34, -19], [26, 11]].map(([d, x0]) => {
      const setup = { kick: 0, d, x0, wind: 4 }
      return { name: `rugby from ${d} metres, ${x0} across`, paint: paintRugby, state: { view: rugbyCamera(setup), ball: { ...teeAt(setup), spin: 0.35 }, tee: teeAt(setup), wind: 4, aim: { x: 1, y: 5 } } }
    }),
    ...[[1.3, 0], [3.7, 0.95], [3.7, -0.95], [2.5, 0.6]].map(([d, turn]) => {
      const spot = { d, turn }
      return { name: `netball from ${d} metres, turned ${turn}`, paint: paintNetball, state: { view: netballCamera(spot), ball: { x: HOOP.x, y: 1.15, z: HOOP.z + d }, hoop: { ...HOOP, swish: 0.5 }, arms: { at: { x: HOOP.x + Math.sin(turn) * d, y: 1.15, z: HOOP.z + Math.cos(turn) * d }, lift: turn > 0 ? 1 : 0 } } }
    }),
    // Cricket: the bowler running in with the ball, the ball at the bat
    // as the bat comes down to it, and a broken wicket with the ball gone by.
    ...[[-1, 0, null], [1.2, 0.3, null], [1.4, 1, 0.2]].map(([t, swing, wicket]) => {
      const d = { ball: 0, time: 1.2, straight: true, slower: false, line: 0.36, length: 0.64, height: 0.5, runup: 1.7 }
      const ball = t < 0 ? { ...ballIn(d, 0), held: true } : ballIn(d, t)
      return { name: `cricket ${t} seconds after the ball is let go`, paint: paintCricket, state: { view: cricketCamera(), goalLine: false, ball, bowler: bowlerAt(d, t), batter: { swing, line: d.line, meet: 0.3, look: 2 }, wicket } }
    }),
  ]

  for (const c of cases) {
    it(`${c.name}: no line is wider than a fifth of the screen, and every corner is a real place`, () => {
      for (const [w, h] of [[390, 844], [740, 360]]) {
        const { canvas, seen } = fakeCanvas()
        const view = createFlatView({ canvas, paint: c.paint, colours, boards: ['Winter Fayre'], sign: { name: 'Winter Fayre', over: 'Wymondham College PSA' } })
        view.resize(w, h, 1)
        view.draw({ ...c.state, now: 3 })
        expect(seen.widths.length).toBeGreaterThan(0)
        for (const wide of seen.widths) expect(wide).toBeLessThanOrEqual(h * 0.2 + 1e-9)
        for (const [x, y] of seen.points) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
          // Cut off in front of the camera, nothing is flung out of all
          // reckoning: a corner well to one side lands a long way off the
          // screen, but a real distance off it.
          expect(Math.abs(x)).toBeLessThan(2e6)
          expect(Math.abs(y)).toBeLessThan(2e6)
        }
      }
    })
  }
})
