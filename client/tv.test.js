// The TV screen's small rules (tv.js): what it writes for a board, and
// whose turn is next.

import { describe, it, expect } from 'vitest'
import { cleanEntries, nextBoard, firstTurn, nextTurn, turnMs, TOP, ROTATE_MS, REFRESH_MS, APPEAL_MS, APPEAL_EVERY } from './tv.js'

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

  it('gives the appeal a turn of ten seconds or so after every three leaderboards, and then the next leaderboard', () => {
    expect(APPEAL_EVERY).toBe(3)
    expect(APPEAL_MS).toBeGreaterThanOrEqual(8000)
    expect(APPEAL_MS).toBeLessThanOrEqual(12000)
    const shown = []
    let turn = firstTurn(0)
    let appealMs = 0
    let allMs = 0
    for (let n = 0; n < 200; n++) {
      shown.push(turn.appeal ? 'appeal' : turn.board)
      // While the appeal is on, the board under it does not change.
      if (turn.appeal) expect(turn.board).toBe(shown[shown.length - 2])
      allMs += turnMs(turn)
      if (turn.appeal) appealMs += turnMs(turn)
      turn = nextTurn(turn, 7, true)
    }
    expect(shown.slice(0, 13)).toEqual([0, 1, 2, 'appeal', 3, 4, 5, 'appeal', 6, 0, 1, 'appeal', 2])
    // No leaderboard is left out or shown twice running, and each has as many turns as the rest.
    const boards = shown.filter(x => x !== 'appeal')
    boards.forEach((b, i) => { if (i) expect(b).toBe((boards[i - 1] + 1) % 7) })
    // The appeal is never on twice running, and has about ten seconds in every forty.
    shown.forEach((x, i) => { if (i && x === 'appeal') expect(shown[i - 1]).not.toBe('appeal') })
    expect(appealMs / allMs).toBeGreaterThan(0.2)
    expect(appealMs / allMs).toBeLessThan(0.34)
    expect(turnMs({ appeal: true })).toBe(APPEAL_MS)
    expect(turnMs({ appeal: false })).toBe(ROTATE_MS)
  })

  it('goes round the leaderboards alone where the page has no appeal, and copes with one board or none', () => {
    let turn = firstTurn(2)
    const shown = []
    for (let n = 0; n < 9; n++) { shown.push(turn.appeal ? 'appeal' : turn.board); turn = nextTurn(turn, 4, false) }
    expect(shown).toEqual([2, 3, 0, 1, 2, 3, 0, 1, 2])
    turn = firstTurn(0)
    const one = []
    for (let n = 0; n < 6; n++) { one.push(turn.appeal ? 'appeal' : turn.board); turn = nextTurn(turn, 1, true) }
    expect(one).toEqual([0, 0, 0, 'appeal', 0, 0])
    expect(nextTurn(firstTurn(0), 0, true)).toEqual({ board: 0, appeal: false, since: 2 })
  })

  it('changes board every few seconds and asks again a little less often', () => {
    expect(ROTATE_MS).toBeGreaterThanOrEqual(5000)
    expect(ROTATE_MS).toBeLessThanOrEqual(15000)
    expect(REFRESH_MS).toBeGreaterThanOrEqual(10000)
    expect(REFRESH_MS).toBeLessThanOrEqual(60000)
  })
})
