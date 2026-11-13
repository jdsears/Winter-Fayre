// Netball shot in the stadium (games/stage.js): the rules (rules.js)
// with the post, its ring and the ball drawn in the 3D scene the other
// games share, dressed for netball.
//
// The rules count in metres from under the ring, along the line to it
// and to the side of that line. The stadium counts in metres too, with
// the post where the middle of the football goal is.

import { SECONDS, RING, BALL_R, HANDS, FLIGHT, G, spotFor, shotFromSwipe, ballAt, outcome, missBy, SAID, readBest, keepBest } from './rules.js'
import { GOAL } from '../shootout/physics.js'
import { openStage, boardsFrom } from '../games/stage.js'
import { tally } from '../games/count.js'
import { createGoBoard } from '../games/board.js'
import { othersFor } from '../../shared/games.js'
import { paintNetball } from './paint.js'

// The middle of the ring, held out in front of the post.
export const HOOP = { x: 0, y: RING.height, z: GOAL.lineZ + 0.24 }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Where the shooter stands for a spot: its distance out from under the
// ring, turned that far round the goal circle.
export const shooterAt = (spot) => ({ x: HOOP.x + Math.sin(spot.turn) * spot.d, z: HOOP.z + Math.cos(spot.turn) * spot.d })

// A place in the rules (along the line to the ring, to the side of it,
// and how high) as a place in the stadium.
export function toWorld(spot, p) {
  const from = shooterAt(spot)
  // Towards the ring, and to the right of that as the shooter sees it.
  const ux = -Math.sin(spot.turn)
  const uz = -Math.cos(spot.turn)
  return { x: from.x + ux * p.along - uz * p.side, y: p.y, z: from.z + uz * p.along + ux * p.side }
}

// The camera for a shot: behind the ball on the line from the ring, at
// eye height, tilted so the ball is always in the same place near the
// foot of the screen (BALL_DOWN of the way from the middle to the foot)
// with the ring above it.
export const BALL_DOWN = 0.72
export function cameraFor(spot) {
  const from = shooterAt(spot)
  const back = 2.2
  const high = 1.75
  const fov = 60
  const tilt = Math.atan(BALL_DOWN * Math.tan((fov * Math.PI) / 360)) - Math.atan((high - HANDS) / back)
  return {
    pos: { x: from.x + Math.sin(spot.turn) * back, y: high, z: from.z + Math.cos(spot.turn) * back },
    look: { x: HOOP.x, y: high + Math.tan(tilt) * (spot.d + back), z: HOOP.z },
    fov,
  }
}

// What a miss is told, to do better with the next one.
const HINTS = { short: 'A longer flick goes further', long: 'A shorter flick', wide: 'Flick straight at the ring', rim: 'So close' }

