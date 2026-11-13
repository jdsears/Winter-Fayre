// The games' music: an arcade tune, made on the spot like the rest of
// the sound (audio.js). No audio file, nothing fetched.
//
// For the Winter Fayre the tune is the chorus of Jingle Bells (James
// Pierpont, 1857, long out of copyright): sixteen bars in C major at 132
// beats a minute, round and round. A square wave lead, a softer arpeggio
// under it, a triangle bass and a drum kit of a sine thump and bursts of
// noise. Each bar is sixteen steps.

export const TEMPO = 132
export const STEP = 60 / TEMPO / 4
export const BARS = 16
export const STEPS = BARS * 16

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// 'A4' is 440; 'C5' the C above it.
export function hz(note) {
  const m = /^([A-G])(#?)(\d)$/.exec(note)
  if (!m) return 0
  const n = SEMI[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12
  return 440 * Math.pow(2, (n - 69) / 12)
}

// The chord of each bar: its bass note and the notes of its arpeggio.
const C = { bass: 'C3', arp: ['G4', 'C5', 'E5'] }
const F = { bass: 'F2', arp: ['A4', 'C5', 'F5'] }
const G = { bass: 'G2', arp: ['G4', 'B4', 'D5'] }
const D = { bass: 'D3', arp: ['A4', 'D5', 'F5'] }
export const CHORDS = [C, C, C, C, F, C, D, G, C, C, C, C, F, C, G, C]

// The tune, a bar a line: a note, or a dot to let the last one ring.
const TUNE = [
  // Jingle bells, jingle bells,
  'E5 . . . E5 . . . E5 . . . . . . .',
  'E5 . . . E5 . . . E5 . . . . . . .',
  // jingle all the way.
  'E5 . . . G5 . . . C5 . . . . . D5 .',
  'E5 . . . . . . . . . . . . . . .',
  // Oh what fun it is to ride
  'F5 . . . F5 . . . F5 . . . . . F5 .',
  'F5 . . . E5 . . . E5 . . . E5 . E5 .',
  // in a one horse open sleigh.
  'E5 . . . D5 . . . D5 . . . E5 . . .',
  'D5 . . . . . . . G5 . . . . . . .',
  // And round again,
  'E5 . . . E5 . . . E5 . . . . . . .',
  'E5 . . . E5 . . . E5 . . . . . . .',
  'E5 . . . G5 . . . C5 . . . . . D5 .',
  'E5 . . . . . . . . . . . . . . .',
  'F5 . . . F5 . . . F5 . . . . . F5 .',
  'F5 . . . E5 . . . E5 . . . E5 . E5 .',
  // to its last line.
  'G5 . . . G5 . . . F5 . . . D5 . . .',
  'C5 . . . . . . . . . . . . . . .',
]
export const LEAD = TUNE.flatMap(bar => bar.split(' ').map(n => (n === '.' ? null : n)))

// Where in a bar the bass plays (true is an octave up), and the drums.
const BASS = { 0: false, 3: false, 6: true, 8: false, 11: false, 14: true }
const THUMP = new Set([0, 8, 10])
const SNARE = new Set([4, 12])

// What sounds on a step of the loop: [{ voice, note | null, steps }].
export function stepEvents(step) {
  const s = ((step % STEPS) + STEPS) % STEPS
  const bar = Math.floor(s / 16)
  const at = s % 16
  const chord = CHORDS[bar]
  const out = []
  if (LEAD[s]) {
    let steps = 1
    while (steps < 6 && (s + steps) % 16 !== 0 && LEAD[s + steps] === null) steps += 1
    out.push({ voice: 'lead', note: LEAD[s], steps })
  }
  if (at in BASS) out.push({ voice: 'bass', note: chord.bass, up: BASS[at], steps: 2 })
  if (at % 2 === 0) out.push({ voice: 'arp', note: chord.arp[(at / 2) % chord.arp.length], steps: 1 })
  if (THUMP.has(at)) out.push({ voice: 'thump' })
  if (SNARE.has(at)) out.push({ voice: 'snare' })
  if (at % 2 === 0) out.push({ voice: 'hat', open: at === 14 })
  return out
}

// Plays the loop into `out` on the audio context `ctx`, a little ahead
// of the clock so the timing holds. `noise` is a buffer of white noise.
export function createMusic(ctx, out, noise, win = globalThis.window) {
  let timer = 0
  let step = 0
  let next = 0

  const tone = (type, freq, at, len, peak, { glide = 0 } = {}) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + len)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    g.gain.setValueAtTime(peak, at + Math.max(0.01, len * 0.6))
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + len + 0.02)
  }
  const hit = (at, len, peak, type, freq) => {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    src.connect(f).connect(g).connect(out)
    src.start(at, Math.random())
    src.stop(at + len + 0.02)
  }

  function play(e, at) {
    if (e.voice === 'lead') tone('square', hz(e.note), at, STEP * e.steps * 0.92, 0.11)
    else if (e.voice === 'arp') tone('square', hz(e.note), at, STEP * 0.7, 0.035)
    else if (e.voice === 'bass') tone('triangle', hz(e.note) * (e.up ? 2 : 1), at, STEP * 1.7, 0.3)
    else if (e.voice === 'thump') tone('sine', 150, at, 0.16, 0.5, { glide: 44 })
    else if (e.voice === 'snare') { hit(at, 0.12, 0.2, 'bandpass', 1900); tone('triangle', 190, at, 0.07, 0.12, { glide: 120 }) }
    else if (e.voice === 'hat') hit(at, e.open ? 0.12 : 0.035, 0.07, 'highpass', 7200)
  }

  function tick() {
    if (ctx.state !== 'running') return
    // Fallen behind (the tab was hidden): pick up from now.
    if (next < ctx.currentTime - 0.1) next = ctx.currentTime + 0.05
    while (next < ctx.currentTime + 0.25) {
      for (const e of stepEvents(step)) play(e, next)
      step = (step + 1) % STEPS
      next += STEP
    }
  }

  return {
    get playing() { return Boolean(timer) },
    start() {
      if (timer) return
      step = 0
      next = ctx.currentTime + 0.08
      timer = win.setInterval(tick, 60)
      tick()
    },
    stop() {
      if (!timer) return
      win.clearInterval(timer)
      timer = 0
    },
  }
}
