// Partner logos on the boards: only this site's own logo paths are
// taken from the page, and a logo is fitted inside its board.

import { describe, it, expect } from 'vitest'
import { boardLogosFrom, logoBox, logoReady, topSignFrom, boardCentre, BOARD_COUNT, BOARD_W } from './boards.js'

const page = (value) => ({ querySelector: () => (value === null ? null : { getAttribute: () => value }) })
const ID = '6a284285-7904-46b2-b25c-2b7196350d6b'

describe('partner logos on the boards', () => {
  it('takes only this site\'s own logo paths', () => {
    const raw = JSON.stringify({
      'Example Garage': `/media/partners/${ID}.webp`,
      Elsewhere: 'https://example.com/logo.webp',
      Photo: `/media/photos/${ID}-480.webp`,
      Odd: 42,
    })
    expect(boardLogosFrom(page(raw))).toEqual({ 'example garage': `/media/partners/${ID}.webp` })
    expect(boardLogosFrom(page('not json'))).toEqual({})
    expect(boardLogosFrom(page(null))).toEqual({})
  })

  it('fits a logo inside its board, in the middle', () => {
    for (const [nw, nh] of [[1600, 159], [600, 201], [200, 200]]) {
      const b = logoBox({ naturalWidth: nw, naturalHeight: nh }, 1024, 148)
      expect(b.w).toBeLessThanOrEqual(1024 * 0.86 + 0.01)
      expect(b.h).toBeLessThanOrEqual(148 * 0.66 + 0.01)
      expect(b.x + b.w / 2).toBeCloseTo(512, 5)
      expect(b.y + b.h / 2).toBeCloseTo(74, 5)
      expect(b.w / b.h).toBeCloseTo(nw / nh, 5)
    }
  })

  it('a logo that has not loaded is not drawn', () => {
    expect(logoReady(null)).toBe(false)
    expect(logoReady({ complete: true, naturalWidth: 0 })).toBe(false)
    expect(logoReady({ complete: true, naturalWidth: 10 })).toBe(true)
  })

  it('the big sign takes a name and only this site\'s own pictures', () => {
    const sign = (v) => topSignFrom(page(JSON.stringify(v)))
    expect(sign({ name: '  Wicklewood   U14s ', badge: '/media/badge/197745b334cbfc9d.webp', logo: null })).toEqual({ name: 'Wicklewood U14s', badge: '/media/badge/197745b334cbfc9d.webp', logo: null })
    expect(sign({ name: 'A', badge: 'https://example.com/b.png', logo: `/media/photos/${ID}-480.webp` })).toEqual({ name: 'A', badge: null, logo: null })
    expect(sign({ name: '', logo: `/media/partners/${ID}.webp` })).toEqual({ name: '', badge: null, logo: `/media/partners/${ID}.webp` })
    expect(sign({ name: '' })).toBeNull()
    expect(sign(null)).toBeNull()
    expect(topSignFrom(page('not json'))).toBeNull()
    expect(sign({ name: 'x'.repeat(90) }).name.length).toBe(40)
  })

  it('the boards stand in a row with one behind the middle of the goal', () => {
    expect(BOARD_COUNT % 2).toBe(1)
    expect(boardCentre((BOARD_COUNT - 1) / 2)).toBe(0)
    expect(boardCentre(1) - boardCentre(0)).toBe(BOARD_W)
    expect(boardCentre(0)).toBe(-boardCentre(BOARD_COUNT - 1))
  })
})
