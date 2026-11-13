// Rugby conversion in the stadium (games/stage.js): the rules (rules.js)
// with the posts, the ball on its tee and the wind drawn in the 3D scene
// the other games share, dressed for rugby.
//
// The rules count in metres from the posts' line. The stadium counts in
// metres too, with the posts' line where the football goal's is, so a
// place in one is a place in the other.

import {
  KICKS, POSTS, BALL_R, kickSetup, shotFromSwipe, ballAt, crossing, outcome, metresFor, SAID, readBest, keepBest,
} from './rules.js'
import { GOAL } from '../shootout/physics.js'
import { project } from '../shootout/camera.js'
import { openStage, boardsFrom } from '../games/stage.js'
import { tally } from '../games/count.js'
import { createGoBoard } from '../games/board.js'
import { othersFor } from '../../shared/games.js'
import { paintRugby } from './paint.js'

const LINE = GOAL.lineZ
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// A place in the rules (across, up, and how far towards the posts) as a
// place in the stadium.
export const toWorld = (setup, p) => ({ x: p.x, y: BALL_R + p.y, z: LINE + setup.d - p.f })
export const teeAt = (setup) => ({ x: setup.x0, y: BALL_R, z: LINE + setup.d })

// The camera for a kick: behind the ball on the line from the middle of
// the posts, a little above it. It closes in a little for the long
// kicks, so the posts never get too small to aim at on a phone, and it
// is tilted so the ball is always in the same place: in the middle,
// near the foot of the screen (BALL_DOWN of the way from the middle to
// the foot), with the posts standing above it.
export const BALL_DOWN = 0.7
export function cameraFor(setup) {
  const tee = teeAt(setup)
  const away = Math.hypot(tee.x, setup.d) || 1
  const ux = tee.x / away
  const uz = setup.d / away
  const back = 7.5
  const high = 2.6
  const fov = clamp(56 - (setup.d - 18) * 0.875, 42, 56)
  const tilt = Math.atan(BALL_DOWN * Math.tan((fov * Math.PI) / 360)) - Math.atan((high - BALL_R) / back)
  return {
    pos: { x: tee.x + ux * back, y: high, z: tee.z + uz * back },
    look: { x: 0, y: high + Math.tan(tilt) * (away + back), z: LINE },
    fov,
  }
}

// A swipe on the screen as the rules read one: measured against where
// the ball and the posts are drawn.
export function swipeToShot(points, setup, width, height) {
  if (!points || points.length < 2) return null
  const cam = cameraFor(setup)
  const tee = project(cam, teeAt(setup), width, height)
  const left = project(cam, { x: -POSTS.halfWidth, y: POSTS.bar, z: LINE }, width, height)
  const right = project(cam, { x: POSTS.halfWidth, y: POSTS.bar, z: LINE }, width, height)
  const across = (right.x - left.x) / (POSTS.halfWidth * 2)
  const up = tee.y - (left.y + right.y) / 2
  const from = (tee.x - (left.x + right.x) / 2) / across
  return shotFromSwipe(points, { across, up, from, tall: height })
}

// The wind in words, for the top of the screen and for a screen reader.
export function windWords(wind) {
  if (!wind) return 'No wind'
  return `Wind ${Math.abs(wind)} to the ${wind > 0 ? 'right' : 'left'}`
}

const WORDS = { over: 'YES!', short: 'SHORT', under: 'UNDER', wide: 'WIDE', post: 'POST!', bar: 'BAR!' }

