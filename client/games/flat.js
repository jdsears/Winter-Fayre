// A flat stadium for the games of the stage (stage.js), drawn on a 2D
// canvas where the 3D will not run. It is given the same picture of the
// game each frame as the 3D scene is (the camera, the ball and the
// rest), puts every point on the screen with the camera both share
// (shootout/camera.js), and draws the winter night, the stand, the
// boards and the pitch. The game then paints its own posts and ball on
// top with the brushes it is handed.
//
// So a game plays the same without WebGL: the same rules, the same
// swipes, the same finish panel and leaderboard.
//
// The camera can stand anywhere and look any way, so everything drawn is
// first cut off at a little way in front of it (NEAR): what is behind
// the camera is never drawn.

import { project } from '../shootout/camera.js'
import { BOARDS_Z, GOAL } from '../shootout/physics.js'
import { BOARD_COUNT, BOARD_W, boardCentre, drawTopSign } from '../shootout/boards.js'
import { mix } from '../shootout/colour.js'

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'
const COATS = ['#f0c05a', '#ffffff', '#c8102e', '#1e9e57', '#8fd6e8', '#2b2f3a']
const SKINS = ['#f1c7a5', '#d9a07a', '#a8714f', '#7a4b32']
const BULBS = ['#ff4d4d', '#3fe07a', '#ffd166', '#5cc8ff', '#ffffff']
const SIGN_Z = BOARDS_Z - 2.4 - 5 * 1.15 + 0.3
export const NEAR = 0.45

const between = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })

// The part of a line from a to b that is in front of the camera, or null.
// depth(p) is how far in front of the camera a point is.
export function clipLine(a, b, depth, near = NEAR) {
  const da = depth(a)
  const db = depth(b)
  if (da < near && db < near) return null
  if (da >= near && db >= near) return [a, b]
  const cut = between(a, b, (near - da) / (db - da))
  return da < near ? [cut, b] : [a, cut]
}

// The part of a flat shape (its corners in order) that is in front of
// the camera: its corners in order, or none.
export function clipShape(corners, depth, near = NEAR) {
  const out = []
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    const da = depth(a)
    const db = depth(b)
    if (da >= near) out.push(a)
    if ((da >= near) !== (db >= near)) out.push(between(a, b, (near - da) / (db - da)))
  }
  return out.length >= 3 ? out : []
}

