// Head to head: the rules, with no drawing and no browser in them.
//
// One player a side, seen from the side, on a small pitch with a goal
// at each end. Each player is a big head on a small body. They run, jump
// and kick; the ball comes off a head, a body or a boot. Most goals in
// sixty seconds wins. The visitor plays on the left and attacks the
// right-hand goal; the computer plays on the right.
//
// The pitch is 800 wide and 450 high, whatever size it is drawn at, with
// y counted down the screen. Speeds are in those units a second.

export const W = 800
export const H = 450
// The ground is well up from the bottom: the grass below it is where a
// phone's control buttons sit, clear of the goals.
export const GROUND = 312
export const MATCH_SECONDS = 60
// A goal is 58 deep from the end of the pitch, and its bar is 150 up.
export const GOAL_D = 58
export const BAR = GROUND - 150
export const POST_R = 5
export const BALL_R = 14
export const HEAD_R = 27
export const BODY_R = 20
// The head's middle and the body's middle, above the feet.
export const HEAD_UP = 62
export const BODY_UP = 24
export const BOOT_R = 13
export const KICK_TIME = 0.22
const G_PLAYER = 1900
const G_BALL = 1150
const RUN = 265
const JUMP = 640
const MAX_BALL = 1250
// A header: how hard the head drives the ball when the player has
// jumped for it, from a glancing touch to one met full on.
const HEADER_LEAST = 150
const HEADER_MOST = 600
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// big, armed and stun are how long each has left, in seconds: super
// sized, a flaming shot waiting on the next touch, and knocked back.
const freshPlayer = (side, carry = {}) => ({ side, x: side < 0 ? 230 : W - 230, y: GROUND, vx: 0, vy: 0, kick: -1, kicked: false, high: false, face: -side, nod: 0, big: carry.big || 0, armed: carry.armed || 0, curl: carry.curl || 0, frozen: carry.frozen || 0, swap: carry.swap || 0, stun: 0 })

// The powers. Each side is dealt three of them for a match, at random,
// and may use each once.
export const POWERS = ['invisible', 'big', 'flame', 'giant', 'curler', 'wall', 'small', 'freeze', 'swap']
export const POWER_NAMES = {
  invisible: 'Invisible ball', big: 'Super size', flame: 'Flaming ball', giant: 'Giant ball', curler: 'Curler',
  wall: 'Brick wall', small: 'Small goal', freeze: 'Freeze', swap: 'Banana skin',
}
export const DEAL = 3
export const GIANT_TIME = 5
export const GIANT_SIZE = 1.9
export const WALL_TIME = 4
export const SMALL_TIME = 5
export const FREEZE_TIME = 2
export const SWAP_TIME = 4
// Three different powers, picked at random.
export function dealPowers(rng = Math.random) {
  const left = [...POWERS]
  const out = []
  while (out.length < DEAL && left.length) out.push(left.splice(Math.min(left.length - 1, Math.floor(rng() * left.length)), 1)[0])
  return out
}
const hand = (names) => Object.fromEntries(names.map(n => [n, true]))
// How big the ball is: bigger while it is a giant.
export const ballR = (m) => BALL_R * (m.giant > 0 ? GIANT_SIZE : 1)
// How high a side's goal is: half as high while it is a small goal.
// side is 'left' for the goal the left-hand player defends.
export const barOf = (m, side) => (m.small?.[side] > 0 ? GROUND - (GROUND - BAR) / 2 : BAR)
export const INVISIBLE_TIME = 4
export const BIG_TIME = 6
export const BIG_SIZE = 1.55
export const ARMED_TIME = 6
export const FLAME_TIME = 1.3
const FLAME_SPEED = 1150
// How big a player is drawn and reaches: grown while super sized.
export const sizeOf = (p) => (p.big > 0 ? BIG_SIZE : 1)

