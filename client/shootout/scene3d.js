// The stadium in 3D, on three.js, shared by the penalty shootout and the
// games of the stage (games/stage.js). A striped pitch with its box and
// spot, a goal whose net catches the ball and ripples, boards with the
// fayre's name on them, a low-poly crowd in the site's colours, and the
// taker and keeper in kit.
//
// It is a winter night with a splash of Christmas: stars, falling snow,
// snow lying on the boards, a string of fairy lights, a Christmas tree
// either side of the goal and Christmas hats in the crowd and on the
// keeper. With reduced motion the snow hangs still and the lights do
// not twinkle.
//
// It draws what the game hands it each frame (game.js): the ball's place
// from the flight's path, the keeper's body from the physics' pose and
// the taker from the shared run up (poses.js), so the 2D version and the
// rules agree with every frame. Light on a phone: the pixel ratio is
// capped at 2, the crowd is two instanced meshes, and everything is
// disposed of when the game closes.

import {
  BoxGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group,
  HemisphereLight, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  Object3D, OctahedronGeometry, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Quaternion, RepeatWrapping, RingGeometry, Scene,
  SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, BufferAttribute, BufferGeometry, Euler,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BALL_R, BOARDS_Z, GOAL, KEEPER_Z } from './physics.js'
import { cameraFor, screenGeometry } from './camera.js'
import { takerPose, smooth } from './poses.js'
import { mix } from './colour.js'
import { makeRng } from './rng.js'
import { LOOKS, SKINS, lookAt } from './looks.js'
import { prefersReducedMotion } from './motion.js'
import { loadBoardLogos, logoReady, logoBox, BOARD_W, BOARD_COUNT, boardCentre, drawTopSign, loadTopSign } from './boards.js'

const PI = Math.PI
// three.js counts light a factor of pi higher than the lighting these
// numbers were set by, as the site's own scene does.
const LIGHT = PI
const lerp = (a, b, k) => a + (b - a) * k
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function canvasTexture(doc, w, h, draw, { repeat = null, anisotropy = 4 } = {}) {
  const c = doc.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = anisotropy
  if (repeat) {
    t.wrapS = RepeatWrapping
    t.wrapT = RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  t.userData.redraw = () => {
    draw(c.getContext('2d'), w, h)
    t.needsUpdate = true
  }
  return t
}

function placed(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(1, 1, 1))
  return geometry.applyMatrix4(m)
}

// The football: the site's own ball, a sphere with twelve pentagon caps
// pulled into shape, here merged into one mesh per colour.
function makeBall() {
  const group = new Group()
  group.add(new Mesh(new SphereGeometry(BALL_R, 28, 20), new MeshLambertMaterial({ color: 0xffffff })))
  const cap = new SphereGeometry(1.012, 20, 3, 0, PI * 2, 0, 0.36)
  const pa = cap.attributes.position
  const sec = (PI * 2) / 5
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i)
    const y = pa.getY(i)
    const z = pa.getZ(i)
    const th = Math.acos(Math.max(-1, Math.min(1, y / 1.012)))
    const ph = Math.atan2(z, x)
    const loc = (((ph % sec) + sec) % sec) - sec / 2
    const th2 = ((th * Math.cos(PI / 5)) / Math.cos(loc)) * 1.12
    pa.setXYZ(i, 1.012 * Math.sin(th2) * Math.cos(ph), 1.012 * Math.cos(th2), 1.012 * Math.sin(th2) * Math.sin(ph))
  }
  cap.computeVertexNormals()
  const phi = (1 + Math.sqrt(5)) / 2
  const up = new Vector3(0, 1, 0)
  const caps = []
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    for (const v of [[0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]]) {
      const g = cap.clone()
      const q = new Quaternion().setFromUnitVectors(up, new Vector3(v[0], v[1], v[2]).normalize())
      g.applyMatrix4(new Matrix4().compose(new Vector3(), q, new Vector3(BALL_R, BALL_R, BALL_R)))
      caps.push(g)
    }
  }
  const merged = mergeGeometries(caps)
  for (const g of caps) g.dispose()
  cap.dispose()
  group.add(new Mesh(merged, new MeshLambertMaterial({ color: 0x0b0c10 })))
  return group
}

