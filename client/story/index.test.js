// The appeal's 3D story on the arcade page (index.js): when it runs, and
// the small sums it scrolls by.

import { describe, it, expect } from 'vitest'
import { canDraw3d, focusLine, follow, startStory, pastTheStory, boardWords, easeOff, SLOW_MS, WARM_UP, SAMPLE, SHORT } from './index.js'

describe('where the words are being read', () => {
  it('is a little above the middle of the room under the stage', () => {
    expect(focusLine({ bottom: 371 }, 844)).toBeCloseTo(371 + (844 - 371) * 0.42, 9)
    // Before the stage is pinned it is lower on the screen, and so is the line.
    expect(focusLine({ bottom: 600 }, 844)).toBeGreaterThan(focusLine({ bottom: 371 }, 844))
  })

  it('stays on the screen when the stage is off it, above or below', () => {
    expect(focusLine({ bottom: -200 }, 844)).toBeCloseTo(844 * 0.42, 9)
    expect(focusLine({ bottom: 3000 }, 844)).toBe(844)
  })
})

describe('the camera following the scroll', () => {
  it('closes on where the scroll is without ever passing it, most of the way in a fifth of a second', () => {
    let shown = 0
    for (let i = 0; i < 12; i++) {
      const next = follow(shown, 3, 1 / 60)
      expect(next).toBeGreaterThan(shown)
      expect(next).toBeLessThan(3)
      shown = next
    }
    expect(shown).toBeGreaterThan(3 * 0.7)
    expect(follow(5, 2, 0.05)).toBeLessThan(5)
    expect(follow(5, 2, 0.05)).toBeGreaterThan(2)
  })

  it('stays where it is when no time has passed, or the clock has gone back', () => {
    expect(follow(1.5, 4, 0)).toBe(1.5)
    expect(follow(1.5, 4, -1)).toBe(1.5)
  })
})

describe('keeping the picture moving on a slow phone', () => {
  it('draws fewer pixels once enough frames have been slow, where there are pixels to spare', () => {
    expect(easeOff({ average: 70, counted: SAMPLE, ratio: 2 })).toBe(true)
    expect(easeOff({ average: SLOW_MS + 1, counted: SAMPLE + 30, ratio: 1.5 })).toBe(true)
  })

  it('leaves a phone that keeps up alone, and does not judge on a few frames', () => {
    expect(easeOff({ average: 17, counted: 500, ratio: 2 })).toBe(false)
    expect(easeOff({ average: SLOW_MS, counted: 500, ratio: 2 })).toBe(false)
    expect(easeOff({ average: 300, counted: SAMPLE - 1, ratio: 2 })).toBe(false)
  })

  it('has nothing more to take off a picture already drawn at one pixel to one', () => {
    expect(easeOff({ average: 300, counted: 500, ratio: 1 })).toBe(false)
  })

  it('calls under twenty frames a second slow, and waits for the scene to settle before counting', () => {
    expect(SLOW_MS).toBe(50)
    expect(WARM_UP).toBeGreaterThanOrEqual(20)
    expect(SAMPLE).toBeGreaterThanOrEqual(30)
  })
})

describe('the words on the boards along the back of the field', () => {
  const page = (value) => ({ getAttribute: (name) => (name === 'data-boards' ? value : null) })

  it('are the ones the page gives, which are the ones round the games\' pitch', () => {
    expect(boardWords(page(JSON.stringify(['Wymondham College PSA', 'Winter Fayre', 'Sports Fund Appeal'])))).toEqual(['Wymondham College PSA', 'Winter Fayre', 'Sports Fund Appeal'])
    expect(boardWords(page(JSON.stringify(['  Winter Fayre  ', 'The PSA\'s appeal'])))).toEqual(['Winter Fayre', 'The PSA\'s appeal'])
  })

  it('are a few short names and nothing else: no markup, no numbers, nothing long', () => {
    const odd = ['<b>Winter</b>', 'Winter Fayre', 7, null, { name: 'x' }, 'a'.repeat(60), 'https://elsewhere.example', '', 'x']
    expect(boardWords(page(JSON.stringify(odd)))).toEqual(['Winter Fayre'])
    expect(boardWords(page(JSON.stringify(Array.from({ length: 20 }, () => 'Winter Fayre'))))).toHaveLength(6)
  })

  it('are none where the page gives none that can be read', () => {
    expect(boardWords(page(null))).toEqual([])
    expect(boardWords(page('not a list'))).toEqual([])
    expect(boardWords(page('{"a":1}'))).toEqual([])
    expect(boardWords({ getAttribute: () => { throw new Error('no') } })).toEqual([])
  })
})