// A match at its start. `left` is the visitor, `right` the computer.
// powers, when given, is each side's hand: { left: [names], right: [names] }.
// Without it each side is dealt three at random.
export function newMatch({ powers = null, rng = Math.random } = {}) {
  return {
    left: freshPlayer(-1),
    right: freshPlayer(1),
    ball: { x: W / 2, y: 90, vx: 0, vy: 0, spin: 0 },
    score: { left: 0, right: 0 },
    clock: MATCH_SECONDS,
    // 'play', 'goal' (a pause after one) or 'over'.
    phase: 'play',
    pause: 0,
    scorer: null,
    events: [],
    turn: 0,
    // The powers each side still has, the ball while it cannot be seen
    // ({ by, t }) and while it is on fire ({ by, t }).
    powers: { left: hand(powers?.left || dealPowers(rng)), right: hand(powers?.right || dealPowers(rng)) },
    hidden: null,
    flame: null,
    // How long the ball is a giant, how long a curling shot has left to
    // dip ({ by, t }), and how long each side's wall and small goal last.
    giant: 0,
    curling: null,
    wall: { left: 0, right: 0 },
    small: { left: 0, right: 0 },
  }
}

// The ball dropped in the middle and the players back in their halves.
function kickOff(m) {
  return { ...m, left: freshPlayer(-1, m.left), right: freshPlayer(1, m.right), ball: { x: W / 2, y: 90, vx: 0, vy: 0, spin: 0 }, phase: 'play', pause: 0, scorer: null, hidden: null, flame: null, curling: null }
}

export const headOf = (p) => ({ x: p.x, y: p.y - HEAD_UP * sizeOf(p) })
export const bodyOf = (p) => ({ x: p.x, y: p.y - BODY_UP * sizeOf(p) })
// Where the boot is through a kick: it swings out in front and up.
export function bootOf(p) {
  if (p.kick < 0) return null
  const u = clamp(p.kick / KICK_TIME, 0, 1)
  const swing = Math.sin(u * Math.PI)
  const k = sizeOf(p)
  return { x: p.x + p.face * (16 + 30 * swing) * k, y: p.y - (12 + 22 * swing) * k }
}

function movePlayer(p, input, dt) {
  let { x, y, vx, vy, kick, kicked, face } = p
  const nod = Math.max(0, (p.nod || 0) - dt)
  const big = Math.max(0, (p.big || 0) - dt)
  const armed = Math.max(0, (p.armed || 0) - dt)
  const stun = Math.max(0, (p.stun || 0) - dt)
  const curl = Math.max(0, (p.curl || 0) - dt)
  const frozen = Math.max(0, (p.frozen || 0) - dt)
  const swap = Math.max(0, (p.swap || 0) - dt)
  // Knocked back by a flaming ball, or frozen, a player can do nothing.
  if (p.stun > 0 || p.frozen > 0) input = {}
  // On a banana skin, left is right and right is left.
  else if (p.swap > 0) input = { ...input, left: input.right, right: input.left }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  vx = dir * RUN
  if (input.jump && y >= GROUND) vy = -JUMP
  vy += G_PLAYER * dt
  x = clamp(x + vx * dt, GOAL_D + BODY_R, W - GOAL_D - BODY_R)
  y += vy * dt
  if (y >= GROUND) { y = GROUND; vy = 0 }
  // Two kicks: a low drive (kick) and a high one (lob).
  let high = p.high
  if ((input.kick || input.lob) && kick < 0) { kick = 0; kicked = false; high = Boolean(input.lob) && !input.kick }
  if (kick >= 0) {
    kick += dt
    if (kick > KICK_TIME) kick = -1
  }
  return { ...p, x, y, vx, vy, kick, kicked, high, face, nod, big, armed, stun, curl, frozen, swap }
}

// The ball off a round thing that may be moving: pushed clear of it and
// sent away along the line between their middles.
function offCircle(ball, c, r, cvx, cvy, bounce, ballRadius = BALL_R) {
  const dx = ball.x - c.x
  const dy = ball.y - c.y
  const d = Math.hypot(dx, dy)
  const reach = r + ballRadius
  if (d >= reach || d === 0) return null
  const nx = dx / d
  const ny = dy / d
  const rel = (ball.vx - cvx) * nx + (ball.vy - cvy) * ny
  let vx = ball.vx
  let vy = ball.vy
  if (rel < 0) {
    vx -= (1 + bounce) * rel * nx
    vy -= (1 + bounce) * rel * ny
  }
  return { ...ball, x: c.x + nx * reach, y: c.y + ny * reach, vx, vy }
}

