// The 3D scene of the appeal's story (index.js runs it; path.js says
// where things stand and where the camera is).
//
// A snowy sports field on a winter's night, with the things the appeal is
// about standing in a row: the table tennis tables, the cricket square
// being watered and the rugby posts in their protectors, which the PSA
// has funded, and the football box goals and the cricket covers it is
// raising for now, each in a ring of gold with sparks rising round it.
//
// It is dressed as the Winter Fayre's poster is (John, 13 November 2026):
// a deep navy night, snowflakes and four-pointed stars in the poster's
// teal and gold hung among the trees, the fayre's own navy boards beside
// the appeal's plum ones, snow under the Christmas trees, presents and a
// snowman or two.
//
// The things are made to look as the College's own do in the picture
// John supplied (13 November 2026): dark blue tables on white frames,
// white and blue post protectors with the College's name up them, a
// white box goal on wheels with a square net, and blue covers. They are
// drawn here from plain shapes, in the site's own style: no photograph,
// no model and no maker's name is used.

import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, RepeatWrapping, RingGeometry, Scene,
  SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer,
} from 'three'
import { PLACES, RAISING, viewAt, cheerAt } from './path.js'

const PI = Math.PI
// three.js counts light a factor of pi higher than these numbers were
// set by, as the stadium's scene does.
const LIGHT = PI
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const fract = (v) => v - Math.floor(v)

export const PLUM = '#5c3351'
export const GOLD = '#f0c05a'
// The Winter Fayre's own colours, after its poster: a deep navy, the
// teal and the ice blue of its snowflakes, and white.
export const FAYRE = { navy: '#1a2a47', night: '#0b1322', teal: '#3fb8c9', ice: '#8fd6e8', red: '#c8102e' }
// The colours of the College's own things, as in the picture supplied.
export const COLOURS = {
  table: '#1f4d8c', // the tables' tops: a deep blue
  frame: '#eef1f6', // their frames, the goals and the posts: white
  pad: '#22408f', // the lower half of a post protector: blue
  cover: '#2a50b4', // the cricket covers: blue
}
const UP = new Vector3(0, 1, 0)
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'

