// The sweet on a finish panel (prize.js): what it writes for a winner
// and for a go that fell short, and that there is one sweet each.

import { describe, it, expect } from 'vitest'
import { drawPrize, drawSweet, clearPrize, wonAt, readSweet, dayOf, SWEET_KEY, CONFIRM_MS } from './prize.js'
import { PRIZES, PRIZE_WORDS, ONE_EACH } from '../../shared/prizes.js'
import { firstFiveGoals, newShootout, addKick } from '../shootout/rules.js'

// Enough of a document for the prize's place: elements with a class,
// words, children, a hidden attribute and a tap to listen for.
function fakeDoc() {
  const make = (tag) => ({
    tag, className: '', textContent: '', children: [], attrs: {}, taps: [],
    get firstChild() { return this.children[0] || null },
    appendChild(c) { this.children.push(c); return c },
    removeChild(c) { this.children = this.children.filter(x => x !== c) },
    setAttribute(k, v) { this.attrs[k] = v },
    removeAttribute(k) { delete this.attrs[k] },
    addEventListener(type, fn) { if (type === 'click') this.taps.push(fn) },
    tap() { for (const fn of [...this.taps]) fn() },
  })
  return { createElement: make }
}
// A phone's own storage.
function fakeStore(start = {}) {
  const kept = new Map(Object.entries(start))
  return { getItem: k => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)) }, kept }
}
const words = (into) => into.children.map(c => c.textContent)
const at = (h, m, day = 14) => new Date(2026, 10, day, h, m)

describe('the prize on a finish panel', () => {
  it('tells a winner to show the screen at the stall, with the time it was won and the stall\'s button', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    const into = doc.createElement('p')
    into.attrs.hidden = ''
    const said = drawPrize(doc, into, 'keepy', PRIZES.keepy.at, at(10, 5), store)
    expect(said).toBe(`You have won a sweet. ${PRIZE_WORDS}`)
    expect(into.className).toBe('gs-prize won')
    expect('hidden' in into.attrs).toBe(false)
    expect(words(into)).toEqual(['You have won a sweet', PRIZE_WORDS, 'Won at 10:05', 'Stall: sweet given'])
    expect(into.children[3].tag).toBe('button')
    expect(into.children[3].attrs.type).toBe('button')
    // The phone remembers it, and nothing else: the day, the game and the time.
    expect(JSON.parse(store.kept.get(SWEET_KEY))).toEqual({ day: '2026-11-14', game: 'keepy', at: '10:05', given: null })
    expect([...store.kept.keys()]).toEqual([SWEET_KEY])
  })

  it('tells anyone else what to aim for and that it is one sweet each, and is emptied for the next go', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    const into = doc.createElement('p')
    const said = drawPrize(doc, into, 'freekick', PRIZES.freekick.at - 1, at(10, 5), store)
    expect(said).toBe('Win a sweet: score 8 of your 10 free kicks.')
    expect(into.className).toBe('gs-prize')
    expect(words(into)).toEqual([`Win a sweet: score 8 of your 10 free kicks. ${ONE_EACH}`])
    expect(store.kept.size).toBe(0)
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
    expect(wonAt(at(9, 7))).toBe('Won at 09:07')
    expect(wonAt(at(13, 40))).toBe('Won at 13:40')
    expect(dayOf(at(9, 7))).toBe('2026-11-14')
  })
})

