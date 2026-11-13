// What moves, for a visitor who has asked for less motion and for one
// who has not. With reduced motion there is no camera shake, no confetti,
// no slow motion and no camera follow, and the banners and the changes
// between kicks fade rather than sweep. The ball and the keeper still
// move: the game needs them to.

export function prefersReducedMotion(win = globalThis.window) {
  try {
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

export function effects(reduce) {
  return reduce
    ? { shake: 0, confetti: false, slowMotion: false, follow: false, transition: 'fade', crowd: false }
    : { shake: 1, confetti: true, slowMotion: true, follow: true, transition: 'sweep', crowd: true }
}

// The game clock's speed on the winning kick: slow just before it is
// settled and just after, normal otherwise.
export function slowMotionScale(t, decidedAt, on) {
  if (!on) return 1
  const from = decidedAt - 0.32
  const to = decidedAt + 0.45
  if (t < from || t > to) return 1
  return 0.32
}

// A decaying shake, in metres of camera movement, for a hit on the frame.
export function shakeOffset(age, strength, seed = 0) {
  if (strength <= 0 || age < 0 || age > 0.6) return { x: 0, y: 0 }
  const fall = Math.exp(-age * 7) * strength * 0.06
  return {
    x: Math.sin(age * 71 + seed) * fall,
    y: Math.cos(age * 53 + seed * 1.7) * fall * 0.7,
  }
}
