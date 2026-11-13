// Cricket smash drawn flat (games/flat.js), where the 3D will not run:
// the pitch and its creases, a wicket at each end, the bowler, the
// batter with a bat and the ball, each put on the screen by the camera
// the 3D scene uses.

import { GROUND, BALL_R, BAT, strokeAt, batPoint } from './ground.js'
import { SKINS } from '../shootout/looks.js'

const TURF = '#cfbf8c'
const WOOD = '#f0e2b6'
const DARK = '#141f33'

// A simple figure standing at a place: legs, a body in its shirt and a
// head. `stride` swings the legs along the pitch, `apart` sets them
// apart along it, and `lean` tips the body the way given ({ x, z }).
function figure(s, at, shirt, skin, { stride = 0, apart = 0, lean = { x: 0, z: 0 } } = {}) {
  const step = Math.sin(stride) * 0.22
  const hip = { x: at.x + lean.x * 0.3, y: 0.9, z: at.z + lean.z * 0.3 }
  const neck = { x: at.x + lean.x, y: 1.46, z: at.z + lean.z }
  s.line({ x: at.x - (apart ? 0 : 0.1), y: 0, z: at.z - step - apart }, { x: hip.x - (apart ? 0 : 0.08), y: hip.y, z: hip.z - apart * 0.3 }, 0.14, DARK)
  s.line({ x: at.x + (apart ? 0 : 0.1), y: 0, z: at.z + step + apart }, { x: hip.x + (apart ? 0 : 0.08), y: hip.y, z: hip.z + apart * 0.3 }, 0.14, DARK)
  s.line({ x: hip.x, y: 0.92, z: hip.z }, neck, 0.4, shirt)
  s.disc({ x: neck.x + lean.x * 0.2, y: 1.68, z: neck.z + lean.z * 0.2 }, 0.14, skin)
  return neck
}

function wicketAt(s, z, broken = null) {
  const t = broken === null || broken === undefined ? -1 : Math.max(0, broken)
  const k = t < 0 ? 0 : Math.min(1, t * 8)
  for (const n of [-1, 0, 1]) {
    const x = n * GROUND.stumpGap
    // A broken wicket: the stumps knocked back and apart.
    s.line({ x, y: 0, z }, { x: x + n * k * 0.22, y: GROUND.stumpHeight * (1 - k * 0.25), z: z + k * (n ? 0.2 : 0.5) }, 0.045, WOOD)
  }
  if (t < 0) {
    s.line({ x: -GROUND.stumpGap, y: GROUND.stumpHeight + 0.015, z }, { x: GROUND.stumpGap, y: GROUND.stumpHeight + 0.015, z }, 0.03, WOOD)
  } else {
    // The bails fly off and lie where they land.
    const fly = Math.min(0.73, t)
    for (const side of [-1, 1]) s.disc({ x: side * (0.06 + fly * 0.7), y: Math.max(0.03, GROUND.stumpHeight + 2.6 * fly - 4.9 * fly * fly), z: z + fly * 0.9 }, 0.035, WOOD)
  }
}

export function paintCricket(g, s) {
  // The pitch, and the creases at each end.
  const ends = [GROUND.far - 1.3, GROUND.stumps + 1.3]
  s.quad([{ x: -GROUND.half, y: 0, z: ends[0] }, { x: GROUND.half, y: 0, z: ends[0] }, { x: GROUND.half, y: 0, z: ends[1] }, { x: -GROUND.half, y: 0, z: ends[1] }], TURF)
  for (const [stumps, crease] of [[GROUND.far, GROUND.far + 1.22], [GROUND.stumps, GROUND.crease]]) {
    s.line({ x: -1.32, y: 0, z: stumps }, { x: 1.32, y: 0, z: stumps }, 0.06, '#ffffff')
    s.line({ x: -1.83, y: 0, z: crease }, { x: 1.83, y: 0, z: crease }, 0.06, '#ffffff')
    for (const side of [-1, 1]) s.line({ x: side * 1.32, y: 0, z: stumps }, { x: side * 1.32, y: 0, z: crease }, 0.06, '#ffffff')
  }

  // The ball: red, with its seam, and its shadow on the pitch.
  const ball = (at) => {
    if (s.ball.hidden || !s.seen(at)) return
    s.shade(at, BALL_R * 1.4)
    const on = s.disc(at, BALL_R, '#c8102e')
    if (on) {
      g.strokeStyle = '#ffffff'
      g.lineWidth = Math.max(1, on.scale * 0.012)
      g.beginPath(); g.moveTo(on.x, on.y - on.scale * BALL_R); g.lineTo(on.x, on.y + on.scale * BALL_R); g.stroke()
    }
  }

  // The far wicket, and the bowler coming in beside it: leaning into
  // his run, the bowling arm coming over the top.
  wicketAt(s, GROUND.far)
  const b = s.bowler
  let hand = null
  if (b) {
    const turn = (b.bowl || 0) * Math.PI * 1.75
    const lean = 0.12 * (b.run || 0) + 0.2 * Math.sin(Math.min(1, b.bowl || 0) * Math.PI)
    const neck = figure(s, b, '#8fd6e8', SKINS[0], { stride: b.stride, lean: { x: 0, z: lean } })
    const shoulder = { x: b.x - 0.26, y: neck.y - 0.04, z: neck.z }
    hand = { x: shoulder.x, y: shoulder.y - Math.cos(turn) * 0.62, z: shoulder.z - Math.sin(turn) * 0.62 }
    s.line(shoulder, hand, 0.11, '#8fd6e8')
  }
  // A ball he has not let go of is in his hand. One still on its way is
  // beyond the batter; one that has gone by is nearer.
  const held = Boolean(s.ball.held && hand)
  const beyond = held || s.ball.z < GROUND.crease
  if (beyond) ball(held ? hand : s.ball)

  // The batter, side on, and the bat coming through in both hands.
  const stroke = strokeAt(s.batter || {})
  const look = SKINS[(1 + (s.batter?.look || 0)) % SKINS.length]
  const neck = figure(s, stroke.stand, s.colours.kit || '#c8102e', look, { apart: 0.22 + 0.1 * stroke.down, lean: { x: 0.16, z: 0 } })
  const top = batPoint(stroke, -BAT.top)
  const join = batPoint(stroke, BAT.handle - BAT.top)
  const toe = batPoint(stroke, BAT.handle - BAT.top + BAT.blade)
  for (const side of [-1, 1]) s.line({ x: neck.x, y: neck.y - 0.06, z: neck.z + side * 0.2 }, stroke.grip, 0.1, look)
  s.line(top, join, 0.045, '#c8102e')
  s.line(join, toe, BAT.width, '#c4893f')

  // The near wicket, standing or broken.
  wicketAt(s, GROUND.stumps, s.wicket)
  if (!beyond) ball(s.ball)
}