export async function playNetball3D(root, win = window) {
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let best = readBest(store)
  let goals = 0
  let spot = spotFor(0)
  let shot = null
  let swipe = null
  let keys = null
  let started = false
  let over = false
  let left = SECONDS
  let stage = null
  let board = null
  let clock = 0

  const hud = () => {
    stage.set('now', goals)
    stage.set('left', Math.max(0, Math.ceil(left)))
  }

  function finish() {
    over = true
    shot = null
    tally('netball', 'done', win)
    const record = goals > best
    best = keepBest(store, goals)
    hud()
    if ((record && goals >= 3) || goals >= 8) {
      stage.audio.roar()
      stage.cheer(3)
      stage.confetti(140)
    } else {
      stage.audio.whistle()
    }
    stage.prompt('')
    const count = goals === 1 ? '1 goal' : `${goals} goals`
    stage.showEnd({
      title: record && goals >= 3 ? 'New best' : goals >= 8 ? 'Sharp shooting' : goals >= 4 ? 'Good shooting' : 'Time',
      line: `${count} in ${SECONDS} seconds. Your best on this device is ${best}.`,
    })
    const prize = stage.prize('netball', goals)
    stage.say(`Time. ${count} in ${SECONDS} seconds. Your best on this device is ${best}. ${prize}`)
    stage.endExtra.replaceChildren()
    board.show(stage.endExtra, goals)
  }

  // The shot in the air has come down to the ring's height.
  function arrived() {
    shot.arrived = true
    const result = shot.result
    if (result === 'goal') {
      goals += 1
      stage.set('now', goals)
      stage.audio.swish(0.8)
      stage.audio.chime()
      if (goals % 5 === 0) {
        stage.banner(`${goals}!`, 900)
        stage.audio.cheer()
        stage.cheer(2)
        stage.confetti(40)
      }
      stage.prompt('')
    } else {
      if (result === 'rim') stage.audio.clang()
      stage.prompt(HINTS[result])
    }
    stage.say(`${SAID[result]} ${goals} ${goals === 1 ? 'goal' : 'goals'}.`)
  }

  // The ball is back in the hands: from a new place after a goal.
  function nextBall() {
    const scored = shot?.result === 'goal'
    shot = null
    if (left <= 0) { finish(); return }
    if (scored) {
      spot = spotFor(goals)
      keys = null
      stage.say(`From ${spot.d} metres.`)
    }
  }

  function take(next) {
    if (!next || shot || over) return
    if (!started) {
      started = true
      tally('netball', 'play', win)
    }
    shot = { ...next, result: outcome(spot, next), miss: missBy(spot, next), at: clock, arrived: false }
    stage.prompt('')
    stage.audio.kick(0.2)
  }

  function restart() {
    goals = 0
    spot = spotFor(0)
    shot = null
    keys = null
    started = false
    over = false
    left = SECONDS
    board.next()
    stage.endExtra.replaceChildren()
    stage.hideEnd()
    hud()
    stage.prompt('Flick the ball up')
  }

  stage = await openStage({
    name: 'Netball shot',
    sport: 'netball',
    flat: paintNetball,
    hud: [{ key: 'now', label: 'goals' }, { key: 'left', label: 'seconds' }],
    others: othersFor('netball'),
    boards: boardsFrom(root),
    win,
    onPointer(type, x, y) {
      if (shot || over) { swipe = null; return }
      if (type === 'down') {
        swipe = [{ x, y }]
        stage.fx.clearTrail()
      } else if (type === 'move' && swipe) {
        swipe.push({ x, y })
        if (swipe.length > 60) swipe.splice(1, 1)
        stage.fx.addTrail(x, y, win.performance.now())
      } else if (type === 'up' && swipe) {
        const next = shotFromSwipe(swipe, { tall: stage.size.height })
        swipe = null
        take(next)
      } else if (type === 'cancel') {
        swipe = null
      }
    },
    onKey(key) {
      if (stage.ended) { if (key === ' ' || key === 'Enter') restart(); return }
      if (shot || over) return
      keys ||= { reach: 2, aim: 0 }
      const move = { ArrowLeft: [0, -0.04], ArrowRight: [0, 0.04], ArrowUp: [0.1, 0], ArrowDown: [-0.1, 0] }[key]
      if (move) {
        keys = { reach: Math.round(clamp(keys.reach + move[0], 0.6, 4.8) * 10) / 10, aim: Math.round(clamp(keys.aim + move[1], -0.6, 0.6) * 100) / 100 }
        stage.say(`A shot of ${keys.reach} metres, ${Math.abs(keys.aim) < 0.02 ? 'straight' : keys.aim < 0 ? 'to the left' : 'to the right'}. The ring is ${spot.d} metres away.`)
      } else if (key === ' ' || key === 'Enter') {
        take({ reach: keys.reach, aim: keys.aim })
      }
    },
  })
  if (!stage) return null

  board = createGoBoard({ game: 'netball', root, win, say: stage.say })
  stage.again.addEventListener('click', restart)
  hud()
  stage.prompt('Flick the ball up')
  stage.say(`Netball shot. ${SECONDS} seconds to score as many goals as you can. Flick the ball up at the ring, or use the arrow keys and Space. The ring is ${spot.d} metres away.`)

  stage.onFrame((dt, now) => {
    clock += dt
    if (started && !over) {
      const was = Math.ceil(left)
      left -= dt
      if (Math.ceil(left) !== was) stage.set('left', Math.max(0, Math.ceil(left)))
      // Time is up: a ball in the air still counts when it comes down.
      if (left <= 0 && !shot) finish()
    }
    const cam = cameraFor(spot)
    const hands = toWorld(spot, { along: 0, side: 0, y: HANDS })
    // In the hands the ball bobs a little, ready to be flicked.
    let ball = { ...hands, y: HANDS + (stage.reduce || over ? 0 : Math.sin(now * 3) * 0.015) }
    if (shot) {
      const t = clock - shot.at
      if (t < FLIGHT) {
        ball = toWorld(spot, ballAt(shot, t))
      } else {
        if (!shot.arrived) arrived()
        const after = t - FLIGHT
        const fall = Math.sqrt(2 * G * (ballAt(shot, 0.7 * FLIGHT).y - RING.height) + 0.01)
        if (shot.result === 'goal') {
          // Down through the ring and the net.
          ball = { x: HOOP.x, y: Math.max(BALL_R, RING.height - fall * 0.55 * after - 0.5 * G * after * after), z: HOOP.z }
        } else if (shot.result === 'rim') {
          // Off the ring: up a little and away the way it was going.
          const out = Math.min(1.2, after * 1.6)
          const here = toWorld(spot, { along: spot.d + shot.miss.along * (1 + out), side: shot.miss.side * (1 + out), y: 0 })
          ball = { ...here, y: Math.max(BALL_R, RING.height + 1.9 * after - 0.5 * G * after * after) }
        } else {
          // Past the ring, and down to the grass.
          ball = toWorld(spot, ballAt(shot, t))
        }
        if (after > (shot.result === 'goal' ? 0.42 : 0.5)) nextBall()
      }
    }
    return { view: cam, taker: null, keeper: null, holding: false, ball, aim: null, hoop: HOOP }
  })
  return stage
}