export async function playRugby3D(root, win = window) {
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let best = readBest(store)
  let kick = 0
  let over = 0
  let metres = 0
  let setup = kickSetup(Math.random, 0)
  let flying = null
  let swipe = null
  let keys = null
  let waiting = false
  let stage = null
  let board = null
  let clock = 0
  let weak = false

  const hud = () => {
    stage.set('now', over)
    stage.set('kick', Math.min(kick + 1, KICKS))
    stage.note(windWords(setup.wind), setup.wind)
  }

  function finish() {
    tally('rugby', 'done', win)
    const record = over > best
    best = keepBest(store, over)
    if (record || over >= 4) {
      stage.audio.roar()
      stage.cheer(3)
      stage.confetti(140)
    }
    stage.note('')
    stage.showEnd({
      title: over === KICKS ? 'Five from five' : record ? 'New best' : over >= 3 ? 'Good kicking' : 'Full time',
      line: `${over} of ${KICKS} over, from ${metres} metres in all. Your best on this device is ${best}.`,
    })
    const prize = stage.prize('rugby', over)
    stage.say(`${over} of ${KICKS} over, from ${metres} metres in all. Best on this device: ${best}. ${prize}`)
    stage.endExtra.replaceChildren()
    board.show(stage.endExtra, metres)
  }

  function next() {
    flying = null
    waiting = false
    kick += 1
    if (kick >= KICKS) { finish(); return }
    setup = kickSetup(Math.random, kick)
    keys = null
    hud()
    // A kick that did not get there is told how to kick harder.
    stage.prompt(weak ? 'A longer swipe kicks harder' : setup.wind ? 'Mind the wind' : 'Swipe up from the ball')
    weak = false
    stage.say(`Kick ${kick + 1} of ${KICKS}: ${setup.d} metres out. ${windWords(setup.wind)}.`)
  }

  function landed() {
    const result = flying.result
    flying.landed = true
    waiting = true
    if (result === 'over') {
      over += 1
      metres += metresFor(setup)
      stage.audio.chime()
      stage.audio.cheer()
      stage.cheer(2)
      stage.confetti(40)
    } else {
      if (result === 'post' || result === 'bar') stage.audio.clang()
      stage.audio.groan()
      weak = result === 'short' || result === 'under'
    }
    stage.banner(WORDS[result], 1100)
    stage.set('now', over)
    stage.say(`Kick ${kick + 1} of ${KICKS}: ${SAID[result]} ${over} over.`)
    win.setTimeout(next, 1500)
  }

  function take(shot) {
    if (!shot || flying || waiting || kick >= KICKS) return
    if (kick === 0) tally('rugby', 'play', win)
    const result = outcome(setup, shot)
    const c = crossing(setup, shot)
    // How long the ball is followed: to the ground if it falls short, to
    // the posts if it hits them, and a little past them otherwise.
    const until = result === 'short' ? c.down : result === 'post' || result === 'bar' ? c.t : c.t + 0.35
    flying = { shot, result, until, cross: c.t, at: clock, landed: false }
    keys = null
    stage.prompt('')
    stage.audio.kick(0.5 + shot.power * 0.5)
  }

  function restart() {
    kick = 0
    over = 0
    metres = 0
    setup = kickSetup(Math.random, 0)
    flying = null
    waiting = false
    keys = null
    weak = false
    board.next()
    stage.endExtra.replaceChildren()
    stage.hideEnd()
    hud()
    stage.prompt('Swipe up from the ball')
  }

  stage = await openStage({
    name: 'Rugby conversion',
    sport: 'rugby',
    flat: paintRugby,
    hud: [{ key: 'now', label: 'over' }, { key: 'kick', label: `of ${KICKS}` }],
    others: othersFor('rugby'),
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
        if (shot) take(shot)
        else stage.prompt('Swipe up from the ball')
      } else if (type === 'cancel') {
        swipe = null
      }
    },
    onKey(key) {
      if (stage.ended) { if (key === ' ' || key === 'Enter') restart(); return }
      if (flying || waiting) return
      keys ||= { aim: 0, power: 0.7 }
      const move = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, 0.05], ArrowDown: [0, -0.05] }[key]
      if (move) {
        keys = { aim: clamp(keys.aim + move[0], -12, 12), power: clamp(keys.power + move[1], 0.1, 1) }
        const where = Math.abs(keys.aim) < 0.25 ? 'the middle of the posts' : `${Math.abs(keys.aim).toFixed(1)} metres ${keys.aim < 0 ? 'left' : 'right'} of the middle`
        stage.say(`Aim at ${where}, power ${Math.round(keys.power * 100)} in a hundred.`)
      } else if (key === ' ' || key === 'Enter') {
        take({ aim: keys.aim, power: keys.power, bend: 0 })
      }
    },
  })
  if (!stage) return null

  board = createGoBoard({ game: 'rugby', root, win, say: stage.say })
  stage.again.addEventListener('click', restart)
  hud()
  stage.prompt('Swipe up from the ball')
  stage.say(`Rugby conversion. Five kicks at the posts. Swipe up from the ball, or use the arrow keys to aim and Space to kick. Kick 1 of ${KICKS}: ${setup.d} metres out. ${windWords(setup.wind)}.`)

  stage.onFrame((dt) => {
    clock += dt
    const cam = cameraFor(setup)
    const tee = teeAt(setup)
    // On its tee the ball leans at the posts.
    const heading = Math.atan2(-setup.x0, setup.d)
    let ball = { ...tee, spin: 0.35, heading }
    if (flying) {
      const age = clock - flying.at
      const t = Math.min(age, flying.until)
      const p = ballAt(setup, flying.shot, t)
      ball = { ...toWorld(setup, p), spin: 0.35 + t * 9, heading }
      if (age >= flying.until) {
        if (!flying.landed) landed()
        const after = age - flying.until
        if (flying.result === 'post' || flying.result === 'bar') {
          // Off the woodwork: back towards the kicker and down.
          ball.y = Math.max(BALL_R, ball.y - 4.9 * after * after)
          ball.z += Math.min(3, after * 4)
        } else if (flying.result !== 'short') {
          // On it goes, and comes down beyond the posts.
          const on = ballAt(setup, flying.shot, age)
          ball = { ...toWorld(setup, on), spin: 0.35 + age * 9, heading }
        }
      }
    }
    // The keys' aim: a mark on the posts' line at the bar's height.
    const aim = keys && !flying ? { x: keys.aim, y: POSTS.bar + 1 + keys.power * 3, faint: false } : null
    return { view: cam, taker: null, keeper: null, holding: false, ball, aim, tee: flying ? null : tee, wind: setup.wind }
  })
  return stage
}
