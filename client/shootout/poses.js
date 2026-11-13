// Where the taker is and how they move, shared by the 3D scene and the
// 2D version so both show the same run up and the same tells. Pure.
//
// A taker is { phase, u, paused, tellDir, high }: phase is 'ready',
// 'runup', 'strike' or 'follow', u its progress from 0 to 1, paused a stop
// in the run up, tellDir the side the body gives away (-1, 0 or 1 across
// the goal) and high a lean back.

// The visitor's taker waits just out of a phone's view, so the goal is
// clear to aim at, and steps in for the kick; the computer's runs in
// from behind the ball, in view, so the tells can be read.
export const READY_SHOOT = { x: -1.6, z: 0.35 }
export const RUNUP_START = { x: -1.0, z: 4.3 }
export const PLANT = { x: -0.42, z: 0.26 }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
export const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}

export function takerPose(taker, mode, now = 0) {
  const phase = taker?.phase || 'ready'
  const u = clamp(taker?.u ?? 0, 0, 1)
  const start = mode === 'save' ? RUNUP_START : READY_SHOOT
  const tellDir = mode === 'save' ? (taker?.tellDir || 0) : 0
  const high = mode === 'save' && taker?.high
  const pose = { x: start.x, z: start.z, yaw: 0, stride: 0, run: 0, kick: 0, lean: 0, twist: 0, head: 0, bob: 0 }
  if (phase === 'ready') {
    pose.bob = Math.sin(now * 2.2) * 0.012
    pose.yaw = mode === 'save' ? -0.35 : -0.7
    return pose
  }
  if (phase === 'runup') {
    // A slight curve into the ball, the way a right-footed taker comes in.
    pose.x = lerp(start.x, PLANT.x, u) - Math.sin(u * Math.PI) * 0.18
    pose.z = lerp(start.z, PLANT.z, u)
    pose.yaw = lerp(mode === 'save' ? -0.35 : -0.7, -0.12, u)
    const strides = mode === 'save' ? 5 : 1.5
    pose.stride = u * strides * Math.PI * 2
    pose.run = mode === 'save' ? 1 : 0.7
    pose.bob = Math.abs(Math.sin(pose.stride)) * 0.05
    if (taker.paused) {
      // A stutter: stopped dead in the run up, weight back.
      pose.run = 0.15
      pose.bob = 0
    }
    // The tells: the hips open towards the side, the head glances early,
    // and a lean back for one going high.
    pose.twist = tellDir * 0.5 * smooth(0.45, 0.92, u)
    pose.head = tellDir * 0.6 * smooth(0.12, 0.35, u) * (1 - smooth(0.6, 0.85, u))
    pose.lean = high ? 0.24 * smooth(0.55, 1, u) : 0.05 * u
    return pose
  }
  pose.x = PLANT.x
  pose.z = PLANT.z
  pose.yaw = -0.12
  pose.twist = tellDir * 0.5
  pose.lean = high ? 0.24 : 0.05
  if (phase === 'strike') {
    pose.kick = u
    return pose
  }
  // Follow through: the kicking leg comes down and the taker steps on.
  pose.kick = 1 - smooth(0, 1, u) * 0.8
  pose.z = PLANT.z - 0.35 * smooth(0, 1, u)
  pose.lean = pose.lean * (1 - u)
  return pose
}
