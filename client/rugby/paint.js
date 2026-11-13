// Rugby conversion drawn flat (games/flat.js), where the 3D will not
// run: the 22, the posts with their pads and flags, the tee and the
// ball, each put on the screen by the camera the 3D scene uses.

import { POSTS } from './rules.js'
import { GOAL } from '../shootout/physics.js'

const LINE = GOAL.lineZ

export function paintRugby(g, s) {
  // The 22 (the brush leaves out whatever of it is behind the camera).
  s.line({ x: -34, y: 0, z: LINE + 22 }, { x: 34, y: 0, z: LINE + 22 }, 0.12, '#f4f7f2')

  // The posts: two uprights, the bar, a pad at the foot of each.
  for (const side of [-1, 1]) {
    const x = side * POSTS.halfWidth
    s.line({ x, y: 0, z: LINE }, { x, y: POSTS.height, z: LINE }, 0.2, '#ffffff')
    s.line({ x, y: 0.1, z: LINE }, { x, y: 1.8, z: LINE }, 0.5, s.colours.accent)
    // The flag flies the way the wind blows, and hangs in a calm.
    if (!s.seen({ x, y: POSTS.height, z: LINE })) continue
    const top = s.at({ x, y: POSTS.height, z: LINE })
    const reach = top.scale * (s.wind ? 0.9 : 0.25) * (s.wind < 0 ? -1 : 1)
    const drop = top.scale * (s.wind ? 0.42 : 0.9)
    g.fillStyle = '#c8102e'
    g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(top.x + reach, top.y + drop / 2); g.lineTo(top.x, top.y + drop); g.closePath(); g.fill()
  }
  s.line({ x: -POSTS.halfWidth, y: POSTS.bar, z: LINE }, { x: POSTS.halfWidth, y: POSTS.bar, z: LINE }, 0.16, '#ffffff')

  // The keys' aim, when the keyboard is being used.
  if (s.aim && s.seen({ x: s.aim.x, y: s.aim.y, z: LINE })) {
    const a = s.at({ x: s.aim.x, y: s.aim.y, z: LINE })
    g.strokeStyle = s.colours.accent
    g.lineWidth = 3
    g.beginPath(); g.arc(a.x, a.y, Math.max(8, a.scale * 0.3), 0, Math.PI * 2); g.stroke()
  }

  // The tee, and the ball: long, white, turning end over end as it flies.
  if (s.tee) s.disc({ x: s.tee.x, y: 0.03, z: s.tee.z }, 0.12, s.colours.accent, 0.4)
  if (!s.seen(s.ball)) return
  s.shade(s.ball, 0.2)
  const b = s.at(s.ball)
  g.save()
  g.translate(b.x, b.y)
  g.rotate(s.ball.spin || 0)
  g.fillStyle = '#f6f3ea'
  g.strokeStyle = s.colours.ink
  g.lineWidth = Math.max(1, b.scale * 0.015)
  g.beginPath(); g.ellipse(0, 0, Math.max(3, b.scale * 0.105), Math.max(4.5, b.scale * 0.16), 0, 0, Math.PI * 2); g.fill(); g.stroke()
  g.fillStyle = '#c8102e'
  for (const end of [-1, 1]) { g.beginPath(); g.ellipse(0, end * Math.max(3.4, b.scale * 0.12), Math.max(1.6, b.scale * 0.055), Math.max(1.4, b.scale * 0.05), 0, 0, Math.PI * 2); g.fill() }
  g.restore()
}
