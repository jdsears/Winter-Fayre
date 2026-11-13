// The ball, the goal and the keeper's body, in metres and seconds, kept
// pure so every outcome can be tested: a shot is launched from the spot,
// flown with gravity and its bend, and checked against the keeper, the
// posts and crossbar, the goal line and the net. The same path drives
// the 3D scene and the 2D version, so what is drawn is what was decided.
//
// Axes: x runs across the goal (positive is the taker's right), y is up
// and z runs from the spot (z = 0) towards the goal line (z = -11).

export const GOAL = {
  halfWidth: 3.66, // from the centre to the inside of a post
  height: 2.44, // to the underside of the crossbar
  post: 0.06, // radius of the posts and the bar
  lineZ: -11,
  depthTop: 1.0, // how far back the net is at the bar
  depthBottom: 2.0, // and at the ground
}
export const BALL_R = 0.11
export const SPOT = Object.freeze({ x: 0, y: BALL_R, z: 0 })
export const KEEPER_Z = -10.82
export const BOARDS_Z = -16
export const GRAVITY = 9.81
export const DT = 1 / 480
export const SAMPLE_EVERY = 4 // a path point every 1/120 s

// How a shot's numbers become a flight.
export const SHOT = {
  minSpeed: 13, // m/s at no power
  maxSpeed: 26, // m/s at full power
  liftFrom: 0.92, // power above this lifts the ball: only near full power
  maxLift: 0.8, // metres of lift at full power
  bendAccel: 8.5, // m/s² of sideways pull at full bend
  bendCarry: 0.4, // metres a full bend carries the ball past its aim
  // Error, in metres: a base, more with power², more with bend, and more
  // the finer it is aimed at a post or under the bar, so a corner is a
  // risk.
  spread: [0.2, 0.6, 0.12, 0.35, 0.5],
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k

// Where a shot is aimed on the goal: aimX -1 to 1 is post to post,
// aimY 0 to 1 is the grass to the bar. Past 1 either way is off target.
export function aimPoint(shot) {
  return {
    x: shot.aimX * GOAL.halfWidth,
    y: BALL_R + clamp(shot.aimY, 0, 2) * (GOAL.height - BALL_R),
  }
}

export function speedFor(power) {
  return lerp(SHOT.minSpeed, SHOT.maxSpeed, clamp(power, 0, 1))
}

export function liftFor(power) {
  return (Math.max(0, clamp(power, 0, 1) - SHOT.liftFrom) / (1 - SHOT.liftFrom)) * SHOT.maxLift
}

export function spreadFor(power, curve = 0, aimX = 0, aimY = 0) {
  const [base, withPower, withBend, nearPost, nearBar = 0] = SHOT.spread
  const p = clamp(power, 0, 1)
  return base + withPower * p * p + withBend * Math.abs(clamp(curve, -1, 1)) + nearPost * Math.max(0, Math.abs(aimX) - 0.6) + nearBar * Math.max(0, clamp(aimY, 0, 1.2) - 0.6)
}

// The flight a shot starts on: from the spot, with the aim moved by lift,
// bend and a little error (none when no random source is given).
export function launch(shot, rng = null) {
  const power = clamp(shot.power ?? 0.5, 0, 1)
  const bend = clamp(shot.curve ?? 0, -1, 1)
  const aim = aimPoint(shot)
  const spread = rng ? spreadFor(power, bend, shot.aimX, shot.aimY) : 0
  const ex = rng ? rng.normal(spread) : 0
  const ey = rng ? rng.normal(spread * 0.7) : 0
  const tx = aim.x + ex + bend * SHOT.bendCarry
  const ty = Math.max(BALL_R, aim.y + liftFor(power) + ey)
  const dz = GOAL.lineZ - SPOT.z
  const speed = speedFor(power)
  const T = Math.hypot(tx - SPOT.x, ty - SPOT.y, dz) / speed
  const ax = bend * SHOT.bendAccel
  return {
    p: { ...SPOT },
    v: {
      x: (tx - SPOT.x - 0.5 * ax * T * T) / T,
      y: (ty - SPOT.y + 0.5 * GRAVITY * T * T) / T,
      z: dz / T,
    },
    a: { x: ax, y: -GRAVITY, z: 0 },
    flightTime: T,
    aimed: { x: tx, y: ty },
    power,
    curve: bend,
  }
}

// Where the ball would cross the keeper's line if nothing touched it,
// with a share of its bend allowed for (1 is all of it).
export function predictCrossing(flight, bendRead = 1) {
  const t = (KEEPER_Z - flight.p.z) / flight.v.z
  return {
    t,
    x: flight.p.x + flight.v.x * t + 0.5 * flight.a.x * t * t * bendRead,
    y: flight.p.y + flight.v.y * t - 0.5 * GRAVITY * t * t,
  }
}

// ── The keeper's body ───────────────────────────────────────────────────
// The keeper is a few capsules (a segment with a radius) in the plane
// just off the line. A plan says what the keeper does and when:
//   { kind: 'ready' | 'set' | 'dive' | 'jump', start, duration, target }
// start is in seconds from the strike (negative is before it), target is
// where the hands go.

export const BODY = {
  length: 2.05, // feet to fingertips, stretched out
  radius: 0.24,
  reachX: 2.75, // the reach, about waist height (reachY), with no time to spare
  reachY: 0.95,
  reachUp: 1.55, // to the top corners
  reachDown: 1.7, // and down to the grass, deeper: a keeper gets down
  // With time (the ball still on its way once the keeper has set off),
  // the reach grows, across most, then down to the grass, then up.
  growFrom: 0.3, // seconds of time before it grows
  growOver: 0.35, // and the time over which it grows to the full
  growX: 0.8,
  growUp: 0.45,
  growDown: 0.6,
  baseTime: 0.22, // how long a dive takes: base, plus per metre
  perMetre: 0.13,
}
const READY_HANDS = { x: 0, y: 1.3 }

// The reach for the time the keeper has: half ellipses about waist
// height, wide across, deeper down to the grass than up to the bar.
export function reachShape(reach = 1, time = 0) {
  const f = clamp((time - BODY.growFrom) / BODY.growOver, 0, 1)
  return {
    x: (BODY.reachX + BODY.growX * f) * reach,
    up: (BODY.reachUp + BODY.growUp * f) * reach,
    down: (BODY.reachDown + BODY.growDown * f) * reach,
  }
}

function reachK(point, shape) {
  const dy = point.y - BODY.reachY
  return (point.x / shape.x) ** 2 + (dy / (dy >= 0 ? shape.up : shape.down)) ** 2
}

// Where the hands can get to, nearest the point asked for.
export function clampToReach(point, reach = 1, time = 0) {
  const shape = reachShape(reach, time)
  const k = reachK(point, shape)
  if (k <= 1) return { x: point.x, y: Math.max(0.15, point.y) }
  const s = 1 / Math.sqrt(k)
  return { x: point.x * s, y: Math.max(0.15, BODY.reachY + (point.y - BODY.reachY) * s) }
}

export function inReach(point, reach = 1, time = 0) {
  return reachK(point, reachShape(reach, time)) <= 1
}

export function diveDuration(target, speed = 1) {
  const d = Math.hypot(target.x - READY_HANDS.x, target.y - READY_HANDS.y)
  return (BODY.baseTime + BODY.perMetre * d) / speed
}

const easeOut = (u) => 1 - (1 - u) * (1 - u)

export function keeperPose(plan, t) {
  const kind = plan?.kind || 'ready'
  const started = plan && t >= plan.start
  const u = started ? clamp((t - plan.start) / Math.max(plan.duration, 0.01), 0, 1) : 0
  const e = easeOut(u)
  if (!started || kind === 'ready') {
    return {
      kind: 'ready', u: 0, lean: 0,
      feet: { x: 0, y: 0.08 }, hands: { ...READY_HANDS }, chest: { x: 0, y: 1.1 },
      capsules: [
        { a: { x: 0, y: 0.12 }, b: { x: 0, y: 1.62 }, r: 0.27, core: true },
        { a: { x: -0.72, y: 1.2 }, b: { x: 0.72, y: 1.2 }, r: 0.09 },
      ],
    }
  }
  if (kind === 'set') {
    return {
      kind, u, lean: 0,
      feet: { x: 0, y: 0.08 }, hands: { x: 0, y: lerp(1.3, 0.95, e) }, chest: { x: 0, y: lerp(1.1, 0.98, e) },
      capsules: [
        { a: { x: 0, y: 0.12 }, b: { x: 0, y: 1.55 }, r: 0.28, core: true },
        { a: { x: -0.82, y: lerp(1.2, 0.9, e) }, b: { x: 0.82, y: lerp(1.2, 0.9, e) }, r: 0.1 },
        { a: { x: -0.42, y: 0.12 }, b: { x: 0.42, y: 0.12 }, r: 0.12 },
      ],
    }
  }
  const target = plan.target
  if (kind === 'jump') {
    const hands = { x: lerp(0, target.x, e), y: lerp(1.65, target.y, e) }
    const feet = { x: lerp(0, target.x * 0.5, e), y: lerp(0.08, 0.5, e) }
    return {
      kind, u, lean: Math.atan2(hands.x - feet.x, hands.y - feet.y),
      feet, hands, chest: { x: lerp(feet.x, hands.x, 0.62), y: lerp(feet.y, hands.y, 0.62) },
      capsules: [
        { a: feet, b: hands, r: 0.26, core: true },
        { a: { x: hands.x - 0.42, y: hands.y - 0.14 }, b: { x: hands.x + 0.42, y: hands.y - 0.14 }, r: 0.09 },
      ],
    }
  }
  // A dive: pushed off the near foot, stretched towards the target.
  const s = Math.sign(target.x) || 1
  const pivot = { x: 0.25 * s, y: 0.1 }
  const len = Math.hypot(target.x - pivot.x, target.y - pivot.y) || 1
  const feetEnd = {
    x: target.x - (BODY.length * (target.x - pivot.x)) / len,
    y: Math.max(0.12, target.y - (BODY.length * (target.y - pivot.y)) / len),
  }
  const start = { x: 0.3 * s, y: 1.3 }
  const hands = { x: lerp(start.x, target.x, e), y: lerp(start.y, target.y, e) }
  const feet = { x: lerp(0, feetEnd.x, e), y: lerp(0.08, feetEnd.y, e) }
  return {
    kind, u, lean: Math.atan2(hands.x - feet.x, hands.y - feet.y),
    feet, hands, chest: { x: lerp(feet.x, hands.x, 0.62), y: lerp(feet.y, hands.y, 0.62) },
    capsules: [{ a: feet, b: hands, r: lerp(0.27, BODY.radius, e), core: true }],
  }
}

// ── Flying a shot ───────────────────────────────────────────────────────

function closestOnSegment(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  const k = len2 > 0 ? clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1) : 0
  return { x: a.x + abx * k, y: a.y + aby * k, k }
}