// How well a header is met, from 0 to 1: the ball's place on the head
// against the way a header is aimed, forwards and up. 1 is full on the
// forehead; 0 is the back or the underside of the head.
export function headerPower(p, ball) {
  const h = headOf(p)
  const d = Math.hypot(ball.x - h.x, ball.y - h.y) || 1
  const aim = { x: p.face * 0.78, y: -0.63 }
  return Math.max(0, ((ball.x - h.x) / d) * aim.x + ((ball.y - h.y) / d) * aim.y)
}

// The ball in the net after a goal: the net takes its pace, it drops,
// and it stays in the goal. side is -1 for the left-hand goal.
function inNet(ball, side, dt, events) {
  const b = { ...ball }
  const back = side < 0 ? BALL_R : W - BALL_R
  const front = side < 0 ? GOAL_D - BALL_R : W - GOAL_D + BALL_R
  b.vy += G_BALL * dt
  b.vx *= Math.max(0, 1 - 3.5 * dt)
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.spin += (b.vx / BALL_R) * dt
  if (side < 0 ? b.x <= back : b.x >= back) {
    // The back of the net: it gives, and the ball comes off it slowly.
    if (Math.abs(b.vx) > 60) events.push({ type: 'net', side, y: b.y, power: Math.min(1, Math.abs(b.vx) / 700) })
    b.x = back
    b.vx = -b.vx * 0.18
  }
  if (side < 0 ? b.x > front : b.x < front) { b.x = front; b.vx = -b.vx * 0.2 }
  if (b.y < BAR + BALL_R) { b.y = BAR + BALL_R; b.vy = Math.abs(b.vy) * 0.3 }
  if (b.y > GROUND - BALL_R) { b.y = GROUND - BALL_R; b.vy = -b.vy * 0.45; if (Math.abs(b.vy) < 30) b.vy = 0 }
  return b
}

