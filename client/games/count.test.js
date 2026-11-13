// The games tell the site when they are started and finished, and send
// nothing else.

import { describe, it, expect } from 'vitest'
import { tally, GAMES } from './count.js'

describe('telling the site a game was played', () => {
  it('sends only the game and which of the two moments it is', () => {
    const sent = []
    const win = { fetch: (url, init) => { sent.push({ url, init }); return Promise.resolve() } }
    expect(tally('keepy', 'play', win)).toBe(true)
    expect(sent.length).toBe(1)
    expect(sent[0].url).toBe('/api/count')
    expect(sent[0].init.method).toBe('POST')
    expect(JSON.parse(sent[0].init.body)).toEqual({ game: 'keepy', moment: 'play' })
    expect(Object.keys(sent[0].init.headers)).toEqual(['content-type'])
    expect(sent[0].init.credentials).toBeUndefined()
  })

  it('sends nothing for a game or a moment it does not know', () => {
    const sent = []
    const win = { fetch: (...a) => { sent.push(a); return Promise.resolve() } }
    expect(tally('chess', 'play', win)).toBe(false)
    expect(tally('keepy', 'won', win)).toBe(false)
    expect(sent.length).toBe(0)
    expect(GAMES).toEqual(['penalties', 'keepy', 'freekick', 'headtohead'])
  })

  it('never stops a game when it cannot be sent', () => {
    expect(tally('keepy', 'done', { fetch: () => Promise.reject(new Error('offline')) })).toBe(true)
    expect(tally('keepy', 'done', { fetch: () => { throw new Error('blocked') } })).toBe(false)
    expect(tally('keepy', 'done', {})).toBe(false)
  })
})
