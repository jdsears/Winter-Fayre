// The Winter Fayre poster's snowflakes and four-pointed stars, drawn on
// a canvas. John sent the poster and asked for more of its colours and
// decorations in the scenes (13 November 2026): these hang in the sky of
// the appeal's 3D story (story/scene.js) and of every game's stadium,
// in 3D (shootout/scene3d.js) and drawn flat (flat.js).
//
// They are drawn from lines, in this site's own hand: the poster itself
// is not used, only its colours and the kind of snowflake it has.

import { makeRng } from '../shootout/rng.js'

// The poster's colours for them.
export const POSTER = { teal: '#3fb8c9', ice: '#8fd6e8', gold: '#f0c05a', white: '#ffffff' }

// How many patterns of snowflake there are.
export const KINDS = 3

// A snowflake: six arms, in one of three patterns, drawn in `ink` round
// the drawing surface's own origin and reaching `size` across (a little
// less, to leave room at the edge of a square of that size).
export function drawFlake(g, size, kind = 0, ink = POSTER.white) {
  const R = size * 0.42
  const stroke = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke() }
  g.save()
  g.strokeStyle = ink
  g.lineCap = 'round'
  g.lineWidth = Math.max(1, size * 0.04)
  for (let i = 0; i < 6; i++) {
    g.save()
    g.rotate((i * Math.PI) / 3)
    stroke(0, 0, 0, -R)
    if (kind === 0) {
      // Two pairs of branches up each arm.
      for (const [at, len] of [[0.42, 0.3], [0.7, 0.2]]) for (const side of [-1, 1]) stroke(0, -R * at, side * R * len * 0.87, -R * (at + len * 0.5))
    } else if (kind === 1) {
      // A diamond at each tip and a ring half way up.
      const d = size / 128
      g.beginPath(); g.moveTo(0, -R); g.lineTo(8 * d, -R + 12 * d); g.lineTo(0, -R + 24 * d); g.lineTo(-8 * d, -R + 12 * d); g.closePath(); g.stroke()
      g.beginPath(); g.arc(0, -R * 0.4, 5 * d, 0, Math.PI * 2); g.stroke()
    } else {
      // A fork at each tip, and a short spoke between each pair of arms.
      for (const side of [-1, 1]) stroke(0, -R * 0.78, side * R * 0.16, -R)
      g.rotate(Math.PI / 6)
      stroke(0, -R * 0.24, 0, -R * 0.56)
    }
    g.restore()
  }
  if (kind === 2) { g.beginPath(); g.arc(0, 0, R * 0.22, 0, Math.PI * 2); g.stroke() }
  g.restore()
}

// A four-pointed star, filled with `ink`, round the origin and `size`
// from point to point.
export function drawSparkle(g, size, ink = POSTER.white) {
  const far = size * 0.47
  const near = size * 0.0625
  g.save()
  g.fillStyle = ink
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const r = i % 2 ? near : far
    const x = Math.sin(a) * r
    const y = -Math.cos(a) * r
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.closePath()
  g.fill()
  g.restore()
}

const FLAKE_INKS = [POSTER.teal, POSTER.ice, POSTER.gold]
const STAR_INKS = [POSTER.gold, POSTER.white, POSTER.teal]

// Where they hang in a stadium's sky: above the stand and behind it, all
// the way across. Each is { x, y, z, size, kind, star, ink, beat }: its
// place and its size in metres, which pattern it is (or a star), its
// colour, and where in its sway it starts. The same each time, so the
// 3D stadium and the flat one hang them in the same places.
//   behind   how far back the nearest are (the z of the back of the stand)
export function stadiumFlakes(behind, count = 30, seed = 2026) {
  const r = makeRng(seed)
  const out = []
  for (let i = 0; i < count; i++) {
    const star = i % 4 === 3
    out.push({
      x: -45 + (i + r()) * (90 / count),
      y: r.range(12.5, 30),
      z: behind - r.range(2, 16),
      size: star ? r.range(1.4, 2.5) : r.range(2.3, 4.2),
      kind: star ? KINDS : Math.floor(r() * KINDS),
      star,
      ink: (star ? STAR_INKS : FLAKE_INKS)[Math.floor(r() * 3)],
      beat: r() * 10,
    })
  }
  return out
}

// How one of them sits at a moment: a little up or down as it sways, and
// a star's size as it twinkles. Still, with reduced motion.
export function swayAt(flake, now, still = false) {
  if (still) return { lift: 0, scale: 1 }
  return { lift: Math.sin(now * 0.5 + flake.beat) * 0.22, scale: flake.star ? 0.72 + 0.28 * Math.sin(now * 2.4 + flake.beat * 3) : 1 }
}