// first is the side whose touch is worked out first this time: it
// alternates, so neither side wins every ball that both reach at once.
function moveBall(m, dt, events, first = 'left') {
  let b = { ...m.ball }
  const R = ballR(m)
  // A flaming ball hardly drops.
  b.vy += G_BALL * dt * (m.flame ? 0.2 : 1)
  // A curling shot climbs, then dips hard and runs on towards the goal.
  if (m.curling && b.vy > -120) { b.vy += G_BALL * dt * 1.5; b.vx += (m.curling.by === 'left' ? 1 : -1) * 520 * dt }
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.spin += (b.vx / R) * dt

  // The players: head, body, and the boot through a kick. When both
  // boots meet the ball at once neither wins it: it goes straight up.
  const boots = []
  for (const key of first === 'left' ? ['left', 'right'] : ['right', 'left']) {
    const p = m[key]
    const k = sizeOf(p)
    // A flaming ball is not stopped by the other side: it knocks them
    // back and carries on, a little slower.
    if (m.flame && m.flame.by !== key) {
      const h = headOf(p)
      const c = bodyOf(p)
      if (Math.hypot(b.x - h.x, b.y - h.y) < HEAD_R * k + R || Math.hypot(b.x - c.x, b.y - c.y) < BODY_R * k + R) {
        if (!(p.stun > 0)) {
          m[key] = { ...p, stun: 0.7, vy: Math.min(p.vy, -260) }
          b.vx *= 0.8
          events.push({ type: 'knock', by: key })
        }
        continue
      }
    }
    const head = offCircle(b, headOf(p), HEAD_R * k, p.vx, p.vy, 0.88, R)
    if (head) {
      b = head
      // In the air the player heads it on purpose: the ball is driven
      // away from the head, hardest when it is met with the forehead,
      // up and forwards, and hardly at all off the back of the head.
      const power = p.y < GROUND - 3 ? headerPower(p, b) : 0
      if (power > 0) {
        const h = headOf(p)
        const d = Math.hypot(b.x - h.x, b.y - h.y) || 1
        const drive = HEADER_LEAST + (HEADER_MOST - HEADER_LEAST) * power * power
        b.vx += ((b.x - h.x) / d) * drive
        b.vy += ((b.y - h.y) / d) * drive
        m[key] = { ...m[key], nod: 0.22 }
        events.push({ type: 'header', by: key, power })
      } else {
        events.push({ type: 'head', by: key })
      }
    }
    const body = offCircle(b, bodyOf(m[key]), BODY_R * k, p.vx, p.vy, 0.6, R)
    if (body) b = body
    const boot = bootOf(p)
    if (boot && !m[key].kicked && Math.hypot(b.x - boot.x, b.y - boot.y) < (BOOT_R + 4) * k + R) {
      boots.push(p)
      m[key] = { ...m[key], kicked: true }
      events.push({ type: 'kick', by: key })
    }
  }
  if (boots.length === 2) {
    b.vx = (boots[0].vx + boots[1].vx) * 0.3
    b.vy = -560
  } else if (boots.length === 1) {
    // A low kick is a drive along the ground; a high one is a lob.
    const kicker = boots[0]
    b.vx = kicker.face * (kicker.high ? 330 : 560) + kicker.vx * 0.35
    b.vy = kicker.high ? -640 : -260
    // With a curler waiting, the kick goes up and over and dips.
    if (kicker.curl > 0 && !m.flame) {
      const key = kicker.side < 0 ? 'left' : 'right'
      b.vx = kicker.face * 300
      b.vy = -700
      m[key] = { ...m[key], curl: 0 }
      m.curling = { by: key, t: 1.6 }
      events.push({ type: 'curl', by: key })
    }
  }
  // A side with a flaming shot waiting sets the ball alight with its
  // next kick or header: fast, flat and towards the other goal.
  for (const e of events) {
    if ((e.type !== 'kick' && e.type !== 'header') || e.lit) continue
    e.lit = true
    const p = m[e.by]
    if (!(p.armed > 0) || m.flame) continue
    b.vx = p.face * FLAME_SPEED
    b.vy = Math.max(-260, Math.min(-60, b.vy * 0.25))
    m[e.by] = { ...p, armed: 0 }
    m.flame = { by: e.by, t: FLAME_TIME }
    events.push({ type: 'flame', by: e.by })
  }

  // The ground, the roof and the ends of the pitch above the bars.
  if (b.y > GROUND - R) {
    b.y = GROUND - R
    // Only a ball coming down bounces: one just kicked up off the grass
    // keeps the pace the boot gave it.
    if (b.vy > 0) {
      if (b.vy > 90) events.push({ type: 'bounce', speed: b.vy })
      b.vy = -b.vy * 0.8
      b.vx *= 0.99
      if (Math.abs(b.vy) < 26) b.vy = 0
    }
  }
  if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.8 }
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.82 }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.82 }

  // The goals: the end of each bar is round, and the bar is solid from
  // above and below.
  for (const side of [-1, 1]) {
    const owner = side < 0 ? 'left' : 'right'
    const postX = side < 0 ? GOAL_D : W - GOAL_D
    const bar = barOf(m, owner)
    // A brick wall fills the goal mouth, and a small goal is shut above
    // its lowered bar: the ball comes back off either.
    const coming = side < 0 ? b.vx < 0 : b.vx > 0
    const atMouth = side < 0 ? b.x - R < postX + 6 && b.x > postX - 10 : b.x + R > postX - 6 && b.x < postX + 10
    const shut = (m.wall?.[owner] > 0 && b.y > BAR) || (bar > BAR && b.y > BAR && b.y < bar)
    if (shut && coming && atMouth) {
      b.x = side < 0 ? postX + 6 + R : postX - 6 - R
      b.vx = -b.vx * 0.6
      events.push({ type: m.wall?.[owner] > 0 ? 'wall' : 'post', side })
      continue
    }
    const post = offCircle(b, { x: postX, y: bar }, POST_R, 0, 0, 0.8, R)
    if (post) { b = post; events.push({ type: 'post' }); continue }
    const inside = side < 0 ? b.x < postX : b.x > postX
    if (inside && Math.abs(b.y - bar) < R) {
      const above = b.y < bar
      b.y = bar + (above ? -R : R)
      b.vy = (above ? -1 : 1) * Math.abs(b.vy) * 0.75
      events.push({ type: 'post' })
    }
  }

  const speed = Math.hypot(b.vx, b.vy)
  if (!m.flame && speed > MAX_BALL) { b.vx *= MAX_BALL / speed; b.vy *= MAX_BALL / speed }
  return b
}

