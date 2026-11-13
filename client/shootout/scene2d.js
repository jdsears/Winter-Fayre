// The pitch drawn flat, on a canvas, for a browser with no WebGL: the
// same camera, goal, keeper, taker and ball as the 3D scene, projected
// by hand, so the rules and results are the same. The visitor taps
// where to shoot and where to dive (a swipe and the keys work too).

import { BALL_R, BOARDS_Z, GOAL, KEEPER_Z } from './physics.js'
import { cameraFor, project, screenGeometry, screenToAim } from './camera.js'
import { takerPose } from './poses.js'
import { mix } from './colour.js'
import { makeRng } from './rng.js'
import { SKINS, lookAt } from './looks.js'
import { loadBoardLogos, logoReady, logoBox, BOARD_W, BOARD_COUNT, boardCentre } from './boards.js'


export function createScene2D({ canvas, colours, kits, boards = [], boardLogos = {}, win = globalThis.window }) {
  const logoImages = loadBoardLogos(boardLogos, { win })
  const ctx = canvas.getContext('2d')
  let w = 1
  let h = 1
  let ratio = 1
  let teams = { taker: kits.home, keeper: kits.awayKeeper, number: '9' }
  let ripple = null
  let cheerUntil = -1
  let lastNow = 0
  const rnd = makeRng(20261110)
  const grassA = '#3f8f3a'
  const grassB = '#357f31'
  const crowd = []
  const crowdColours = [colours.primary, colours.accent, '#ffffff', colours.deep, '#c9ced8', '#2b2f3a', colours.primary]
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < 46; i++) {
      crowd.push({
        x: -19 + i * 0.84 + (row % 2) * 0.42 + rnd.range(-0.15, 0.15),
        y: 1.3 + row * 0.75,
        z: BOARDS_Z - 2.2 - row * 1.1,
        c: crowdColours[Math.floor(rnd() * crowdColours.length)],
        s: SKINS[Math.floor(rnd() * SKINS.length)],
        p: rnd() * Math.PI * 2,
      })
    }
  }

  function resize(width, height, dpr) {
    w = width
    h = height
    ratio = Math.min(2, dpr || 1)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  const P = (cam, x, y, z) => project(cam, { x, y, z }, w, h)

  function poly(cam, pts, close = false) {
    ctx.beginPath()
    pts.forEach(([x, y, z], i) => {
      const s = P(cam, x, y, z)
      if (i === 0) ctx.moveTo(s.x, s.y)
      else ctx.lineTo(s.x, s.y)
    })
    if (close) ctx.closePath()
  }

  function drawBackdrop(cam, now) {
    const horizon = P(cam, 0, 0, -60).y
    const sky = ctx.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, mix(colours.deep, '#000000', 0.35))
    sky.addColorStop(1, mix(colours.primary, '#ffffff', 0.12))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, horizon + 2)
    // The stand.
    ctx.fillStyle = mix(colours.deep, '#000000', 0.2)
    poly(cam, [[-30, 0, BOARDS_Z - 1], [30, 0, BOARDS_Z - 1], [30, 7, BOARDS_Z - 10], [-30, 7, BOARDS_Z - 10]], true)
    ctx.fill()
    const cheering = now < cheerUntil
    for (const p of crowd) {
      const bob = cheering ? Math.max(0, Math.sin(now * 9 + p.p)) * 0.35 : Math.sin(now * 1.3 + p.p) * 0.02
      const body = P(cam, p.x, p.y + bob, p.z)
      const r = Math.max(1.2, 0.26 * body.scale)
      ctx.fillStyle = p.c
      ctx.fillRect(body.x - r, body.y - r * 0.4, r * 2, r * 2.2)
      ctx.fillStyle = p.s
      ctx.beginPath()
      ctx.arc(body.x, body.y - r * 0.9, r * 0.62, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawPitch(cam) {
    const top = P(cam, 0, 0, -60).y
    ctx.fillStyle = grassA
    ctx.fillRect(0, top, w, h - top)
    for (let z = 12; z > -60; z -= 4) {
      if (Math.round(z / 4) % 2 === 0) continue
      const a = P(cam, 0, 0, z).y
      const b = P(cam, 0, 0, z - 4).y
      ctx.fillStyle = grassB
      ctx.fillRect(0, Math.min(a, b), w, Math.abs(a - b) + 0.5)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = Math.max(1.5, 0.12 * P(cam, 0, 0, -11).scale)
    poly(cam, [[-40, 0, GOAL.lineZ], [40, 0, GOAL.lineZ]])
    ctx.stroke()
    poly(cam, [[-9.16, 0, GOAL.lineZ], [-9.16, 0, GOAL.lineZ + 5.5], [9.16, 0, GOAL.lineZ + 5.5], [9.16, 0, GOAL.lineZ]])
    ctx.stroke()
    poly(cam, [[-20.16, 0, GOAL.lineZ], [-20.16, 0, GOAL.lineZ + 16.5], [20.16, 0, GOAL.lineZ + 16.5], [20.16, 0, GOAL.lineZ]])
    ctx.stroke()
    const arc = []
    for (let a = -0.93; a <= 0.93; a += 0.08) arc.push([Math.sin(a) * 9.15, 0, Math.cos(a) * 9.15 - 0])
    poly(cam, arc.filter(([, , z]) => z > 5.5))
    ctx.stroke()
    const spot = P(cam, 0, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(spot.x, spot.y, 0.16 * spot.scale, 0.06 * spot.scale, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawBoards(cam) {
    const names = boards.length ? boards : ['Winter Fayre']
    const width = BOARD_W
    for (let n = 0; n < BOARD_COUNT; n++) {
      const i = n - 4
      const x0 = boardCentre(n) - width / 2
      const a = P(cam, x0, 0.95, BOARDS_Z)
      const b = P(cam, x0 + width, 0, BOARDS_Z)
      const fill = (i + 4) % 2 === 0 ? colours.primary : colours.deep
      // A partner with a logo has a white board with the logo on it.
      const img = logoImages.get(names[(i + 4) % names.length].toLowerCase())
      if (logoReady(img)) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y)
        const box = logoBox(img, b.x - a.x, b.y - a.y)
        ctx.drawImage(img, a.x + box.x, a.y + box.y, box.w, box.h)
        continue
      }
      ctx.fillStyle = fill
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y)
      ctx.fillStyle = (i + 4) % 2 === 0 ? '#ffffff' : colours.accent
      const name = names[(i + 4) % names.length].toUpperCase()
      const size = Math.max(6, (b.y - a.y) * 0.62)
      ctx.font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, (a.x + b.x) / 2, (a.y + b.y) / 2, (b.x - a.x) * 0.9)
    }
  }

  function netOffset(x, y, now) {
    if (!ripple) return 0
    const age = now - ripple.at
    if (age > 1.6) {
      ripple = null
      return 0
    }
    const d2 = (x - ripple.x) ** 2 + (y - ripple.y) ** 2
    return ripple.amp * Math.exp(-d2 / 0.5) * Math.exp(-age * 3.2) * Math.cos(age * 18)
  }

  function drawNet(cam, now) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1
    const back = (y) => GOAL.lineZ - GOAL.post - (GOAL.depthBottom + (GOAL.depthTop - GOAL.depthBottom) * (y / GOAL.height))
    for (let x = -GOAL.halfWidth; x <= GOAL.halfWidth + 0.01; x += 0.36) {
      ctx.beginPath()
      for (let y = 0; y <= GOAL.height + 0.01; y += 0.2) {
        const s = P(cam, x, y, back(y) - netOffset(x, y, now))
        if (y === 0) ctx.moveTo(s.x, s.y)
        else ctx.lineTo(s.x, s.y)
      }
      ctx.stroke()
    }
    for (let y = 0; y <= GOAL.height + 0.01; y += 0.3) {
      ctx.beginPath()
      for (let x = -GOAL.halfWidth; x <= GOAL.halfWidth + 0.01; x += 0.3) {
        const s = P(cam, x, y, back(y) - netOffset(x, y, now))
        if (x === -GOAL.halfWidth) ctx.moveTo(s.x, s.y)
        else ctx.lineTo(s.x, s.y)
      }
      ctx.stroke()
    }
    for (const side of [-1, 1]) {
      const x = side * GOAL.halfWidth
      for (let y = 0; y <= GOAL.height + 0.01; y += 0.3) {
        poly(cam, [[x, y, GOAL.lineZ], [x, y, back(y)]])
        ctx.stroke()
      }
    }
  }

  function drawFrame(cam) {
    const s = P(cam, 0, 0, GOAL.lineZ).scale
    ctx.strokeStyle = '#ffffff'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(3, GOAL.post * 2 * s)
    poly(cam, [[-GOAL.halfWidth - GOAL.post, 0, GOAL.lineZ], [-GOAL.halfWidth - GOAL.post, GOAL.height + GOAL.post, GOAL.lineZ], [GOAL.halfWidth + GOAL.post, GOAL.height + GOAL.post, GOAL.lineZ], [GOAL.halfWidth + GOAL.post, 0, GOAL.lineZ]])
    ctx.stroke()
    ctx.lineCap = 'butt'
  }

  function line(cam, a, b, width, colour) {
    const p = P(cam, a.x, a.y, a.z)
    const q = P(cam, b.x, b.y, b.z)
    ctx.strokeStyle = colour
    ctx.lineWidth = Math.max(1.5, width * p.scale)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }

  function blob(cam, x, z, rx, alpha) {
    const s = P(cam, x, 0.01, z)
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, rx * s.scale, rx * 0.32 * s.scale, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // The keeper, from the physics' own body: legs, shirt, head and gloves
  // along the line from the feet to the hands.
  function drawKeeper(cam, pose) {
    const kit = teams.keeper
    const z = KEEPER_Z
    const f = pose.feet
    const core = pose.capsules[0]
    const top = pose.kind === 'ready' || pose.kind === 'set' ? { x: core.b.x, y: core.b.y } : pose.hands
    const at = (k) => ({ x: f.x + (top.x - f.x) * k, y: f.y + (top.y - f.y) * k, z })
    const standing = pose.kind === 'ready' || pose.kind === 'set'
    const hip = at(standing ? 0.45 : 0.36)
    const shoulder = at(standing ? 0.8 : 0.62)
    const head = at(standing ? 0.97 : 0.72)
    blob(cam, (f.x + top.x) / 2, z, 0.5, 0.25)
    line(cam, { ...f, z }, hip, 0.2, kit.shorts)
    line(cam, { x: f.x, y: f.y, z }, at(0.12), 0.18, kit.socks)
    line(cam, hip, shoulder, 0.42, kit.shirt)
    const arms = standing
      ? [pose.capsules[1]?.a, pose.capsules[1]?.b].filter(Boolean).map((p) => ({ ...p, z }))
      : [{ ...pose.hands, x: pose.hands.x - 0.12, z }, { ...pose.hands, x: pose.hands.x + 0.12, z }]
    for (const hand of arms) {
      line(cam, shoulder, hand, 0.13, kit.sleeve)
      const g = P(cam, hand.x, hand.y, z)
      ctx.fillStyle = kit.gloves || '#f6f6f6'
      ctx.beginPath()
      ctx.arc(g.x, g.y, Math.max(2, 0.1 * g.scale), 0, Math.PI * 2)
      ctx.fill()
    }
    const hd = P(cam, head.x, head.y, z)
    const keeperLook = lookAt(teams.keeperLook)
    const hr = Math.max(3, 0.13 * hd.scale)
    // A ponytail shows behind the head, for a look that has one.
    if (keeperLook.ponytail) {
      ctx.strokeStyle = keeperLook.hair
      ctx.lineWidth = Math.max(2, hr * 0.5)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(hd.x + hr * 0.7, hd.y - hr * 0.5)
      ctx.quadraticCurveTo(hd.x + hr * 1.7, hd.y - hr * 0.2, hd.x + hr * 1.5, hd.y + hr * 1.2)
      ctx.stroke()
    }
    ctx.fillStyle = keeperLook.skin
    ctx.beginPath()
    ctx.arc(hd.x, hd.y, hr, 0, Math.PI * 2)
    ctx.fill()
    if (keeperLook.ponytail) {
      ctx.fillStyle = keeperLook.hair
      ctx.beginPath()
      ctx.arc(hd.x, hd.y - hr * 0.12, hr * 1.04, Math.PI, 0)
      ctx.fill()
    }
  }

  // The taker, seen from behind, running in, with the tells: hips turned,
  // a glance, a lean back.
  function drawTaker(cam, taker, mode, now) {
    const kit = teams.taker
    const t = takerPose(taker, mode, now)
    const s = P(cam, t.x, 0, t.z)
    const k = s.scale
    blob(cam, t.x, t.z, 0.35, 0.3)
    const hipY = s.y - 0.88 * k - t.bob * k
    const shoulderY = hipY - 0.55 * k
    const lean = t.lean * 0.9 * k
    const twist = t.twist
    const halfHips = 0.17 * k
    // Legs: the kicking leg swings forward on the strike.
    const swing = Math.sin(t.stride) * 0.28 * t.run
    const legs = [
      { x: s.x - halfHips * 0.7, dy: swing },
      { x: s.x + halfHips * 0.7, dy: -swing - t.kick * 0.5 },
    ]
    for (const leg of legs) {
      const footY = s.y - leg.dy * k * 0.5
      const kneeY = hipY + (footY - hipY) * 0.5
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(2, 0.14 * k)
      ctx.strokeStyle = lookAt(teams.look).skin
      ctx.beginPath()
      ctx.moveTo(leg.x, hipY)
      ctx.lineTo(leg.x, kneeY)
      ctx.stroke()
      ctx.lineWidth = Math.max(2, 0.13 * k)
      ctx.strokeStyle = kit.socks
      ctx.beginPath()
      ctx.moveTo(leg.x, kneeY)
      ctx.lineTo(leg.x, footY)
      ctx.stroke()
      ctx.fillStyle = '#15161a'
      ctx.fillRect(leg.x - 0.07 * k, footY - 0.02 * k, 0.14 * k, 0.07 * k)
    }
    ctx.fillStyle = kit.shorts
    ctx.fillRect(s.x - halfHips * 1.3, hipY - 0.05 * k, halfHips * 2.6, 0.24 * k)
    // The shirt, with the shoulders turned by the twist.
    const sx = s.x + twist * 0.12 * k + lean * 0.1
    const width = 0.46 * k * (1 - Math.abs(twist) * 0.25)
    ctx.fillStyle = kit.shirt
    ctx.beginPath()
    ctx.moveTo(s.x - halfHips * 1.2, hipY)
    ctx.lineTo(sx - width / 2, shoulderY + lean * 0.4)
    ctx.lineTo(sx + width / 2, shoulderY + lean * 0.4)
    ctx.lineTo(s.x + halfHips * 1.2, hipY)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = kit.trim
    ctx.fillRect(sx - width / 2, shoulderY + lean * 0.4, width, 0.05 * k)
    ctx.fillStyle = kit.number || '#ffffff'
    ctx.font = `800 ${Math.max(8, 0.3 * k)}px "Barlow Condensed", "Arial Narrow", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(teams.number, (sx + s.x) / 2, (hipY + shoulderY) / 2 + lean * 0.2)
    // Arms swing with the run.
    ctx.strokeStyle = kit.sleeve
    ctx.lineWidth = Math.max(2, 0.1 * k)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(sx + (side * width) / 2, shoulderY + lean * 0.4 + 0.04 * k)
      ctx.lineTo(sx + side * (width / 2 + 0.12 * k), shoulderY + 0.5 * k - side * swing * 0.4 * k)
      ctx.stroke()
    }
    const headX = sx + t.head * 0.08 * k
    ctx.fillStyle = lookAt(teams.look).skin
    ctx.beginPath()
    ctx.arc(headX, shoulderY - 0.16 * k + lean * 0.3, 0.13 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = lookAt(teams.look).hair
    ctx.beginPath()
    ctx.arc(headX, shoulderY - 0.19 * k + lean * 0.3, 0.13 * k, Math.PI, 0)
    ctx.fill()
  }

  function drawBall(cam, b, now) {
    blob(cam, b.x, b.z, BALL_R * 1.4, Math.max(0.08, 0.35 - b.y * 0.08))
    const s = P(cam, b.x, b.y, b.z)
    const r = Math.max(2.5, BALL_R * s.scale)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#16181d'
    const spin = (b.z + b.x) * 3 + now * 0.2
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.arc(s.x + Math.cos(a) * r * 0.5, s.y + Math.sin(a) * r * 0.5, r * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  function drawAim(cam, aim) {
    const s = P(cam, aim.x, aim.y, GOAL.lineZ + 0.05)
    const r = Math.max(8, 0.24 * s.scale)
    ctx.strokeStyle = colours.accent
    ctx.globalAlpha = aim.faint ? 0.5 : 1
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.moveTo(s.x - r * 1.5, s.y)
    ctx.lineTo(s.x - r * 0.5, s.y)
    ctx.moveTo(s.x + r * 0.5, s.y)
    ctx.lineTo(s.x + r * 1.5, s.y)
    ctx.moveTo(s.x, s.y - r * 1.5)
    ctx.lineTo(s.x, s.y - r * 0.5)
    ctx.moveTo(s.x, s.y + r * 0.5)
    ctx.lineTo(s.x, s.y + r * 1.5)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function draw(state) {
    const now = state.now
    lastNow = now
    const cam = cameraFor(state.mode, w / h, { follow: state.follow, ball: state.ball, shake: state.shake })
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawBackdrop(cam, now)
    // The pitch first, then the boards that stand on it.
    drawPitch(cam)
    drawBoards(cam)
    const ball = state.ball
    const takerZ = takerPose(state.taker, state.mode, now).z
    drawNet(cam, now)
    if (ball.z < GOAL.lineZ - 0.1) drawBall(cam, ball, now)
    drawFrame(cam)
    const ballInFront = ball.z >= KEEPER_Z
    if (!ballInFront && ball.z >= GOAL.lineZ - 0.1) drawBall(cam, ball, now)
    drawKeeper(cam, state.keeper)
    if (state.aim) drawAim(cam, state.aim)
    if (ballInFront && ball.z < takerZ) {
      drawBall(cam, ball, now)
      drawTaker(cam, state.taker, state.mode, now)
    } else {
      drawTaker(cam, state.taker, state.mode, now)
      if (ballInFront) drawBall(cam, ball, now)
    }
  }

  return {
    kind: '2d',
    resize,
    setTeams(next) { teams = { ...teams, ...next } },
    geometry() { return screenGeometry('shoot', w, h) },
    tapToAim(x, y) { return screenToAim('shoot', w, h, x, y) },
    draw,
    ripple(p, strength = 1) { ripple = { x: p.x, y: p.y, amp: 0.25 + 0.45 * strength, at: lastNow } },
    celebrate(seconds) { cheerUntil = lastNow + seconds },
    dispose() {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 1
      canvas.height = 1
      void win
    },
  }
}