// A low-poly footballer: boxes and spheres on joints, in a kit. Built
// facing down the pitch (towards -z); the keeper is turned round.
function makePlayer(doc, { keeper = false, skin = LOOKS[1].skin, hair = LOOKS[1].hair } = {}) {
  const mats = {
    shirt: new MeshLambertMaterial({ color: 0xffffff }),
    sleeve: new MeshLambertMaterial({ color: 0xffffff }),
    trim: new MeshLambertMaterial({ color: 0xffffff }),
    shorts: new MeshLambertMaterial({ color: 0xffffff }),
    socks: new MeshLambertMaterial({ color: 0xffffff }),
    skin: new MeshLambertMaterial({ color: new Color(skin) }),
    hair: new MeshLambertMaterial({ color: new Color(hair) }),
    boots: new MeshLambertMaterial({ color: 0x15161a }),
    gloves: new MeshLambertMaterial({ color: 0xf4f4f4 }),
    hat: new MeshLambertMaterial({ color: 0xc8102e }),
    fur: new MeshLambertMaterial({ color: 0xffffff }),
  }
  const box = (w, h, d, mat, y = -h / 2) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat)
    m.position.y = y
    return m
  }
  const root = new Group()
  const lean = new Group()
  root.add(lean)
  const body = new Group()
  lean.add(body)
  if (keeper) body.rotation.y = PI

  const hips = new Group()
  hips.position.y = 0.92
  body.add(hips)
  hips.add(box(0.38, 0.27, 0.24, mats.shorts, -0.06))
  const legs = []
  for (const side of [-1, 1]) {
    const thigh = new Group()
    thigh.position.set(side * 0.105, -0.06, 0)
    hips.add(thigh)
    thigh.add(box(0.15, 0.44, 0.16, mats.skin))
    const knee = new Group()
    knee.position.y = -0.44
    thigh.add(knee)
    knee.add(box(0.135, 0.36, 0.145, mats.socks))
    const boot = box(0.13, 0.08, 0.27, mats.boots, -0.4)
    boot.position.z = -0.05
    knee.add(boot)
    legs.push({ thigh, knee })
  }
  const torso = new Group()
  torso.position.y = 0.94
  body.add(torso)
  torso.add(box(0.45, 0.56, 0.25, mats.shirt, 0.28))
  torso.add(box(0.47, 0.05, 0.27, mats.trim, 0.565))
  torso.add(box(0.46, 0.04, 0.26, mats.trim, 0.02))
  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new Group()
    shoulder.position.set(side * 0.29, 0.52, 0)
    torso.add(shoulder)
    shoulder.add(box(0.12, 0.3, 0.13, mats.sleeve))
    const elbow = new Group()
    elbow.position.y = -0.3
    shoulder.add(elbow)
    elbow.add(box(0.105, 0.27, 0.11, keeper ? mats.sleeve : mats.skin))
    elbow.add(box(keeper ? 0.15 : 0.1, keeper ? 0.15 : 0.1, keeper ? 0.09 : 0.1, keeper ? mats.gloves : mats.skin, -0.32))
    arms.push({ shoulder, elbow, side })
  }
  const neck = new Group()
  neck.position.y = 0.6
  torso.add(neck)
  const head = new Mesh(new SphereGeometry(0.13, 16, 12), mats.skin)
  head.position.y = 0.15
  neck.add(head)
  const hairCap = new Mesh(new SphereGeometry(0.137, 16, 8, 0, PI * 2, 0, PI * 0.55), mats.hair)
  hairCap.position.y = 0.165
  hairCap.rotation.x = 0.25
  neck.add(hairCap)
  // A ponytail, for a look that has one: a band high at the back of the
  // head and the tail falling from it past one shoulder, so it shows from
  // the front as well as from behind. Hidden for every other look.
  const ponytail = new Group()
  ponytail.position.set(0.03, 0.24, 0.1)
  ponytail.visible = false
  const band = new Mesh(new SphereGeometry(0.05, 10, 8), mats.hair)
  ponytail.add(band)
  const tail = new Mesh(new CylinderGeometry(0.045, 0.02, 0.36, 10), mats.hair)
  tail.position.set(0.09, -0.16, 0.02)
  tail.rotation.set(-0.15, 0, 0.5)
  ponytail.add(tail)
  neck.add(ponytail)

  // A keeper wears a Christmas hat: a white band, a red cone that flops
  // to one side and a bobble on its end.
  if (keeper) {
    const band = new Mesh(new CylinderGeometry(0.128, 0.134, 0.06, 14), mats.fur)
    band.position.y = 0.235
    const cone = new Mesh(new ConeGeometry(0.122, 0.27, 12), mats.hat)
    cone.position.set(0.03, 0.385, 0)
    cone.rotation.z = -0.32
    const bobble = new Mesh(new SphereGeometry(0.042, 8, 6), mats.fur)
    bobble.position.set(0.075, 0.515, 0)
    neck.add(band, cone, bobble)
  }

  // The number on the back of the shirt.
  let numberTex = null
  let numberMesh = null
  if (!keeper) {
    numberTex = canvasTexture(doc, 128, 128, () => {})
    numberMesh = new Mesh(new PlaneGeometry(0.26, 0.26), new MeshBasicMaterial({ map: numberTex, transparent: true }))
    numberMesh.position.set(0, 0.3, 0.128)
    torso.add(numberMesh)
  }

  function setLook(look = 0) {
    mats.skin.color.set(lookAt(look).skin)
    mats.hair.color.set(lookAt(look).hair)
    ponytail.visible = Boolean(lookAt(look).ponytail)
  }

  function setKit(kit, number = '') {
    mats.shirt.color.set(kit.shirt)
    mats.sleeve.color.set(kit.sleeve || kit.shirt)
    mats.trim.color.set(kit.trim)
    mats.shorts.color.set(kit.shorts)
    mats.socks.color.set(kit.socks)
    if (kit.gloves) mats.gloves.color.set(kit.gloves)
    if (numberTex) {
      const c = numberTex.image
      const g = c.getContext('2d')
      g.clearRect(0, 0, 128, 128)
      g.fillStyle = kit.number || '#ffffff'
      g.font = '800 112px "Barlow Condensed", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(number), 64, 70)
      numberTex.needsUpdate = true
    }
  }

  return { root, lean, body, hips, legs, torso, arms, neck, mats, setKit, setLook, numberTex }
}

function blobTexture(doc) {
  return canvasTexture(doc, 64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  })
}

