// The free kick challenge on the page (server/render/games.js draws its
// place).
//
// The game is a canvas with the score, the kick being taken and the best
// score kept on this device. Nothing is sent anywhere. A kick is a swipe
// up from the ball: where it points is the aim, how long it is the
// height, and a swipe that curls bends the ball. On a keyboard the arrow
// keys move the aim and Space or Enter takes the kick. What happened to
// each kick is also said in words beside the canvas, for a screen
// reader.

import {
  W, H, KICKS, POST_LEFT, POST_RIGHT, BALL_R, WALL_AT, WALL_H, WALL_W,
  kickSetup, shotFromSwipe, flightAt, outcome, SAID, readBest, keepBest,
} from './rules.js'

// Where things stand on the drawing. The goal line is far and the ball
// near, so a bar height is drawn larger the nearer it is.
const GOAL_TOP = 78
const GOAL_LINE = 178
const BALL_Y = 430 // the goal line is REACH_UP (rules.js) above this
const lineAt = (t) => BALL_Y + (GOAL_LINE - BALL_Y) * t
const barAt = (t) => (GOAL_LINE - GOAL_TOP) * (1 + (1 - t) * 0.85)
const FLIGHT_MS = 850

export function startFreeKicks(root, win = window) {
  const canvas = root.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  if (!ctx) return
  const nowEl = root.querySelector('[data-fk-now]')
  const kickEl = root.querySelector('[data-fk-kick]')
  const bestEl = root.querySelector('[data-fk-best]')
  const said = root.querySelector('[data-fk-said]')
  const button = root.querySelector('[data-fk-start]')
  const store = (() => { try { return win.localStorage } catch { return null } })()
  const css = win.getComputedStyle(win.document.documentElement)
  const colour = (name, fallback) => css.getPropertyValue(name).trim() || fallback
  const deep = colour('--primary-deep', '#141f33')
  const primary = colour('--primary', '#22344f')
  const accent = colour('--accent', '#f0c05a')
  const ink = colour('--ink', '#0c1626')
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches

  const ratio = Math.min(win.devicePixelRatio || 1, 3)
  canvas.width = W * ratio
  canvas.height = H * ratio

  let score = 0
  let kick = 0
  let best = readBest(store)
  let setup = kickSetup()
  let flying = null   // { shot, result, start }
  let showing = null  // the result on screen between kicks
  let swipe = null    // the points of the swipe being made
  let aim = { x: 180, h: 0.6 } // the keyboard's aim
  let keys = false
  let frame = 0

  function figure(x, feet, tall, shirt, wide = 20) {
    const head = Math.min(tall * 0.15, wide * 0.46)
    ctx.fillStyle = shirt
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x - wide / 2, feet - tall + head * 1.7, wide, tall - head * 1.7, 5)
    else ctx.rect(x - wide / 2, feet - tall + head * 1.7, wide, tall - head * 1.7)
    ctx.fill()
    ctx.fillStyle = '#e8b48f'
    ctx.beginPath()
    ctx.arc(x, feet - tall + head, head, 0, Math.PI * 2)
    ctx.fill()
  }

  function ball(x, y, r) {
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = ink
    ctx.lineWidth = Math.max(1.5, r * 0.18)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
    ctx.fill()
  }

  function draw(time = 0) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, deep)
    sky.addColorStop(0.42, primary)
    sky.addColorStop(1, deep)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    // The pitch's lines.
    ctx.strokeStyle = '#ffffff30'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, GOAL_LINE)
    ctx.lineTo(W, GOAL_LINE)
    ctx.stroke()
    ctx.strokeRect(POST_LEFT - 46, GOAL_LINE, POST_RIGHT - POST_LEFT + 92, 96)
    // The goal: its net, then its posts and bar.
    ctx.fillStyle = '#ffffff14'
    ctx.fillRect(POST_LEFT, GOAL_TOP, POST_RIGHT - POST_LEFT, GOAL_LINE - GOAL_TOP)
    ctx.strokeStyle = '#ffffff26'
    ctx.lineWidth = 1
    for (let x = POST_LEFT + 20; x < POST_RIGHT; x += 20) { ctx.beginPath(); ctx.moveTo(x, GOAL_TOP); ctx.lineTo(x, GOAL_LINE); ctx.stroke() }
    for (let y = GOAL_TOP + 20; y < GOAL_LINE; y += 20) { ctx.beginPath(); ctx.moveTo(POST_LEFT, y); ctx.lineTo(POST_RIGHT, y); ctx.stroke() }
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(POST_LEFT, GOAL_LINE)
    ctx.lineTo(POST_LEFT, GOAL_TOP)
    ctx.lineTo(POST_RIGHT, GOAL_TOP)
    ctx.lineTo(POST_RIGHT, GOAL_LINE)
    ctx.stroke()

    // Where the ball is in its flight, if it is flying.
    let t = 0
    let at = { x: setup.x0, h: 0 }
    if (flying) {
      const stop = flying.result === 'wall' ? WALL_AT : 1
      t = Math.min(stop, ((time - flying.start) / FLIGHT_MS) || 0)
      at = flightAt(setup, flying.shot, t)
    }
    // The keeper, who goes toward a shot on target.
    let keeperX = setup.keeperX
    if (flying && flying.result !== 'wall') {
      const lean = flying.result === 'saved' ? 1 : 0.55
      keeperX += (Math.max(POST_LEFT + 14, Math.min(POST_RIGHT - 14, flying.shot.aim)) - setup.keeperX) * Math.min(1, t * 1.3) * lean
    }
    figure(keeperX, GOAL_LINE, (GOAL_LINE - GOAL_TOP) * 0.78, '#ff7a1a', 26)

    const wallFeet = lineAt(WALL_AT)
    const wallTall = (setup.wallH ?? WALL_H) * barAt(WALL_AT)
    const drawWall = () => { for (let i = 0; i < 4; i++) figure(setup.wallX - WALL_W / 2 + 13 + i * (WALL_W - 26) / 3, wallFeet, wallTall, '#f4f4f2', 25) }
    const drawBall = () => {
      const y = lineAt(t) - at.h * barAt(t)
      const r = BALL_R * (1 + (1 - t) * 0.75)
      ctx.fillStyle = 'rgba(0,0,0,.28)'
      ctx.beginPath()
      ctx.ellipse(at.x, lineAt(t) + 2, r * 0.9, r * 0.32, 0, 0, Math.PI * 2)
      ctx.fill()
      ball(at.x, y, r)
    }
    // The ball is in front of the wall until it reaches it, and behind
    // it after.
    if (t < WALL_AT) { drawWall(); drawBall() } else { drawBall(); drawWall() }

    // The swipe as it is made, and the keyboard's aim when it is in use.
    if (swipe && swipe.length > 1) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.setLineDash([2, 9])
      ctx.beginPath()
      swipe.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (keys && !flying && !showing && kick < KICKS) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(aim.x, GOAL_LINE - aim.h * (GOAL_LINE - GOAL_TOP), 11, 0, Math.PI * 2)
      ctx.stroke()
    }
    // What happened, and what to do.
    const words = showing ? SAID[showing].toUpperCase().replace(/[.!]$/, '') : (kick === 0 && !flying ? 'SWIPE UP FROM THE BALL' : null)
    if (words) {
      ctx.font = `800 ${showing ? 40 : 24}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = showing === 'goal' ? accent : '#fff'
      ctx.fillText(words, W / 2, showing ? 260 : 390)
    }
  }

  function show() {
    nowEl.textContent = String(score)
    kickEl.textContent = String(Math.min(kick + 1, KICKS))
    bestEl.textContent = String(best)
  }

  function next() {
    showing = null
    if (kick >= KICKS) {
      const record = score > best
      best = keepBest(store, score)
      show()
      said.textContent = `${score} of ${KICKS} scored${record ? ', your best yet' : ''}. Best on this device: ${best}.`
      button.hidden = false
      button.textContent = 'Play again'
      draw()
      return
    }
    setup = kickSetup(Math.random, kick)
    aim = { x: 180, h: 0.6 }
    show()
    draw()
  }

  function landed() {
    const result = flying.result
    flying = null
    showing = result
    if (result === 'goal') score++
    kick++
    nowEl.textContent = String(score)
    said.textContent = `Kick ${kick} of ${KICKS}: ${SAID[result]} ${score} scored.`
    draw()
    win.setTimeout(next, reduce ? 900 : 1100)
  }

  function loop(time) {
    if (!flying) return
    if (!flying.start) flying.start = time
    draw(time)
    const stop = flying.result === 'wall' ? WALL_AT : 1
    if ((time - flying.start) / FLIGHT_MS >= stop) return landed()
    frame = win.requestAnimationFrame(loop)
  }

  function take(shot) {
    if (!shot || flying || showing || kick >= KICKS) return
    flying = { shot, result: outcome(setup, shot), start: 0 }
    frame = win.requestAnimationFrame(loop)
  }

  const point = (e) => {
    const box = canvas.getBoundingClientRect()
    return { x: ((e.clientX - box.left) / box.width) * W, y: ((e.clientY - box.top) / box.height) * H }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (flying || showing || kick >= KICKS) return
    e.preventDefault()
    keys = false
    canvas.setPointerCapture?.(e.pointerId)
    swipe = [point(e)]
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!swipe) return
    swipe.push(point(e))
    if (swipe.length > 60) swipe.splice(1, 1)
    draw()
  })
  const release = () => {
    if (!swipe) return
    const shot = shotFromSwipe(swipe, setup.x0)
    swipe = null
    if (shot) take(shot)
    else draw()
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', () => { swipe = null; draw() })
  canvas.addEventListener('keydown', (e) => {
    const move = { ArrowLeft: [-14, 0], ArrowRight: [14, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[e.key]
    if (move) {
      e.preventDefault()
      keys = true
      aim = { x: Math.max(40, Math.min(W - 40, aim.x + move[0])), h: Math.max(0.05, Math.min(1.2, aim.h + move[1])) }
      draw()
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      keys = true
      take({ aim: aim.x, height: Math.round(aim.h * 100) / 100, bend: 0 })
    }
  })
  button.addEventListener('click', () => {
    win.cancelAnimationFrame(frame)
    score = 0
    kick = 0
    flying = null
    showing = null
    button.hidden = true
    said.textContent = 'Swipe up from the ball to take the first kick.'
    setup = kickSetup()
    show()
    draw()
    canvas.focus({ preventScroll: true })
  })
  win.document.fonts?.ready.then(() => draw(), () => {})
  show()
  draw()
}