// Which side has scored: 'left' when the ball is in the right-hand goal.
// m, when given, says how big the ball is and how high each goal is.
export function goalFor(ball, m = {}) {
  const r = ballR(m)
  if (ball.x > W - GOAL_D + r * 0.5 && ball.y > barOf(m, 'right') + r * 0.5) return 'left'
  if (ball.x < GOAL_D - r * 0.5 && ball.y > barOf(m, 'left') + r * 0.5) return 'right'
  return null
}

// The match a moment later. inputs: { left, right }, each { left, right,
// jump, kick }. dt is in seconds. What happened is in `events`.
export function step(match, inputs, dt) {
  if (match.phase === 'over') return match.events.length ? { ...match, events: [] } : match
  const t = Math.min(dt, 1 / 30)
  const events = []
  if (match.phase === 'goal') {
    const pause = match.pause - t
    if (pause > 0) {
      // The ball runs on into the net and the players come back to earth
      // while the goal is celebrated.
      const side = match.scorer === 'left' ? 1 : -1
      const still = {}
      return { ...match, pause, events, ball: inNet(inNet(match.ball, side, t / 2, events), side, t / 2, events), left: movePlayer(match.left, still, t), right: movePlayer(match.right, still, t) }
    }
    if (match.clock <= 0) return { ...match, phase: 'over', pause: 0, events: [{ type: 'over' }] }
    return { ...kickOff(match), events: [{ type: 'kickoff' }] }
  }
  const m = { ...match, events, turn: (match.turn || 0) + 1 }
  // A power asked for is used, if that side still has it.
  for (const key of ['left', 'right']) {
    const name = inputs[key]?.power
    if (!name || !m.powers?.[key]?.[name]) continue
    m.powers = { ...m.powers, [key]: { ...m.powers[key], [name]: false } }
    const other = key === 'left' ? 'right' : 'left'
    if (name === 'invisible') m.hidden = { by: key, t: INVISIBLE_TIME }
    else if (name === 'big') m[key] = { ...m[key], big: BIG_TIME }
    else if (name === 'flame') m[key] = { ...m[key], armed: ARMED_TIME }
    else if (name === 'giant') m.giant = GIANT_TIME
    else if (name === 'curler') m[key] = { ...m[key], curl: ARMED_TIME }
    else if (name === 'wall') m.wall = { ...m.wall, [key]: WALL_TIME }
    else if (name === 'small') m.small = { ...m.small, [key]: SMALL_TIME }
    else if (name === 'freeze') m[other] = { ...m[other], frozen: FREEZE_TIME }
    else if (name === 'swap') m[other] = { ...m[other], swap: SWAP_TIME }
    events.push({ type: 'power', by: key, name })
  }
  if (m.hidden) m.hidden = m.hidden.t - t > 0 ? { ...m.hidden, t: m.hidden.t - t } : null
  if (m.flame) m.flame = m.flame.t - t > 0 ? { ...m.flame, t: m.flame.t - t } : null
  if (m.curling) m.curling = m.curling.t - t > 0 ? { ...m.curling, t: m.curling.t - t } : null
  m.giant = Math.max(0, (m.giant || 0) - t)
  m.wall = { left: Math.max(0, (m.wall?.left || 0) - t), right: Math.max(0, (m.wall?.right || 0) - t) }
  m.small = { left: Math.max(0, (m.small?.left || 0) - t), right: Math.max(0, (m.small?.right || 0) - t) }
  // A ball that has grown is kept clear of the ground and the ends.
  const grown = ballR(m)
  if (m.ball.y > GROUND - grown) m.ball = { ...m.ball, y: GROUND - grown }
  // Two small steps for each one asked, so a fast ball does not pass
  // through a head.
  for (let i = 0; i < 2; i++) {
    m.left = movePlayer(m.left, inputs.left || {}, t / 2)
    m.right = movePlayer(m.right, inputs.right || {}, t / 2)
    // The two cannot stand in the same place.
    const gap = m.right.x - m.left.x
    if (Math.abs(gap) < BODY_R * 2 && Math.abs(m.left.y - m.right.y) < 70) {
      const push = (BODY_R * 2 - Math.abs(gap)) / 2 * (gap >= 0 ? 1 : -1)
      m.left = { ...m.left, x: clamp(m.left.x - push, GOAL_D + BODY_R, W - GOAL_D - BODY_R) }
      m.right = { ...m.right, x: clamp(m.right.x + push, GOAL_D + BODY_R, W - GOAL_D - BODY_R) }
    }
    m.ball = moveBall(m, t / 2, events, (m.turn + i) % 2 ? 'right' : 'left')
    const scored = goalFor(m.ball, m)
    if (scored) {
      m.score = { ...m.score, [scored]: m.score[scored] + 1 }
      m.phase = 'goal'
      m.pause = 2
      m.scorer = scored
      m.hidden = null
      m.flame = null
      m.curling = null
      m.giant = 0
      events.push({ type: 'goal', by: scored })
      return m
    }
  }
  m.clock = Math.max(0, match.clock - t)
  if (m.clock <= 0) {
    m.phase = 'over'
    events.push({ type: 'over' })
  }
  return m
}

