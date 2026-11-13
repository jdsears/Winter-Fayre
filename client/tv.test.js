// The TV screen's small rules (tv.js): what it writes for a board, and
// whose turn is next.

import { describe, it, expect } from 'vitest'
import { cleanEntries, nextBoard, TOP, ROTATE_MS, REFRESH_MS } from './tv.js'

describe('the TV screen', () => {
  it('writes only three capital letters and a whole score, ten at most', () => {
    const entries = [
      { initials: 'ABC', score: 12 },
      { initials: 'abc', score: 5 },
      { initials: '<b>', score: 5 },
      { initials: 'ABCD', score: 5 },
      { initials: 'XYZ', score: 2.5 },
      { initials: 'XYZ', score: 0 },
      { initials: 'XYZ', score: '7' },
      null,
      'nonsense',
      { initials: 'LMN', score: 3, name: 'Kai Hartley' },
    ]
    expect(cleanEntries(entries)).toEqual([{ initials: 'ABC', score: 12 }, { initials: 'XYZ', score: 7 }, { initials: 'LMN', score: 3 }])
    expect(cleanEntries(null)).toEqual([])
    expect(cleanEntries(Array.from({ length: 30 }, () => ({ initials: 'ABC', score: 1 })))).toHaveLength(TOP)
  })

  it('takes the boards in turn, round and round', () => {
    expect(nextBoard(0, 4)).toBe(1)
    expect(nextBoard(3, 4)).toBe(0)
    expect(nextBoard(0, 1)).toBe(0)
    expect(nextBoard(0, 0)).toBe(0)
  })

  it('changes board every few seconds and asks again a little less often', () => {
    expect(ROTATE_MS).toBeGreaterThanOrEqual(5000)
    expect(ROTATE_MS).toBeLessThanOrEqual(15000)
    expect(REFRESH_MS).toBeGreaterThanOrEqual(10000)
    expect(REFRESH_MS).toBeLessThanOrEqual(60000)
  })
})
