// Keepy-uppies in the stadium (games/stage.js): the same rules as the
// flat version (rules.js), with the ball drawn in the penalty shootout's
// 3D scene, with the goal and the crowd behind it.
//
// The rules count in the flat pitch's pixels. The stadium counts in
// metres. The ball is 26 pixels and 0.11 metres in radius, and every
// place is turned from one to the other by that.

import { W, H, R, GROUND, newGo, tap, keyTouch, step, readBest, keepBest } from './rules.js'
import { BALL_R } from '../shootout/physics.js'
import { openStage, boardsFrom } from '../games/stage.js'
import { tally } from '../games/count.js'
import { createGoBoard } from '../games/board.js'
import { othersFor } from '../../shared/games.js'

const M = BALL_R / R
const FIELD_W = W * M
const FIELD_H = H * M
const FOV = 50
const TAN = Math.tan((FOV * Math.PI) / 360)
export const MILESTONES = [10, 25, 50, 100, 150, 200]

// The camera for a screen: level, far enough back that the whole of the
// rules' pitch fits across and up, with the grass a little way above
// the bottom of the screen.
export function cameraFor(width, height) {
  const aspect = width / height
  const d = Math.max((FIELD_W / 2) / (TAN * aspect), (FIELD_H * 0.56) / TAN)
  const y = d * TAN * 0.74
  return { pos: { x: 0, y, z: d }, look: { x: 0, y, z: -11 }, fov: FOV, d }
}

// The rules' place for a point of the screen, and the stadium's place
// for a place in the rules.
export function screenToRules(cam, width, height, sx, sy) {
  const k = (height / 2) / TAN
  const xw = ((sx - width / 2) / k) * cam.d
  const yw = cam.pos.y - ((sy - height / 2) / k) * cam.d
  return { x: xw / M + W / 2, y: GROUND - R - (yw - BALL_R) / M }
}
export function rulesToWorld(x, y) {
  return { x: (x - W / 2) * M, y: BALL_R + (GROUND - R - y) * M, z: 0 }
}

export async function playKeepy3D(root, win = window) {
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let go = newGo()
  let best = readBest(store)
  let squash = 0
  let hinted = false
  let stage = null
  // The day's leaderboard, where the page has a ticket for it.
  let board = null

  function touched(next) {
    if (next === go) return
    const first = !go.started
    if (first) tally('keepy', 'play', win)
    go = next
    squash = 1
    stage.audio.kick(0.25)
    stage.big(String(go.score), true)
    stage.set('now', go.score)
    if (first || !hinted) { stage.prompt(''); hinted = true }
    if (MILESTONES.includes(go.score)) {
      stage.banner(`${go.score}!`)
      stage.cheer(2)
      stage.audio.chime()
      stage.audio.cheer()
      stage.confetti(50)
      stage.say(`${go.score} keepy-uppies.`)
    }
  }

  function restart() {
    go = newGo()
    board.next()
    stage.endExtra.replaceChildren()
    stage.hideEnd()
    stage.big('')
    stage.set('now', 0)
    stage.prompt('Tap the ball')
  }

  function dropped() {
    tally('keepy', 'done', win)
    const record = go.score > best
    best = keepBest(store, go.score)
    stage.set('best', best)
    if (record && go.score >= 3) {
      stage.cheer(3)
      stage.audio.roar()
      stage.confetti(140)
    } else if (go.score >= 3) {
      stage.audio.groan()
    }
    const times = go.score === 1 ? '1 keepy-uppy' : `${go.score} keepy-uppies`
    stage.showEnd({
      title: record && go.score >= 3 ? 'New best' : go.score === 0 ? 'Dropped it' : 'Good go',
      line: `${times}. Your best on this device is ${best}.`,
    })
    stage.say(`The ball is down. ${times}. Your best on this device is ${best}.`)
    stage.endExtra.replaceChildren()
    board.show(stage.endExtra, go.score)
  }

  stage = await openStage({
    name: 'Keepy-uppies',
    hud: [{ key: 'now', label: 'now' }, { key: 'best', label: 'best' }],
    others: othersFor('keepy'),
    boards: boardsFrom(root),
    win,
    onPoint(x, y) {
      if (go.over) return
      const cam = cameraFor(stage.size.width, stage.size.height)
      const p = screenToRules(cam, stage.size.width, stage.size.height, x, y)
      touched(tap(go, p.x, p.y))
    },
    onKey(key) {
      if (key !== ' ' && key !== 'Enter') return
      if (go.over) restart()
      else touched(keyTouch(go))
    },
  })
  if (!stage) return null

  board = createGoBoard({ game: 'keepy', root, win, say: stage.say })
  stage.again.addEventListener('click', restart)
  stage.set('best', best)
  stage.prompt('Tap the ball')
  stage.say('Tap the ball, or press Space, to keep it off the ground.')

  stage.onFrame((dt, now, size) => {
    const before = go
    go = step(go, dt)
    if (go.over && !before.over) dropped()
    squash = Math.max(0, squash - dt * 7)
    const cam = cameraFor(size.width, size.height)
    const ball = rulesToWorld(go.x, go.y)
    // Before the first touch the ball hangs and bobs, to be tapped.
    if (!go.started) ball.y += Math.sin(now * 3) * 0.03
    return { view: cam, taker: null, keeper: null, holding: false, ball, squash: stage.reduce ? 0 : squash, aim: null }
  })
  return stage
}
