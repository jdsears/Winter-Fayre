// Cricket smash in the stadium (games/stage.js): the rules (rules.js)
// with the pitch, the wickets, the bowler, the batter and the ball drawn
// in the 3D scene the other games share, dressed for cricket.
//
// One thumb: a tap anywhere swings the bat, once a ball. The swing is
// judged by how near it was to the moment the ball reached the bat.

import { BALLS, delivery, flight, judge, lateFor, result, stroke, stumpsAfter, timingWord, SAID, readBest, keepBest, G } from './rules.js'
import { GROUND, BALL_R, HAND, CONTACT, toWorld, cameraFor } from './ground.js'
import { openStage, boardsFrom } from '../games/stage.js'
import { tally } from '../games/count.js'
import { createGoBoard } from '../games/board.js'
import { othersFor } from '../../shared/games.js'
import { paintCricket } from './paint.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Where a delivery is in the stadium, t seconds after it left the hand.
export const ballIn = (d, t) => toWorld(flight(d, t, HAND))

// How long the bat takes to come down to the ball and to follow through,
// how long it takes to come back to wait for the next ball, how long a
// ball's result is shown before the next one, and how long the bowler
// waits at the top of his run.
export const DOWN = 0.06
export const FOLLOW = 0.2
export const BACK = 0.3
export const PAUSE = 1.5
export const WAIT = 0.75
// How long after a ball's result the bowler sets off back to his mark,
// and how long he takes: he is there just before his next run starts.
export const JOG_AFTER = 0.6
export const JOG = PAUSE - JOG_AFTER + WAIT - 0.05
// A tap is counted as made this long before it is heard of: about what a
// phone takes between them to show a picture and to notice a finger. With
// none allowed for, a swing made at the right moment as the player saw it
// would be judged late, and late is the side with no room.
export const LAG = 0.05

// How far through the bowling arm's turn the ball is let go, and how far
// in front of his feet the bowler's hand is as it goes.
const RELEASED = 0.57
const REACHES = 0.41
// How quickly he pulls up after it: the seconds his pace takes to fall to
// about a third.
const PULL_UP = 0.35

// The bowler as the scene draws him, at a moment of a ball: `t` seconds
// since the ball left his hand (below nought while he runs in).
//   x, z      where he is
//   stride    where his legs are in their stride
//   run       how hard he is running, 0 to 1
//   bowl      his bowling arm's way over the top, 0 to 1
export function bowlerAt(d, t) {
  // The arm starts round a quarter of a second before the ball goes, and
  // the ball goes as the arm passes the top of its turn.
  const ARM = 0.42
  const bowl = clamp((t + ARM * RELEASED) / ARM, 0, 1)
  const run = clamp(1 + t / d.runup, 0, 1)
  // He gathers pace from the top of his run to the crease, lets the ball
  // go at full tilt and pulls up in a few steps.
  const way = GROUND.release - REACHES - GROUND.runFrom
  const pace = (1.5 * way) / d.runup
  const on = t > 0 ? pace * PULL_UP * (1 - Math.exp(-t / PULL_UP)) : 0
  const z = GROUND.runFrom + way * run ** 1.5 + on
  return { x: GROUND.bowlerX, z, stride: run * d.runup * 9 + Math.max(0, t) * 6, run: t < -d.runup ? 0 : t > 0 ? Math.max(0, 1 - t / 1.1) : 0.35 + 0.65 * run, bowl }
}

// Between balls the bowler jogs back to the top of his run. Where he is
// k of the way back (0 to 1) from where he pulled up (`from`), `seconds`
// after setting off: turned away from the batter for all but the first
// and last of it.
export function joggingBack(from, k, seconds) {
  const way = clamp(k, 0, 1)
  const ends = Math.min(1, way / 0.15, (1 - way) / 0.15)
  return { x: GROUND.bowlerX, z: from + (GROUND.runFrom - from) * way * way * (3 - 2 * way), stride: seconds * 8, run: 0.55 * ends, bowl: 0, turn: ends }
}