function netBackZ(y) {
  const up = clamp(y / GOAL.height, 0, 1)
  return GOAL.lineZ - GOAL.post - lerp(GOAL.depthBottom, GOAL.depthTop, up)
}

// What happens to a shot: its outcome and the whole path, sampled every
// 1/120 s, with each contact as an event.
//   outcome   'goal' | 'saved' | 'post' | 'bar' | 'over' | 'wide'
//   decidedAt when it was settled (when the banner shows)
//   woodwork  'post' or 'bar' if it hit the frame, even on the way in
//   caught    the keeper held it
export function simulate(flight, plan = null, { maxTime = 3.2, tail = 1.5 } = {}) {
  const p = { ...flight.p }
  const v = { ...flight.v }
  const a = { ...flight.a }
  const path = []
  const events = []
  let outcome = null
  let decidedAt = null
  let woodwork = null
  let woodworkAt = null
  let keeperTouch = false
  let caught = false
  let caughtFrom = null
  let crossed = false
  let netHit = false
  let t = 0
  let step = 0
  const event = (type, extra = {}) => events.push({ type, t, x: p.x, y: p.y, z: p.z, ...extra })
  const decide = (what) => {
    if (outcome) return
    outcome = what
    decidedAt = t
  }
  const record = () => path.push(t, p.x, p.y, p.z)
  record()

  while (t < maxTime) {
    t += DT
    step += 1
    if (caught) {
      // Gathered into the keeper's chest, eased there from where it was met.
      const pose = keeperPose(plan, t)
      const k = clamp((t - caughtFrom.t) / 0.12, 0, 1)
      p.x = lerp(caughtFrom.x, pose.chest.x, k)
      p.y = lerp(caughtFrom.y, Math.max(BALL_R, pose.chest.y), k)
      p.z = lerp(caughtFrom.z, KEEPER_Z + 0.24, k)
    } else {
      v.x += a.x * DT
      v.y += a.y * DT
      v.z += a.z * DT
      p.x += v.x * DT
      p.y += v.y * DT
      p.z += v.z * DT

      // The grass.
      if (p.y < BALL_R) {
        p.y = BALL_R
        if (v.y < 0) {
          if (v.y < -1.2) event('ground')
          v.y = -v.y * 0.45
          if (v.y < 0.4) v.y = 0
          v.x *= 0.86
          v.z *= 0.86
        }
      }
      if (p.y <= BALL_R + 1e-4 && v.y === 0) {
        const roll = 1 - 1.4 * DT
        v.x *= roll
        v.z *= roll
      }

      // The keeper, until the ball is past the line.
      if (plan && !keeperTouch && !crossed && p.z > GOAL.lineZ - 0.4) {
        const pose = keeperPose(plan, t)
        for (const c of pose.capsules) {
          const q = closestOnSegment(p, c.a, c.b)
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dz = p.z - KEEPER_Z
          const d = Math.hypot(dx, dy, dz)
          if (d >= BALL_R + c.r) continue
          keeperTouch = true
          a.x = 0
          const speed = Math.hypot(v.x, v.y, v.z)
          const n = d > 1e-6 ? { x: dx / d, y: dy / d, z: dz / d } : { x: 0, y: 0, z: 1 }
          // Held when it comes in gently at the body or the hands.
          if (speed < 20.5 && c.core && (q.k > 0.55 || pose.kind === 'ready' || pose.kind === 'set')) {
            caught = true
            caughtFrom = { t, x: p.x, y: p.y, z: p.z }
            event('keeper', { caught: true })
          } else {
            const vn = v.x * n.x + v.y * n.y + v.z * n.z
            if (vn < 0) {
              v.x -= 1.35 * vn * n.x
              v.y -= 1.35 * vn * n.y
              v.z -= 1.35 * vn * n.z
            }
            // A parry goes back out, never in.
            v.x *= 0.6
            v.y = v.y * 0.6 + 1.2
            v.z = Math.max(v.z * 0.6, 2 + speed * 0.12)
            const push = BALL_R + c.r + 0.002
            p.x = q.x + n.x * push
            p.y = Math.max(BALL_R, q.y + n.y * push)
            // Never knocked back over the line: a parry comes out.
            p.z = Math.max(KEEPER_Z + n.z * push, GOAL.lineZ + BALL_R)
            event('keeper', { caught: false })
          }
          decide('saved')
          break
        }
      }

      // The posts and the crossbar.
      if (!crossed || p.z > GOAL.lineZ - 0.5) {
        for (const side of [-1, 1]) {
          const px = side * (GOAL.halfWidth + GOAL.post)
          const dx = p.x - px
          const dz = p.z - GOAL.lineZ
          const d = Math.hypot(dx, dz)
          if (p.y < GOAL.height + GOAL.post && d < BALL_R + GOAL.post && d > 1e-6) {
            hitFrame(p, v, { x: dx / d, y: 0, z: dz / d }, { x: px + (dx / d) * (BALL_R + GOAL.post + 0.002), y: p.y, z: GOAL.lineZ + (dz / d) * (BALL_R + GOAL.post + 0.002) })
            a.x = 0
            if (!woodwork) { woodwork = 'post'; woodworkAt = t }
            event('post', { side })
          }
        }
        if (Math.abs(p.x) < GOAL.halfWidth + GOAL.post) {
          const by = GOAL.height + GOAL.post
          const dy = p.y - by
          const dz = p.z - GOAL.lineZ
          const d = Math.hypot(dy, dz)
          if (d < BALL_R + GOAL.post && d > 1e-6) {
            hitFrame(p, v, { x: 0, y: dy / d, z: dz / d }, { x: p.x, y: by + (dy / d) * (BALL_R + GOAL.post + 0.002), z: GOAL.lineZ + (dz / d) * (BALL_R + GOAL.post + 0.002) })
            a.x = 0
            if (!woodwork) { woodwork = 'bar'; woodworkAt = t }
            event('bar')
          }
        }
      }

      // Over the line: wholly past the back of it.
      if (!crossed && p.z < GOAL.lineZ - GOAL.post - BALL_R) {
        crossed = true
        const inside = Math.abs(p.x) < GOAL.halfWidth && p.y < GOAL.height
        if (inside) {
          event('line')
          if (!keeperTouch) decide('goal')
          else { outcome = 'goal'; decidedAt = t }
        } else if (keeperTouch) {
          decide('saved')
        } else if (woodwork) {
          outcome = woodwork
          decidedAt = woodworkAt
        } else {
          const overBy = p.y - GOAL.height
          const wideBy = Math.abs(p.x) - GOAL.halfWidth
          decide(overBy > wideBy ? 'over' : 'wide')
        }
      }

      // The net catches it, and keeps it: once in, it stays behind the line.
      if (crossed && outcome === 'goal') {
        const backZ = netBackZ(p.y)
        let hit = false
        if (p.z - BALL_R < backZ) {
          p.z = backZ + BALL_R
          v.z = Math.abs(v.z) * 0.08
          v.x *= 0.35
          v.y *= 0.35
          hit = true
        }
        if (Math.abs(p.x) + BALL_R > GOAL.halfWidth) {
          p.x = Math.sign(p.x) * (GOAL.halfWidth - BALL_R)
          v.x = -v.x * 0.1
          v.z *= 0.5
          hit = true
        }
        if (p.y + BALL_R > GOAL.height) {
          p.y = GOAL.height - BALL_R
          v.y = -Math.abs(v.y) * 0.1
          v.z *= 0.5
          hit = true
        }
        if (hit && !netHit) {
          netHit = true
          event('net', { speed: Math.hypot(v.x, v.y, v.z) })
        }
        if (netHit) {
          // The net has it: no more than a sag, and it drops.
          const hold = Math.max(0, 1 - 7 * DT)
          v.x *= hold
          v.z *= hold
        }
        const inside = GOAL.lineZ - GOAL.post - BALL_R
        if (p.z > inside) {
          p.z = inside
          if (v.z > 0) v.z = 0
        }
      } else if (outcome && outsideNet(p, v)) {
        // A miss that comes down on the net, or runs into its side or
        // back, stays outside it, and never comes in through the mouth.
        if (!netHit) {
          netHit = true
          event('net-outside', { speed: Math.hypot(v.x, v.y, v.z) })
        }
      }

      // The boards behind the goal stop anything that missed: it drops
      // there rather than coming back.
      if (p.z - BALL_R < BOARDS_Z) {
        p.z = BOARDS_Z + BALL_R
        v.z = Math.abs(v.z) * 0.01
        v.x *= 0.2
        v.y *= 0.4
        event('board')
      }

      // Off the frame and back out, or held up: settled as woodwork.
      if (!outcome && woodwork && (v.z > 0 || t - woodworkAt > 0.6)) {
        outcome = woodwork
        decidedAt = woodworkAt
      }
    }
    if (step % SAMPLE_EVERY === 0) record()
    if (outcome && t >= decidedAt + tail) break
  }
  if (!outcome) {
    outcome = woodwork || 'wide'
    decidedAt = woodworkAt ?? t
  }
  return {
    outcome,
    scored: outcome === 'goal',
    decidedAt,
    woodwork,
    keeperTouch,
    caught,
    events,
    path: Float32Array.from(path),
    duration: t,
  }
}

