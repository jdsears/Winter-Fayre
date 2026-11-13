// Head to head's players (characters.js): eight to pick from, the
// computer's never the visitor's, and the pick kept on the device.

import { describe, it, expect } from 'vitest'
import { CHARACTERS, characterById, pickOpponent, readCharacter, keepCharacter, CHARACTER_KEY, drawHead } from './characters.js'

describe("head to head's players", () => {
  it('are eight, each different, with no names', () => {
    expect(CHARACTERS.length).toBe(8)
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(8)
    expect(new Set(CHARACTERS.map(c => c.style)).size).toBe(8)
    expect(new Set(CHARACTERS.map(c => c.skin)).size).toBeGreaterThanOrEqual(5)
    for (const c of CHARACTERS) {
      expect(c.skin).toMatch(/^#[0-9a-f]{6}$/)
      expect(c.hair).toMatch(/^#[0-9a-f]{6}$/)
      expect(Object.keys(c).sort()).toEqual(['hair', 'id', 'label', 'skin', 'style'])
      // A description of hair, never a name.
      expect(c.label).toMatch(/hair|ponytail|curls|bob|braids|crop/)
    }
    expect(characterById('nobody')).toBe(CHARACTERS[0])
  })

  it("the computer's player is never the visitor's, and every other player has a turn", () => {
    for (const mine of CHARACTERS) {
      const seen = new Set()
      for (let i = 0; i < 70; i++) {
        const other = pickOpponent(mine.id, () => i / 70)
        expect(other.id).not.toBe(mine.id)
        seen.add(other.id)
      }
      expect(seen.size).toBe(7)
      expect(pickOpponent(mine.id, () => 1).id).not.toBe(mine.id)
    }
  })

  it('the pick is kept on the device, and nonsense is ignored', () => {
    const kept = {}
    const store = { getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v } }
    expect(readCharacter(store)).toBeNull()
    expect(keepCharacter(store, 'braids')).toBe('braids')
    expect(kept[CHARACTER_KEY]).toBe('braids')
    expect(readCharacter(store)).toBe('braids')
    expect(keepCharacter(store, 'someone else')).toBe(CHARACTERS[0].id)
    expect(readCharacter({ getItem: () => 'Kai Hartley' })).toBeNull()
    expect(readCharacter({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(keepCharacter(null, 'bun')).toBe('bun')
  })

  it('every player can be drawn facing either way', () => {
    const calls = []
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return a }), set: (t, k, v) => { t[k] = v; return true } })
    for (const c of CHARACTERS) for (const f of [1, -1]) drawHead(ctx, c, 100, 100, 27, f, { look: 2 })
    expect(calls.filter(k => k === 'save').length).toBe(16)
    expect(calls.filter(k => k === 'restore').length).toBe(16)
    expect(calls).toContain('arc')
  })
})
