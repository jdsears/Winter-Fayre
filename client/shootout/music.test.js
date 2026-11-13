// The arcade tune's notes and timing (music.js): the loop is sixteen
// bars of sixteen steps, every note is one the scale has, and the drums
// fall where a beat is.

import { describe, it, expect } from 'vitest'
import { hz, LEAD, STEPS, STEP, TEMPO, CHORDS, stepEvents } from './music.js'

describe('the arcade tune', () => {
  it('names notes as their pitch', () => {
    expect(hz('A4')).toBeCloseTo(440, 5)
    expect(hz('A5')).toBeCloseTo(880, 5)
    expect(hz('C5')).toBeCloseTo(523.25, 1)
    expect(hz('G#4')).toBeCloseTo(415.3, 1)
    expect(hz('H9')).toBe(0)
  })

  it('is sixteen bars of sixteen steps, at 132 beats a minute', () => {
    expect(LEAD.length).toBe(STEPS)
    expect(STEPS).toBe(256)
    expect(CHORDS.length).toBe(16)
    expect(STEP * 4 * TEMPO).toBeCloseTo(60, 6)
  })

  it('every note is a real one, in C major', () => {
    const scale = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    for (const n of LEAD.filter(Boolean)) {
      expect(hz(n)).toBeGreaterThan(200)
      expect(scale.has(n[0]) && !n.includes('#')).toBe(true)
    }
    for (const c of CHORDS) for (const n of [c.bass, ...c.arp]) expect(hz(n)).toBeGreaterThan(60)
  })

  it('puts the drums on the beat, and loops', () => {
    const voices = (s) => stepEvents(s).map(e => e.voice)
    expect(voices(0)).toContain('thump')
    expect(voices(4)).toContain('snare')
    expect(voices(12)).toContain('snare')
    expect(voices(1)).not.toContain('hat')
    expect(stepEvents(STEPS)).toEqual(stepEvents(0))
    expect(stepEvents(-1)).toEqual(stepEvents(STEPS - 1))
  })

  it('a held note lasts until the next one or the bar ends', () => {
    const first = stepEvents(0).find(e => e.voice === 'lead')
    expect(first).toEqual({ voice: 'lead', note: 'E5', steps: 4 })
    for (let s = 0; s < STEPS; s++) for (const e of stepEvents(s)) if (e.voice === 'lead') expect((s % 16) + e.steps).toBeLessThanOrEqual(16)
  })
})