// For a miss: keeps the ball outside the goal, pushing it back out of
// whichever face of the net it came through. Returns whether it touched.
function outsideNet(p, v) {
  const hw = GOAL.halfWidth + GOAL.post
  const top = GOAL.height + GOAL.post
  const back = netBackZ(Math.min(p.y, GOAL.height))
  if (p.z > GOAL.lineZ + BALL_R || p.z < back - BALL_R) return false
  if (Math.abs(p.x) > hw + BALL_R || p.y > top + BALL_R) return false
  const side = hw + BALL_R - Math.abs(p.x)
  const roof = top + BALL_R - p.y
  const rear = p.z - (back - BALL_R)
  const mouth = GOAL.lineZ + BALL_R - p.z
  const least = Math.min(side, roof, rear, mouth)
  if (least === roof) {
    p.y = top + BALL_R
    if (v.y < 0) v.y = -v.y * 0.2
    v.x *= 0.7
    v.z *= 0.7
  } else if (least === side) {
    const s = Math.sign(p.x) || 1
    p.x = s * (hw + BALL_R)
    v.x = s * Math.abs(v.x) * 0.15
    v.z *= 0.6
  } else if (least === rear) {
    p.z = back - BALL_R
    v.z = -Math.abs(v.z) * 0.15
    v.x *= 0.6
  } else {
    p.z = GOAL.lineZ + BALL_R
    v.z = Math.abs(v.z) * 0.3
  }
  return true
}