// paint(g, picture) draws the game: picture is what the game hands the
// stage each frame, with at (a point of the pitch on the screen), seen
// (whether a point is in front of the camera), line, disc, shade and
// quad (the brushes), width, height, colours, now and reduce.
export function createFlatView({ canvas, paint, colours, boards = [], sign = null, reduce = false }) {
  const g = canvas.getContext('2d')
  if (!g) return null
  let width = 1
  let height = 1
  let ratio = 1
  let cheerUntil = -1
  let lastNow = 0
  const names = boards.length ? boards : ['Winter Fayre']
  // Snow, as shares of the screen, so it falls the same at any size.
  const flakes = Array.from({ length: 80 }, (_, i) => ({ x: (i * 0.618034) % 1, y: (i * 0.381966) % 1, r: 1 + (i % 4) * 0.5, v: 0.05 + (i % 5) * 0.014, p: i * 1.3 }))

  function draw(state) {
    const now = state.now
    lastNow = now
    const cam = { pos: state.view.pos, look: state.view.look, fov: state.view.fov }
    const at = (p) => project(cam, p, width, height)
    // The way the camera looks, worked out by the first point it places.
    at(cam.look)
    const f = cam.basis.f
    const depth = (p) => (p.x - cam.pos.x) * f.x + (p.y - cam.pos.y) * f.y + (p.z - cam.pos.z) * f.z
    const seen = (p) => depth(p) >= NEAR

    const quad = (corners, fill) => {
      const pts = clipShape(corners, depth)
      if (!pts.length) return
      g.fillStyle = fill
      g.beginPath()
      pts.forEach((p, i) => { const s = at(p); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y) })
      g.closePath()
      g.fill()
    }
    const line = (a, b, wide, colour) => {
      const part = clipLine(a, b, depth)
      if (!part) return
      const p = at(part[0])
      const q = at(part[1])
      g.strokeStyle = colour
      g.lineCap = 'round'
      g.lineWidth = Math.min(height * 0.2, Math.max(1.5, wide * (p.scale + q.scale) / 2))
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke()
    }
    const disc = (p, r, colour, squash = 1) => {
      if (!seen(p)) return null
      const s = at(p)
      g.fillStyle = colour
      g.beginPath(); g.ellipse(s.x, s.y, Math.max(1.5, r * s.scale), Math.max(1.5, r * s.scale * squash), 0, 0, Math.PI * 2); g.fill()
      return s
    }
    const shade = (p, r) => disc({ x: p.x, y: 0.01, z: p.z }, r, 'rgba(0,0,0,0.3)', 0.35)
    // A flat thing that faces the camera's side of the pitch (a board, the
    // sign): its place on the screen as a box, or null when any of it is
    // behind the camera.
    const box = (topLeft, bottomRight) => {
      if (!seen(topLeft) || !seen(bottomRight) || !seen({ x: bottomRight.x, y: topLeft.y, z: bottomRight.z }) || !seen({ x: topLeft.x, y: bottomRight.y, z: topLeft.z })) return null
      const a = at(topLeft)
      const b = at(bottomRight)
      return b.x - a.x > 1 && b.y - a.y > 1 ? { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } : null
    }

    g.setTransform(ratio, 0, 0, ratio, 0, 0)
    // The night sky, down to the horizon, and the frosty grass below it.
    const level = Math.hypot(f.x, f.z) || 1
    const horizon = Math.min(height, Math.max(0, at({ x: cam.pos.x + (f.x / level) * 900, y: 0, z: cam.pos.z + (f.z / level) * 900 }).y))
    const sky = g.createLinearGradient(0, 0, 0, Math.max(1, horizon))
    sky.addColorStop(0, mix(colours.deep, '#000000', 0.55))
    sky.addColorStop(1, mix(colours.primary, '#bcd7f2', 0.35))
    g.fillStyle = sky
    g.fillRect(0, 0, width, height)
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.35 + (i % 4) * 0.15
      g.fillRect(((i * 0.754877) % 1) * width, ((i * 0.569840) % 1) * Math.max(0, horizon - 20) * 0.8, 1.6, 1.6)
    }
    g.globalAlpha = 1
    g.fillStyle = '#357e50'
    g.fillRect(0, horizon, width, height - horizon)
    for (let z = BOARDS_Z, i = 0; z < 60; z += 5.5, i++) {
      if (i % 2 === 0) quad([{ x: -70, y: 0, z }, { x: 70, y: 0, z }, { x: 70, y: 0, z: z + 5.5 }, { x: -70, y: 0, z: z + 5.5 }], '#3f8f5a')
    }

    // The stand, and the crowd in it, who jump when there is something to
    // cheer. It rises away from the pitch behind the boards.
    const cheering = now < cheerUntil && !reduce
    const foot = { y: 1, z: BOARDS_Z - 2 }
    const top = { y: 9.6, z: BOARDS_Z - 17 }
    quad([{ x: -30, ...foot }, { x: 30, ...foot }, { x: 30, ...top }, { x: -30, ...top }], mix(colours.deep, '#1c2230', 0.55))
    const rows = 11
    const cols = 46
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const n = r * cols + c
        if (n % 9 === 4) continue
        const k = (r + 0.6) / rows
        const seat = { x: -29 + ((c + 0.5 + (r % 2) * 0.4) / cols) * 58, y: foot.y + (top.y - foot.y) * k, z: foot.z + (top.z - foot.z) * k }
        if (!seen(seat)) continue
        const s = at(seat)
        if (s.x < -30 || s.x > width + 30) continue
        const lift = cheering && n % 3 ? Math.max(0, Math.sin(now * 9 + n)) * 0.4 * s.scale : 0
        const w = Math.max(2, 0.5 * s.scale)
        g.fillStyle = n % 5 === 0 ? mix(colours.primary, '#ffffff', 0.35) : COATS[n % COATS.length]
        g.fillRect(s.x - w / 2, s.y - w * 1.2 - lift, w, w * 1.2)
        g.fillStyle = SKINS[n % SKINS.length]
        g.beginPath(); g.arc(s.x, s.y - w * 1.5 - lift, w * 0.36, 0, Math.PI * 2); g.fill()
        // About one in four wears a Christmas hat.
        if (n % 4 === 1) {
          g.fillStyle = '#c8102e'
          g.beginPath(); g.moveTo(s.x - w * 0.36, s.y - w * 1.72 - lift); g.lineTo(s.x + w * 0.36, s.y - w * 1.72 - lift); g.lineTo(s.x + w * 0.1, s.y - w * 2.3 - lift); g.closePath(); g.fill()
        }
      }
    }

    // The big sign across the stand.
    if (sign) {
      const b = box({ x: -4.5, y: 7.95, z: SIGN_Z }, { x: 4.5, y: 5.45, z: SIGN_Z })
      if (b) {
        g.save()
        g.translate(b.x, b.y)
        g.scale(b.w / 1152, b.h / 320)
        drawTopSign(g, 1152, 320, sign, { colours, font: FONT })
        g.restore()
      }
    }

    // The boards, with snow lying on them and a string of fairy lights.
    for (let i = 0; i < BOARD_COUNT; i++) {
      const x = boardCentre(i)
      const b = box({ x: x - BOARD_W / 2, y: 0.955, z: BOARDS_Z }, { x: x + BOARD_W / 2, y: 0, z: BOARDS_Z })
      if (!b || b.x > width || b.x + b.w < 0) continue
      const even = i % 2 === 0
      g.fillStyle = even ? colours.primary : colours.deep
      g.fillRect(b.x, b.y, b.w, b.h)
      g.fillStyle = even ? '#ffffff' : colours.accent
      g.font = `800 ${Math.max(8, b.h * 0.56)}px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(names[i % names.length].toUpperCase(), b.x + b.w / 2, b.y + b.h / 2, b.w * 0.9)
      g.fillStyle = '#f2f7ff'
      g.fillRect(b.x, b.y - 2, b.w, 3.5)
      for (let k = 0; k < 8; k++) {
        g.globalAlpha = reduce ? 1 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now * 2.6 + (i * 8 + k) * 2.4))
        g.fillStyle = BULBS[(i * 8 + k) % BULBS.length]
        g.beginPath(); g.arc(b.x + ((k + 0.5) / 8) * b.w, b.y - 5, Math.max(1.4, b.h * 0.07), 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
    }

    // The line the goal, the posts or the hoop stand on (cricket has none).
    if (state.goalLine !== false) line({ x: -34, y: 0, z: GOAL.lineZ }, { x: 34, y: 0, z: GOAL.lineZ }, 0.12, '#f4f7f2')

    paint(g, { ...state, at, seen, line, disc, shade, quad, width, height, colours, now, reduce })

    // The snow, falling in front of it all. With reduced motion it hangs still.
    g.fillStyle = '#ffffff'
    const wind = state.wind || 0
    for (const flake of flakes) {
      const y = reduce ? flake.y : (flake.y + now * flake.v) % 1
      const x = reduce ? flake.x : (((flake.x + Math.sin(now * 0.9 + flake.p) * 0.012 + now * (0.006 + wind * 0.012)) % 1) + 1) % 1
      g.globalAlpha = 0.55 + (flake.r - 1) * 0.2
      g.beginPath(); g.arc(x * width, y * height, flake.r, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1
  }

  return {
    kind: '2d',
    resize(w, h, r) {
      width = w
      height = h
      ratio = Math.min(2, r || 1)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
    },
    setTeams() {},
    ripple() {},
    geometry() { return null },
    celebrate(seconds) { cheerUntil = lastNow + seconds },
    draw,
    dispose() {},
  }
}