// A swing of the bat, t seconds after the tap: 0 as the bat waits, up to
// CONTACT as it comes down to the ball (in `down` seconds) and on to 1 as
// it follows through.
export function swingAt(t, down = DOWN) {
  if (!(t > 0)) return 0
  if (t < down) return CONTACT * (t / down)
  return CONTACT + (1 - CONTACT) * Math.min(1, (t - down) / FOLLOW)
}

// What a tap at a ball comes to. `tap` and `arrives` are moments on the
// game's clock: the tap, and the ball reaching the bat. A swing that is
// near enough meets the ball: { kind, delta, holds, meets }. The ball is
// stopped at `holds` (where it is as the bat sets off for it, or at the
// bat if it is not there yet) until the bat meets it at `meets`. A swing
// that will miss gives null.
export function meeting(d, tap, arrives) {
  const delta = tap - arrives
  const kind = judge(delta, lateFor(d))
  if (kind === 'miss') return null
  return { kind, delta, holds: Math.max(arrives, tap), meets: Math.max(arrives, tap + DOWN) }
}

// A ball that has been hit, t seconds after the bat met it: it leaves
// the bat the stroke's way (rules.js, stroke) and flies or runs away.
export function hitBall(from, s, t) {
  // Straight back past the bowler is towards the stand; off is to the right.
  const level = s.speed * Math.cos(s.loft)
  const slow = s.loft > 0.3 ? 1 : Math.exp(-t * (s.speed > 20 ? 0.25 : 1.4))
  const run = s.loft > 0.3 ? level * t : (level / (s.speed > 20 ? 0.25 : 1.4)) * (1 - slow)
  const y = from.y + s.speed * Math.sin(s.loft) * t - 0.5 * G * t * t
  return { x: from.x + Math.sin(s.turn) * run, y: Math.max(BALL_R, y), z: from.z - Math.cos(s.turn) * run }
}

// A ball that has hit the stumps, t seconds after: it drops behind them.
export function ballOffStumps(at, t) {
  return { x: at.x, y: Math.max(BALL_R, at.y - 0.5 * G * t * t), z: GROUND.stumps + 0.06 + Math.min(0.5, t * 1.4) }
}

const WORDS = { six: 'SIX!', four: 'FOUR!', two: '2 RUNS', one: '1 RUN', touch: 'NO RUN', dot: 'DOT BALL', bowled: 'OUT!' }