export function result(match) {
  if (match.score.left > match.score.right) return 'win'
  if (match.score.left < match.score.right) return 'lose'
  return 'draw'
}

// ---------------------------------------------------------------------
// The computer
// ---------------------------------------------------------------------
//
// It plays the right-hand side. skill runs from 0 (slow to react, often
// leaves it) to 1 (sharp). It keeps itself between the ball and its own
// goal, heads a ball that is coming down on it, kicks one that is in
// front of its boot, and goes home when the ball is far away. mind is
// what it carries from one moment to the next: { wait, inputs }.

export function newMind() {
  return { wait: 0, inputs: { left: false, right: false, jump: false, kick: false, lob: false, power: null }, seen: null }
}

export function computerInputs(match, skill, mind, dt, rng = Math.random) {
  const s = clamp(skill, 0, 1)
  const wait = mind.wait - dt
  // It thinks again only so often: less often the weaker it is.
  if (wait > 0) return { ...mind, wait, inputs: { ...mind.inputs, jump: false, kick: false, lob: false, power: null } }
  const me = match.right
  // It cannot play a ball it cannot see: while the visitor's invisible
  // ball lasts it goes by where the ball was when it vanished.
  const blind = match.hidden?.by === 'left'
  const b = blind ? (mind.seen || match.ball) : match.ball
  const seen = blind ? (mind.seen || { ...match.ball, vx: 0, vy: 0 }) : null
  const home = W - 215
  // Where the ball will be a moment from now: the better it is, the
  // further ahead it looks and the less it misjudges.
  const ahead = 0.12 + 0.2 * s
  const bx = b.x + b.vx * ahead + (rng() - 0.5) * 90 * (1 - s)
  const near = bx > W * (0.46 - 0.16 * s) || b.vx > 160 - 60 * s
  // Stand goal-side of the ball, a little behind it.
  const want = near ? clamp(bx + 30, GOAL_D + BODY_R + 6, W - GOAL_D - BODY_R) : home
  const slack = 10 + 30 * (1 - s)
  // A weaker one sometimes stands and watches.
  const dozing = rng() < 0.45 * (1 - s)
  const inputs = { left: !dozing && me.x > want + slack, right: !dozing && me.x < want - slack, jump: false, kick: false, lob: false }
  const dx = me.x - b.x
  const height = GROUND - b.y
  // A ball in front of the boot and low: kick it, more surely the better it is.
  if (dx > 6 && dx < 62 && height < 74 && rng() < 0.12 + 0.83 * s) {
    // A lob when the visitor is close in front, in the way of a drive.
    const blocked = match.left.x < me.x && me.x - match.left.x < 230
    if (blocked && rng() < 0.35 + 0.4 * s) inputs.lob = true
    else inputs.kick = true
  }
  // A ball coming down above the head: jump for it.
  if (Math.abs(dx - 8) < 54 && height > 96 && height < 215 && b.vy > -160 && me.y >= GROUND && rng() < 0.08 + 0.82 * s) inputs.jump = true
  // Its powers, each once: super size when the ball is coming at its
  // goal, the flaming ball when it is about to strike, and the invisible
  // ball once it has sent the ball the visitor's way. Not in the first
  // few seconds, one at a time, and more readily the sharper it is.
  const have = match.powers?.right || {}
  const quiet = !match.hidden && !match.flame && !(me.big > 0) && !(me.armed > 0) && !(me.curl > 0) && !(match.giant > 0) && !(match.wall?.right > 0) && !(match.small?.right > 0) && !(match.left.frozen > 0) && !(match.left.swap > 0)
  if (quiet && match.clock < MATCH_SECONDS - 6 && rng() < 0.05 + 0.2 * s) {
    const striking = inputs.kick || inputs.lob
    const underFire = b.vx > 220 && b.x > W * 0.55
    const going = b.vx < -260 && b.x < W * 0.6 && b.x > W * 0.25
    // To defend, when the ball is coming at its goal; to attack, as it
    // strikes or once the ball is on its way; to put the visitor off,
    // when they are on the ball in its half.
    const pick = (names) => names.find(n => have[n])
    if (underFire) inputs.power = pick(['wall', 'big', 'small']) || null
    else if (striking) inputs.power = pick(['flame', 'curler']) || null
    else if (going) inputs.power = pick(['invisible', 'giant']) || null
    else if (b.x > W * 0.5 && Math.abs(match.left.x - b.x) < 90) inputs.power = pick(['freeze', 'swap']) || null
  }
  return { wait: 0.05 + 0.42 * (1 - s) * rng(), inputs, seen }
}

