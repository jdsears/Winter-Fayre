import { describe, test, expect } from 'vitest'
import { RUN_KEY, readRun, keepRun, placeOf } from './run.js'

const store = () => {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}

describe('the run that is on the leaderboard', () => {
  test('is kept and read back only for a run of the same length', () => {
    const s = store()
    keepRun(s, { ticket: 'a.b.ABC.2.c', initials: 'ABC', score: 2, extra: 'not kept' })
    expect(readRun(s, 2)).toEqual({ ticket: 'a.b.ABC.2.c', initials: 'ABC', score: 2 })
    expect(readRun(s, 3)).toBe(null)
    expect(readRun(s, 0)).toBe(null)
    keepRun(s, null)
    expect(readRun(s, 2)).toBe(null)
  })

  test('anything odd in the store is not a run', () => {
    const s = store()
    for (const bad of ['nonsense', '{}', '{"ticket":1,"initials":"ABC","score":2}', '{"ticket":"t","initials":"Kai Hartley","score":2}', '{"ticket":"t","initials":"ABC","score":"2"}']) {
      s.setItem(RUN_KEY, bad)
      expect(readRun(s, 2)).toBe(null)
    }
    expect(readRun(null, 2)).toBe(null)
    expect(readRun({ getItem() { throw new Error('blocked') } }, 2)).toBe(null)
    expect(() => keepRun({ setItem() { throw new Error('full') } }, { ticket: 't', initials: 'ABC', score: 1 })).not.toThrow()
  })

  test('is found on a board by its letters and count', () => {
    const entries = [{ initials: 'TOP', score: 9 }, { initials: 'ABC', score: 2 }, { initials: 'ABC', score: 1 }]
    expect(placeOf(entries, { initials: 'ABC', score: 2 })).toBe(2)
    expect(placeOf(entries, { initials: 'ABC', score: 3 })).toBe(0)
    expect(placeOf(entries, null)).toBe(0)
  })
})
