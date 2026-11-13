// Keepy-uppies on the page (server/render/games.js draws its place).
//
// The game is a canvas with a Play button, a count and the best count
// kept on this device. Nothing is sent anywhere. It is played by tapping
// the ball, or with Space or Enter on a keyboard. The count is also said
// in words beside the canvas, for a screen reader.

import { W, H, R, GROUND, newGo, tap, keyTouch, step, readBest, keepBest } from './rules.js'

export function startKeepy(root, win = window) {
  const canvas = root.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  if (!ctx) return
  const nowEl = root.querySelector('[data-ku-now]')
  const bestEl = root.querySelector('[data-ku-best]')
  const said = root.querySelector('[data-ku-said]')
  const button = root.querySelector('[data-ku-start]')
  const store = (() => { try { return win.localStorage } catch { return null } })()
  const css = win.getComputedStyle(win.document.documentElement)
  const colour = (name, fallback) => css.getPropertyValue(name).trim() || fallback
  const deep = colour('--primary-deep', '#141f33')
  const primary = colour('--primary', '#22344f')
  const accent = colour('--accent', '#f0c05a')
  const ink = colour('--ink', '#0c1626')

  // Drawn sharp on any screen: the canvas holds more dots than it shows.
  const ratio = Math.min(win.devicePixelRatio || 1, 3)
  canvas.width = W * ratio
  canvas.height = H * ratio

  let go = newGo()
  let best = readBest(store)
  let spin = 0
  let last = 0
  let frame = 0
  bestEl.textContent = String(best)

  function draw() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, primary)
    sky.addColorStop(1, deep)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)
    // The count, large behind the ball.
    ctx.fillStyle = '#ffffff1f'
    ctx.font = '800 190px "Barlow Condensed", "Arial Narrow", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(go.score), W / 2, H * 0.42)
    // The ground.
    ctx.fillStyle = accent
    ctx.fillRect(0, GROUND, W, 4)
    ctx.fillStyle = '#ffffff14'
    ctx.fillRect(0, GROUND + 4, W, H - GROUND)
    // The ball's shadow, nearer and darker as it falls.
    const height = Math.max(0, GROUND - R - go.y)
    ctx.fillStyle = `rgba(0,0,0,${(0.34 - Math.min(height / 900, 0.26)).toFixed(2)})`
    ctx.beginPath()
    ctx.ellipse(go.x, GROUND + 2, R * (0.95 - Math.min(height / 1200, 0.5)), 5, 0, 0, Math.PI * 2)
    ctx.fill()
    // The ball.
    ctx.save()
    ctx.translate(go.x, go.y)
    ctx.rotate(spin)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
      ctx.lineTo(Math.cos(a) * R * 0.44, Math.sin(a) * R * 0.44)
    }
    ctx.closePath()
    ctx.fill()
    ctx.lineWidth = 2.5
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * R * 0.44, Math.sin(a) * R * 0.44)
      ctx.lineTo(Math.cos(a) * R * 0.96, Math.sin(a) * R * 0.96)
      ctx.stroke()
    }
    ctx.restore()
    // What to do, before the first touch and when the go is over.
    if (!go.started || go.over) {
      ctx.fillStyle = '#fff'
      ctx.font = '800 30px "Barlow Condensed", "Arial Narrow", sans-serif'
      ctx.fillText(go.over ? 'IT IS DOWN' : 'TAP THE BALL', W / 2, H * 0.64)
    }
  }

  function show() {
    nowEl.textContent = String(go.score)
    bestEl.textContent = String(best)
  }

  function ended() {
    const record = go.score > best
    best = keepBest(store, go.score)
    show()
    said.textContent = `${go.score} ${go.score === 1 ? 'keepy-uppy' : 'keepy-uppies'}${record && go.score > 0 ? ', your best yet' : ''}. Best on this device: ${best}.`
    button.hidden = false
    button.textContent = 'Play again'
  }

  function loop(time) {
    const dt = last ? (time - last) / 1000 : 0
    last = time
    const before = go
    go = step(go, dt)
    spin += go.vx * dt * 0.02
    draw()
    if (go.over && !before.over) return ended()
    if (go.started && !go.over) frame = win.requestAnimationFrame(loop)
  }

  function touched(next) {
    if (next === go) return
    const first = !go.started
    go = next
    show()
    if (first) {
      button.hidden = true
      said.textContent = 'Keep it up.'
      last = 0
      win.cancelAnimationFrame(frame)
      frame = win.requestAnimationFrame(loop)
    }
  }

  function fresh() {
    win.cancelAnimationFrame(frame)
    go = newGo()
    show()
    draw()
  }

  canvas.addEventListener('pointerdown', (e) => {
    const box = canvas.getBoundingClientRect()
    if (go.over) return
    e.preventDefault()
    touched(tap(go, ((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H))
  })
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (go.over) { fresh(); return }
    touched(keyTouch(go))
  })
  button.addEventListener('click', () => {
    fresh()
    button.hidden = true
    said.textContent = 'Tap the ball to start.'
    canvas.focus({ preventScroll: true })
  })
  // The page put away: the go waits, and the ball does not fall unseen.
  win.document.addEventListener('visibilitychange', () => {
    if (win.document.hidden) { win.cancelAnimationFrame(frame); last = 0 } else if (go.started && !go.over) frame = win.requestAnimationFrame(loop)
  })
  win.document.fonts?.ready.then(draw, () => {})
  draw()
}