function hitFrame(p, v, n, out) {
  const vn = v.x * n.x + v.y * n.y + v.z * n.z
  if (vn < 0) {
    // Restitution off the frame, with the slide along it kept mostly.
    const e = 0.62
    v.x -= (1 + e) * vn * n.x
    v.y -= (1 + e) * vn * n.y
    v.z -= (1 + e) * vn * n.z
    v.x *= 0.94
    v.y *= 0.94
    v.z *= 0.94
  }
  p.x = out.x
  p.y = Math.max(BALL_R, out.y)
  p.z = out.z
}

// The ball's place at time t along a simulated path.
export function pathAt(path, t) {
  const n = path.length / 4
  if (n === 0) return { x: SPOT.x, y: SPOT.y, z: SPOT.z }
  if (t <= path[0]) return { x: path[1], y: path[2], z: path[3] }
  const last = (n - 1) * 4
  if (t >= path[last]) return { x: path[last + 1], y: path[last + 2], z: path[last + 3] }
  const dt = path[4] - path[0]
  const i = Math.min(n - 2, Math.floor((t - path[0]) / dt))
  const j = i * 4
  const k = clamp((t - path[j]) / (path[j + 4] - path[j]), 0, 1)
  return {
    x: lerp(path[j + 1], path[j + 5], k),
    y: lerp(path[j + 2], path[j + 6], k),
    z: lerp(path[j + 3], path[j + 7], k),
  }
}
