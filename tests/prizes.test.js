// The sweets (shared/prizes.js) and the way an entry is taken off a
// leaderboard (the numbers page).
//
//   Every game has a prize, set in one place, and the arcade's tiles and
//   the TV say what wins it.
//   The numbers page lists today's leaderboards, each entry with a Take
//   off button: behind the password, and only from the page itself.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PRIZES, PRIZE_WORDS, wonPrize, prizeFor, prizeLine } from '../shared/prizes.js'
import { GAMES } from '../shared/games.js'
import { cspFor } from '../server/security.js'
import { startApp, PERSON } from './support/helpers.js'

describe('the sweets', () => {
  test('every game has a prize, and nothing else does', () => {
    assert.deepEqual(Object.keys(PRIZES).sort(), GAMES.map(g => g.key).sort())
    for (const g of GAMES) {
      const p = PRIZES[g.key]
      assert.ok(Number.isInteger(p.at) && p.at >= 1, g.key)
      assert.ok(p.at <= g.board.maxScore, `${g.key}: the prize can be reached`)
      assert.match(p.target, /^[a-z]/, `${g.key}: the words carry on from "Win a sweet:"`)
      assert.ok(!/[.!]$/.test(p.target), g.key)
    }
  })

  test('they are at the harder level John asked for: four in five, and eight in ten', () => {
    assert.equal(PRIZES.penalties.at, 4)
    assert.equal(PRIZES.freekick.at, 8)
    assert.equal(PRIZES.headtohead.at, 1)
    assert.equal(PRIZES.keepy.at, 20)
    if (PRIZES.rugby) assert.equal(PRIZES.rugby.at, 4)
    if (PRIZES.netball) assert.equal(PRIZES.netball.at, 8)
  })

  test('a score at the number wins, one under it does not, and nonsense never does', () => {
    for (const [game, p] of Object.entries(PRIZES)) {
      assert.equal(wonPrize(game, p.at), true, game)
      assert.equal(wonPrize(game, p.at + 3), true, game)
      assert.equal(wonPrize(game, p.at - 1), false, game)
      for (const bad of [NaN, undefined, null, '9', Infinity * 0]) assert.equal(wonPrize(game, bad), false, `${game} ${bad}`)
    }
    assert.equal(wonPrize('snooker', 100), false)
  })

  test('a winner is told to show the screen at the stall, in John\'s words; anyone else, what to aim for', () => {
    assert.equal(PRIZE_WORDS, 'Show this screen at the sports stall to claim a sweet.')
    assert.deepEqual(prizeFor('penalties', 4), { won: true, words: PRIZE_WORDS })
    assert.deepEqual(prizeFor('penalties', 3), { won: false, words: 'Win a sweet: score 4 of your 5 penalties.' })
    assert.equal(prizeFor('snooker', 9), null)
    assert.equal(prizeLine('keepy'), 'Win a sweet: do 20 keepy-uppies.')
    assert.equal(prizeLine('snooker'), null)
  })

  test('the arcade says how a sweet is won, and each tile says what wins it', async () => {
    const app = await startApp()
    try {
      const html = await (await app.get('/')).text()
      assert.match(html, /show your screen at the sports stall to claim a sweet/)
      for (const g of GAMES) assert.ok(html.includes(`<span class="gt-w">${prizeLine(g.key)}</span>`), g.key)
    } finally {
      await app.close()
    }
  })
})

