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

import { project } from '../shootout/camera.js'
import { BOARDS_Z, GOAL } from '../shootout/physics.js'
import { BOARD_COUNT, BOARD_W, boardCentre, drawTopSign } from '../shootout/boards.js'
import { mix } from '../shootout/colour.js'

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'
const COATS = ['#f0c05a', '#ffffff', '#c8102e', '#1e9e57', '#8fd6e8', '#2b2f3a']
const BULBS = ['#ff4d4d', '#3fe07a', '#ffd166', '#5cc8ff', '#ffffff']
const SIGN_Z = BOARDS_Z - 2.4 - 5 * 1.15 + 0.3

// paint(g, picture) draws the game: picture is what the game hands the
// stage each frame, with at (a point of the pitch on the screen), line,
// disc and shade (the brushes), width, height, colours, now and reduce.
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
    // Only what is in front of the camera can be drawn.
    const ahead = (z) => Math.min(z, cam.pos.z - 0.6)
    const quad = (pts, fill) => {
      g.fillStyle = fill
      g.beginPath()
      pts.forEach((p, i) => { const s = at(p); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y) })
      g.closePath()
      g.fill()
    }
    const line = (a, b, wide, colour) => {
      const p = at(a)
      const q = at(b)
      g.strokeStyle = colour
      g.lineCap = 'round'
      g.lineWidth = Math.max(1.5, wide * (p.scale + q.scale) / 2)
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke()
    }
    const disc = (p, r, colour, squash = 1) => {
      const s = at(p)
      g.fillStyle = colour
      g.beginPath(); g.ellipse(s.x, s.y, Math.max(1.5, r * s.scale), Math.max(1.5, r * s.scale * squash), 0, 0, Math.PI * 2); g.fill()
      return s
    }
    const shade = (p, r) => disc({ x: p.x, y: 0.01, z: p.z }, r, 'rgba(0,0,0,0.3)', 0.35)

    g.setTransform(ratio, 0, 0, ratio, 0, 0)
    // The night sky, down to the horizon, and the frosty grass below it.
    const horizon = at({ x: cam.pos.x, y: 0, z: -400 }).y
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
    for (let z = BOARDS_Z, i = 0; z < cam.pos.z - 1; z += 5.5, i++) {
      if (i % 2) continue
      quad([{ x: -60, y: 0, z }, { x: 60, y: 0, z }, { x: 60, y: 0, z: ahead(z + 5.5) }, { x: -60, y: 0, z: ahead(z + 5.5) }], '#3f8f5a')
    }

    // The stand and the crowd in it, who jump when there is something to cheer.
    const cheering = now < cheerUntil && !reduce
    const a = at({ x: -30, y: 1, z: BOARDS_Z - 2 })
    const b = at({ x: 30, y: 9.6, z: BOARDS_Z - 17 })
    g.fillStyle = mix(colours.deep, '#1c2230', 0.55)
    g.fillRect(a.x, b.y, b.x - a.x, a.y - b.y)
    const rows = 11
    const cols = 46
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = r * cols + c
        if (n % 9 === 4) continue
        const x = a.x + ((c + 0.5 + (r % 2) * 0.4) / cols) * (b.x - a.x)
        const lift = cheering && n % 3 ? Math.max(0, Math.sin(now * 9 + n)) * (a.y - b.y) * 0.02 : 0
        const y = a.y - ((r + 0.8) / rows) * (a.y - b.y) - lift
        const w = ((b.x - a.x) / cols) * 0.62
        g.fillStyle = n % 5 === 0 ? mix(colours.primary, '#ffffff', 0.35) : COATS[n % COATS.length]
        g.fillRect(x - w / 2, y, w, w * 1.1)
        g.fillStyle = ['#f1c7a5', '#d9a07a', '#a8714f', '#7a4b32'][n % 4]
        g.beginPath(); g.arc(x, y - w * 0.3, w * 0.42, 0, Math.PI * 2); g.fill()
      }
    }

    // The big sign across the stand.
    if (sign) {
      const tl = at({ x: -4.5, y: 7.95, z: SIGN_Z })
      const br = at({ x: 4.5, y: 5.45, z: SIGN_Z })
      g.save()
      g.translate(tl.x, tl.y)
      g.scale((br.x - tl.x) / 1152, (br.y - tl.y) / 320)
      drawTopSign(g, 1152, 320, sign, { colours, font: FONT })
      g.restore()
    }

    // The boards, with snow lying on them and a string of fairy lights.
    for (let i = 0; i < BOARD_COUNT; i++) {
      const x = boardCentre(i)
      const tl = at({ x: x - BOARD_W / 2, y: 0.955, z: BOARDS_Z })
      const br = at({ x: x + BOARD_W / 2, y: 0, z: BOARDS_Z })
      if (br.x < 0 || tl.x > width) continue
      const even = i % 2 === 0
      g.fillStyle = even ? colours.primary : colours.deep
      g.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
      g.fillStyle = even ? '#ffffff' : colours.accent
      g.font = `800 ${Math.max(8, (br.y - tl.y) * 0.56)}px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(names[i % names.length].toUpperCase(), (tl.x + br.x) / 2, (tl.y + br.y) / 2, (br.x - tl.x) * 0.9)
      g.fillStyle = '#f2f7ff'
      g.fillRect(tl.x, tl.y - 2, br.x - tl.x, 3.5)
      for (let k = 0; k < 8; k++) {
        g.globalAlpha = reduce ? 1 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now * 2.6 + (i * 8 + k) * 2.4))
        g.fillStyle = BULBS[(i * 8 + k) % BULBS.length]
        g.beginPath(); g.arc(tl.x + ((k + 0.5) / 8) * (br.x - tl.x), tl.y - 5, Math.max(1.4, (br.y - tl.y) * 0.07), 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
    }

    // The line the goal, the posts or the hoop stand on.
    line({ x: -34, y: 0, z: GOAL.lineZ }, { x: 34, y: 0, z: GOAL.lineZ }, 0.12, '#f4f7f2')

    paint(g, { ...state, at, line, disc, shade, quad, ahead, width, height, colours, now, reduce })

    // The snow, falling in front of it all. With reduced motion it hangs still.
    g.fillStyle = '#ffffff'
    const wind = state.wind || 0
    for (const f of flakes) {
      const y = reduce ? f.y : (f.y + now * f.v) % 1
      const x = reduce ? f.x : (((f.x + Math.sin(now * 0.9 + f.p) * 0.012 + now * (0.006 + wind * 0.012)) % 1) + 1) % 1
      g.globalAlpha = 0.55 + (f.r - 1) * 0.2
      g.beginPath(); g.arc(x * width, y * height, f.r, 0, Math.PI * 2); g.fill()
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
