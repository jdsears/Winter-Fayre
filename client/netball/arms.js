// The shooter's own arms in netball, seen from where the shooter stands:
// two forearms coming up from the foot of the screen with a hand either
// side of the ball, and a follow-through as the ball is let go. John
// asked for them (13 November 2026), so that a shot reads as a shot.
//
// One place for where they are, for the 3D scene and the flat painter
// alike. Metres, in the stadium's own places.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const unit = (v) => { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n } }
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const add = (p, ...parts) => parts.reduce((q, [v, k]) => ({ x: q.x + v.x * k, y: q.y + v.y * k, z: q.z + v.z * k }), p)

// How far each hand is from the middle of the ball, and how long a
// forearm is drawn.
export const HAND_OUT = 0.14
export const FOREARM = 0.5
// How far the hands rise, and reach towards the ring, as the ball goes.
export const LIFT = { up: 0.46, on: 0.22 }

// The way the camera faces, and its right and its up.
export function facing(view) {
  const on = unit(sub(view.look, view.pos))
  const right = unit(cross(on, { x: 0, y: 1, z: 0 }))
  return { on, right, up: cross(right, on) }
}

// Where the two arms are: [{ side, hand, elbow }], the left arm first.
//   view   the camera: { pos, look }
//   at     where the ball rests in the hands
//   lift   0 with the ball held, 1 at the top of the follow-through
export function armsAt(view, at, lift = 0) {
  const k = Math.min(1, Math.max(0, lift))
  const { on, right, up } = facing(view)
  return [-1, 1].map((side) => {
    // A hand either side of the ball, a little under its middle; in the
    // follow-through they rise, close a little and reach for the ring.
    const hand = add(at, [right, side * (HAND_OUT - 0.04 * k)], [up, -0.03 + LIFT.up * k], [on, LIFT.on * k])
    // The elbow is below the hand, wider, and nearer the shooter.
    const elbow = add(hand, [up, -FOREARM * 0.92], [right, side * 0.1], [on, -FOREARM * (0.36 + 0.2 * k)])
    return { side, hand, elbow }
  })
}

// How far through the follow-through the arms are, t seconds after the
// ball was let go (below nought: still held): up quickly, held, and
// down again as the next ball comes to hand at `back` seconds.
export function liftAt(t, back = Infinity) {
  if (!(t >= 0)) return 0
  const up = Math.min(1, t / 0.16)
  const down = t > back ? Math.max(0, 1 - (t - back) / 0.18) : 1
  const k = Math.min(up, down)
  return k * k * (3 - 2 * k)
}