export async function playCricket3D(root, win = window) {
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let best = readBest(store)
  let ball = 0
  let runs = 0
  let wickets = 0
  let d = delivery(0)
  // Where the ball in play is up to: 'ready' (waiting for the first
  // tap), 'bowl' (the bowler is running in or the ball is in the air)
  // and 'done' (its result is being shown).
  let phase = 'ready'
  let at = 0 // the clock when the ball leaves the hand
  let swungAt = null // the clock at the swing, for this ball
  let plan = null // the swing's meeting with the ball, if it will meet it
  let outcome = null
  let decidedAt = 0
  let over = false
  let jog = null // the bowler's way back to his mark: { from, at }
  let fresh = false // a new batter has just come in
  let stage = null
  let board = null
  let clock = 0
  let lastFrame = 0

  // The clock now, between frames too: a tap is timed when it lands.
  const nowClock = () => clock + clamp((win.performance.now() - lastFrame) / 1000, 0, 0.05)

  const hud = () => {
    stage.set('now', runs)
    stage.set('ball', Math.min(ball + 1, BALLS))
  }

  function finish() {
    over = true
    tally('cricket', 'done', win)
    const record = runs > best
    best = keepBest(store, runs)
    hud()
    stage.note('')
    if ((record && runs >= 8) || runs >= 24) {
      stage.audio.roar()
      stage.cheer(3)
      stage.confetti(140)
    }
    const count = runs === 1 ? '1 run' : `${runs} runs`
    const lost = wickets === 0 ? 'and not out' : `for ${wickets} ${wickets === 1 ? 'wicket' : 'wickets'}`
    stage.showEnd({
      title: record && runs >= 8 ? 'New best' : runs >= 24 ? 'What an over' : runs >= 12 ? 'Good batting' : 'End of the over',
      line: `${count} from the ${BALLS} balls, ${lost}. Your best on this device is ${best}.`,
    })
    const prize = stage.prize('cricket', runs)
    stage.say(`That is the over. ${count}, ${lost}. Your best on this device is ${best}. ${prize}`)
    stage.endExtra.replaceChildren()
    board.show(stage.endExtra, runs)
  }

  // The bowler sets off for the next ball.
  function bowl() {
    fresh = Boolean(outcome?.out)
    d = delivery(ball)
    phase = 'bowl'
    at = clock + WAIT + d.runup
    swungAt = null
    plan = null
    outcome = null
    hud()
    stage.prompt('')
    stage.note(fresh ? 'Next batter in' : '')
  }

  // The ball has been dealt with: what it was worth. delta is how far
  // the swing was from the right moment, or null for no swing.
  function decide(delta, met = null) {
    outcome = { ...result(d, delta), delta, met }
    decidedAt = clock
    phase = 'done'
    runs += outcome.runs
    if (outcome.out) wickets += 1
    stage.set('now', runs)
    stage.banner(WORDS[outcome.kind], 1000)
    const word = timingWord(outcome.kind, delta)
    stage.note(word)
    if (outcome.kind === 'six' || outcome.kind === 'four') {
      stage.audio.kick(1)
      stage.audio.cheer()
      stage.cheer(outcome.kind === 'six' ? 2.4 : 1.6)
      if (outcome.kind === 'six') stage.confetti(50)
    } else if (outcome.kind === 'bowled') {
      stage.audio.clang()
      stage.audio.groan()
    } else if (outcome.kind === 'dot') {
      stage.audio.groan()
    } else {
      stage.audio.kick(outcome.kind === 'touch' ? 0.15 : 0.5)
    }
    stage.say(`Ball ${ball + 1} of ${BALLS}: ${SAID[outcome.kind]} ${word ? `${word}. ` : ''}${runs} ${runs === 1 ? 'run' : 'runs'}.`)
  }

  // A tap: the first starts the over, and after that each ball has one
  // swing of the bat.
  function swing() {
    if (over) return
    if (phase === 'ready') {
      tally('cricket', 'play', win)
      bowl()
      return
    }
    // A tap just after a ball has gone by with no swing at it was a swing
    // all the same: too late a one.
    if (phase === 'done' && outcome.delta === null && swungAt === null && clock - decidedAt < 0.6) {
      swungAt = nowClock() - LAG
      stage.note(timingWord(outcome.kind, 1))
      return
    }
    if (phase !== 'bowl' || swungAt !== null) return
    // A tap before the ball has left the bowler's hand is not a swing.
    const tap = nowClock() - LAG
    if (tap < at) return
    swungAt = tap
    plan = meeting(d, tap, at + d.time)
    stage.audio.kick(0.12)
  }

  function restart() {
    ball = 0
    runs = 0
    wickets = 0
    over = false
    phase = 'ready'
    swungAt = null
    plan = null
    outcome = null
    jog = null
    fresh = false
    d = delivery(0)
    board.next()
    stage.endExtra.replaceChildren()
    stage.hideEnd()
    stage.note('')
    hud()
    stage.prompt('Tap to start the over')
  }

  stage = await openStage({
    name: 'Cricket smash',
    sport: 'cricket',
    flat: paintCricket,
    hud: [{ key: 'now', label: 'runs' }, { key: 'ball', label: `of ${BALLS}` }],
    others: othersFor('cricket'),
    boards: boardsFrom(root),
    win,
    onPoint() { swing() },
    onKey(key) {
      if (stage.ended) { if (key === ' ' || key === 'Enter') restart(); return }
      if (key === ' ' || key === 'Enter') swing()
    },
  })
  if (!stage) return null

  // The bowler is the other side's player.
  stage.setTeams({ taker: stage.kits.away, number: '' })
  board = createGoBoard({ game: 'cricket', root, win, say: stage.say })
  stage.again.addEventListener('click', restart)
  hud()
  stage.prompt('Tap to start the over')
  stage.say(`Cricket smash. An over of ${BALLS} balls. Tap, or press Space, as the ball reaches the bat. Tap to start the over.`)

  stage.onFrame((dt) => {
    clock += dt
    lastFrame = win.performance.now()
    const t = phase === 'ready' ? -99 : clock - at
    // The word that a new batter is in goes as the ball is let go.
    if (fresh && phase === 'bowl' && t >= 0) {
      fresh = false
      stage.note('')
    }
    if (phase === 'bowl') {
      // A swing that meets the ball is settled as the bat gets to it. A
      // ball nothing has met is settled as it reaches the stumps, or
      // goes by them.
      if (plan && clock >= plan.meets) decide(plan.delta, { at: plan.meets, from: ballIn(d, plan.holds - at) })
      else if (!plan && t >= d.time + stumpsAfter(d)) decide(swungAt === null ? null : swungAt - (at + d.time))
    } else if (phase === 'done' && clock - decidedAt > PAUSE && !over) {
      if (ball + 1 >= BALLS) finish()
      else { ball += 1; bowl() }
    }

    // The ball: in the bowler's hand until it is let go, then down the
    // pitch; a ball the bat is coming to waits for it, and after the bat
    // it is away off it, or on to the stumps, or gone by.
    let place = { ...ballIn(d, 0), held: true }
    let wicket = null
    if (phase !== 'ready' && t >= 0) {
      if (outcome?.met) {
        place = hitBall(outcome.met.from, stroke(outcome.kind, outcome.delta), clock - outcome.met.at)
      } else if (outcome?.kind === 'bowled') {
        const hit = d.time + stumpsAfter(d)
        place = ballOffStumps(ballIn(d, hit), t - hit)
        wicket = t - hit
      } else {
        const here = ballIn(d, plan ? Math.min(t, plan.holds - at) : t)
        place = { ...here, hidden: here.z > GROUND.stumps + 1.6 }
      }
    }
    // The bat: through its swing, and back to wait before the next ball.
    let swingFor = swungAt === null ? 0 : swingAt(clock - swungAt, plan ? plan.meets - swungAt : DOWN)
    if (phase === 'done') swingFor *= 1 - clamp((clock - decidedAt - (PAUSE - BACK)) / BACK, 0, 1)
    const from = outcome?.met ? outcome.met.from : plan ? ballIn(d, plan.holds - at) : null
    // The bowler: running in and bowling, and between balls jogging back
    // to the top of his run.
    let bowler = bowlerAt(d, phase === 'ready' ? -99 : t)
    if (!jog && phase === 'done' && !over && ball + 1 < BALLS && clock - decidedAt >= JOG_AFTER) jog = { from: bowler.z, at: clock }
    if (jog) {
      if (phase === 'ready' || clock - jog.at >= JOG) jog = null
      else bowler = joggingBack(jog.from, (clock - jog.at) / JOG, clock - jog.at)
    }
    return {
      view: cameraFor(), taker: null, keeper: null, holding: false, aim: null, goalLine: false,
      ball: place,
      bowler,
      // A new batter comes in for the ball after a wicket.
      batter: { swing: swingFor, line: d.line, meet: from ? from.z - GROUND.bat : 0, look: wickets - (phase === 'done' && outcome?.out ? 1 : 0) },
      wicket,
    }
  })
  return stage
}