// A small steady source of numbers, so the scene is the same each time.
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// words   the appeal's name, for its boards along the back
// boards  the words on all the boards, turn and turn about, as round the
//         games' pitch; the appeal's own board is plum, the rest navy
// college the name up the post protectors, as on the College's own
export function createStoryScene({ canvas, win = globalThis.window, words = 'Sports Fund Appeal', boards = [], college = 'Wymondham College' }) {
  const doc = win.document
  const dpr = Math.min(2, win.devicePixelRatio || 1)
  const renderer = new WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' })
  renderer.setPixelRatio(dpr)
  const scene = new Scene()
  const camera = new PerspectiveCamera(46, 1, 0.1, 260)
  const rnd = seeded(20261114)
  const kept = new Set()
  const keep = (x) => { kept.add(x); return x }
  let width = 1
  let height = 1

  const drawn = (w, h, draw) => {
    const c = doc.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d'), w, h)
    const t = keep(new CanvasTexture(c))
    t.colorSpace = SRGBColorSpace
    return t
  }
  // Lettering is drawn at once, and again when the site's own type has come.
  const lettered = (w, h, draw) => {
    const t = drawn(w, h, draw)
    try {
      doc.fonts?.load?.(`800 80px ${FONT}`).then(() => {
        draw(t.image.getContext('2d'), w, h)
        t.needsUpdate = true
      }, () => {})
    } catch { /* it keeps the lettering it has */ }
    return t
  }
  const lam = (color, more = {}) => keep(new MeshLambertMaterial({ color: new Color(color), ...more }))
  const flat = (color, more = {}) => keep(new MeshBasicMaterial({ color: new Color(color), ...more }))
  const box = (w, h, d) => keep(new BoxGeometry(w, h, d))
  const put = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new Mesh(geometry, material)
    m.position.set(x, y, z)
    parent.add(m)
    return m
  }
  // A round bar from one point to another.
  const dir = new Vector3()
  const bar = (parent, a, b, r, material) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const m = new Mesh(keep(new CylinderGeometry(r, r, dir.length(), 10)), material)
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    m.quaternion.setFromUnitVectors(UP, dir.normalize())
    parent.add(m)
    return m
  }

  // The sky: the poster's navy night, lifting to the appeal's plum where
  // it meets the trees.
  scene.background = drawn(4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, FAYRE.night)
    grad.addColorStop(0.5, FAYRE.navy)
    grad.addColorStop(0.82, '#33305c')
    grad.addColorStop(1, '#4d2f5c')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  scene.fog = new Fog(new Color('#27294c'), 46, 150)
  scene.add(new HemisphereLight(0xe6edff, 0x2c4a3a, 0.92 * LIGHT))
  const moon = new DirectionalLight(0xfff2dc, 0.62 * LIGHT)
  moon.position.set(-10, 18, 14)
  scene.add(moon)
  // A soft light from the camera's side, so no face it sees is in the dark.
  const fill = new DirectionalLight(0xfff6ea, 0.3 * LIGHT)
  fill.position.set(6, 6, 20)
  scene.add(fill)

  // The field: mown in stripes, under a dusting of snow.
  const grass = drawn(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#2f6b4c' : '#285f43'
      g.fillRect((i * w) / 8, 0, w / 8, h)
    }
    const r = seeded(7)
    g.fillStyle = 'rgba(255,255,255,0.10)'
    for (let i = 0; i < 520; i++) g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
  })
  grass.wrapS = grass.wrapT = RepeatWrapping
  grass.repeat.set(6, 4)
  const ground = put(scene, keep(new PlaneGeometry(240, 160)), lam('#ffffff', { map: grass }), 0, 0, 0)
  ground.rotation.x = -PI / 2

  // A pool of warm light on the grass under each thing, as if lit for the evening.
  const pool = drawn(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,226,160,0.50)')
    grad.addColorStop(0.55, 'rgba(255,214,140,0.16)')
    grad.addColorStop(1, 'rgba(255,214,140,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  const poolMat = flat('#ffffff', { map: pool, transparent: true, depthWrite: false })
  const poolGeo = keep(new CircleGeometry(8.5, 32))
  for (const at of Object.values(PLACES)) {
    const p = put(scene, poolGeo, poolMat, at.x, 0.02, at.z + 0.5)
    p.rotation.x = -PI / 2
  }
  // A ring of gold on the grass round each thing still being raised for.
  const ringMat = flat(GOLD, { transparent: true, depthWrite: false, side: DoubleSide })
  const ringGeo = keep(new RingGeometry(7.3, 7.55, 64))
  for (const name of RAISING) {
    const r = put(scene, ringGeo, ringMat, PLACES[name].x, 0.05, PLACES[name].z - 0.6)
    r.rotation.x = -PI / 2
  }

  // A soft round dot, for snow, water, sparks and fairy lights.
  const dot = drawn(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.75)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  const cloud = (count, material) => {
    const geometry = keep(new BufferGeometry())
    const at = new Float32Array(count * 3)
    geometry.setAttribute('position', new BufferAttribute(at, 3))
    const points = new Points(geometry, material)
    points.frustumCulled = false
    scene.add(points)
    return { at, geometry, points }
  }

  const white = lam(COLOURS.frame)
  const bright = lam('#fafbfe', { emissive: new Color('#2b2b36') })
  const dark = lam('#2a2030')
  const black = lam('#15131a')
  const steel = lam('#b9c2cf')
  const line = flat('#ffffff')

  // ------------------------------------------------------------------
  // Along the back: the boards, the fairy lights and the Christmas trees.
  // ------------------------------------------------------------------
  const BACK = -19
  // A board's face. The appeal's own is plum with gold lettering; the
  // rest are the fayre's navy, their first word in gold and the rest in
  // white, as "Winter Fayre" is on its poster.
  const face = (text) => lettered(1024, 128, (g, w, h) => {
    const appeal = text === words
    g.fillStyle = appeal ? '#3d2137' : FAYRE.navy
    g.fillRect(0, 0, w, h)
    g.fillStyle = appeal ? GOLD : FAYRE.ice
    g.fillRect(0, 0, w, 7)
    g.fillRect(0, h - 7, w, 7)
    g.font = `800 84px ${FONT}`
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    const said = String(text).toUpperCase()
    const cut = appeal ? said.length : (said.indexOf(' ') < 0 ? said.length : said.indexOf(' '))
    const first = said.slice(0, cut)
    const rest = said.slice(cut)
    const wide = Math.min(w - 60, g.measureText(said).width)
    const squeeze = wide / (g.measureText(said).width || 1)
    let x = (w - wide) / 2
    g.fillStyle = GOLD
    g.fillText(first, x, h / 2 + 4, g.measureText(first).width * squeeze)
    x += g.measureText(first).width * squeeze
    g.fillStyle = '#ffffff'
    if (rest) g.fillText(rest, x, h / 2 + 4, g.measureText(rest).width * squeeze)
  })
  const signs = (boards.length ? boards : [words]).map(text => flat('#ffffff', { map: face(text) }))
  const boardGeo = box(11.6, 1.45, 0.25)
  const snowCap = box(11.7, 0.12, 0.34)
  for (let i = -4; i <= 4; i++) {
    put(scene, boardGeo, signs[(i + 4) % signs.length], i * 12, 0.73, BACK)
    put(scene, snowCap, white, i * 12, 1.5, BACK)
  }
  // Behind the boards the ground is under snow, and the trees stand in it.
  const snowfield = put(scene, keep(new PlaneGeometry(260, 90)), lam('#e7edf7'), 0, 0.03, BACK - 45.2)
  snowfield.rotation.x = -PI / 2

  // Fairy lights, strung from pole to pole above the boards.
  const BULBS = ['#ffd166', '#bfe3ff', '#ff6b6b', '#7be0a0']
  const poles = []
  for (let x = -54; x <= 54; x += 12) poles.push(x)
  const poleGeo = keep(new CylinderGeometry(0.07, 0.07, 4.6, 6))
  for (const x of poles) put(scene, poleGeo, dark, x, 2.3, BACK - 0.6)
  const perSpan = 11
  const bulbs = cloud((poles.length - 1) * perSpan, keep(new PointsMaterial({ size: 0.62, map: dot, transparent: true, depthWrite: false, vertexColors: true, blending: AdditiveBlending, fog: false })))
  const tint = new Float32Array(bulbs.at.length)
  const c = new Color()
  for (let s = 0; s < poles.length - 1; s++) {
    for (let i = 0; i < perSpan; i++) {
      const k = (i + 0.5) / perSpan
      const n = s * perSpan + i
      bulbs.at[n * 3] = lerp(poles[s], poles[s + 1], k)
      // The string sags between its poles.
      bulbs.at[n * 3 + 1] = 4.5 - Math.sin(k * PI) * 1.1
      bulbs.at[n * 3 + 2] = BACK - 0.6
      c.set(BULBS[n % BULBS.length])
      tint[n * 3] = c.r
      tint[n * 3 + 1] = c.g
      tint[n * 3 + 2] = c.b
    }
  }
  bulbs.geometry.setAttribute('color', new BufferAttribute(tint, 3))

  const driftGeo = keep(new SphereGeometry(1, 10, 6))
  // Christmas trees behind the boards, snow on their tops and a star above.
  const bough = lam('#1f5a3f')
  const farBough = lam('#17382f')
  const star = flat('#ffe08a')
  const tierGeo = [keep(new ConeGeometry(2.3, 2.6, 9)), keep(new ConeGeometry(1.75, 2.3, 9)), keep(new ConeGeometry(1.15, 2.0, 9))]
  const capGeo = keep(new ConeGeometry(0.62, 0.9, 9))
  const trunkGeo = keep(new CylinderGeometry(0.32, 0.36, 1.2, 7))
  const starGeo = keep(new SphereGeometry(0.3, 8, 6))
  const tree = (x, z, scale, lit) => {
    const g = new Group()
    put(g, trunkGeo, dark, 0, 0.6, 0)
    put(g, tierGeo[0], lit ? bough : farBough, 0, 2.3, 0)
    put(g, tierGeo[1], lit ? bough : farBough, 0, 3.8, 0)
    put(g, tierGeo[2], lit ? bough : farBough, 0, 5.1, 0)
    if (lit) {
      put(g, capGeo, white, 0, 5.75, 0)
      put(g, starGeo, star, 0, 6.35, 0)
    }
    g.position.set(x, 0, z)
    g.scale.setScalar(scale)
    scene.add(g)
  }
  const litTrees = []
  for (let i = -4; i <= 4; i++) {
    const lit = { x: i * 12 + 6, z: BACK - 4.5, scale: 1 + rnd() * 0.25 }
    litTrees.push(lit)
    tree(lit.x, lit.z, lit.scale, true)
  }
  for (let i = -9; i <= 9; i++) tree(i * 7 + rnd() * 3, BACK - 12 - rnd() * 6, 1.25 + rnd() * 0.7, false)
  // Lights on the Christmas trees, on the side that faces the field.
  const PER_TREE = 13
  const baubles = cloud(litTrees.length * PER_TREE, keep(new PointsMaterial({ size: 0.5, map: dot, transparent: true, depthWrite: false, vertexColors: true, blending: AdditiveBlending, fog: false })))
  const baubleTint = new Float32Array(baubles.at.length)
  const BAUBLES = [GOLD, '#ffffff', FAYRE.teal, '#ff6b6b']
  litTrees.forEach((lit, t) => {
    for (let k = 0; k < PER_TREE; k++) {
      const n = t * PER_TREE + k
      // A tree is widest low down: a light is put on its outside at its height.
      const up = 1.5 + rnd() * 4.2
      const out = (2.3 * (1 - (up - 1) / 5.4) + 0.12) * lit.scale
      const round = (rnd() - 0.5) * 2.6
      baubles.at[n * 3] = lit.x + Math.sin(round) * out
      baubles.at[n * 3 + 1] = up * lit.scale
      baubles.at[n * 3 + 2] = lit.z + Math.cos(round) * out
      c.set(BAUBLES[n % BAUBLES.length])
      baubleTint[n * 3] = c.r
      baubleTint[n * 3 + 1] = c.g
      baubleTint[n * 3 + 2] = c.b
    }
  })
  baubles.geometry.setAttribute('color', new BufferAttribute(baubleTint, 3))

  // The poster's snowflakes: six arms each, in three patterns, drawn in
  // white so each can be given the poster's teal, ice blue or gold.
  const flakeArt = (kind) => drawn(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2)
    g.strokeStyle = '#ffffff'
    g.lineCap = 'round'
    g.lineWidth = 5
    const R = 54
    const stroke = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke() }
    for (let i = 0; i < 6; i++) {
      g.save()
      g.rotate((i * PI) / 3)
      stroke(0, 0, 0, -R)
      if (kind === 0) {
        // Two pairs of branches up each arm.
        for (const [at, len] of [[0.42, 0.3], [0.7, 0.2]]) for (const side of [-1, 1]) stroke(0, -R * at, side * R * len * 0.87, -R * (at + len * 0.5))
      } else if (kind === 1) {
        // A diamond at each tip and a ring half way up.
        g.beginPath(); g.moveTo(0, -R); g.lineTo(8, -R + 12); g.lineTo(0, -R + 24); g.lineTo(-8, -R + 12); g.closePath(); g.stroke()
        g.beginPath(); g.arc(0, -R * 0.4, 5, 0, PI * 2); g.stroke()
      } else {
        // A short spoke between each pair of arms, and a fork at each tip.
        for (const side of [-1, 1]) stroke(0, -R * 0.78, side * R * 0.16, -R)
        g.rotate(PI / 6)
        stroke(0, -R * 0.24, 0, -R * 0.56)
      }
      g.restore()
    }
    if (kind === 2) { g.beginPath(); g.arc(0, 0, R * 0.22, 0, PI * 2); g.stroke() }
  })
  // And its four-pointed stars.
  const sparkleArt = drawn(128, 128, (g, w, h) => {
    g.translate(w / 2, h / 2)
    g.fillStyle = '#ffffff'
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4
      const far = i % 2 ? 8 : 60
      g.lineTo(Math.sin(a) * far, -Math.cos(a) * far)
    }
    g.closePath()
    g.fill()
  })
  const flakes = [0, 1, 2].map(flakeArt)
  const hang = (map, colour) => keep(new SpriteMaterial({ map, color: new Color(colour), transparent: true, depthWrite: false, fog: false }))
  const flakeMats = flakes.flatMap(art => [hang(art, FAYRE.teal), hang(art, FAYRE.ice), hang(art, GOLD)])
  const sparkleMats = [hang(sparkleArt, GOLD), hang(sparkleArt, '#ffffff'), hang(sparkleArt, FAYRE.teal)]
  // They hang among the trees behind the boards, all the way along.
  const HUNG = 44
  const hung = []
  for (let i = 0; i < HUNG; i++) {
    const star = i % 4 === 3
    const mats = star ? sparkleMats : flakeMats
    const sprite = new Sprite(mats[Math.floor(rnd() * mats.length)])
    const size = star ? 1.1 + rnd() * 1.3 : 1.7 + rnd() * 2.1
    const y = 3.6 + rnd() * 8.8
    sprite.position.set(-66 + (i + rnd()) * (132 / HUNG), y, BACK - 6.6 - rnd() * 4)
    sprite.scale.set(size, size, 1)
    scene.add(sprite)
    hung.push({ sprite, y, size, star, beat: rnd() * 10 })
  }
  // And a few large ones high over the field itself, for the sky of the
  // wide views: too high to come into a close one.
  const HIGH = 16
  for (let i = 0; i < HIGH; i++) {
    const star = i % 5 === 4
    const mats = star ? sparkleMats : flakeMats
    const sprite = new Sprite(mats[Math.floor(rnd() * mats.length)])
    const size = star ? 1.6 + rnd() * 1.2 : 2.3 + rnd() * 1.6
    const y = 10.5 + rnd() * 7
    sprite.position.set(-44 + (i + rnd()) * (88 / HIGH), y, -15 + rnd() * 11)
    sprite.scale.set(size, size, 1)
    scene.add(sprite)
    hung.push({ sprite, y, size, star, beat: rnd() * 10 })
  }

  // Presents at the foot of the boards, wrapped in the fayre's colours.
  const WRAP = [FAYRE.red, FAYRE.teal, GOLD, '#ffffff', FAYRE.navy]
  const wrapMats = WRAP.map(colour => lam(colour))
  const unit = box(1, 1, 1)
  const present = (x, z, wide, high, wrap, ribbon, turn) => {
    const g = new Group()
    const body = put(g, unit, wrapMats[wrap], 0, high / 2, 0)
    body.scale.set(wide, high, wide)
    for (const across of [0, 1]) {
      const band = put(g, unit, wrapMats[ribbon], 0, high / 2, 0)
      band.scale.set(across ? wide * 1.03 : wide * 0.16, high * 1.03, across ? wide * 0.16 : wide * 1.03)
    }
    const bow = put(g, driftGeo, wrapMats[ribbon], 0, high + wide * 0.08, 0)
    bow.scale.set(wide * 0.22, wide * 0.12, wide * 0.22)
    g.position.set(x, 0, z)
    g.rotation.y = turn
    scene.add(g)
  }

  // A snowman: three balls of snow, coal for eyes, a carrot, a scarf and
  // a Christmas hat.
  const snowMat = lam('#f4f7fc')
  const carrot = lam('#f08a2c')
  const hat = lam(FAYRE.red)
  const ball = keep(new SphereGeometry(1, 16, 12))
  const noseGeo = keep(new ConeGeometry(0.09, 0.42, 8))
  const hatGeo = keep(new ConeGeometry(0.42, 0.8, 12))
  const brimGeo = keep(new TorusGeometry(0.42, 0.09, 8, 16))
  const scarfGeo = keep(new TorusGeometry(0.5, 0.12, 8, 16))
  const snowman = (x, z, scarf, turn) => {
    const g = new Group()
    for (const [r, y] of [[0.95, 0.85], [0.68, 2.1], [0.47, 3.02]]) put(g, ball, snowMat, 0, y, 0).scale.setScalar(r)
    for (const side of [-1, 1]) put(g, ball, black, side * 0.17, 3.12, 0.41).scale.setScalar(0.055)
    for (const y of [1.9, 2.25]) put(g, ball, black, 0, y, 0.66).scale.setScalar(0.06)
    const nose = put(g, noseGeo, carrot, 0, 3.0, 0.62)
    nose.rotation.x = PI / 2
    const wrap = put(g, scarfGeo, wrapMats[scarf], 0, 2.66, 0)
    wrap.rotation.x = PI / 2
    put(g, unit, wrapMats[scarf], 0.3, 2.3, 0.42).scale.set(0.2, 0.62, 0.08)
    const brim = put(g, brimGeo, snowMat, 0, 3.36, 0)
    brim.rotation.x = PI / 2
    put(g, hatGeo, hat, 0, 3.76, 0)
    put(g, ball, snowMat, 0, 4.18, 0).scale.setScalar(0.12)
    g.position.set(x, 0, z)
    g.rotation.y = turn
    scene.add(g)
  }

  // Drifts of snow along the foot of the boards.
  for (let i = 0; i < 26; i++) {
    const d = put(scene, driftGeo, white, -56 + i * 4.5 + rnd() * 2, 0, BACK + 0.9 + rnd() * 0.8)
    d.scale.set(1.6 + rnd() * 1.6, 0.22 + rnd() * 0.2, 0.8 + rnd() * 0.5)
  }
  // Between the things, in front of the boards: a pile of presents, or a
  // snowman with presents at his feet.
  ;[-30, -18, -6, 6, 18, 30].forEach((x, i) => {
    const z = BACK + 2.2
    if (i % 2) snowman(x + 0.4, z + 0.3, i % 3 === 0 ? 1 : 0, (rnd() - 0.5) * 0.7)
    const at = i % 2 ? x - 1.9 : x
    present(at - 0.9, z + 0.2, 1.25, 1.0, i % 5, (i + 2) % 5 === i % 5 ? 3 : (i + 2) % 5, rnd() * 0.6)
    present(at + 0.55, z - 0.1, 0.95, 1.3, (i + 1) % 5, 2, -rnd() * 0.5)
    present(at - 0.1, z + 1.25, 0.8, 0.7, (i + 3) % 5, i % 2 ? 3 : 2, rnd() * 0.9)
  })

  // ------------------------------------------------------------------
  // Already funded: the table tennis tables. Deep blue tops with white
  // lines, on white frames with a trolley of small wheels under the
  // middle, and a dark net with a white tape along its top.
  // ------------------------------------------------------------------
  const tables = new Group()
  tables.position.set(PLACES.tables.x, 0, PLACES.tables.z)
  scene.add(tables)
  const TABLE = { long: 2.74, wide: 1.525, high: 0.76 }
  const tableTop = lam(COLOURS.table)
  const netting = flat('#131c33', { transparent: true, opacity: 0.84 })
  const topGeo = box(TABLE.long, 0.05, TABLE.wide)
  const edgeLong = box(TABLE.long, 0.008, 0.03)
  const midLine = box(TABLE.long, 0.008, 0.012)
  const edgeWide = box(0.03, 0.008, TABLE.wide)
  const apronLong = box(TABLE.long - 0.16, 0.07, 0.03)
  const apronWide = box(0.03, 0.07, TABLE.wide - 0.16)
  const legGeo = box(0.05, TABLE.high - 0.09, 0.05)
  const footGeo = box(0.05, 0.05, TABLE.wide - 0.36)
  const trolleyGeo = box(0.56, 0.05, TABLE.wide - 0.3)
  const strutGeo = box(0.05, 0.52, 0.05)
  const castorGeo = keep(new CylinderGeometry(0.06, 0.06, 0.05, 10))
  const netGeo = box(0.012, 0.1525, TABLE.wide + 0.3)
  const tapeGeo = box(0.02, 0.024, TABLE.wide + 0.3)
  const clampGeo = box(0.04, 0.2, 0.04)
  const table = (x, z) => {
    const g = new Group()
    const y = TABLE.high
    put(g, topGeo, tableTop, 0, y - 0.025, 0)
    for (const sz of [-1, 1]) put(g, edgeLong, line, 0, y + 0.004, sz * (TABLE.wide / 2 - 0.015))
    put(g, midLine, line, 0, y + 0.004, 0)
    for (const sx of [-1, 1]) put(g, edgeWide, line, sx * (TABLE.long / 2 - 0.015), y + 0.004, 0)
    // The white frame: a rail under the top's edge, a leg at each
    // corner, a foot joining each pair, and the trolley under the middle.
    for (const sz of [-1, 1]) put(g, apronLong, white, 0, y - 0.085, sz * (TABLE.wide / 2 - 0.08))
    for (const sx of [-1, 1]) {
      put(g, apronWide, white, sx * (TABLE.long / 2 - 0.08), y - 0.085, 0)
      for (const sz of [-1, 1]) put(g, legGeo, white, sx * (TABLE.long / 2 - 0.32), (y - 0.09) / 2, sz * (TABLE.wide / 2 - 0.18))
      put(g, footGeo, white, sx * (TABLE.long / 2 - 0.32), 0.1, 0)
    }
    put(g, trolleyGeo, white, 0, 0.15, 0)
    for (const sz of [-1, 1]) {
      put(g, strutGeo, white, 0, 0.41, sz * (TABLE.wide / 2 - 0.3))
      for (const sx of [-1, 1]) {
        const w = put(g, castorGeo, black, sx * 0.22, 0.06, sz * (TABLE.wide / 2 - 0.22))
        w.rotation.z = PI / 2
      }
    }
    put(g, netGeo, netting, 0, y + 0.076, 0)
    put(g, tapeGeo, line, 0, y + 0.1525, 0)
    for (const sz of [-1, 1]) put(g, clampGeo, black, 0, y + 0.06, sz * (TABLE.wide / 2 + 0.15))
    g.position.set(x, 0, z)
    g.scale.setScalar(1.45)
    tables.add(g)
    return g
  }
  // A full set: four in a row, the nearest being played on.
  const nearTable = table(0, 1.9)
  for (let i = 1; i <= 3; i++) table(0, 1.9 - i * 4.3)
  const bat = lam('#d8283c')
  const grip = lam('#c9a26a')
  const batGeo = keep(new CylinderGeometry(0.1, 0.1, 0.02, 14))
  const gripGeo = box(0.035, 0.13, 0.03)
  const bats = [-1, 1].map((side) => {
    const g = new Group()
    const face = put(g, batGeo, bat, 0, 0.1, 0)
    face.rotation.z = PI / 2
    put(g, gripGeo, grip, 0, -0.05, 0)
    g.userData.side = side
    nearTable.add(g)
    return g
  })
  const pingPong = put(nearTable, keep(new SphereGeometry(0.045, 10, 8)), flat('#fff3d6'), 0, 1, 0)

  // ------------------------------------------------------------------
  // Already funded: the cricket square, watered.
  // ------------------------------------------------------------------
  const strawMat = lam('#d2c48e')
  const squareMat = lam('#3c8a5c')
  const stumpMat = lam('#e9dcae')
  const stumpGeo = keep(new CylinderGeometry(0.022, 0.022, 0.72, 6))
  const bailGeo = box(0.24, 0.025, 0.03)
  const creaseGeo = box(3.3, 0.012, 0.06)
  // A cricket square: the lighter mown square, the strip down its
  // middle, a crease and a set of stumps at each end.
  const cricketSquare = (parent, stumps = true) => {
    const mown = put(parent, keep(new PlaneGeometry(13, 21)), squareMat, 0, 0.012, 0)
    mown.rotation.x = -PI / 2
    put(parent, box(3.05, 0.03, 20.1), strawMat, 0, 0.02, 0)
    for (const end of [-1, 1]) {
      put(parent, creaseGeo, line, 0, 0.042, end * 8.8)
      if (!stumps) continue
      for (const sx of [-0.115, 0, 0.115]) put(parent, stumpGeo, stumpMat, sx, 0.36, end * 10.02)
      put(parent, bailGeo, stumpMat, 0, 0.735, end * 10.02)
    }
  }
  const water = new Group()
  water.position.set(PLACES.water.x, 0, PLACES.water.z - 1.5)
  scene.add(water)
  cricketSquare(water)
  // The sprinkler: three feet, a stem and a brass head that turns, fed
  // by a hose that runs off across the grass.
  const brass = lam('#d9a441', { emissive: new Color('#3a2606') })
  const hose = lam('#27508f')
  const SPRINKLE = 3
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * PI) / 3 + 0.5
    bar(water, [0, 0.42, SPRINKLE], [Math.cos(a) * 0.42, 0.03, SPRINKLE + Math.sin(a) * 0.42], 0.025, steel)
  }
  bar(water, [0, 0.4, SPRINKLE], [0, 0.86, SPRINKLE], 0.04, steel)
  const head = put(water, box(0.6, 0.08, 0.08), brass, 0, 0.9, SPRINKLE)
  put(water, keep(new SphereGeometry(0.07, 10, 8)), brass, 0, 0.9, SPRINKLE)
  const HOSE = [[-0.1, SPRINKLE + 0.1], [-2.4, SPRINKLE + 2.2], [-3.2, SPRINKLE + 5.4], [-5.8, SPRINKLE + 8.2], [-6.4, SPRINKLE + 13]]
  for (let i = 1; i < HOSE.length; i++) bar(water, [HOSE[i - 1][0], 0.05, HOSE[i - 1][1]], [HOSE[i][0], 0.05, HOSE[i][1]], 0.045, hose)
  // Its two jets, as drops that fly out and fall in a turning spiral.
  const DROPS = 170
  const spray = cloud(DROPS, keep(new PointsMaterial({ size: 0.2, map: dot, color: new Color('#cdeaff'), transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending })))
  const SPRINKLER = { x: PLACES.water.x, y: 0.92, z: PLACES.water.z - 1.5 + SPRINKLE, reach: 5.6, turn: 0.9, flight: 1.15 }

  // ------------------------------------------------------------------
  // Already funded: the rugby posts, in their protectors. Each is a
  // square pad round the foot of a post: white above and blue below,
  // with the College's name up the blue in white.
  // ------------------------------------------------------------------
  const posts = new Group()
  posts.position.set(PLACES.posts.x, 0, PLACES.posts.z)
  scene.add(posts)
  const POST = { half: 2.8, bar: 3, high: 10.5 }
  const PAD = { wide: 0.6, high: 1.95, white: 0.4 }
  const padFace = lettered(256, 832, (g, w, h) => {
    g.fillStyle = '#f4f6fa'
    g.fillRect(0, 0, w, h)
    g.fillStyle = COLOURS.pad
    g.fillRect(0, h * PAD.white, w, h * (1 - PAD.white))
    // The name runs up the pad, to be read with the head tilted.
    g.save()
    g.translate(w / 2, h * (PAD.white + (1 - PAD.white) / 2))
    g.rotate(-PI / 2)
    g.fillStyle = '#ffffff'
    g.font = `800 96px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(college).toUpperCase(), 0, 6, h * (1 - PAD.white) - 40)
    g.restore()
  })
  const padSide = lam('#ffffff', { map: padFace })
  const padGeo = box(PAD.wide, PAD.high, PAD.wide)
  // The four sides carry the lettering; the top and the foot are plain.
  const padMats = [padSide, padSide, white, white, padSide, padSide]
  for (const sx of [-1, 1]) {
    bar(posts, [sx * POST.half, 0, 0], [sx * POST.half, POST.high, 0], 0.075, bright)
    put(posts, padGeo, padMats, sx * POST.half, PAD.high / 2, 0)
  }
  bar(posts, [-POST.half, POST.bar, 0], [POST.half, POST.bar, 0], 0.075, bright)
  // A ball kicked between them, over and over.
  const oval = put(posts, keep(new SphereGeometry(0.2, 12, 8)), lam('#f3ead2'), 0, 0.3, 8)
  oval.scale.set(0.72, 0.72, 1.18)

  // ------------------------------------------------------------------
  // Now raising for: the football box goals. A white frame with the net
  // held square behind it, on wheels: one full-sized and one of the
  // nine-a-side size.
  // ------------------------------------------------------------------
  const netTile = drawn(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,255,255,0.95)'
    g.lineWidth = 3.4
    for (let i = 0; i <= 4; i++) {
      const p = (i * w) / 4
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke()
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke()
    }
  })
  netTile.wrapS = netTile.wrapT = RepeatWrapping
  netTile.anisotropy = 4
  const netMat = flat('#ffffff', { map: netTile, transparent: true, side: DoubleSide, depthWrite: false })
  const tyreGeo = keep(new CylinderGeometry(0.16, 0.16, 0.09, 14))
  const hubGeo = keep(new CylinderGeometry(0.07, 0.07, 0.1, 10))
  // half the width between the posts, the height of the bar, and how far
  // back the net is held.
  const boxGoal = (half, high, deep) => {
    const g = new Group()
    const thick = 0.075
    const thin = 0.045
    // The mouth: two posts and the crossbar.
    bar(g, [-half, 0, 0], [-half, high, 0], thick, bright)
    bar(g, [half, 0, 0], [half, high, 0], thick, bright)
    bar(g, [-half - thick, high, 0], [half + thick, high, 0], thick, bright)
    for (const sx of [-1, 1]) {
      const x = sx * half
      // Each side: a bar back from the top of the post, a stay down to
      // the ground, and a bar along the ground back to the post.
      bar(g, [x, high, 0], [x, high, -deep], thin, bright)
      bar(g, [x, high, -deep], [x, 0.06, -deep], thin, bright)
      bar(g, [x, 0.06, 0], [x, 0.06, -deep], thin, bright)
      // And its wheels, one behind the post and one at the back.
      for (const z of [-0.42, -deep + 0.18]) {
        const tyre = put(g, tyreGeo, black, x + sx * 0.13, 0.16, z)
        tyre.rotation.z = PI / 2
        const hub = put(g, hubGeo, white, x + sx * 0.13, 0.16, z)
        hub.rotation.z = PI / 2
      }
    }
    bar(g, [-half, high, -deep], [half, high, -deep], thin, bright)
    bar(g, [-half, 0.06, -deep], [half, 0.06, -deep], thin, bright)
    // The net: square behind, flat on top and straight down each side.
    const panel = (w, h, x, y, z, rx, ry) => {
      const geometry = keep(new PlaneGeometry(w, h))
      // The net's squares are the same size on every panel.
      const uv = geometry.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.8), uv.getY(i) * (h / 0.8))
      const m = put(g, geometry, netMat, x, y, z)
      m.rotation.set(rx, ry, 0)
      m.renderOrder = 2
    }
    panel(half * 2, high, 0, high / 2, -deep, 0, 0)
    panel(half * 2, deep, 0, high, -deep / 2, -PI / 2, 0)
    panel(deep, high, -half, high / 2, -deep / 2, 0, PI / 2)
    panel(deep, high, half, high / 2, -deep / 2, 0, PI / 2)
    return g
  }
  const GOAL = { half: 3.66, high: 2.44, deep: 1.9 }
  const goal = boxGoal(GOAL.half, GOAL.high, GOAL.deep)
  goal.position.set(PLACES.goals.x, 0, PLACES.goals.z + 0.6)
  scene.add(goal)
  const small = boxGoal(2.44, 1.83, 1.45)
  small.position.set(PLACES.goals.x + 5.4, 0, PLACES.goals.z - 6.6)
  small.rotation.y = -0.5
  scene.add(small)
  // A football, struck into the big goal over and over.
  const football = put(goal, keep(new SphereGeometry(0.2, 14, 10)), lam('#ffffff'), 0, 0.2, 5)
  const SHOT = { from: [1.4, 0.2, 5.6], to: [-1.3, 1.25, -GOAL.deep + 0.45] }

  // ------------------------------------------------------------------
  // Now raising for: the cricket pitch covers. A long low blue roof on
  // a wheeled frame, rolled over the strip.
  // ------------------------------------------------------------------
  const covers = new Group()
  covers.position.set(PLACES.covers.x, 0, PLACES.covers.z - 1.5)
  scene.add(covers)
  cricketSquare(covers, false)
  const COVER = { half: 2.05, high: 0.6, long: 10.4, at: 1.2 }
  const sheet = lam(COLOURS.cover, { side: DoubleSide, emissive: new Color('#0b1a4a') })
  const seam = lam('#1c3a8c')
  const shell = put(covers, keep(new CylinderGeometry(COVER.half, COVER.half, COVER.long, 24, 1, true, PI / 2, PI)), sheet, 0, 0.2, COVER.at)
  shell.rotation.x = PI / 2
  shell.scale.z = COVER.high
  // Its ends are closed with the same sheet.
  const endGeo = keep(new CircleGeometry(COVER.half, 24, 0, PI))
  for (const end of [-1, 1]) {
    const e = put(covers, endGeo, sheet, 0, 0.2, COVER.at + end * (COVER.long / 2))
    e.scale.y = COVER.high
  }
  // The seams where its lengths of sheet join, and the frame it rides on.
  const seamGeo = keep(new TorusGeometry(COVER.half + 0.012, 0.03, 6, 22, PI))
  for (let i = 0; i <= 4; i++) {
    const rib = put(covers, seamGeo, seam, 0, 0.2, COVER.at - COVER.long / 2 + (i * COVER.long) / 4)
    rib.scale.y = COVER.high
  }
  for (const sx of [-1, 1]) {
    bar(covers, [sx * COVER.half, 0.2, COVER.at - COVER.long / 2], [sx * COVER.half, 0.2, COVER.at + COVER.long / 2], 0.05, steel)
    for (const end of [-0.4, 0, 0.4]) {
      const tyre = put(covers, tyreGeo, black, sx * (COVER.half + 0.1), 0.16, COVER.at + end * COVER.long)
      tyre.rotation.z = PI / 2
    }
  }

  // Sparks of gold round the two things being raised for.
  const SPARKS = 46
  const sparkMat = keep(new PointsMaterial({ size: 0.5, map: dot, color: new Color('#ffdf8a'), transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }))
  const sparks = cloud(SPARKS * RAISING.length, sparkMat)
  const sparkSeed = Array.from({ length: SPARKS * RAISING.length }, () => [rnd(), rnd(), rnd(), rnd()])

  // Stars, far off and high, behind everything.
  const STARS = 150
  const stars = cloud(STARS, keep(new PointsMaterial({ size: 1.5, map: dot, color: new Color('#f3e9ff'), transparent: true, opacity: 0.85, depthWrite: false, fog: false })))
  for (let i = 0; i < STARS; i++) {
    const round = (rnd() - 0.5) * PI * 1.5
    const far = 190
    stars.at[i * 3] = Math.sin(round) * far
    stars.at[i * 3 + 1] = 16 + rnd() * 120
    stars.at[i * 3 + 2] = -Math.cos(round) * far
  }

  // Snow, falling over the whole field.
  const FLAKES = 300
  const snow = cloud(FLAKES, keep(new PointsMaterial({ size: 0.26, map: dot, color: new Color('#ffffff'), transparent: true, opacity: 0.9, depthWrite: false })))
  const flake = Array.from({ length: FLAKES }, () => [rnd(), rnd(), rnd(), 0.7 + rnd() * 0.6])
  const SKY = { x: 110, y: 26, z: 70, near: 44 }
  // And a few large ones nearer to, drawn as the poster's snowflakes are.
  const BIG = 46
  const bigSnow = cloud(BIG, keep(new PointsMaterial({ size: 0.85, map: flakes[0], color: new Color('#dff3fb'), transparent: true, opacity: 0.92, depthWrite: false })))
  const bigFlake = Array.from({ length: BIG }, () => [rnd(), rnd(), rnd(), 0.55 + rnd() * 0.5])

  function animate(t, now) {
    // The rally: the ball goes from bat to bat, bouncing once on the far half.
    const leg = now / 0.62
    const way = Math.floor(leg) % 2 ? -1 : 1
    const u = fract(leg)
    const bounce = 0.69
    let y
    if (u < bounce) y = 0.83 + 0.42 * Math.sin(PI * (0.25 + 0.75 * (u / bounce)))
    else y = 0.83 + 0.3 * Math.sin((PI / 2) * ((u - bounce) / (1 - bounce)))
    pingPong.position.set(way * lerp(-1.5, 1.5, u), y, 0.12 * Math.sin(now * 1.7))
    for (const b of bats) {
      // The bat that is about to be hit to comes forward to meet the ball.
      const mine = b.userData.side === way
      const reach = mine ? Math.max(0, (u - 0.72) / 0.28) : Math.max(0, 1 - u / 0.2)
      b.position.set(b.userData.side * (1.66 - 0.14 * reach), 1.05 + 0.05 * reach, 0.12 * Math.sin(now * 1.7))
      b.rotation.z = -b.userData.side * 0.35 * reach
    }

    // The sprinkler turns, and each drop keeps the way it was thrown.
    head.rotation.y = now * SPRINKLER.turn
    for (let i = 0; i < DROPS; i++) {
      const jet = i % 2
      const p = fract(now / SPRINKLER.flight + i / DROPS)
      const thrown = (now - p * SPRINKLER.flight) * SPRINKLER.turn + jet * PI
      const out = SPRINKLER.reach * p * (0.82 + 0.18 * ((i * 7) % 5) / 4)
      spray.at[i * 3] = SPRINKLER.x + Math.cos(thrown) * out
      spray.at[i * 3 + 1] = Math.max(0.05, SPRINKLER.y * (1 - p) + 7.2 * p * (1 - p))
      spray.at[i * 3 + 2] = SPRINKLER.z - Math.sin(thrown) * out
    }
    spray.geometry.attributes.position.needsUpdate = true

    // The kick at the posts: up from in front, between them and away.
    const kick = fract(now / 3.4)
    const k = clamp(kick / 0.62, 0, 1)
    oval.visible = kick < 0.62
    oval.position.set(lerp(-1.3, 0.4, k), 0.3 + 18.8 * k * (1.02 - k), lerp(6.4, -13, k))
    oval.rotation.x = now * 9

    // The shot at the box goal: it waits, is struck, flies in under the
    // bar, drops inside the net and is put back.
    const shot = fract(now / 3.8)
    const fly = clamp((shot - 0.3) / 0.16, 0, 1)
    const drop = clamp((shot - 0.46) / 0.14, 0, 1)
    football.position.set(
      lerp(SHOT.from[0], SHOT.to[0], fly),
      lerp(lerp(SHOT.from[1], SHOT.to[1], fly) + Math.sin(fly * PI) * 0.5, 0.2, drop * drop),
      lerp(SHOT.from[2], SHOT.to[2], fly),
    )
    football.rotation.x = -fly * 16
    // It shrinks away at the end of its turn and comes back at the start.
    football.scale.setScalar(clamp(Math.min(shot / 0.05, (1 - shot) / 0.06), 0, 1))

    // The gold round what is being raised for: quiet until the story's
    // end, then at its liveliest.
    const cheer = cheerAt(t)
    ringMat.opacity = 0.5 + 0.2 * Math.sin(now * 2.1) + 0.25 * cheer
    sparkMat.opacity = clamp(0.55 + 0.45 * cheer, 0, 1)
    sparkMat.size = 0.42 + 0.3 * cheer
    for (let i = 0; i < sparks.at.length / 3; i++) {
      const s = sparkSeed[i]
      const home = PLACES[RAISING[Math.floor(i / SPARKS)]]
      const rise = fract(now * (0.16 + s[3] * 0.14 + 0.1 * cheer) + s[0])
      sparks.at[i * 3] = home.x + (s[1] - 0.5) * 12 + Math.sin(now * 0.8 + s[0] * 9) * 0.3
      sparks.at[i * 3 + 1] = 0.2 + rise * (5.2 + 2 * cheer)
      sparks.at[i * 3 + 2] = home.z - 0.6 + (s[2] - 0.5) * 9
    }
    sparks.geometry.attributes.position.needsUpdate = true

    // Snow: each flake falls at its own pace and drifts a little, and is
    // put back at the top when it lands.
    for (let i = 0; i < FLAKES; i++) {
      const f = flake[i]
      const fall = fract(f[1] - now * 0.055 * f[3])
      snow.at[i * 3] = (f[0] - 0.5) * SKY.x + Math.sin(now * 0.5 + f[2] * 20) * 0.6
      snow.at[i * 3 + 1] = fall * SKY.y
      snow.at[i * 3 + 2] = SKY.near - f[2] * SKY.z
    }
    snow.geometry.attributes.position.needsUpdate = true
    for (let i = 0; i < BIG; i++) {
      const f = bigFlake[i]
      bigSnow.at[i * 3] = (f[0] - 0.5) * 96 + Math.sin(now * 0.4 + f[2] * 30) * 0.9
      bigSnow.at[i * 3 + 1] = fract(f[1] - now * 0.04 * f[3]) * 15
      bigSnow.at[i * 3 + 2] = 30 - f[2] * 44
    }
    bigSnow.geometry.attributes.position.needsUpdate = true

    // The snowflakes and stars hung among the trees sway a little, and the stars twinkle.
    for (const d of hung) {
      d.sprite.position.y = d.y + Math.sin(now * 0.5 + d.beat) * 0.22
      if (d.star) {
        const k = 0.72 + 0.28 * Math.sin(now * 2.4 + d.beat * 3)
        d.sprite.scale.set(d.size * k, d.size * k, 1)
      }
    }
  }

  let ratio = dpr
  return {
    // How many of the screen's own pixels are drawn to each of the page's:
    // two on most phones. Fewer is quicker, and a little softer.
    get ratio() { return ratio },
    setRatio(next) {
      ratio = Math.max(1, Math.min(dpr, next))
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
    },
    // Draws the story at t (0 at its first stop, as path.js counts) and
    // at now seconds on the clock.
    render(t, now) {
      const view = viewAt(t, width / height)
      // The camera is never quite still: it breathes a little.
      camera.position.set(view.pos.x + Math.sin(now * 0.27) * 0.3, view.pos.y + Math.sin(now * 0.33) * 0.12, view.pos.z)
      if (Math.abs(camera.fov - view.fov) > 0.01) {
        camera.fov = view.fov
        camera.updateProjectionMatrix()
      }
      camera.lookAt(view.look.x, view.look.y, view.look.z)
      animate(t, now)
      renderer.render(scene, camera)
    },
    resize(w, h) {
      width = Math.max(1, w)
      height = Math.max(1, h)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    dispose() {
      for (const x of kept) x.dispose?.()
      kept.clear()
      renderer.dispose()
    },
  }
}
