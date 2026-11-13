// The shootout's rules: five each in turn, finished as soon as one side
// cannot catch the other, then sudden death a round at a time, and the
// tracker's two rows of five.
//
// Run with: npx vitest run client/shootout/rules.test.js

import { describe, it, expect } from 'vitest'
import * as R from './rules.js'

// Plays a list of results, in turn from the first kicker.
const play = (results, first = 'us') => results.reduce((s, r) => R.addKick(s, r), R.newShootout({ first }))

describe('best of five', () => {
  it('alternates, the visitor first', () => {
    let s = R.newShootout()
    expect(R.nextSide(s)).toBe('us')
    s = R.addKick(s, true)
    expect(R.nextSide(s)).toBe('them')
    s = R.addKick(s, false)
    expect(R.nextSide(s)).toBe('us')
    expect(R.roundOf(s)).toBe(2)
    expect(R.tally(s)).toEqual({ us: 1, them: 0, usTaken: 1, themTaken: 1 })
  })

  it('goes all five when it is close, and is won 4 to 3', () => {
    // us: G G M G G (4), them: G M G G M (3)
    const s = play([true, true, true, false, false, true, true, true, true, false])
    expect(R.isOver(s)).toBe(true)
    expect(R.winner(s)).toBe('us')
    expect(R.resultLine(s)).toBe('You won the shootout 4 to 3')
  })

  it('stops early once a side cannot catch up: 3 to 0 after three each', () => {
    const s = play([true, false, true, false, true, false])
    expect(R.isOver(s)).toBe(true)
    expect(R.winner(s)).toBe('us')
    expect(s.kicks).toHaveLength(6)
    expect(R.nextSide(s)).toBe(null)
  })

  it('stops mid round when the second side cannot catch up', () => {
    // After us 4 kicks (4 scored) and them 3 (1 scored): them have 2 left, 1 + 2 < 4.
    const s = play([true, false, true, true, true, false, true])
    expect(R.isOver(s)).toBe(true)
    expect(R.winner(s)).toBe('us')
  })

  it('lets the side that kicks second win without its last kick', () => {
    // us G M M M, them G G G: them on 3, us on 1 with one left.
    const s = play([true, true, false, true, false, true, false])
    expect(R.winner(s)).toBe('them')
    expect(R.resultLine(s)).toBe('You lost the shootout 1 to 3')
  })

  it('refuses a kick once it is over', () => {
    const s = play([true, false, true, false, true, false])
    expect(() => R.addKick(s, true)).toThrow()
  })

  it('knows when the next kick settles it', () => {
    // 4 to 4 after four each... us take the fifth: neither result settles it yet.
    let s = play([true, true, true, true, true, true, true, true])
    expect(R.stakes(s)).toMatchObject({ side: 'us', deciding: false })
    s = R.addKick(s, false)
    // them take the fifth: a goal wins it for them, a miss goes to sudden death.
    expect(R.stakes(s)).toMatchObject({ side: 'them', ifScored: 'them', ifMissed: null, deciding: true })
  })
})

describe('sudden death', () => {
  const level = [true, true, false, false, true, true, true, true, false, false] // 3 to 3 after five each

  it('starts when it is level after five each', () => {
    const s = play(level)
    expect(R.isOver(s)).toBe(false)
    expect(R.isSuddenDeath(s)).toBe(true)
    expect(R.nextSide(s)).toBe('us')
    expect(R.roundOf(s)).toBe(6)
  })

  it('is never settled by the first kick of a round', () => {
    expect(R.isOver(play([...level, true]))).toBe(false)
    expect(R.isOver(play([...level, false]))).toBe(false)
  })

  it('is settled when one scores and the other does not', () => {
    expect(R.winner(play([...level, true, false]))).toBe('us')
    expect(R.winner(play([...level, false, true]))).toBe('them')
  })

  it('goes round after round while both score or both miss', () => {
    const s = play([...level, true, true, false, false, true, true])
    expect(R.isOver(s)).toBe(false)
    expect(R.roundOf(s)).toBe(9)
    expect(R.winner(play([...level, true, true, false, false, true, true, true, false]))).toBe('us')
    expect(R.resultLine(play([...level, true, true, true, false]))).toBe('You won the shootout 5 to 4')
  })
})

