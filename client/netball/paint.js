// Netball shot drawn flat (games/flat.js), where the 3D will not run:
// the goal circle, the post with its pad, the ring and its net, and the
// ball, each put on the screen by the camera the 3D scene uses.

import { RING, BALL_R } from './rules.js'
import { armsAt } from './arms.js'
import { GOAL } from '../shootout/physics.js'

const LINE = GOAL.lineZ

export function paintNetball(g, s) {
  const hoop = s.hoop || { x: 0, y: RING.height, z: LINE + 0.24 }

  // The goal circle: 4.9 metres round the post, a short line at a time
  // (the brush leaves out whatever of it is behind the camera).
  const round = (i) => ({ x: Math.cos((i / 40) * Math.PI) * 4.9, y: 0, z: LINE + Math.sin((i / 40) * Math.PI) * 4.9 })
  for (let i = 0; i < 40; i++) s.line(round(i), round(i + 1), 0.1, '#f4f7f2')

  // The post and its pad.
  s.line({ x: 0, y: 0, z: LINE }, { x: 0, y: RING.height, z: LINE }, 0.09, '#ffffff')
  s.line({ x: 0, y: 0.1, z: LINE }, { x: 0, y: 1.9, z: LINE }, 0.24, s.colours.accent)

  // The shooter's arms come up from the foot of the screen to the ball,
  // drawn last of all, over everything.
  const arms = () => {
    if (!s.arms) return
    for (const a of armsAt(s.view, s.arms.at, s.arms.lift)) {
      s.line(a.elbow, a.hand, 0.1, s.colours.kit || '#c8102e')
      s.disc(a.hand, 0.065, '#d9a07a')
    }
  }

  // The ring, seen from below as a flat oval, with its net under it. As
  // a goal goes through, the net is pulled down and the ring glows gold.
  if (!s.seen(hoop)) { arms(); return }
  const through = Math.sin(Math.min(1, Math.max(0, hoop.swish || 0)) * Math.PI)
  const centre = s.at(hoop)
  const rx = Math.max(6, RING.radius * centre.scale)
  const ry = Math.max(2, rx * 0.3)
  const drop = rx * 1.9 * (1 + 0.6 * through)
  // A ball that has dropped below the ring is behind its near edge.
  const below = s.ball.y < hoop.y - 0.05
  const ball = () => {
    if (!s.seen(s.ball)) return
    s.shade(s.ball, 0.16)
    const b = s.at(s.ball)
    const r = Math.max(4, BALL_R * b.scale)
    g.fillStyle = '#fbfbf6'
    g.strokeStyle = s.colours.ink
    g.lineWidth = Math.max(1, r * 0.08)
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill(); g.stroke()
    g.strokeStyle = '#4bb8d6'
    g.lineWidth = Math.max(1.5, r * 0.14)
    g.beginPath(); g.ellipse(b.x, b.y, r * 0.96, r * 0.36, 0.5, 0, Math.PI * 2); g.stroke()
  }
  if (!below) ball()
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = Math.max(1, rx * 0.04)
  for (let i = -3; i <= 3; i++) {
    g.beginPath(); g.moveTo(centre.x + (i / 3) * rx, centre.y); g.lineTo(centre.x + (i / 3) * rx * 0.62, centre.y + drop); g.stroke()
  }
  g.beginPath(); g.ellipse(centre.x, centre.y + drop, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = through > 0.05 ? s.colours.accent : '#e0263c'
  g.lineWidth = Math.max(3, rx * (0.18 + 0.08 * through))
  g.beginPath(); g.ellipse(centre.x, centre.y, rx, ry, 0, 0, Math.PI * 2); g.stroke()
  if (below) ball()
  arms()
}
