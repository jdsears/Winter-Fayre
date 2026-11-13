// The game's sounds, made on the spot with the Web Audio API: no audio
// files. Off until the visitor switches it on; the context is only made
// then, from their tap, so nothing plays or loads before.
//
// Everything is played into a stadium: a little of each sound goes
// through an echo made here (a burst of fading noise), and the whole mix
// through a compressor, so a kick is felt and a roar does not clip. While
// the sound is on, the crowd murmurs under the game and an arcade tune
// plays (music.js), dropping back for a moment under each jingle.
//
// The moments of a game are arcade sounds, which a synthesiser makes
// well, over the crowd, which it makes less well: a rising fanfare for a
// goal, a longer one for a win, three falling notes for a miss and a
// coin's two notes for a milestone.

import { createMusic, hz } from './music.js'

export function createAudio(win = globalThis.window) {
  let ctx = null
  let master = null
  let noise = null
  let enabled = false
  let room = null
  let bed = null
  let musicBus = null
  let music = null
  // The tune has a switch of its own: on unless the visitor turns it off.
  let musicOn = true

  function ensure() {
    if (ctx) return ctx
    const AC = win?.AudioContext || win?.webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      ctx = null
      return null
    }
    master = ctx.createGain()
    master.gain.value = 0.8
    const squeeze = ctx.createDynamicsCompressor()
    squeeze.threshold.value = -16
    squeeze.ratio.value = 5
    squeeze.attack.value = 0.004
    squeeze.release.value = 0.22
    master.connect(squeeze).connect(ctx.destination)
    // The stadium's echo: 1.8 seconds of noise that dies away.
    try {
      const rate = ctx.sampleRate
      const tail = ctx.createBuffer(2, Math.floor(rate * 1.8), rate)
      let r = 987654321
      for (let c = 0; c < 2; c++) {
        const d = tail.getChannelData(c)
        for (let i = 0; i < d.length; i++) {
          r = (r * 1103515245 + 12345) & 0x7fffffff
          d[i] = ((r / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / d.length, 2.6)
        }
      }
      room = ctx.createConvolver()
      room.buffer = tail
      const wet = ctx.createGain()
      wet.gain.value = 0.22
      master.connect(room).connect(wet).connect(squeeze)
    } catch { room = null }
    // The tune has a volume of its own, under everything else.
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.5
    musicBus.connect(squeeze)
    const len = Math.floor(ctx.sampleRate * 2)
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noise.getChannelData(0)
    let seed = 12345
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      data[i] = (seed / 0x7fffffff) * 2 - 1
    }
    return ctx
  }

  const live = () => enabled && ctx && ctx.state !== 'closed'

  function envelope(gain, at, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + attack)
    gain.gain.setValueAtTime(peak, at + attack + hold)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release)
  }

  function noiseSource(at, duration) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.start(at, Math.random() * 1.5)
    src.stop(at + duration + 0.05)
    return src
  }

  // The boot on the ball: a deep thump, the slap of the leather and a
  // short click, harder with more power.
  function kick(power = 0.6) {
    if (!live()) return
    const at = ctx.currentTime
    const p = Math.max(0.05, Math.min(1, power))
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(170 + p * 60, at)
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.16)
    envelope(g, at, 0.003, 0.012, 0.22, 0.55 + p * 0.45)
    osc.connect(g).connect(master)
    osc.start(at)
    osc.stop(at + 0.32)
    const slap = noiseSource(at, 0.09)
    const sf = ctx.createBiquadFilter()
    sf.type = 'bandpass'
    sf.Q.value = 1.1
    sf.frequency.setValueAtTime(2200, at)
    sf.frequency.exponentialRampToValueAtTime(700, at + 0.08)
    const sg = ctx.createGain()
    envelope(sg, at, 0.001, 0.006, 0.07, 0.3 + p * 0.5)
    slap.connect(sf).connect(sg).connect(master)
    const click = noiseSource(at, 0.02)
    const cf = ctx.createBiquadFilter()
    cf.type = 'highpass'
    cf.frequency.value = 3500
    const cg = ctx.createGain()
    envelope(cg, at, 0.001, 0.002, 0.015, 0.12 + p * 0.2)
    click.connect(cf).connect(cg).connect(master)
  }

  // One arcade note: a square or triangle wave, on and off sharply.
  function blip(type, note, at, len, peak, glideTo = null) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(hz(note), at)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(hz(glideTo), at + len)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.006)
    g.gain.setValueAtTime(peak, at + len * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(master)
    o.start(at)
    o.stop(at + len + 0.03)
  }

  // The tune drops back while a jingle plays, then comes up again.
  function duck(seconds) {
    if (!musicBus) return
    const at = ctx.currentTime
    musicBus.gain.cancelScheduledValues(at)
    musicBus.gain.setValueAtTime(musicBus.gain.value, at)
    musicBus.gain.linearRampToValueAtTime(0.12, at + 0.05)
    musicBus.gain.setValueAtTime(0.12, at + seconds)
    musicBus.gain.linearRampToValueAtTime(0.5, at + seconds + 0.5)
  }

  // A run of notes with a second voice a third below: [note, steps].
  function jingle(notes, { step = 0.085, peak = 0.2, type = 'square' } = {}) {
    let at = ctx.currentTime + 0.01
    for (const [note, steps, under] of notes) {
      const len = step * steps
      blip(type, note, at, len * 0.95, peak)
      if (under) blip('triangle', under, at, len * 0.95, peak * 0.9)
      at += len
    }
    duck(at - ctx.currentTime)
  }

  // A coin: two quick high notes, for a milestone.
  function chime() {
    if (!live()) return
    jingle([['B5', 1], ['E6', 4]], { step: 0.07, peak: 0.18 })
  }

  // A goal: up the chord and hold the top.
  function fanfare() {
    jingle([['C5', 1, 'C4'], ['E5', 1, 'C4'], ['G5', 1, 'E4'], ['C6', 2, 'G4'], ['G5', 1, 'E4'], ['C6', 5, 'C5']])
  }

  // A win: the goal's fanfare, on, and up a tone to finish.
  function victory() {
    jingle([
      ['C5', 1, 'C4'], ['C5', 1, 'C4'], ['C5', 1, 'C4'], ['C5', 3, 'E4'], ['G#4', 3, 'C4'], ['A#4', 3, 'D4'],
      ['C5', 2, 'E4'], ['A#4', 1, 'D4'], ['C5', 8, 'E4'],
    ], { step: 0.1, peak: 0.22 })
  }

  // A miss: three notes falling, the last one sliding away.
  function sad() {
    const at = ctx.currentTime + 0.01
    blip('triangle', 'E4', at, 0.2, 0.3)
    blip('triangle', 'D#4', at + 0.22, 0.2, 0.3)
    blip('triangle', 'D4', at + 0.44, 0.55, 0.3, 'A3')
    duck(1.1)
  }

  // The net taking the ball: a brush of filtered noise.
  function swish(strength = 1) {
    if (!live()) return
    const at = ctx.currentTime
    const n = noiseSource(at, 0.6)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.9
    f.frequency.setValueAtTime(2400, at)
    f.frequency.exponentialRampToValueAtTime(5200, at + 0.35)
    const g = ctx.createGain()
    envelope(g, at, 0.02, 0.05, 0.4, 0.5 * Math.min(1, strength))
    n.connect(f).connect(g).connect(master)
  }

  // The frame ringing: a few partials that do not quite agree.
  function clang() {
    if (!live()) return
    const at = ctx.currentTime
    const partials = [[523, 0.32, 1.1], [1197, 0.22, 0.9], [1872, 0.16, 0.7], [2711, 0.1, 0.5], [3550, 0.06, 0.35]]
    for (const [freq, peak, len] of partials) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      envelope(g, at, 0.002, 0.0, len, peak)
      o.connect(g).connect(master)
      o.start(at)
      o.stop(at + len + 0.05)
    }
    const n = noiseSource(at, 0.03)
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 3000
    const g = ctx.createGain()
    envelope(g, at, 0.001, 0.0, 0.03, 0.3)
    n.connect(f).connect(g).connect(master)
  }

  // The referee's whistle: a high tone with the pea's trill.
  function whistle() {
    if (!live()) return
    const at = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2750, at)
    o.frequency.linearRampToValueAtTime(2900, at + 0.35)
    const trill = ctx.createOscillator()
    trill.type = 'square'
    trill.frequency.value = 34
    const depth = ctx.createGain()
    depth.gain.value = 0.35
    const g = ctx.createGain()
    envelope(g, at, 0.015, 0.32, 0.08, 0.28)
    const am = ctx.createGain()
    am.gain.value = 0.65
    trill.connect(depth).connect(am.gain)
    o.connect(am).connect(g).connect(master)
    o.start(at)
    trill.start(at)
    o.stop(at + 0.5)
    trill.stop(at + 0.5)
  }

  // One band of the crowd's voice: noise through a band, rising or
  // falling, with a wobble of its own so the bands do not move together.
  function voices(at, len, { from, to, q, peak, attack, wobble }) {
    const n = noiseSource(at, len + 0.2)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = q
    f.frequency.setValueAtTime(from, at)
    f.frequency.linearRampToValueAtTime(to, at + len)
    const g = ctx.createGain()
    envelope(g, at, attack, len * 0.35, len * 0.65 - attack, peak)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = wobble
    const depth = ctx.createGain()
    depth.gain.value = peak * 0.3
    lfo.connect(depth).connect(g.gain)
    lfo.start(at)
    lfo.stop(at + len + 0.2)
    n.connect(f).connect(g).connect(master)
  }

  // Hands clapping: many short bursts, thick at first and thinning out.
  function claps(at, len, count) {
    for (let i = 0; i < count; i++) {
      const when = at + 0.15 + Math.pow(Math.random(), 1.4) * len
      const n = noiseSource(when, 0.03)
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'
      f.Q.value = 1.4
      f.frequency.value = 1100 + Math.random() * 1500
      const g = ctx.createGain()
      envelope(g, when, 0.001, 0.004, 0.022, 0.05 + Math.random() * 0.07)
      n.connect(f).connect(g).connect(master)
    }
  }

  // The crowd: a cheer or a roar is three bands of voices rising, with
  // clapping over them. A groan is two low bands that fall away.
  function crowd(kind = 'cheer') {
    if (!live()) return
    const at = ctx.currentTime
    if (kind === 'groan') sad()
    else if (kind === 'roar') victory()
    else fanfare()
    if (kind === 'groan') {
      voices(at, 1.5, { from: 520, to: 300, q: 1.6, peak: 0.34, attack: 0.1, wobble: 4.3 })
      voices(at, 1.5, { from: 900, to: 620, q: 1.2, peak: 0.16, attack: 0.12, wobble: 5.7 })
      return
    }
    const roar = kind === 'roar'
    const len = roar ? 3.4 : 2.2
    const k = roar ? 1 : 0.7
    voices(at, len, { from: 420, to: 560, q: 0.8, peak: 0.34 * k, attack: 0.14, wobble: 3.7 })
    voices(at, len, { from: 950, to: 1450, q: 0.7, peak: 0.42 * k, attack: 0.18, wobble: 5.3 })
    voices(at, len, { from: 2300, to: 3100, q: 0.9, peak: 0.16 * k, attack: 0.24, wobble: 7.1 })
    claps(at, len * 0.9, roar ? 70 : 34)
  }

  // The crowd's murmur under the game, while the sound is on.
  function startBed() {
    if (bed || !ctx) return
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = 0.5
    f1.frequency.value = 520
    const f2 = ctx.createBiquadFilter()
    f2.type = 'lowpass'
    f2.frequency.value = 1700
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.085, ctx.currentTime + 1.2)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.23
    const depth = ctx.createGain()
    depth.gain.value = 0.03
    lfo.connect(depth).connect(g.gain)
    src.connect(f1).connect(f2).connect(g).connect(master)
    src.start()
    lfo.start()
    bed = { src, lfo }
  }
  function stopBed() {
    if (!bed) return
    try { bed.src.stop(); bed.lfo.stop() } catch { /* already stopped */ }
    bed = null
  }

  return {
    get enabled() { return enabled },
    // From a tap: makes the context then, so the browser allows it.
    setEnabled(on) {
      enabled = Boolean(on)
      if (enabled && ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {})
      if (enabled && ctx) {
        startBed()
        music ||= createMusic(ctx, musicBus, noise, win)
        if (musicOn) music.start()
      } else {
        stopBed()
        music?.stop()
      }
      return enabled && Boolean(ctx)
    },
    // The tune alone, on or off. It plays only while the sound is on.
    setMusic(on) {
      musicOn = Boolean(on)
      if (musicOn && enabled && music) music.start()
      else music?.stop()
      return musicOn
    },
    get music() { return musicOn },
    supported: Boolean(win?.AudioContext || win?.webkitAudioContext),
    kick, swish, clang, whistle, chime,
    cheer: () => crowd('cheer'),
    roar: () => crowd('roar'),
    groan: () => crowd('groan'),
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}) },
    resume() { if (enabled && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}) },
    dispose() {
      enabled = false
      stopBed()
      music?.stop()
      music = null
      if (ctx) ctx.close().catch(() => {})
      ctx = null
    },
  }
}
