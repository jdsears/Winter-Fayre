// The leaderboard's small rules on the page: what is typed becomes three
// capital letters, and a go is offered a place only when it would make
// the board.

import { describe, it, expect } from 'vitest'
import { tidyInitials, wouldMake, ordinal, SAID } from './board.js'

describe('the leaderboard on the page', () => {
  it('keeps only letters, three at most, in capitals', () => {
    expect(tidyInitials('abc')).toBe('ABC')
    expect(tidyInitials('a.b.c.')).toBe('ABC')
    expect(tidyInitials('Kai Hartley')).toBe('KAI')
    expect(tidyInitials('12')).toBe('')
    expect(tidyInitials(null)).toBe('')
  })

  it('offers a place only to a go that would make the board', () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ initials: 'ABC', score: 100 - i }))
    expect(wouldMake([], 1)).toBe(true)
    expect(wouldMake([], 0)).toBe(false)
    expect(wouldMake(full, 51)).toBe(false)
    expect(wouldMake(full, 52)).toBe(true)
    expect(wouldMake(full.slice(0, 49), 1)).toBe(true)
  })

  it('says a place in words', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 50].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '50th'])
  })

  it('has words for every refusal', () => {
    for (const reason of ['initials', 'ticket', 'score', 'low', 'busy', 'unavailable']) expect(SAID[reason]).toMatch(/\.$/)
  })
})