describe('one sweet each', () => {
  it('a second win is not a second sweet: the first is still the one to collect', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    drawPrize(doc, doc.createElement('p'), 'keepy', 25, at(10, 5), store)
    const into = doc.createElement('p')
    const said = drawPrize(doc, into, 'rugby', PRIZES.rugby.at, at(10, 20), store)
    expect(said).toBe(`You have a sweet to collect. ${PRIZE_WORDS}`)
    expect(words(into)).toEqual(['You have a sweet to collect', PRIZE_WORDS, 'Won at 10:05 in Keepy-uppies', 'Stall: sweet given'])
    expect(JSON.parse(store.kept.get(SWEET_KEY))).toEqual({ day: '2026-11-14', game: 'keepy', at: '10:05', given: null })
  })

  it('a go that falls short still shows a sweet that is waiting, so it can be claimed any time', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    drawPrize(doc, doc.createElement('p'), 'penalties', 5, at(11, 0), store)
    const into = doc.createElement('p')
    drawPrize(doc, into, 'cricket', 3, at(11, 30), store)
    expect(into.className).toBe('gs-prize won')
    expect(words(into).slice(0, 3)).toEqual(['You have a sweet to collect', PRIZE_WORDS, 'Won at 11:00 in Penalties'])
  })

  it('the stall taps its button twice, and the phone then says the sweet has been had', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    const into = doc.createElement('p')
    drawPrize(doc, into, 'netball', PRIZES.netball.at, at(12, 0), store)
    const button = into.children[3]
    // One tap only asks again: a thumb that slips loses no one their sweet.
    button.tap()
    expect(button.textContent).toBe('Tap again to confirm')
    expect(JSON.parse(store.kept.get(SWEET_KEY)).given).toBeNull()
    expect(into.className).toBe('gs-prize won')
    button.tap()
    const kept = JSON.parse(store.kept.get(SWEET_KEY))
    expect(kept.given).toMatch(/^\d\d:\d\d$/)
    expect(kept).toMatchObject({ day: '2026-11-14', game: 'netball', at: '12:00' })
    expect(into.className).toBe('gs-prize had')
    expect(words(into)).toEqual(['You have had your sweet', `Your sweet was given at ${kept.given}. ${ONE_EACH}`])
    expect(into.children.some(c => c.tag === 'button')).toBe(false)
  })

  it('after the sweet is given, a win is praised and wins no more, and a miss is told the same', () => {
    const doc = fakeDoc()
    const store = fakeStore({ [SWEET_KEY]: JSON.stringify({ day: '2026-11-14', game: 'keepy', at: '10:05', given: '10:09' }) })
    const win = doc.createElement('p')
    expect(drawPrize(doc, win, 'rugby', 5, at(12, 0), store)).toBe(`Target beaten again. You have had your sweet today. ${ONE_EACH}`)
    expect(words(win)).toEqual(['Target beaten again', `Your sweet was given at 10:09. ${ONE_EACH}`])
    const miss = doc.createElement('p')
    expect(drawPrize(doc, miss, 'rugby', 1, at(12, 5), store)).toBe(`You have had your sweet today. ${ONE_EACH}`)
    expect(words(miss)).toEqual(['You have had your sweet', `Your sweet was given at 10:09. ${ONE_EACH}`])
    expect(miss.className).toBe('gs-prize had')
  })

  it('is for the day: yesterday\'s sweet does not count against today', () => {
    const doc = fakeDoc()
    const store = fakeStore({ [SWEET_KEY]: JSON.stringify({ day: '2026-11-13', game: 'keepy', at: '15:00', given: '15:02' }) })
    expect(readSweet(store, at(9, 0))).toBeNull()
    const into = doc.createElement('p')
    expect(drawPrize(doc, into, 'keepy', 30, at(9, 0), store)).toBe(`You have won a sweet. ${PRIZE_WORDS}`)
    expect(JSON.parse(store.kept.get(SWEET_KEY))).toEqual({ day: '2026-11-14', game: 'keepy', at: '09:00', given: null })
  })

  it('reads what the phone keeps with care: anything odd is no sweet', () => {
    for (const junk of ['not json', '{}', '[]', 'null', JSON.stringify({ day: '2026-11-14', game: 'snooker', at: '10:00' }), JSON.stringify({ day: '2026-11-14', game: 'keepy', at: 'soon' })]) {
      expect(readSweet(fakeStore({ [SWEET_KEY]: junk }), at(10, 0))).toBeNull()
    }
    expect(readSweet(null, at(10, 0))).toBeNull()
    expect(readSweet({ getItem() { throw new Error('shut') } }, at(10, 0))).toBeNull()
    // A given time that is not a time is no given time.
    expect(readSweet(fakeStore({ [SWEET_KEY]: JSON.stringify({ day: '2026-11-14', game: 'keepy', at: '10:00', given: 'yes' }) }), at(10, 5))).toEqual({ day: '2026-11-14', game: 'keepy', at: '10:00', given: null })
  })

  it('where the browser will keep nothing, the page itself remembers while it is open', () => {
    const doc = fakeDoc()
    const first = doc.createElement('p')
    expect(drawPrize(doc, first, 'keepy', 30, at(10, 0))).toBe(`You have won a sweet. ${PRIZE_WORDS}`)
    const second = doc.createElement('p')
    expect(drawPrize(doc, second, 'rugby', 5, at(10, 10))).toBe(`You have a sweet to collect. ${PRIZE_WORDS}`)
    // Another page starts afresh.
    expect(drawPrize(fakeDoc(), fakeDoc().createElement('p'), 'rugby', 5, at(10, 20))).toBe(`You have won a sweet. ${PRIZE_WORDS}`)
  })

  it('draws a waiting sweet on the arcade page too, with the same button', () => {
    const doc = fakeDoc()
    const store = fakeStore()
    const into = doc.createElement('p')
    into.attrs.hidden = ''
    const said = drawSweet(doc, into, { day: '2026-11-14', game: 'cricket', at: '11:11', given: null }, { store })
    expect(said).toBe(`You have a sweet to collect. ${PRIZE_WORDS}`)
    expect('hidden' in into.attrs).toBe(false)
    expect(words(into)).toEqual(['You have a sweet to collect', PRIZE_WORDS, 'Won at 11:11 in Cricket smash', 'Stall: sweet given'])
    into.children[3].tap()
    into.children[3].tap()
    expect(JSON.parse(store.kept.get(SWEET_KEY)).given).toMatch(/^\d\d:\d\d$/)
    expect(CONFIRM_MS).toBeGreaterThanOrEqual(3000)
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