describe('taking an entry off a leaderboard', () => {
  const password = 'a long invented password'
  const auth = { authorization: `Basic ${Buffer.from(`anyone:${password}`).toString('base64')}` }
  const form = (fields) => new URLSearchParams(fields).toString()

  async function withBoard() {
    const app = await startApp({ appOptions: { numbersPassword: password } })
    const tickets = [app.boards.keepy.ticket(), app.boards.keepy.ticket(), app.boards.keepy.ticket()]
    app.clock.now += 60000
    await app.boards.keepy.add({ initials: 'ABC', score: 10, ticket: tickets[0] })
    await app.boards.keepy.add({ initials: 'XYZ', score: 25, ticket: tickets[1] })
    await app.boards.keepy.add({ initials: 'LMN', score: 7, ticket: tickets[2] })
    const host = new URL(app.base).host
    const send = (fields, headers = {}) => app.get('/numbers/remove', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: app.base, host, ...auth, ...headers }, body: form(fields) })
    return { app, send, host }
  }

  test('the numbers page lists today\'s leaderboards, each entry with its Take off button', async () => {
    const { app } = await withBoard()
    try {
      const res = await app.get('/numbers', { headers: auth })
      assert.equal(res.status, 200)
      const html = await res.text()
      assert.match(html, /<h2 id="boards">Today's leaderboards<\/h2>/)
      for (const g of GAMES) assert.ok(html.includes(`<h3>${g.title}</h3>`), g.key)
      assert.equal((html.match(/<form method="post" action="\/numbers\/remove">/g) || []).length, 3)
      assert.match(html, /<input type="hidden" name="game" value="keepy"><input type="hidden" name="place" value="1"><input type="hidden" name="initials" value="XYZ"><input type="hidden" name="score" value="25">/)
      // The one page that may send a form, and only to this site.
      const nonce = /<style nonce="([^"]+)">/.exec(html)[1]
      assert.equal(res.headers.get('content-security-policy'), cspFor({ nonce, forms: true }))
      assert.match(res.headers.get('content-security-policy'), /form-action 'self'/)
      assert.ok(!/\sstyle\s*=/.test(html.replace(/<style[\s\S]*?<\/style>/, '')))
      assert.match((await app.get('/', { headers: PERSON })).headers.get('content-security-policy'), /form-action 'none'/)
    } finally {
      await app.close()
    }
  })

  test('the entry that was meant goes, from the board, the game and the TV, and no other', async () => {
    const { app, send } = await withBoard()
    try {
      const res = await send({ game: 'keepy', place: '2', initials: 'ABC', score: '10' })
      assert.equal(res.status, 303)
      assert.equal(res.headers.get('location'), '/numbers?removed=1#boards')
      assert.deepEqual((await (await app.get('/api/board/keepy')).json()).entries, [{ initials: 'XYZ', score: 25 }, { initials: 'LMN', score: 7 }])
      const tv = await (await app.get('/tv')).text()
      assert.ok(!tv.includes('>ABC<'))
      assert.match(await (await app.get('/numbers?removed=1', { headers: auth })).text(), /That entry has been taken off/)
      // The board has moved on: the same place now holds another entry, which stays.
      const stale = await send({ game: 'keepy', place: '2', initials: 'ABC', score: '10' })
      assert.equal(stale.headers.get('location'), '/numbers?removed=0#boards')
      assert.equal((await (await app.get('/api/board/keepy')).json()).entries.length, 2)
      assert.match(await (await app.get('/numbers?removed=0', { headers: auth })).text(), /was not taken off/)
    } finally {
      await app.close()
    }
  })

  test('it needs the password, and must come from the numbers page itself', async () => {
    const { app, send, host } = await withBoard()
    try {
      const entry = { game: 'keepy', place: '1', initials: 'XYZ', score: '25' }
      assert.equal((await send(entry, { authorization: '' })).status, 401)
      assert.equal((await send(entry, { authorization: `Basic ${Buffer.from('a:wrong').toString('base64')}` })).status, 401)
      // A form on another site: the browser would send the remembered
      // password, so where the form came from is what turns it away.
      assert.equal((await send(entry, { origin: 'https://evil.example' })).status, 403)
      assert.equal((await send(entry, { origin: '', referer: 'https://evil.example/page' })).status, 403)
      assert.equal((await send(entry, { origin: '' })).status, 403)
      // From the page itself, by its referer when a browser sends no origin.
      assert.equal((await send({ game: 'keepy', place: '3', initials: 'LMN', score: '7' }, { origin: '', referer: `http://${host}/numbers` })).status, 303)
      assert.deepEqual((await (await app.get('/api/board/keepy')).json()).entries, [{ initials: 'XYZ', score: 25 }, { initials: 'ABC', score: 10 }])
    } finally {
      await app.close()
    }
  })

  test('nonsense is refused, and without a password the address is not there', async () => {
    const { app, send } = await withBoard()
    try {
      for (const bad of [
        { game: 'snooker', place: '1', initials: 'XYZ', score: '25' },
        { game: 'keepy', place: 'first', initials: 'XYZ', score: '25' },
        { game: 'keepy', place: '1', initials: 'xyz', score: '25' },
        { game: 'keepy', place: '1', initials: '<b>', score: '25' },
        { game: 'keepy', place: '1', initials: 'XYZ', score: 'lots' },
        { game: '__proto__', place: '1', initials: 'XYZ', score: '25' },
        {},
      ]) assert.equal((await send(bad)).status, 422, JSON.stringify(bad))
      assert.equal((await (await app.get('/api/board/keepy')).json()).entries.length, 3)
    } finally {
      await app.close()
    }
    const bare = await startApp()
    try {
      assert.equal((await bare.get('/numbers/remove', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'game=keepy' })).status, 404)
    } finally {
      await bare.close()
    }
  })
})