// How sharp the computer is next time: a little sharper after the
// visitor wins, a little easier after they lose.
export const FIRST_SKILL = 0.08
export function nextSkill(skill, outcome) {
  const step = outcome === 'win' ? 0.1 : outcome === 'lose' ? -0.08 : 0.02
  return Math.round(clamp(skill + step, 0.04, 1) * 100) / 100
}

// ---------------------------------------------------------------------
// Wins in a row
// ---------------------------------------------------------------------

export const STREAK_KEY = 'winterfayre:headtohead:streak'
export const BEST_KEY = 'winterfayre:headtohead:best'
const kept = (store, key) => {
  try {
    const n = Number(store?.getItem(key))
    return Number.isInteger(n) && n > 0 && n <= 999 ? n : 0
  } catch {
    return 0
  }
}
export const readStreak = (store) => kept(store, STREAK_KEY)
export const readBest = (store) => kept(store, BEST_KEY)
// After a match: the run of wins as it now stands, the best run on this
// device, and the run that has just ended (0 unless one has).
export function afterMatch(store, outcome) {
  const before = readStreak(store)
  const streak = outcome === 'win' ? before + 1 : 0
  const best = Math.max(readBest(store), streak)
  try {
    store?.setItem(STREAK_KEY, String(streak))
    store?.setItem(BEST_KEY, String(best))
  } catch { /* a browser that keeps nothing still plays */ }
  return { streak, best, ended: outcome === 'win' ? 0 : before }
}
