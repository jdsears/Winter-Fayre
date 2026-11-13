// The free kick challenge in the stadium (games/stage.js): the same
// rules as the flat version (rules.js), with the wall, the keeper and
// the ball drawn in the penalty shootout's 3D scene.
//
// The rules count across the pitch in the flat drawing's units, height
// in bar heights and the flight from 0 at the kick to 1 at the goal
// line. The stadium counts in metres. The goal is 220 units and 7.32
// metres wide, and every place is turned from one to the other by that.

import {
  KICKS, CENTRE, POST_LEFT, POST_RIGHT, REACH_UP, WALL_AT, WALL_H, W,
  kickSetup, shotFromSwipe, flightAt, outcome, SAID, readBest, keepBest,
} from './rules.js'
import { BALL_R, GOAL, KEEPER_Z, keeperPose } from '../shootout/physics.js'
import { project } from '../shootout/camera.js'
import { openStage, boardsFrom } from '../games/stage.js'
import { tally } from '../games/count.js'
import { createGoBoard } from '../games/board.js'
import { othersFor } from '../../shared/games.js'

const MX = (GOAL.halfWidth * 2) / (POST_RIGHT - POST_LEFT)
// The ball is twenty metres from the goal line.
export const Z0 = GOAL.lineZ + 20
const FLIGHT = 1.05
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export const acrossToWorld = (x) => (x - CENTRE) * MX
// Where the ball is, in the stadium, at a point in its flight.
export function ballAt(setup, shot, t) {
  const f = flightAt(setup, shot, t)
  return { x: acrossToWorld(f.x), y: BALL_R + Math.max(0, f.h) * GOAL.height, z: Z0 + (GOAL.lineZ - Z0) * t }
}

// The camera for a kick: behind the ball and a little above it, turned
// part of the way towards the middle of the goal, wide enough to hold
// the whole goal on a phone held upright.
export function cameraFor(setup, width, height) {
  const x = acrossToWorld(setup.x0)
  const pos = { x, y: 3.6, z: Z0 + 8.5 }
  const look = { x: x * 0.35, y: 0, z: GOAL.lineZ }
  const dist = pos.z - GOAL.lineZ
  const half = Math.atan(5.0 / dist)
  const fov = clamp((2 * Math.atan(Math.tan(half) / Math.max(0.2, width / height)) * 180) / Math.PI, 34, 62)
  return { pos, look, fov }
}

// A swipe on the screen as the rules read one. The rules want the
// swipe's line carried on to the goal, so the screen is measured against
// where the ball and the goal are drawn: across, by the goal's width on
// the screen, and up, by the ball's distance below the goal.
export function swipeToShot(points, setup, width, height) {
  if (!points || points.length < 2) return null
  const cam = cameraFor(setup, width, height)
  const mid = GOAL.height / 2
  const ball = project(cam, { x: acrossToWorld(setup.x0), y: BALL_R, z: Z0 }, width, height)
  const left = project(cam, { x: -GOAL.halfWidth, y: mid, z: GOAL.lineZ }, width, height)
  const right = project(cam, { x: GOAL.halfWidth, y: mid, z: GOAL.lineZ }, width, height)
  const across = (right.x - left.x) / (POST_RIGHT - POST_LEFT)
  const up = ball.y - (left.y + right.y) / 2
  if (!(across > 0) || !(up > 0)) return null
  const from = CENTRE + (ball.x - (left.x + right.x) / 2) / across
  const read = points.map(p => ({ x: p.x / across, y: (p.y * REACH_UP) / up }))
  return shotFromSwipe(read, from)
}

// How far off the ground the wall is at a point in the ball's flight:
// up as the ball reaches it and down again, by as much as this kick's
// wall is taller than a standing one.
export function wallJump(t, wallH = WALL_H) {
  if (!(t > WALL_AT - 0.22 && t < WALL_AT + 0.22)) return 0
  return Math.sin(((t - (WALL_AT - 0.22)) / 0.44) * Math.PI) * (0.12 + Math.max(0, wallH - WALL_H) * GOAL.height)
}

