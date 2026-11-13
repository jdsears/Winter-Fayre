// The appeal's line on a game's finish panel (appeal.js).

import { describe, it, expect } from 'vitest'
import { appealLine, APPEAL_AT } from './appeal.js'
import { APPEAL } from '../../shared/appeal.js'

// A stand-in document that makes plain elements.
const doc = () => ({
  createElement(tag) {
    const el = { tag, className: '', textContent: '', attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v }, appendChild(c) { this.children.push(c); return c } }
    return el
  },
})

describe('the appeal\'s line on a finish panel', () => {
  it('says what the games are in aid of, for grown-ups, in the appeal\'s own words', () => {
    const { root } = appealLine(doc())
    expect(root.tag).toBe('p')
    expect(root.className).toBe('gs-appeal')
    expect(root.children[0].textContent).toBe(`${APPEAL.line} `)
    expect(APPEAL.line.startsWith('Grown-ups:')).toBe(true)
  })

  it('links to the appeal on this site, never straight to where money is given', () => {
    const { root, link } = appealLine(doc())
    expect(root.children[1]).toBe(link)
    expect(link.tag).toBe('a')
    expect(link.attrs.href).toBe('/#appeal')
    expect(APPEAL_AT).toBe('/#appeal')
    expect(link.textContent).toBe('See the appeal')
    expect(link.attrs.href).not.toContain('donate')
    expect(link.attrs.href).not.toContain('justgiving')
  })
})
