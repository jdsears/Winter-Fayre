// The prize on a finish panel (prize.js): what it writes for a winner
// and for a go that fell short.

import { describe, it, expect } from 'vitest'
import { drawPrize, clearPrize, wonAt } from './prize.js'
import { PRIZES, PRIZE_WORDS } from '../../shared/prizes.js'
import { firstFiveGoals, newShootout, addKick } from '../shootout/rules.js'

// Enough of a document for the prize's place: elements with a class,
// words, children and a hidden attribute.
function fakeDoc() {
  const make = (tag) => ({
    tag, className: '', textContent: '', children: [], attrs: {},
    get firstChild() { return this.children[0] || null },
    appendChild(c) { this.children.push(c); return c },
    removeChild(c) { this.children = this.children.filter(x => x !== c) },
    setAttribute(k, v) { this.attrs[k] = v },
    removeAttribute(k) { delete this.attrs[k] },
  })
  return { createElement: make }
}

describe('the prize on a finish panel', () => {
  it('tells a winner to show the screen at the stall, with the time it was won', () => {
    const doc = fakeDoc()
    const into = doc.createElement('p')
    into.attrs.hidden = ''
    const said = drawPrize(doc, into, 'keepy', PRIZES.keepy.at, new Date(2026, 10, 14, 10, 5))
    expect(said).toBe(`You have won a sweet. ${PRIZE_WORDS}`)
    expect(into.className).toBe('gs-prize won')
    expect('hidden' in into.attrs).toBe(false)
    expect(into.children.map(c => c.textContent)).toEqual(['You have won a sweet', PRIZE_WORDS, 'Won at 10:05'])
  })

  it('tells anyone else what to aim for, and is emptied for the next go', () => {
    const doc = fakeDoc()
    const into = doc.createElement('p')
    const said = drawPrize(doc, into, 'freekick', PRIZES.freekick.at - 1)
    expect(said).toBe('Win a sweet: score 8 of your 10 free kicks.')
    expect(into.className).toBe('gs-prize')
    expect(into.children).toHaveLength(1)
    clearPrize(into)
    expect(into.children).toHaveLength(0)
    expect(into.attrs.hidden).toBe('')
  })

  it('says nothing for a game with no prize', () => {
    const doc = fakeDoc()
    const into = doc.createElement('p')
    expect(drawPrize(doc, into, 'snooker', 99)).toBe('')
    expect(into.attrs.hidden).toBe('')
  })

  it('writes the time with two figures each way', () => {
    expect(wonAt(new Date(2026, 10, 14, 9, 7))).toBe('Won at 09:07')
    expect(wonAt(new Date(2026, 10, 14, 13, 40))).toBe('Won at 13:40')
  })
})

describe('penalties: the prize is judged on the first five kicks', () => {
  const play = (results) => results.reduce((s, r) => addKick(s, r), newShootout({ first: 'us', full: true }))

  it('counts the visitor\'s goals from their own five', () => {
    // us: G G M G G, them: M M M M M
    expect(firstFiveGoals(play([true, false, true, false, false, false, true, false, true, false]))).toBe(4)
    expect(firstFiveGoals(play([true, false, true, false]))).toBe(2)
    expect(firstFiveGoals(newShootout())).toBe(0)
  })

  it('never counts sudden death', () => {
    // Level at 3 each after five, then the visitor scores twice more.
    const level = [true, true, true, true, true, true, false, false, false, false]
    const s = play([...level, true, true, true, false])
    expect(s.kicks.filter(k => k.side === 'us' && k.scored)).toHaveLength(5)
    expect(firstFiveGoals(s)).toBe(3)
    expect(firstFiveGoals(s, 'them')).toBe(3)
  })
})