const WORDS = { goal: 'Goal!', saved: 'Saved', wall: 'Wall', wide: 'Wide', over: 'Over' }
const READY = { kind: 'ready', start: 0, duration: 1 }

export async function playFreeKicks3D(root, win = window) {
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let best = readBest(store)
  let kick = 0
  let score = 0
  let setup = kickSetup()
  let flying = null
  let swipe = null
  let keys = null
  let waiting = false
  let stage = null
  let board = null
  let clock = 0

  const hud = () => {
    stage.set('now', score)
    stage.set('kick', Math.min(kick + 1, KICKS))
  }

  function finish() {
    tally('freekick', 'done', win)
    const record = score > best
    best = keepBest(store, score)
    hud()
    if (record || score >= 7) {
      stage.audio.roar()
      stage.cheer(3)
      stage.confetti(140)
    }
    stage.showEnd({
      title: record ? 'New best' : score >= 7 ? 'Great kicking' : score >= 4 ? 'Good go' : 'Full time',
      line: `${score} of ${KICKS} scored. Your best on this device is ${best}.`,
    })
    const prize = stage.prize('freekick', score)
    stage.say(`${score} of ${KICKS} scored${record ? ', your best yet' : ''}. Best on this device: ${best}. ${prize}`)
    stage.endExtra.replaceChildren()
    board.show(stage.endExtra, score)
  }

  function next() {
    flying = null
    waiting = false
    kick += 1
    if (kick >= KICKS) { finish(); return }
    setup = kickSetup(Math.random, kick)
    keys = null
    hud()
  }

  function landed() {
    const result = flying.result
    flying.landed = true
    waiting = true
    if (result === 'goal') {
      score += 1
      stage.ripple(ballAt(setup, flying.shot, 1), 1)
      stage.audio.swish(0.9)
      stage.audio.cheer()
      stage.cheer(2)
      stage.confetti(40)
    } else {
      stage.audio.kick(result === 'wall' || result === 'saved' ? 0.35 : 0.1)
      stage.audio.groan()
    }
    stage.banner(WORDS[result], 1100)
    stage.set('now', score)
    stage.say(`Kick ${kick + 1} of ${KICKS}: ${SAID[result]} ${score} scored.`)
    win.setTimeout(next, 1500)
  }

  function take(shot) {
    if (!shot || flying || waiting || kick >= KICKS) return
    if (kick === 0) tally('freekick', 'play', win)
    const result = outcome(setup, shot)
    // Where the ball stops being the rules' flight: at the wall, in the
    // keeper's hands, or on past the goal line.
    const until = result === 'wall' ? WALL_AT : result === 'saved' ? 0.985 : 1
    const keeperX = acrossToWorld(setup.keeperX)
    const arrive = ballAt(setup, shot, 1)
    // The keeper goes for it: all the way for a save, short for a goal.
    const reach = result === 'saved' ? 1 : result === 'goal' ? 0.62 : 0.45
    const target = { x: clamp((arrive.x - keeperX) * reach, -3.2, 3.2), y: clamp(arrive.y, 0.3, 2.3) }
    const plan = Math.abs(target.x) < 0.5
      ? { kind: 'jump', start: FLIGHT * 0.5, duration: FLIGHT * 0.45, target }
      : { kind: 'dive', start: FLIGHT * 0.42, duration: FLIGHT * 0.55, target }
    flying = { shot, result, until, at: clock, plan, keeperX, landed: false }
    keys = null
    stage.prompt('')
    stage.audio.kick(0.5 + Math.min(0.5, shot.height / 2))
  }

  function restart() {
    kick = 0
    score = 0
    setup = kickSetup()
    flying = null
    waiting = false
    keys = null
    board.next()
    stage.endExtra.replaceChildren()
    stage.hideEnd()
    hud()
    stage.prompt('Swipe up from the ball')
  }

  stage = await openStage({
    name: 'Free kick challenge',
    hud: [{ key: 'now', label: 'scored' }, { key: 'kick', label: `of ${KICKS}` }],
    others: othersFor('freekick'),
    boards: boardsFrom(root),
    win,
    onPointer(type, x, y) {
      if (flying || waiting || kick >= KICKS) { swipe = null; return }
      if (type === 'down') {
        swipe = [{ x, y }]
        stage.fx.clearTrail()
      } else if (type === 'move' && swipe) {
        swipe.push({ x, y })
        if (swipe.length > 60) swipe.splice(1, 1)
        stage.fx.addTrail(x, y, win.performance.now())
      } else if (type === 'up' && swipe) {
        const shot = swipeToShot(swipe, setup, stage.size.width, stage.size.height)
        swipe = null
        take(shot)
      } else if (type === 'cancel') {
        swipe = null
      }
    },
    onKey(key) {
      if (stage.ended) { if (key === ' ' || key === 'Enter') restart(); return }
      if (flying || waiting) return
      keys ||= { aim: CENTRE, height: 0.5 }
      const move = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[key]
      if (move) {
        keys = { aim: clamp(keys.aim + move[0], 20, W - 20), height: clamp(keys.height + move[1], 0.05, 1.2) }
        stage.say(`Aim ${keys.aim < CENTRE - 20 ? 'left' : keys.aim > CENTRE + 20 ? 'right' : 'middle'}, ${keys.height > 0.75 ? 'high' : keys.height < 0.35 ? 'low' : 'half way up'}.`)
      } else if (key === ' ' || key === 'Enter') {
        take({ aim: Math.round(keys.aim), height: Math.round(keys.height * 100) / 100, bend: 0 })
      }
    },
  })
  if (!stage) return null

  board = createGoBoard({ game: 'freekick', root, win, say: stage.say })
  // The other side's keeper is in goal for a free kick.
  stage.setTeams({ keeper: stage.kits.awayKeeper, keeperLook: 2 })
  stage.again.addEventListener('click', restart)
  hud()
  stage.prompt('Swipe up from the ball')
  stage.say('Swipe up from the ball to take a free kick, or use the arrow keys to aim and Space to shoot.')

  stage.onFrame((dt, now, size) => {
    clock += dt
    const cam = cameraFor(setup, size.width, size.height)
    const keeperX = acrossToWorld(setup.keeperX)
    let ball = { x: acrossToWorld(setup.x0), y: BALL_R, z: Z0 }
    let pose = keeperPose(READY, -99)
    let holding = false
    let x = keeperX
    if (flying) {
      const age = clock - flying.at
      const t = age / FLIGHT
      x = flying.keeperX
      pose = keeperPose(flying.plan, age)
      if (t < flying.until) {
        ball = ballAt(setup, flying.shot, t)
      } else {
        if (!flying.landed) landed()
        const after = age - flying.until * FLIGHT
        const end = ballAt(setup, flying.shot, flying.until)
        if (flying.result === 'saved') {
          holding = true
          ball = { x: x + pose.hands.x, y: Math.max(BALL_R, pose.hands.y), z: KEEPER_Z + 0.2 }
        } else if (flying.result === 'wall') {
          // Off the wall: back towards the kicker and down.
          ball = { x: end.x, y: Math.max(BALL_R, end.y - 4.9 * after * after), z: end.z + Math.min(2.2, after * 3.2) }
        } else if (flying.result === 'goal') {
          // Into the net, and down.
          ball = { x: end.x, y: Math.max(BALL_R, end.y - 4.9 * after * after), z: end.z - Math.min(1.1, after * 6) }
        } else {
          // Wide or over: on past the goal.
          ball = ballAt(setup, flying.shot, t)
          ball.y = Math.max(BALL_R, ball.y)
        }
      }
    }
    const keeper = { ...pose, feet: { ...pose.feet, x: pose.feet.x + x }, hands: { ...pose.hands, x: pose.hands.x + x } }
    const aim = keys && !flying ? { x: acrossToWorld(keys.aim), y: BALL_R + keys.height * GOAL.height, faint: false } : null
    return {
      view: cam, taker: null, keeper, holding, ball, aim,
      // The wall jumps as the ball comes, higher on the later kicks.
      wall: { x: acrossToWorld(setup.wallX), z: Z0 + (GOAL.lineZ - Z0) * WALL_AT, n: 5, jump: wallJump(flying ? (clock - flying.at) / FLIGHT : -1, setup.wallH) },
    }
  })
  return stage
}