export async function createScene3D({ canvas, colours, kits, boards = [], boardLogos = {}, topSign = null, win = globalThis.window, doc = globalThis.document, onLost = () => {} }) {
  const dpr = Math.min(2, win.devicePixelRatio || 1)
  const renderer = new WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' })
  renderer.setPixelRatio(dpr)
  const scene = new Scene()
  const camera = new PerspectiveCamera(50, 1, 0.1, 160)
  const rnd = makeRng(20261110)
  const disposables = new Set()
  const keep = (x) => {
    disposables.add(x)
    return x
  }
  let width = 1
  let height = 1
  let lastNow = 0

  const still = prefersReducedMotion(win)

  // The sky: a winter night, the site's deep colour above, lifting to a
  // pale horizon.
  const horizon = mix(colours.primary, '#bcd7f2', 0.42)
  scene.background = keep(canvasTexture(doc, 4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, mix(colours.deep, '#000000', 0.55))
    grad.addColorStop(0.6, mix(colours.deep, colours.primary, 0.45))
    grad.addColorStop(1, horizon)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  }))
  scene.fog = new Fog(new Color(horizon), 34, 110)

  // A round soft dot, for a star and a snowflake.
  const dot = keep(canvasTexture(doc, 32, 32, (g) => {
    const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
  }))

  // Stars, far behind the stand.
  {
    const r = makeRng(1225)
    const n = 150
    const at = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) at.set([r.range(-95, 95), r.range(16, 78), -100 - r() * 20], i * 3)
    const g = keep(new BufferGeometry())
    g.setAttribute('position', new BufferAttribute(at, 3))
    scene.add(new Points(g, keep(new PointsMaterial({ map: dot, size: 2.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }))))
  }

  scene.add(new HemisphereLight(0xe2ecff, 0x35604a, 0.95 * LIGHT))
  const sun = new DirectionalLight(0xffffff, 0.75 * LIGHT)
  sun.position.set(-6, 14, 10)
  scene.add(sun)

  // ── The pitch ─────────────────────────────────────────────────────────
  const grass = keep(canvasTexture(doc, 256, 256, (g, w, h) => {
    // Grass with a frost on it.
    g.fillStyle = '#3f8f5a'
    g.fillRect(0, 0, w, h / 2)
    g.fillStyle = '#357e50'
    g.fillRect(0, h / 2, w, h / 2)
    const r = makeRng(7)
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = r() < 0.62 ? 'rgba(255,255,255,0.085)' : 'rgba(0,0,0,0.05)'
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 3)
    }
  }, { repeat: [14, 15], anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) }))
  const pitch = new Mesh(keep(new PlaneGeometry(120, 120)), keep(new MeshLambertMaterial({ map: grass })))
  pitch.rotation.x = -PI / 2
  pitch.position.z = -20
  scene.add(pitch)

  const lineW = 0.12
  const lines = []
  const strip = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const g = new PlaneGeometry(len, lineW)
    return placed(g, { x: (x1 + x2) / 2, y: 0.006, z: (z1 + z2) / 2, rx: -PI / 2, rz: -Math.atan2(z2 - z1, x2 - x1) })
  }
  const L = GOAL.lineZ
  lines.push(strip(-34, L, 34, L))
  lines.push(strip(-9.16, L, -9.16, L + 5.5), strip(9.16, L, 9.16, L + 5.5), strip(-9.16, L + 5.5, 9.16, L + 5.5))
  lines.push(strip(-20.16, L, -20.16, L + 16.5), strip(20.16, L, 20.16, L + 16.5), strip(-20.16, L + 16.5, 20.16, L + 16.5))
  lines.push(placed(new CircleGeometry(0.1, 20), { y: 0.007, rx: -PI / 2 }))
  const arcFrom = Math.acos(5.5 / 9.15)
  lines.push(placed(new RingGeometry(9.15 - lineW / 2, 9.15 + lineW / 2, 48, 1, -PI / 2 - arcFrom, 2 * arcFrom), { y: 0.006, rx: -PI / 2 }))
  const lineGeo = keep(mergeGeometries(lines.map((g) => g.toNonIndexed())))
  for (const g of lines) g.dispose()
  const lineMesh = new Mesh(lineGeo, keep(new MeshBasicMaterial({ color: 0xf4f7f2, polygonOffset: true, polygonOffsetFactor: -2 })))
  scene.add(lineMesh)

  // ── The goal ──────────────────────────────────────────────────────────
  const frameMat = keep(new MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a2a2a }))
  const px = GOAL.halfWidth + GOAL.post
  const barY = GOAL.height + GOAL.post
  const frameParts = [
    placed(new CylinderGeometry(GOAL.post, GOAL.post, barY + GOAL.post, 16), { x: -px, y: (barY + GOAL.post) / 2, z: L }),
    placed(new CylinderGeometry(GOAL.post, GOAL.post, barY + GOAL.post, 16), { x: px, y: (barY + GOAL.post) / 2, z: L }),
    placed(new CylinderGeometry(GOAL.post, GOAL.post, px * 2 + GOAL.post * 2, 16), { y: barY, z: L, rz: PI / 2 }),
  ]
  const backTop = L - GOAL.post - GOAL.depthTop
  const backBottom = L - GOAL.post - GOAL.depthBottom
  const stanchion = 0.03
  for (const s of [-1, 1]) {
    frameParts.push(placed(new CylinderGeometry(stanchion, stanchion, GOAL.depthTop, 8), { x: s * px, y: barY, z: L - GOAL.depthTop / 2, rx: PI / 2 }))
    const len = Math.hypot(barY, backTop - backBottom)
    frameParts.push(placed(new CylinderGeometry(stanchion, stanchion, len, 8), { x: s * px, y: barY / 2, z: (backTop + backBottom) / 2, rx: -Math.atan2(backBottom - backTop, barY) }))
    frameParts.push(placed(new CylinderGeometry(stanchion, stanchion, GOAL.depthBottom, 8), { x: s * px, y: 0.03, z: L - GOAL.depthBottom / 2, rx: PI / 2 }))
  }
  frameParts.push(placed(new CylinderGeometry(stanchion, stanchion, px * 2, 8), { y: 0.03, z: backBottom, rz: PI / 2 }))
  const frameGeo = keep(mergeGeometries(frameParts.map((g) => g.toNonIndexed())))
  for (const g of frameParts) g.dispose()
  scene.add(new Mesh(frameGeo, frameMat))

  // The net: four panels whose points move when the ball hits.
  const netTex = keep(canvasTexture(doc, 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,255,255,0.92)'
    g.lineWidth = 5
    g.strokeRect(0, 0, w, h)
  }, { anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()) }))
  netTex.wrapS = RepeatWrapping
  netTex.wrapT = RepeatWrapping
  const netMat = keep(new MeshBasicMaterial({ map: netTex, transparent: true, side: DoubleSide, depthWrite: false, alphaTest: 0.04 }))
  const CELL = 0.16
  const backZ = (y) => L - GOAL.post - lerp(GOAL.depthBottom, GOAL.depthTop, clamp(y / GOAL.height, 0, 1))
  function netPanel(nu, nv, at, normal) {
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3)
    const uv = new Float32Array((nu + 1) * (nv + 1) * 2)
    const index = []
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const k = j * (nu + 1) + i
        const p = at(i / nu, j / nv)
        pos.set([p.x, p.y, p.z], k * 3)
        uv.set([p.u / CELL, p.v / CELL], k * 2)
        if (i < nu && j < nv) index.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1)
      }
    }
    const g = keep(new BufferGeometry())
    g.setIndex(index)
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('uv', new BufferAttribute(uv, 2))
    const mesh = new Mesh(g, netMat)
    mesh.renderOrder = 2
    scene.add(mesh)
    return { mesh, base: pos.slice(), normal }
  }
  const hw = GOAL.halfWidth + GOAL.post
  const panels = [
    netPanel(46, 16, (u, v) => {
      const y = GOAL.height + GOAL.post - v * (GOAL.height + GOAL.post)
      return { x: -hw + u * hw * 2, y, z: backZ(y), u: u * hw * 2, v: v * Math.hypot(GOAL.height, 1) }
    }, () => ({ x: 0, y: 0.45, z: -0.9 })),
    netPanel(46, 6, (u, v) => ({ x: -hw + u * hw * 2, y: barY, z: L - GOAL.post - v * GOAL.depthTop, u: u * hw * 2, v: v * GOAL.depthTop }), () => ({ x: 0, y: 1, z: 0 })),
    ...[-1, 1].map((s) => netPanel(10, 16, (u, v) => {
      const y = v * barY
      return { x: s * hw, y, z: L - GOAL.post - u * (L - GOAL.post - backZ(y)), u: u * GOAL.depthBottom, v: y }
    }, () => ({ x: s, y: 0, z: 0 }))),
  ]
  let ripple = null
  function updateNet(now) {
    if (!ripple) return
    const age = now - ripple.at
    const done = age > 1.8
    for (const panel of panels) {
      const attr = panel.mesh.geometry.attributes.position
      const arr = attr.array
      const base = panel.base
      for (let k = 0; k < arr.length; k += 3) {
        const x = base[k]
        const y = base[k + 1]
        const z = base[k + 2]
        let d = 0
        if (!done) {
          const dist2 = (x - ripple.x) ** 2 + (y - ripple.y) ** 2 + (z - ripple.z) ** 2
          const bulge = Math.exp(-dist2 / (2 * 0.42 * 0.42)) * Math.exp(-age * 3.1) * Math.cos(age * 9.5)
          const dist = Math.sqrt(dist2)
          const wave = Math.exp(-dist * 1.1) * Math.sin(dist * 13 - age * 24) * Math.exp(-age * 2.6) * 0.3
          d = ripple.amp * (bulge + wave * Math.min(1, age * 8))
        }
        const n = panel.normal({ x, y, z })
        arr[k] = x + n.x * d
        arr[k + 1] = y + n.y * d
        arr[k + 2] = z + n.z * d
      }
      attr.needsUpdate = true
    }
    if (done) ripple = null
  }

  // ── Advertising boards ────────────────────────────────────────────────
  const names = boards.length ? boards : ['Winter Fayre']
  const boardTextures = new Map()
  // A partner with a logo has a white board with the logo on it.
  const logoImages = loadBoardLogos(boardLogos, {
    win,
    onLoad: () => { for (const t of boardTextures.values()) t.userData.redraw() },
  })
  const drawBoard = (name, fill, ink) => (g, w, h) => {
    const img = logoImages.get(name.toLowerCase())
    if (logoReady(img)) {
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, w, h)
      g.fillStyle = colours.accent
      g.fillRect(0, h - 12, w, 12)
      const b = logoBox(img, w, h - 12)
      g.drawImage(img, b.x, b.y, b.w, b.h)
      return
    }
    g.fillStyle = fill
    g.fillRect(0, 0, w, h)
    g.fillStyle = colours.accent
    g.fillRect(0, h - 12, w, 12)
    let size = 108
    g.font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`
    const word = name.toUpperCase()
    while (g.measureText(word).width > w * 0.88 && size > 30) {
      size -= 4
      g.font = `800 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`
    }
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(word, w / 2, h / 2 - 4)
  }
  const boardSide = keep(new MeshLambertMaterial({ color: new Color(mix(colours.deep, '#000000', 0.4)) }))
  const boardGeo = keep(new BoxGeometry(BOARD_W, 0.95, 0.14))
  for (let i = 0; i < BOARD_COUNT; i++) {
    const name = names[i % names.length]
    const even = i % 2 === 0
    const key = `${name}|${even}`
    if (!boardTextures.has(key)) {
      boardTextures.set(key, keep(canvasTexture(doc, 768, 180, drawBoard(name, even ? colours.primary : colours.deep, even ? '#ffffff' : colours.accent))))
    }
    const face = keep(new MeshBasicMaterial({ map: boardTextures.get(key) }))
    const board = new Mesh(boardGeo, [boardSide, boardSide, boardSide, boardSide, face, boardSide])
    board.position.set(boardCentre(i), 0.48, BOARDS_Z)
    scene.add(board)
  }
  // Redrawn once the site's display face has loaded, so the names are in it.
  try {
    doc.fonts?.load?.('800 100px "Barlow Condensed"').then(() => {
      for (const t of boardTextures.values()) t.userData.redraw()
      signTexture?.userData.redraw()
    }).catch(() => {})
  } catch { /* no font loading API: the fallback face stays */ }

  // ── Winter ────────────────────────────────────────────────────────────
  // Snow lying along the top of the boards and banked at their feet.
  const snowMat = keep(new MeshLambertMaterial({ color: 0xf2f7ff, emissive: 0x2a3140 }))
  {
    const parts = [placed(new BoxGeometry(BOARD_W * BOARD_COUNT, 0.16, 0.8), { y: 0.06, z: BOARDS_Z + 0.42 })]
    for (let i = 0; i < BOARD_COUNT; i++) parts.push(placed(new BoxGeometry(BOARD_W - 0.06, 0.09, 0.22), { x: boardCentre(i), y: 0.99, z: BOARDS_Z }))
    const geo = keep(mergeGeometries(parts.map((g) => g.toNonIndexed())))
    for (const g of parts) g.dispose()
    scene.add(new Mesh(geo, snowMat))
  }

  // A Christmas tree either side of the goal, behind the boards: three
  // tiers of green with snow on each, a trunk and a gold star.
  const TREE_X = 5.5
  const TREE_Z = BOARDS_Z - 0.95
  const TIERS = [{ r: 1.0, h: 1.5, y: 1.25 }, { r: 0.78, h: 1.3, y: 2.15 }, { r: 0.55, h: 1.1, y: 2.95 }]
  {
    const green = []
    const white = []
    const brown = []
    const gold = []
    for (const s of [-1, 1]) {
      for (const t of TIERS) {
        green.push(placed(new ConeGeometry(t.r, t.h, 10), { x: s * TREE_X, y: t.y, z: TREE_Z }))
        white.push(placed(new ConeGeometry(t.r * 0.52, t.h * 0.5, 10), { x: s * TREE_X, y: t.y + t.h * 0.27, z: TREE_Z }))
      }
      brown.push(placed(new CylinderGeometry(0.14, 0.17, 0.6, 8), { x: s * TREE_X, y: 0.3, z: TREE_Z }))
      gold.push(placed(new OctahedronGeometry(0.2, 0), { x: s * TREE_X, y: 3.66, z: TREE_Z }))
    }
    const merged = (parts) => {
      const geo = keep(mergeGeometries(parts.map((g) => g.toNonIndexed())))
      for (const g of parts) g.dispose()
      return geo
    }
    scene.add(new Mesh(merged(green), keep(new MeshLambertMaterial({ color: 0x1f7a45 }))))
    scene.add(new Mesh(merged(white), snowMat))
    scene.add(new Mesh(merged(brown), keep(new MeshLambertMaterial({ color: 0x5b3a22 }))))
    scene.add(new Mesh(merged(gold), keep(new MeshBasicMaterial({ color: new Color(colours.accent), fog: false }))))
  }

  // Fairy lights: a string along the top of the boards, one under the
  // big sign and one winding round each tree. They twinkle.
  const BULBS = ['#ff4d4d', '#3fe07a', '#ffd166', '#5cc8ff', '#ffffff']
  const bulbs = []
  for (let x = -BOARD_W * BOARD_COUNT / 2 + 0.25; x <= BOARD_W * BOARD_COUNT / 2; x += 0.5) {
    bulbs.push({ x, y: 1.09 + Math.cos(x * PI) * 0.03, z: BOARDS_Z + 0.13 })
  }
  for (const s of [-1, 1]) {
    TIERS.forEach((t, k) => {
      const n = 7 - k * 2
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + k * 0.9
        const up = (i / n) * 0.55 - 0.35
        const rad = t.r * (0.5 - up) * 0.98
        bulbs.push({ x: s * TREE_X + Math.cos(a) * rad, y: t.y + up * t.h, z: TREE_Z + Math.sin(a) * rad })
      }
    })
  }
  const SIGN_Z = BOARDS_Z - 2.4 - 5 * 1.15 + 0.3
  const SIGN_PX = { w: 1152, h: 320 }
  const SIGN_TALL = 2.5
  const SIGN_W = SIGN_TALL * (SIGN_PX.w / SIGN_PX.h)
  if (topSign) for (let x = -SIGN_W / 2 + 0.2; x <= SIGN_W / 2 - 0.1; x += 0.42) bulbs.push({ x, y: 5.3 + Math.cos(x * 1.5) * 0.04, z: SIGN_Z + 0.2 })
  const bulbMesh = new InstancedMesh(keep(new SphereGeometry(0.055, 8, 6)), keep(new MeshBasicMaterial({ color: 0xffffff, fog: false })), bulbs.length)
  const bulbColour = new Color()
  const bulbAt = new Object3D()
  bulbs.forEach((b, i) => {
    bulbAt.position.set(b.x, b.y, b.z)
    bulbAt.updateMatrix()
    bulbMesh.setMatrixAt(i, bulbAt.matrix)
    bulbMesh.setColorAt(i, bulbColour.set(BULBS[i % BULBS.length]))
  })
  bulbMesh.instanceMatrix.needsUpdate = true
  bulbMesh.instanceColor.needsUpdate = true
  scene.add(bulbMesh)
  let twinkledAt = -1
  function twinkle(now) {
    if (still || now - twinkledAt < 0.14) return
    twinkledAt = now
    for (let i = 0; i < bulbs.length; i++) {
      // Each bulb dims and brightens in its own time.
      const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 2.6 + i * 2.4))
      bulbMesh.setColorAt(i, bulbColour.set(BULBS[i % BULBS.length]).multiplyScalar(k))
    }
    bulbMesh.instanceColor.needsUpdate = true
  }

  // Falling snow, from the stand to behind the furthest camera.
  const FLAKES = 900
  const SNOW = { x: 20, top: 14, near: 21, far: BOARDS_Z - 6 }
  const flakeAt = new Float32Array(FLAKES * 3)
  const flakeFall = new Float32Array(FLAKES)
  const flakeDrift = new Float32Array(FLAKES)
  {
    const r = makeRng(1114)
    for (let i = 0; i < FLAKES; i++) {
      flakeAt.set([r.range(-SNOW.x, SNOW.x), r() * SNOW.top, r.range(SNOW.far, SNOW.near)], i * 3)
      flakeFall[i] = r.range(0.7, 1.5)
      flakeDrift[i] = r() * PI * 2
    }
  }
  const flakeGeo = keep(new BufferGeometry())
  flakeGeo.setAttribute('position', new BufferAttribute(flakeAt, 3))
  const snowfall = new Points(flakeGeo, keep(new PointsMaterial({ map: dot, size: 0.15, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.92 })))
  snowfall.frustumCulled = false
  snowfall.renderOrder = 3
  scene.add(snowfall)
  let snowedAt = -1
  function snow(now) {
    const dt = snowedAt < 0 ? 0 : clamp(now - snowedAt, 0, 0.05)
    snowedAt = now
    if (still || !dt) return
    for (let i = 0; i < FLAKES; i++) {
      const k = i * 3
      flakeAt[k] += (Math.sin(now * 0.9 + flakeDrift[i]) * 0.35 + 0.18) * dt
      flakeAt[k + 1] -= flakeFall[i] * dt
      if (flakeAt[k + 1] < 0) flakeAt[k + 1] += SNOW.top
      if (flakeAt[k] > SNOW.x) flakeAt[k] -= SNOW.x * 2
    }
    flakeGeo.attributes.position.needsUpdate = true
  }

  // ── The stand and the crowd ───────────────────────────────────────────
  const tiers = 13
  const standParts = []
  for (let k = 0; k < tiers; k++) {
    standParts.push(placed(new BoxGeometry(56, 0.62 + k * 0.62, 1.15), { y: (0.62 + k * 0.62) / 2 + 0.2, z: BOARDS_Z - 2.4 - k * 1.15 }))
  }
  standParts.push(placed(new BoxGeometry(56, 9, 0.6), { y: 4.5, z: BOARDS_Z - 2.4 - tiers * 1.15 - 0.3 }))
  const standGeo = keep(mergeGeometries(standParts.map((g) => g.toNonIndexed())))
  for (const g of standParts) g.dispose()
  scene.add(new Mesh(standGeo, keep(new MeshLambertMaterial({ color: new Color(mix(colours.deep, '#1c2230', 0.55)) }))))

  const seats = []
  for (let k = 0; k < tiers; k++) {
    for (let i = 0; i < 58; i++) {
      if (rnd() < 0.12) continue
      seats.push({ x: -26 + i * 0.9 + rnd.range(-0.2, 0.2), y: 0.82 + k * 0.62 + 0.2, z: BOARDS_Z - 2.4 - k * 1.15, phase: rnd() * PI * 2, jumpy: rnd() < 0.7 })
    }
  }
  const bodyGeo = keep(new BoxGeometry(0.46, 0.6, 0.32))
  const headGeo = keep(new IcosahedronGeometry(0.14, 0))
  const bodies = new InstancedMesh(bodyGeo, keep(new MeshLambertMaterial({ color: 0xffffff })), seats.length)
  const heads = new InstancedMesh(headGeo, keep(new MeshLambertMaterial({ color: 0xffffff })), seats.length)
  // Winter coats, in the site's colours and Christmas red and green.
  const crowdColours = [mix(colours.primary, '#ffffff', 0.25), colours.accent, '#ffffff', '#c8102e', '#1e9e57', '#8fd6e8', '#2b2f3a', mix(colours.primary, '#ffffff', 0.5)]
  const tmp = new Object3D()
  const colour = new Color()
  seats.forEach((s, i) => {
    colour.set(crowdColours[Math.floor(rnd() * crowdColours.length)])
    bodies.setColorAt(i, colour)
    colour.set(SKINS[Math.floor(rnd() * SKINS.length)])
    heads.setColorAt(i, colour)
  })
  // About one in four of the crowd wears a Christmas hat.
  const hatted = seats.map((s, i) => i).filter(() => rnd() < 0.26)
  const hats = new InstancedMesh(keep(new ConeGeometry(0.15, 0.3, 6)), keep(new MeshLambertMaterial({ color: 0xc8102e })), hatted.length)
  const bobbles = new InstancedMesh(keep(new IcosahedronGeometry(0.055, 0)), keep(new MeshLambertMaterial({ color: 0xffffff })), hatted.length)
  function placeCrowd(now, cheering) {
    seats.forEach((s, i) => {
      const lift = cheering ? (s.jumpy ? Math.max(0, Math.sin(now * 9 + s.phase)) * 0.42 : Math.abs(Math.sin(now * 14 + s.phase)) * 0.06) : 0
      tmp.position.set(s.x, s.y + 0.3 + lift, s.z)
      tmp.rotation.set(0, 0, 0)
      tmp.updateMatrix()
      bodies.setMatrixAt(i, tmp.matrix)
      tmp.position.y = s.y + 0.75 + lift
      tmp.updateMatrix()
      heads.setMatrixAt(i, tmp.matrix)
      s.lift = lift
    })
    hatted.forEach((seat, j) => {
      const s = seats[seat]
      tmp.position.set(s.x, s.y + 0.98 + s.lift, s.z)
      tmp.updateMatrix()
      hats.setMatrixAt(j, tmp.matrix)
      tmp.position.y = s.y + 1.15 + s.lift
      tmp.updateMatrix()
      bobbles.setMatrixAt(j, tmp.matrix)
    })
    bodies.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    hats.instanceMatrix.needsUpdate = true
    bobbles.instanceMatrix.needsUpdate = true
  }
  placeCrowd(0, false)
  bodies.instanceColor.needsUpdate = true
  heads.instanceColor.needsUpdate = true
  scene.add(bodies, heads, hats, bobbles)
  let cheerUntil = -1
  let wasCheering = false

  // The big sign in the stand: the fayre's name.
  let signTexture = null
  if (topSign) {
    const pics = loadTopSign(topSign, { win, onLoad: () => signTexture?.userData.redraw() })
    signTexture = keep(canvasTexture(doc, SIGN_PX.w, SIGN_PX.h, (g, w, h) => drawTopSign(g, w, h, topSign, { ...pics, colours })))
    // It hangs across the middle of the stand, as the front of an upper
    // tier does, with the crowd below and above it. Above the stand it
    // would sit behind a game's own score on a phone. It is nine metres
    // wide, which a phone held upright shows whole in every game.
    const tall = SIGN_TALL
    const sign = new Mesh(keep(new BoxGeometry(SIGN_W, tall, 0.3)), [boardSide, boardSide, boardSide, boardSide, keep(new MeshBasicMaterial({ map: signTexture })), boardSide])
    sign.position.set(0, 6.7, SIGN_Z)
    scene.add(sign)
    const cap = new Mesh(keep(new BoxGeometry(SIGN_W + 0.1, 0.14, 0.5)), snowMat)
    cap.position.set(0, 6.7 + tall / 2 + 0.06, SIGN_Z)
    scene.add(cap)
  }

  // Two floodlights at the back corners.
  const pylonMat = keep(new MeshLambertMaterial({ color: 0x5b6170 }))
  const lampMat = keep(new MeshBasicMaterial({ color: 0xfff6d8 }))
  for (const s of [-1, 1]) {
    const pylon = new Mesh(keep(new CylinderGeometry(0.18, 0.28, 22, 8)), pylonMat)
    pylon.position.set(s * 27, 11, BOARDS_Z - 16)
    scene.add(pylon)
    const lamp = new Mesh(keep(new BoxGeometry(3.4, 1.6, 0.3)), lampMat)
    lamp.position.set(s * 27, 22.4, BOARDS_Z - 15.6)
    lamp.rotation.x = 0.35
    scene.add(lamp)
  }

  // ── The players and the ball ──────────────────────────────────────────
  const taker = makePlayer(doc, lookAt(0))
  const keeper = makePlayer(doc, { keeper: true, ...lookAt(3) })
  scene.add(taker.root, keeper.root)
  const ball = makeBall()
  scene.add(ball)
  // A wall of defenders, for a game with free kicks: built the first
  // time one is asked for, in the other side's kit, facing the ball.
  const WALL_GAP = 0.62
  let wall = null
  const makeWall = (n) => {
    const players = []
    for (let i = 0; i < n; i++) {
      const p = makePlayer(doc, lookAt(i + 1))
      p.setKit(kits.away, '')
      p.root.rotation.y = PI
      for (const a of p.arms) a.shoulder.rotation.set(0.5, 0, -a.side * 0.2)
      p.root.visible = false
      scene.add(p.root)
      players.push(p)
    }
    return players
  }
  const blob = keep(blobTexture(doc))
  const shadowMat = keep(new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }))
  const shadowGeo = keep(new PlaneGeometry(1, 1))
  const shadow = (sx, sz) => {
    const m = new Mesh(shadowGeo, shadowMat)
    m.rotation.x = -PI / 2
    m.scale.set(sx, sz, 1)
    m.renderOrder = 1
    scene.add(m)
    return m
  }
  const ballShadow = shadow(0.42, 0.42)
  const takerShadow = shadow(1.0, 0.7)
  const keeperShadow = shadow(1.3, 0.8)

  const aimGroup = new Group()
  const aimMat = keep(new MeshBasicMaterial({ color: new Color(colours.accent), depthTest: false, transparent: true }))
  const ring = new Mesh(keep(new RingGeometry(0.17, 0.24, 36)), aimMat)
  ring.renderOrder = 5
  aimGroup.add(ring)
  for (let i = 0; i < 4; i++) {
    const tick = new Mesh(keep(new PlaneGeometry(0.16, 0.05)), aimMat)
    tick.position.set(Math.cos((i * PI) / 2) * 0.33, Math.sin((i * PI) / 2) * 0.33, 0)
    tick.rotation.z = (i * PI) / 2
    tick.renderOrder = 5
    aimGroup.add(tick)
  }
  aimGroup.visible = false
  scene.add(aimGroup)

  let teams = { taker: kits.home, keeper: kits.awayKeeper, number: '9' }
  taker.setKit(teams.taker, teams.number)
  keeper.setKit(teams.keeper)
  try {
    doc.fonts?.load?.('800 100px "Barlow Condensed"').then(() => taker.setKit(teams.taker, teams.number)).catch(() => {})
  } catch { /* the fallback face stays */ }

  // ── Posing ────────────────────────────────────────────────────────────
  function poseTaker(state, now) {
    const t = takerPose(state.taker, state.mode, now)
    taker.root.position.set(t.x, t.bob, t.z)
    taker.root.rotation.set(0, t.yaw, 0)
    taker.torso.rotation.set(t.lean, -t.twist, 0)
    taker.hips.rotation.set(0, -t.twist * 0.5, 0)
    taker.neck.rotation.set(0, -t.head, 0)
    const s = t.stride
    const [left, right] = taker.legs
    left.thigh.rotation.x = Math.sin(s) * 0.75 * t.run
    left.knee.rotation.x = -Math.max(0, Math.sin(s + 1.2)) * 1.1 * t.run
    right.thigh.rotation.x = -Math.sin(s) * 0.75 * t.run
    right.knee.rotation.x = -Math.max(0, -Math.sin(s + 1.2)) * 1.1 * t.run
    if (state.taker?.phase === 'strike' || state.taker?.phase === 'follow' || (state.taker?.phase === 'runup' && state.taker.u > 0.82)) {
      // The kicking leg: drawn back, through the ball, and on.
      const back = state.taker.phase === 'runup' ? smooth(0.82, 1, state.taker.u) : 1
      const through = t.kick
      right.thigh.rotation.x = lerp(-0.85 * back, 1.25, through)
      right.knee.rotation.x = -lerp(1.25 * back, 0.08, through)
      left.thigh.rotation.x = lerp(left.thigh.rotation.x, 0.15, back)
      left.knee.rotation.x = lerp(left.knee.rotation.x, -0.2, back)
    }
    const [la, ra] = taker.arms
    la.shoulder.rotation.set(-Math.sin(s) * 0.6 * t.run, 0, -0.15 - 0.7 * t.kick)
    ra.shoulder.rotation.set(Math.sin(s) * 0.6 * t.run, 0, 0.15)
    la.elbow.rotation.x = -0.4 * t.run
    ra.elbow.rotation.x = -0.4 * t.run
    takerShadow.position.set(t.x, 0.012, t.z)
  }

  // The keeper. Standing, she sways and crouches. A dive has four parts:
  // a crouch and a push off the near foot, the flight with both arms
  // reaching for the ball and the trailing knee tucked up, and the
  // landing, when she comes down on her side and stays there. The rules
  // (physics.js) say where her feet and hands are and when the dive is
  // complete; how she comes down after that is drawn here and is no part
  // of whether the ball was saved. Returns how far she has dropped since
  // the dive was complete, so a ball in her hands comes down with her.
  let landing = { since: -1, kind: '' }
  function poseKeeper(pose, now, holding = false) {
    const standing = pose.kind === 'ready' || pose.kind === 'set'
    const sway = pose.kind === 'ready' ? Math.sin(now * 2.1) * 0.05 : 0
    const [l, r] = keeper.legs
    if (standing) {
      landing = { since: -1, kind: '' }
      keeper.root.position.set(pose.feet.x + sway, Math.max(0, pose.feet.y - 0.08), KEEPER_Z)
      keeper.root.rotation.set(0, 0, 0)
      keeper.lean.rotation.set(0, 0, 0)
      const crouch = pose.kind === 'set' ? 0.35 : 0.2
      l.thigh.rotation.set(crouch, 0, -0.12 - crouch * 0.4)
      r.thigh.rotation.set(crouch, 0, 0.12 + crouch * 0.4)
      l.knee.rotation.x = -crouch * 1.6
      r.knee.rotation.x = -crouch * 1.6
      keeper.lean.position.y = -crouch * 0.18
      const reach = pose.kind === 'set' ? 0.95 : 0.7
      for (const a of keeper.arms) {
        if (holding) {
          a.shoulder.rotation.set(-1.15, 0, a.side * 0.35)
          a.elbow.rotation.x = -1.5
        } else {
          a.shoulder.rotation.set(-0.35, 0, a.side * reach)
          a.elbow.rotation.x = -0.6
        }
      }
      keeper.torso.rotation.set(0.18, 0, 0)
      keeper.neck.rotation.set(0, 0, 0)
      keeperShadow.position.set(pose.feet.x, 0.012, KEEPER_Z)
      keeperShadow.scale.set(1.2, 0.8, 1)
      return 0
    }

    const u = pose.u
    const jump = pose.kind === 'jump'
    // Which way she goes across the goal: 1 to the right as it is seen.
    const dir = Math.sign(pose.hands.x - pose.feet.x) || 1
    // The crouch before the push, gone a third of the way in.
    const load = Math.sin(Math.min(1, u / 0.32) * PI)
    // In the air, from a fifth of the way in.
    const flight = smooth(0.18, 0.6, u)

    // Once the dive is complete she comes down, and on her side unless
    // the ball is in her hands or she only jumped.
    if (u >= 1 && landing.since < 0) landing = { since: now, kind: pose.kind }
    if (u < 1) landing = { since: -1, kind: '' }
    const down = landing.since < 0 ? 0 : Math.max(0, now - landing.since)
    const low = Math.min(pose.feet.y, pose.hands.y)
    const floor = jump ? 0.08 : 0.2
    const drop = Math.min(Math.max(0, low - floor), 4.9 * down * down)
    const landed = drop >= Math.max(0, low - floor) - 1e-6 && down > 0
    const settle = jump || holding ? 0 : smooth(0, 0.3, down)
    const flat = dir * (PI / 2) * 0.97
    const lean = jump ? pose.lean * (1 - smooth(0, 0.25, down)) : lerp(pose.lean, flat, settle)
    // A small bounce as she lands.
    const bounce = landed && !jump ? Math.max(0, Math.sin(Math.min(1, (down - Math.sqrt(Math.max(0, low - floor) / 4.9)) / 0.22) * PI)) * 0.05 : 0

    keeper.root.position.set(pose.feet.x, Math.max(0, pose.feet.y - 0.08 - drop + bounce), KEEPER_Z)
    keeper.root.rotation.set(0, 0, 0)
    keeper.lean.rotation.set(0, 0, -lean)
    keeper.lean.position.y = jump ? 0 : -load * 0.12

    // Legs. The body is turned to face the ball, so its own right is the
    // left as it is seen: the trailing leg is the one on the side she
    // dives to, as the body counts sides.
    const trail = dir > 0 ? r : l
    const drive = dir > 0 ? l : r
    if (jump) {
      const tuck = flight * (1 - smooth(0, 0.3, down)) * 0.5
      l.thigh.rotation.set(load * 0.5 + tuck, 0, -0.1)
      r.thigh.rotation.set(load * 0.5 + tuck, 0, 0.1)
      l.knee.rotation.x = -load * 0.9 - tuck * 1.6
      r.knee.rotation.x = -load * 0.9 - tuck * 1.6
    } else {
      // The driving leg bends and then straightens behind her; the
      // trailing knee comes up and stays tucked.
      drive.thigh.rotation.set(load * 0.55 - flight * 0.12, 0, dir * 0.1 * flight)
      drive.knee.rotation.x = -load * 1.0 - flight * 0.1
      trail.thigh.rotation.set(load * 0.4 + flight * 0.85, 0, -dir * 0.12 * flight)
      trail.knee.rotation.x = -load * 0.7 - flight * 1.25
    }

    // Arms: up past the head together, the lower one a little ahead,
    // elbows nearly straight. With the ball held they wrap it at the chest.
    const up = smooth(0, 0.45, u)
    for (const a of keeper.arms) {
      if (holding) {
        a.shoulder.rotation.set(-1.15, 0, a.side * 0.35)
        a.elbow.rotation.x = -1.5
        continue
      }
      // As the body counts sides, the lower arm in a dive is the one away
      // from the side she dives to.
      const lower = jump ? false : a.side !== dir
      const reach = lerp(0.7, jump ? 2.9 : lower ? 3.05 : 2.8, up)
      a.shoulder.rotation.set(-0.18 * flight, 0, a.side * reach)
      a.elbow.rotation.x = lerp(-0.6, -0.12, up) - (landed && !jump ? 0.35 : 0)
    }
    // A small turn of the chest and the head towards the ball.
    keeper.torso.rotation.set(jump ? 0 : -0.1 * flight, jump ? 0 : dir * 0.28 * flight, 0)
    keeper.neck.rotation.set(0, 0, jump ? 0 : -dir * 0.25 * flight * (1 - settle))

    const reachAcross = Math.abs(pose.hands.x - pose.feet.x)
    keeperShadow.position.set(pose.feet.x + dir * reachAcross * (0.35 + 0.25 * settle), 0.012, KEEPER_Z)
    keeperShadow.scale.set(1.2 + reachAcross * (0.8 + 0.4 * settle), 0.8, 1)
    return holding ? drop : 0
  }

  const prevBall = new Vector3(0, BALL_R, 0)
  const spinAxis = new Vector3()
  const spinQ = new Quaternion()
  function poseBall(b) {
    ball.position.set(b.x, b.y, b.z)
    const dx = b.x - prevBall.x
    const dz = b.z - prevBall.z
    const dist = Math.hypot(dx, b.y - prevBall.y, dz)
    if (dist > 1e-4 && dist < 2) {
      spinAxis.set(-dz, 0, dx).normalize()
      if (spinAxis.lengthSq() > 0) {
        spinQ.setFromAxisAngle(spinAxis, -dist / BALL_R)
        ball.quaternion.premultiply(spinQ)
      }
    } else if (dist >= 2) {
      ball.quaternion.identity()
    }
    prevBall.set(b.x, b.y, b.z)
    ballShadow.position.set(b.x, 0.01, b.z)
    const lift = clamp(b.y / 3, 0, 1)
    ballShadow.scale.setScalar(0.42 + lift * 0.3)
  }

  function draw(state) {
    const now = state.now
    lastNow = now
    // A game with its own camera hands it over (view); the shootout's is
    // worked out from its mode.
    const cam = state.view || cameraFor(state.mode, width / height, { follow: state.follow, ball: state.ball, shake: state.shake })
    camera.fov = cam.fov
    camera.aspect = width / height
    camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z)
    camera.lookAt(cam.look.x, cam.look.y, cam.look.z)
    camera.updateProjectionMatrix()
    // A game with no taker (keepy-uppies) leaves the taker out.
    const solo = state.taker === null
    taker.root.visible = !solo
    takerShadow.visible = !solo
    if (!solo) poseTaker(state, now)
    // A wall stands where the game puts it (wall: { x, z, n }), or not at all.
    if (state.wall && !wall) wall = makeWall(state.wall.n || 5)
    if (wall) {
      wall.forEach((p, i) => {
        p.root.visible = Boolean(state.wall)
        if (state.wall) p.root.position.set(state.wall.x + (i - (wall.length - 1) / 2) * WALL_GAP, state.wall.jump || 0, state.wall.z)
      })
    }
    // And a game with no keeper leaves her out.
    const keeperless = state.keeper === null
    keeper.root.visible = !keeperless
    keeperShadow.visible = !keeperless
    const dropped = keeperless ? 0 : poseKeeper(state.keeper, now, state.holding)
    // A ball in her hands comes down with her as she lands.
    poseBall(dropped ? { ...state.ball, y: Math.max(BALL_R + 0.12, state.ball.y - dropped) } : state.ball)
    // A ball just touched swells for a moment (squash is 0 to 1).
    const sq = clamp(state.squash || 0, 0, 1)
    ball.scale.setScalar(1 + sq * 0.16)
    if (state.aim) {
      aimGroup.visible = true
      aimMat.opacity = state.aim.faint ? 0.5 : 1
      aimGroup.position.set(state.aim.x, state.aim.y, L + 0.06)
      const pulse = 1 + Math.sin(now * 6) * 0.06
      aimGroup.scale.setScalar(pulse)
    } else {
      aimGroup.visible = false
    }
    updateNet(now)
    snow(now)
    twinkle(now)
    const cheering = now < cheerUntil
    if (cheering || wasCheering) placeCrowd(now, cheering)
    wasCheering = cheering
    renderer.render(scene, camera)
  }

  const onLostContext = (e) => {
    e.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', onLostContext)

  function dispose() {
    canvas.removeEventListener('webglcontextlost', onLostContext)
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else if (m) m.dispose()
    })
    for (const d of disposables) d.dispose?.()
    for (const p of [taker, keeper, ...(wall || [])]) {
      for (const mat of Object.values(p.mats)) mat.dispose()
      p.numberTex?.dispose()
    }
    bodies.dispose()
    heads.dispose()
    hats.dispose()
    bobbles.dispose()
    bulbMesh.dispose()
    renderer.renderLists.dispose()
    renderer.dispose()
    try { renderer.forceContextLoss() } catch { /* already lost */ }
  }

  return {
    kind: '3d',
    resize(w, h, ratio) {
      width = w
      height = h
      renderer.setPixelRatio(Math.min(2, ratio || 1))
      renderer.setSize(w, h, false)
    },
    setTeams(next) {
      teams = { ...teams, ...next }
      taker.setKit(teams.taker, teams.number)
      taker.setLook(teams.look || 0)
      keeper.setKit(teams.keeper)
      keeper.setLook(teams.keeperLook || 0)
    },
    geometry() { return screenGeometry('shoot', width, height) },
    draw,
    ripple(p, strength = 1) { ripple = { x: p.x, y: p.y, z: p.z, amp: 0.18 + 0.32 * strength, at: lastNow } },
    celebrate(seconds) { cheerUntil = lastNow + seconds },
    dispose,
  }
}