describe('the tracker', () => {
  it('shows five dots a side, filled for a goal, crossed for a miss, the next marked', () => {
    const t = R.trackerRows(play([true, false, false]))
    expect(t.suddenDeath).toBe(false)
    expect(t.rows.us).toEqual(['scored', 'missed', 'empty', 'empty', 'empty'])
    expect(t.rows.them).toEqual(['missed', 'next', 'empty', 'empty', 'empty'])
  })

  it('starts the rows again in sudden death', () => {
    const level = [true, true, false, false, true, true, true, true, false, false]
    const t = R.trackerRows(play([...level, true]))
    expect(t.suddenDeath).toBe(true)
    expect(t.rows.us).toEqual(['scored', 'empty', 'empty', 'empty', 'empty'])
    expect(t.rows.them).toEqual(['next', 'empty', 'empty', 'empty', 'empty'])
  })

  it('keeps the five when it is settled on the tenth kick, never sudden death', () => {
    const s = play([true, true, true, false, false, true, true, true, true, false])
    expect(R.isOver(s)).toBe(true)
    expect(R.isSuddenDeath(s)).toBe(false)
    const t = R.trackerRows(s)
    expect(t.suddenDeath).toBe(false)
    expect(t.rows.us).toEqual(['scored', 'scored', 'missed', 'scored', 'scored'])
    expect(t.rows.them).toEqual(['scored', 'missed', 'scored', 'scored', 'missed'])
  })

  it('has no next dot once it is over', () => {
    const t = R.trackerRows(play([true, false, true, false, true, false]))
    expect([...t.rows.us, ...t.rows.them]).not.toContain('next')
  })
})

describe('the score in words', () => {
  it('says 5 to 4, with no dash, as the site writes scores', () => {
    expect(R.scoreWords(5, 4)).toBe('5 to 4')
    expect(R.standing(play([true]), 'The Visitors')).toBe('You lead 1 to 0.')
    expect(R.standing(play([true, true]), 'The Visitors')).toBe('Level at 1 each.')
    expect(R.standing(play([false, true]), 'The Visitors')).toBe('The Visitors lead 1 to 0.')
  })
})

// The arcade's way: all five each, however it is going, so every visitor
// has the same five kicks to score from and the same five to save.
describe('all five each (full)', () => {
  const full = (results) => results.reduce((s, r) => R.addKick(s, r), R.newShootout({ first: 'us', full: true }))

  it('does not stop at 3 to 0 after three each', () => {
    const s = full([true, false, true, false, true, false])
    expect(R.isOver(s)).toBe(false)
    expect(R.nextSide(s)).toBe('us')
    expect(R.stakes(s).deciding).toBe(false)
  })

  it('is settled only when both have taken their five', () => {
    // us: all five scored. them: none.
    const s = full([true, false, true, false, true, false, true, false, true])
    expect(R.isOver(s)).toBe(false)
    expect(R.nextSide(s)).toBe('them')
    const done = R.addKick(s, false)
    expect(R.isOver(done)).toBe(true)
    expect(R.winner(done)).toBe('us')
    expect(R.tally(done)).toEqual({ us: 5, them: 0, usTaken: 5, themTaken: 5 })
    expect(R.isSuddenDeath(done)).toBe(false)
  })

  it('goes to sudden death when it is level after five each, as ever', () => {
    const level = full([true, true, true, true, false, false, true, true, false, false])
    expect(R.isOver(level)).toBe(false)
    expect(R.isSuddenDeath(level)).toBe(true)
    const won = R.addKick(R.addKick(level, true), false)
    expect(R.winner(won)).toBe('us')
  })

  it('keeps the tracker to five dots a side with the next one marked', () => {
    const t = R.trackerRows(full([true, false, true, false, true, false]))
    expect(t.rows.us).toEqual(['scored', 'scored', 'scored', 'next', 'empty'])
    expect(t.rows.them).toEqual(['missed', 'missed', 'missed', 'empty', 'empty'])
  })
})
