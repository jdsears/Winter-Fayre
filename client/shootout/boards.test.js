// Partner logos on the boards: only this site's own logo paths are
// taken from the page, and a logo is fitted inside its board.

import { describe, it, expect } from 'vitest'
import { boardLogosFrom, logoBox, logoReady, topSignFrom, drawTopSign, loadTopSign, boardCentre, BOARD_COUNT, BOARD_W } from './boards.js'

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

// The big sign with the PSA's crest on it: the crest stands to the left
// of the words, and the words are made to fit in what is left.
describe('the big sign with a badge', () => {
  const colours = { deep: '#141f33', accent: '#f0c05a' }
  const sign = { name: 'Winter Fayre', over: 'Wymondham College PSA', badge: '/media/badge/68c6f907da676efa.webp' }
  // A canvas that draws nothing and notes the pictures and the words it
  // was asked for. A letter is taken as half as wide as it is tall.
  const canvas = () => {
    const seen = { pictures: [], words: [] }
    const g = {
      font: '',
      fillRect() {},
      measureText(text) { return { width: text.length * Number(/(\d+)px/.exec(this.font)[1]) * 0.5 } },
      fillText(text, x, y) { seen.words.push({ text, x, y, size: Number(/(\d+)px/.exec(this.font)[1]) }) },
      drawImage(img, x, y, w, h) { seen.pictures.push({ img, x, y, w, h }) },
    }
    return { g, seen }
  }
  const loaded = { complete: true, naturalWidth: 256, naturalHeight: 256 }

  it('draws the badge square, two thirds of the sign\'s height, with the words beside it and nothing over it', () => {
    const { g, seen } = canvas()
    drawTopSign(g, 1152, 320, sign, { badge: loaded, colours })
    expect(seen.pictures.length).toBe(1)
    const pic = seen.pictures[0]
    expect(pic.img).toBe(loaded)
    expect(pic.w).toBeCloseTo(320 * 0.66, 6)
    expect(pic.h).toBeCloseTo(pic.w, 6)
    expect(pic.y).toBeCloseTo((320 - pic.h) / 2, 6)
    expect(pic.x).toBeGreaterThan(0)
    expect(seen.words.map(w => w.text)).toEqual(['WYMONDHAM COLLEGE PSA', 'WINTER FAYRE'])
    for (const w of seen.words) {
      // Each line is centred on a point to the right of the badge, and
      // starts clear of it and ends on the sign.
      const half = (w.text.length * w.size * 0.5) / 2
      expect(w.x - half).toBeGreaterThan(pic.x + pic.w)
      expect(w.x + half).toBeLessThan(1152)
    }
  })

  it('draws the words alone, larger, until the badge has loaded or if it never does', () => {
    const withBadge = canvas()
    drawTopSign(withBadge.g, 1152, 320, sign, { badge: loaded, colours })
    for (const badge of [null, { complete: false, naturalWidth: 0, naturalHeight: 0 }, { complete: true, naturalWidth: 0, naturalHeight: 0 }]) {
      const { g, seen } = canvas()
      drawTopSign(g, 1152, 320, sign, { badge, colours })
      expect(seen.pictures).toEqual([])
      expect(seen.words.map(w => w.text)).toEqual(['WYMONDHAM COLLEGE PSA', 'WINTER FAYRE'])
      expect(seen.words[1].size).toBeGreaterThanOrEqual(withBadge.seen.words[1].size)
    }
  })

  it('asks this site for the badge, and tells the game when it has come', () => {
    const made = []
    const win = { Image: class { constructor() { made.push(this) } } }
    let told = 0
    const pics = loadTopSign(topSignFrom(page(JSON.stringify(sign))), { win, onLoad: () => { told += 1 } })
    expect(made.length).toBe(1)
    expect(pics.badge).toBe(made[0])
    expect(pics.logo).toBeNull()
    expect(made[0].src).toBe('/media/badge/68c6f907da676efa.webp')
    made[0].onload()
    expect(told).toBe(1)
    // Where there are no pictures to be had (no window), the words stand.
    expect(loadTopSign(sign, { win: undefined })).toEqual({ logo: null, badge: null })
  })
})
