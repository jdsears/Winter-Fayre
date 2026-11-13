// The football on a phone (football.js): the codes it keeps, and what it
// says of how the football stands.

import { describe, it, expect } from 'vitest'
import { readClaims, keepClaim, footballFor, CLAIMS_KEY } from './football.js'
import { FOOTBALL, footballLine, footballWords, footballTv } from '../../shared/prizes.js'

function fakeStore(start = {}) {
  const kept = new Map(Object.entries(start))
  return { getItem: k => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)) }, kept }
}
const DAY = '2026-11-14'

describe('the football\'s rule', () => {
  it('is the best keepy-uppies score on the leaderboard by half past one', () => {
    expect(FOOTBALL).toMatchObject({ game: 'keepy', until: '13:30', said: '1:30pm', prize: 'a FIFA approved football' })
    expect(footballLine()).toBe('Best score on the leaderboard by 1:30pm wins a FIFA approved football.')
  })

  it('is said with who leads while it is open, and who won once it has closed', () => {
    expect(footballWords(null)).toBe(footballLine())
    expect(footballWords({ closed: false, leader: null })).toBe(footballLine())
    expect(footballWords({ closed: false, leader: { initials: 'ABC', score: 57 } })).toBe(`${footballLine()} Leading now: ABC with 57.`)
    expect(footballWords({ closed: true, leader: { initials: 'ABC', score: 57 } })).toBe('The football is won: ABC with 57. Come to the sports stall.')
    expect(footballWords({ closed: true, leader: null })).toBe('The football was not won: no score was on the leaderboard by 1:30pm.')
  })
})

describe('the football on the stall\'s TV', () => {
  it('is one short line: the rule while it is open, and the winner once it has closed', () => {
    expect(footballTv(null)).toBe('A FIFA approved football for the best score by 1:30pm')
    expect(footballTv({ closed: false, leader: { initials: 'ABC', score: 57 } })).toBe('A FIFA approved football for the best score by 1:30pm')
    expect(footballTv({ closed: true, leader: { initials: 'ABC', score: 57 } })).toBe('The football is won: ABC with 57. Come to the sports stall.')
    expect(footballTv({ closed: true, leader: null })).toBe('The football was not won: no score was on the leaderboard by 1:30pm.')
    for (const said of [footballTv(null), footballTv({ closed: true, leader: { initials: 'WWW', score: 999 } })]) expect(said.length).toBeLessThanOrEqual(62)
  })
})

describe('the codes a phone keeps', () => {
  it('keeps an entry\'s code for the day, best first, and nothing else', () => {
    const store = fakeStore()
    expect(readClaims(store, DAY)).toEqual([])
    expect(keepClaim(store, DAY, { initials: 'ABC', score: 30, claim: '4831' })).toBe(true)
    expect(keepClaim(store, DAY, { initials: 'ABC', score: 57, claim: '0072' })).toBe(true)
    expect(readClaims(store, DAY)).toEqual([{ initials: 'ABC', score: 57, claim: '0072' }, { initials: 'ABC', score: 30, claim: '4831' }])
    expect([...store.kept.keys()]).toEqual([CLAIMS_KEY])
    expect(JSON.parse(store.kept.get(CLAIMS_KEY))).toEqual({ day: DAY, entries: [{ initials: 'ABC', score: 57, claim: '0072' }, { initials: 'ABC', score: 30, claim: '4831' }] })
  })

  it('is for the day: yesterday\'s codes are not today\'s', () => {
    const store = fakeStore()
    keepClaim(store, '2026-11-13', { initials: 'ABC', score: 99, claim: '1111' })
    expect(readClaims(store, DAY)).toEqual([])
    keepClaim(store, DAY, { initials: 'XYZ', score: 12, claim: '2222' })
    expect(readClaims(store, DAY)).toEqual([{ initials: 'XYZ', score: 12, claim: '2222' }])
    expect(readClaims(store, '2026-11-13')).toEqual([])
  })

  it('takes only three letters, a whole score and four digits, and keeps a dozen at most', () => {
    const store = fakeStore()
    for (const bad of [null, {}, { initials: 'abc', score: 5, claim: '1234' }, { initials: 'ABC', score: 5.5, claim: '1234' }, { initials: 'ABC', score: 5, claim: '123' }, { initials: 'ABCD', score: 5, claim: '1234' }]) {
      expect(keepClaim(store, DAY, bad)).toBe(false)
    }
    expect(store.kept.size).toBe(0)
    for (let n = 1; n <= 20; n++) keepClaim(store, DAY, { initials: 'ABC', score: n, claim: String(1000 + n) })
    const kept = readClaims(store, DAY)
    expect(kept).toHaveLength(12)
    expect(kept[0].score).toBe(20)
    expect(kept[11].score).toBe(9)
  })

  it('reads what is kept with care, and plays on where nothing can be kept', () => {
    for (const junk of ['not json', 'null', '{}', JSON.stringify({ day: DAY, entries: 'lots' }), JSON.stringify({ day: DAY, entries: [{ initials: 'ABC', score: 5, claim: 'xxxx' }, { initials: '<b>', score: 5, claim: '1234' }] })]) {
      expect(readClaims(fakeStore({ [CLAIMS_KEY]: junk }), DAY)).toEqual([])
    }
    expect(readClaims(null, DAY)).toEqual([])
    const shut = { getItem() { throw new Error('shut') }, setItem() { throw new Error('shut') } }
    expect(readClaims(shut, DAY)).toEqual([])
    expect(keepClaim(shut, DAY, { initials: 'ABC', score: 5, claim: '1234' })).toBe(false)
  })
})

describe('what a phone says of the football', () => {
  const claims = [{ initials: 'ABC', score: 57, claim: '0072' }, { initials: 'ABC', score: 30, claim: '4831' }]

  it('says nothing on a board with no football', () => {
    expect(footballFor(null, claims)).toBeNull()
    expect(footballFor(undefined)).toBeNull()
  })

  it('tells the phone that leads to keep hold of itself, without showing the code yet', () => {
    const f = footballFor({ closed: false, leader: { initials: 'ABC', score: 57 } }, claims)
    expect(f).toMatchObject({ mine: true, won: false, code: '0072' })
    expect(f.words).toBe('You are leading for the football with 57. If no one beats it by 1:30pm it is yours. Keep this phone: it holds your winner\'s code.')
    expect(f.words).not.toContain('0072')
  })

  it('tells the phone that won, with the code for the stall to check', () => {
    const f = footballFor({ closed: true, leader: { initials: 'ABC', score: 57 } }, claims)
    expect(f).toMatchObject({ mine: true, won: true, code: '0072' })
    expect(f.words).toBe('You have won the football. Show this screen at the sports stall. Winner\'s code 0072.')
  })

  it('tells every other phone who leads or who won, and never a code', () => {
    for (const mine of [[], [{ initials: 'ABC', score: 56, claim: '9999' }], [{ initials: 'ABD', score: 57, claim: '9999' }]]) {
      const open = footballFor({ closed: false, leader: { initials: 'ABC', score: 57 } }, mine)
      expect(open).toEqual({ mine: false, won: false, code: null, words: `${footballLine()} Leading now: ABC with 57.` })
      const shut = footballFor({ closed: true, leader: { initials: 'ABC', score: 57 } }, mine)
      expect(shut).toEqual({ mine: false, won: false, code: null, words: 'The football is won: ABC with 57. Come to the sports stall.' })
    }
    expect(footballFor({ closed: true, leader: null }, claims).words).toBe('The football was not won: no score was on the leaderboard by 1:30pm.')
  })
})