describe('whether a browser will draw 3D', () => {
  it('is yes where a canvas gives a drawing surface, and no where it gives none or throws', () => {
    const lost = []
    const yes = { createElement: () => ({ getContext: (kind) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext: () => lost.push(1) }) } : null) }) }
    expect(canDraw3d(yes)).toBe(true)
    // The surface it tried is given back at once.
    expect(lost).toEqual([1])
    expect(canDraw3d({ createElement: () => ({ getContext: (kind) => (kind === 'webgl' ? {} : null) }) })).toBe(true)
    expect(canDraw3d({ createElement: () => ({ getContext: () => null }) })).toBe(false)
    expect(canDraw3d({ createElement: () => { throw new Error('no canvas') } })).toBe(false)
  })
})

describe('where the story is left as words alone', () => {
  // A page that fails the test if the story so much as looks at it.
  const untouched = { querySelector: () => { throw new Error('the page was looked at') }, classList: { add: () => { throw new Error('the page was changed') } } }
  const draws = { createElement: () => ({ getContext: () => ({}) }) }

  it('a visitor who has asked for less motion gets no stage', async () => {
    const win = { innerHeight: 844, document: draws, matchMedia: () => ({ matches: true }) }
    expect(await startStory(untouched, win)).toBe(null)
  })

  it('nor does a browser that will not draw 3D', async () => {
    const win = { innerHeight: 844, document: { createElement: () => ({ getContext: () => null }) }, matchMedia: () => ({ matches: false }) }
    expect(await startStory(untouched, win)).toBe(null)
  })

  it('nor a screen too short to share between a picture and the words, such as a phone on its side', async () => {
    expect(SHORT).toBeGreaterThanOrEqual(420)
    for (const innerHeight of [320, 360, SHORT - 1, undefined]) {
      const win = { innerHeight, document: draws, matchMedia: () => ({ matches: false }) }
      expect(await startStory(untouched, win)).toBe(null)
    }
  })

  it('nor a visitor sent straight to the games menu, who scrolled through it when they arrived', async () => {
    expect(pastTheStory('#games')).toBe(true)
    for (const hash of ['', '#appeal', '#top', undefined, null]) expect(pastTheStory(hash)).toBe(false)
    const win = { innerHeight: 844, location: { hash: '#games' }, document: draws, matchMedia: () => ({ matches: false }) }
    expect(await startStory(untouched, win)).toBe(null)
  })

  it('nor a page whose words are not marked with every stop', async () => {
    const win = { innerHeight: 844, document: draws, matchMedia: () => ({ matches: false }) }
    const changed = []
    const page = { querySelector: (sel) => (sel.includes('data-stop="give"') ? null : { append: () => changed.push('filled') }), classList: { add: (c) => changed.push(c) } }
    expect(await startStory(page, win)).toBe(null)
    expect(changed).toEqual([])
    // Nor one with no room for the picture.
    const roomless = { querySelector: (sel) => (sel === '[data-stage]' ? null : {}), classList: { add: (c) => changed.push(c) } }
    expect(await startStory(roomless, win)).toBe(null)
    expect(changed).toEqual([])
  })
})
