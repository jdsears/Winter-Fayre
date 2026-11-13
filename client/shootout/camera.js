// The camera, shared by the 3D scene and the 2D version: behind the ball
// for a kick, a step further back for a save, framed so the whole goal
// fits the screen's width in portrait, with a short follow after the
// visitor's kick. project() puts a point of the pitch on the screen, so
// the 2D version draws what the 3D one would, and a swipe can be read
// against where the goal really is. Pure.

import { BALL_R, GOAL, SPOT } from './physics.js'
import { pointToAim } from './input.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k

const BASE = {
  shoot: { pos: { x: 0, y: 1.45, z: 3.5 }, look: { x: 0, y: -0.55, z: -11 }, halfWidth: 4.55 },
  save: { pos: { x: 0, y: 1.95, z: 7.2 }, look: { x: 0, y: -0.2, z: -11 }, halfWidth: 4.75 },
}

// The vertical field of view (degrees) that fits the goal across.
export function fitFov(mode, aspect) {
  const b = BASE[mode] || BASE.shoot
  const dist = b.pos.z - GOAL.lineZ
  const half = Math.atan(b.halfWidth / dist)
  const v = 2 * Math.atan(Math.tan(half) / Math.max(0.2, aspect))
  return clamp((v * 180) / Math.PI, 38, 74)
}

export function cameraFor(mode, aspect, { follow = 0, ball = SPOT, shake = { x: 0, y: 0 } } = {}) {
  const b = BASE[mode] || BASE.shoot
  const pos = { ...b.pos }
  const look = { ...b.look }
  if (follow > 0) {
    const k = follow * follow * (3 - 2 * follow)
    pos.x = lerp(pos.x, clamp(ball.x * 0.3, -1.6, 1.6), k)
    pos.y = lerp(pos.y, 1.55, k)
    pos.z = lerp(pos.z, clamp(ball.z + 7, -2.5, pos.z), k)
    look.x = lerp(look.x, ball.x * 0.6, k)
    look.y = lerp(look.y, clamp(ball.y, 0.6, 2.2), k)
  }
  pos.x += shake.x
  pos.y += shake.y
  return { pos, look, fov: fitFov(mode, aspect) }
}

function basis(cam) {
  const f = { x: cam.look.x - cam.pos.x, y: cam.look.y - cam.pos.y, z: cam.look.z - cam.pos.z }
  const fl = Math.hypot(f.x, f.y, f.z) || 1
  f.x /= fl; f.y /= fl; f.z /= fl
  // right = forward x up(0,1,0)
  const r = { x: -f.z, y: 0, z: f.x }
  const rl = Math.hypot(r.x, r.z) || 1
  r.x /= rl; r.z /= rl
  // up = right x forward
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x }
  return { f, r, u }
}

// A point of the pitch on a screen of width by height: { x, y, depth,
// scale } where scale is pixels per metre at that depth.
export function project(cam, p, width, height) {
  const { f, r, u } = cam.basis || (cam.basis = basis(cam))
  const d = { x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z }
  const xc = d.x * r.x + d.y * r.y + d.z * r.z
  const yc = d.x * u.x + d.y * u.y + d.z * u.z
  const zc = Math.max(0.05, d.x * f.x + d.y * f.y + d.z * f.z)
  const k = (height / 2) / Math.tan((cam.fov * Math.PI) / 360)
  return { x: width / 2 + (xc / zc) * k, y: height / 2 - (yc / zc) * k, depth: zc, scale: k / zc }
}

// The goal mouth and the ball on screen, for reading a swipe.
export function screenGeometry(mode, width, height) {
  const cam = cameraFor(mode, width / height)
  const mid = GOAL.height / 2
  const left = project(cam, { x: -GOAL.halfWidth, y: mid, z: GOAL.lineZ }, width, height)
  const right = project(cam, { x: GOAL.halfWidth, y: mid, z: GOAL.lineZ }, width, height)
  const top = project(cam, { x: 0, y: GOAL.height, z: GOAL.lineZ }, width, height)
  // The bottom is where a ball on the grass sits, as aimPoint has it.
  const bottom = project(cam, { x: 0, y: BALL_R, z: GOAL.lineZ }, width, height)
  const ball = project(cam, SPOT, width, height)
  return { goal: { left: left.x, right: right.x, top: top.y, bottom: bottom.y }, ball: { x: ball.x, y: ball.y }, width, height }
}

// Where a tap on the goal aims: the point on the goal's plane under it,
// read the same way as the end of a swipe.
export function screenToAim(mode, width, height, x, y) {
  return pointToAim(screenGeometry(mode, width, height), x, y)
}

// Where an aim shows on the screen, for the marker: the inverse of
// pointToAim on the same goal mouth.
export function aimToScreen(mode, width, height, aim) {
  const g = screenGeometry(mode, width, height).goal
  return { x: g.left + ((aim.aimX + 1) / 2) * (g.right - g.left), y: g.bottom - aim.aimY * (g.bottom - g.top) }
}
