// Where cricket is played in the stadium: a pitch 22 yards long laid
// down the middle, the batter's end nearest the camera and the bowler
// running in from the stand's end. Metres, in the stadium's own places
// (z grows towards the camera, x to the right as the batter's end sees
// it). Shared by the 3D scene, the flat painter and the game.

import { BEYOND } from './rules.js'

export const PITCH_LENGTH = 20.12
const STUMPS = 16
const RELEASE = STUMPS - PITCH_LENGTH + 0.9

export const GROUND = {
  // The batter's stumps, the crease in front of them, and where the bat
  // meets a ball hit at just the right moment: out in front of the
  // crease, as far from the stumps as the rules say (rules.js, BEYOND).
  stumps: STUMPS,
  crease: STUMPS - 1.22,
  bat: (STUMPS + BEYOND * RELEASE) / (1 + BEYOND),
  // The bowler's stumps, the crease the ball is let go over, and where
  // the run up starts.
  far: STUMPS - PITCH_LENGTH,
  release: RELEASE,
  runFrom: STUMPS - PITCH_LENGTH - 5,
  // Half the pitch's width, and where the bowler runs, to one side of the stumps.
  half: 1.525,
  bowlerX: 0.62,
  // Where the batter stands: to the leg side of the stumps, as a
  // right-hander does, seen from behind, a foot either side of the crease.
  batterX: -0.46,
  batterZ: STUMPS - 1.22 - 0.1,
  // A wicket: three stumps 71 centimetres high, 11.5 centimetres apart.
  stumpHeight: 0.71,
  stumpGap: 0.115,
}

// The ball is drawn a good deal bigger than a real one, to be seen on a phone.
export const BALL_R = 0.09

// Where the ball leaves the bowler's hand: he faces the batter, so his
// bowling arm is on the side nearer the stumps, and it goes from the top
// of his reach.
export const HAND = { arm: GROUND.bowlerX - 0.29, hand: 2.05, r: BALL_R }

// A place in a delivery's flight (rules.js, flight) as a place in the
// stadium: along is 0 at the bowler's hand and 1 at the bat.
export function toWorld(p) {
  return { x: p.side, y: p.y, z: GROUND.release + (GROUND.bat - GROUND.release) * p.along }
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ease = (k) => k * k * (3 - 2 * k)
const lerp = (a, b, k) => a + (b - a) * k

// The bat, as it is drawn: 86 centimetres from the top of the handle to
// the toe, held a little below the top.
export const BAT = { handle: 0.28, blade: 0.6, top: 0.1, width: 0.115 }

// How much of a swing is the bat coming down to the ball; the rest is
// the follow through.
export const CONTACT = 0.3

// The batter's stroke at a moment of the swing, for the 3D scene and the
// flat painter alike. swing is 0 (waiting, the bat lifted behind) to 1
// (finished, the bat up past the front shoulder), and the bat is upright,
// meeting the ball, at CONTACT. line is how far to the off side the ball
// is, and meet how far past the usual place it is met (a late swing
// meets it nearer the stumps): the batter steps to it.
//
// Gives where the batter stands ({ x, z }, in the stadium), how far
// through the swing is (down, 0 to 1 as the bat comes down, and through,
// 0 to 1 after it), and the bat: where the hands hold it (grip, in the
// stadium), and its turn from hanging straight down (angle: behind the
// batter below nought, towards the bowler above).
export function strokeAt({ swing = 0, line = 0, meet = 0 } = {}) {
  const w = clamp(swing, 0, 1)
  const down = clamp(w / CONTACT, 0, 1)
  const after = clamp((w - CONTACT) / (1 - CONTACT), 0, 1)
  const through = 1 - (1 - after) ** 2
  const step = ease(down)
  // The ball is met this far up the pitch from where the batter waits
  // (below nought is back towards his stumps). He strides most of the
  // way to it and reaches the rest.
  const to = GROUND.bat + clamp(meet, 0, 1.75) - GROUND.batterZ
  const stride = clamp(to * 0.6, -0.4, 0.5)
  const stand = {
    x: GROUND.batterX + clamp(line - 0.04, 0, 0.45) * step,
    z: GROUND.batterZ + stride * step,
  }
  // The hands: by the back hip as he waits, out in front of the front
  // pad as the bat meets the ball, and up by the front shoulder after.
  const reach = to - stride
  const waits = { back: 0.1, high: 1.05, off: 0.34 }
  const meets = { back: reach, high: 1.06, off: 0.46 }
  const ends = { back: reach - 0.06, high: 1.5, off: 0.38 }
  const from = down < 1 ? waits : meets
  const till = down < 1 ? meets : ends
  const k = down < 1 ? step : through
  const grip = {
    x: stand.x + lerp(from.off, till.off, k),
    y: lerp(from.high, till.high, k),
    z: stand.z + lerp(from.back, till.back, k),
  }
  const angle = down < 1 ? -2.2 * (1 - down ** 1.5) : 2.5 * through
  return { stand, down, through, grip, angle }
}

// Where a point of the bat is: `along` metres down it from the hands
// (below nought is up the handle).
export function batPoint(stroke, along) {
  return {
    x: stroke.grip.x,
    y: stroke.grip.y - Math.cos(stroke.angle) * along,
    z: stroke.grip.z - Math.sin(stroke.angle) * along,
  }
}

// The camera: behind the batter's stumps and above them, looking down
// the pitch at the bowler, with the stumps and the batter in the lower
// half of the screen.
export function cameraFor() {
  return { pos: { x: 0, y: 3.0, z: GROUND.stumps + 6.5 }, look: { x: 0, y: 0.5, z: 2 }, fov: 40 }
}
