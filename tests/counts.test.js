// The site's own numbers (server/counts.js).
//
//   A page is counted only under a name the site gave, and a game only
//   if it is one of the arcade's.
//   Nothing about a visitor is kept: the day's file holds counts alone.
//   A machine is not a visit.
//   The numbers page is behind a password and is never indexed.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createCounts, readDay, isMachine, daysBack, dayTotal, GAMES, TALLIES_A_MINUTE } from '../server/counts.js'
import { createStore } from '../server/store.js'
import { COUNTED } from '../server/app.js'
import { GAMES as LIST } from '../shared/games.js'
import { startApp, quiet, FAYRE, PERSON } from './support/helpers.js'

function memoryCounts({ at = FAYRE, store = createStore({ log: quiet }), pages = ['/', '/privacy'] } = {}) {
  const clock = { now: at }
  const counts = createCounts({ store, pages, now: () => clock.now, log: quiet })
  return { counts, clock, store }
}

describe('what is counted', () => {
  test('a page is counted only under a name the site gave, and a game only if it is one of the arcade\'s', async () => {
    const { counts } = memoryCounts()
    assert.equal(counts.page('/'), true)
    assert.equal(counts.page('/'), true)
    assert.equal(counts.page('/privacy'), true)
    assert.equal(counts.page('/admin'), false)
    assert.equal(counts.page('<script>'), false)
    assert.equal(counts.game('keepy', 'play'), true)
    assert.equal(counts.game('keepy', 'done'), true)
    assert.equal(counts.game('snooker', 'play'), false)
    assert.equal(counts.game('keepy', 'cheat'), false)
    const [today] = await counts.days(1)
    assert.deepEqual(today.pages, { '/': 2, '/privacy': 1 })
    assert.deepEqual(today.games.keepy, { play: 1, done: 1 })
    assert.equal(dayTotal(today), 3)
    assert.deepEqual(Object.keys(today.games), LIST.map(g => g.key))
  })

  test('a file is read with care: only the named pages and the arcade\'s games, each a whole number', () => {
    const d = readDay({ pages: { '/': 7, '/privacy': -2, '/secret': 9, '<b>': 4 }, games: { keepy: { play: 3, done: 2.5 }, snooker: { play: 9 }, penalties: 'no' }, visitors: ['203.0.113.9'] }, '2026-11-14', ['/', '/privacy'])
    assert.deepEqual(d.pages, { '/': 7 })
    assert.deepEqual(d.games.keepy, { play: 3, done: 0 })
    assert.deepEqual(d.games.penalties, { play: 0, done: 0 })
    assert.deepEqual(Object.keys(d).sort(), ['day', 'games', 'pages'])
    assert.deepEqual(Object.keys(d.games), GAMES)
  })

  test('a machine is not a visit', () => {
    for (const ua of ['Googlebot/2.1', 'curl/8.5.0', 'python-requests/2.31', 'UptimeRobot/2.0', 'WhatsApp/2.23', '', undefined, null]) assert.equal(isMachine(ua), true, String(ua))
    assert.equal(isMachine(PERSON['user-agent']), false)
  })

  test('a flood of game counts is turned away', () => {
    const { counts, clock } = memoryCounts()
    for (let n = 0; n < TALLIES_A_MINUTE; n++) assert.equal(counts.game('keepy', 'play'), true)
    assert.equal(counts.game('keepy', 'play'), false)
    clock.now += 61000
    assert.equal(counts.game('keepy', 'play'), true)
  })

  test('the days before a day, newest first, across a month end', () => {
    assert.deepEqual(daysBack('2026-12-01', 3), ['2026-12-01', '2026-11-30', '2026-11-29'])
  })
})

describe('where the numbers are kept', () => {
  test('one small file a day, holding counts and nothing else, picked up again after a restart', async () => {
    const store = createStore({ log: quiet })
    const first = memoryCounts({ store })
    first.counts.page('/')
    first.counts.game('penalties', 'play')
    assert.equal(await first.counts.flush(), true)
    assert.equal(await first.counts.flush(), false)
    const kept = await store.read('counts/2026-11-14')
    assert.deepEqual(Object.keys(kept).sort(), ['games', 'pages'])
    assert.deepEqual(kept.pages, { '/': 1 })
    assert.deepEqual(kept.games.penalties, { play: 1, done: 0 })
    // A restart: the day's totals are picked up and added to.
    const second = memoryCounts({ store })
    second.counts.page('/')
    const [today] = await second.counts.days(1)
    assert.equal(today.pages['/'], 2)
    assert.deepEqual(today.games.penalties, { play: 1, done: 0 })
  })

  test('a new day starts a new file, UK time, and the day before is written as it ends', async () => {
    const { counts, clock, store } = memoryCounts({ at: Date.UTC(2026, 10, 14, 23, 50) })
    counts.page('/')
    clock.now = Date.UTC(2026, 10, 15, 0, 5)
    counts.page('/privacy')
    await new Promise(r => setTimeout(r, 20))
    assert.deepEqual((await store.read('counts/2026-11-14')).pages, { '/': 1 })
    const days = await counts.days(2)
    assert.deepEqual(days.map(d => d.day), ['2026-11-15', '2026-11-14'])
    assert.deepEqual(days[0].pages, { '/privacy': 1 })
    assert.deepEqual(days[1].pages, { '/': 1 })
  })
})

describe('the numbers on the site', () => {
  test('a page a person asks for is counted under its fixed name; a machine, a missing page and a refused game are not', async () => {
    const app = await startApp({ appOptions: { numbersPassword: 'a long invented password' } })
    try {
      await app.get('/', { headers: PERSON })
      await app.get('/?utm_source=anything', { headers: PERSON })
      await app.get('/keepy-uppies', { headers: PERSON })
      await app.get('/', { headers: { 'user-agent': 'Googlebot/2.1' } })
      await app.get('/', {})
      await app.get('/not-a-page', { headers: PERSON })
      assert.equal((await app.post('/api/count', { game: 'keepy', moment: 'play' }, PERSON)).status, 204)
      assert.equal((await app.post('/api/count', { game: 'keepy', moment: 'done' }, PERSON)).status, 204)
      assert.equal((await app.post('/api/count', { game: 'snooker', moment: 'play' }, PERSON)).status, 422)
      assert.equal((await app.post('/api/count', { game: 'keepy', moment: 'play' }, { 'user-agent': 'curl/8' })).status, 204)
      const [today] = await app.counts.days(1)
      assert.deepEqual(today.pages, { '/': 2, '/keepy-uppies': 1 })
      assert.deepEqual(today.games.keepy, { play: 1, done: 1 })
      // Every page that is counted has a name for the numbers page.
      for (const g of LIST) assert.equal(COUNTED[g.path], g.title)
    } finally {
      await app.close()
    }
  })

  test('the numbers page is behind the password, never indexed, and shows the totals', async () => {
    const password = 'a long invented password'
    const app = await startApp({ appOptions: { numbersPassword: password } })
    try {
      await app.get('/', { headers: PERSON })
      await app.post('/api/count', { game: 'freekick', moment: 'play' }, PERSON)
      const none = await app.get('/numbers')
      assert.equal(none.status, 401)
      assert.match(none.headers.get('www-authenticate'), /^Basic realm=/)
      assert.equal(none.headers.get('cache-control'), 'no-store')
      const wrong = await app.get('/numbers', { headers: { authorization: `Basic ${Buffer.from('john:wrong').toString('base64')}` } })
      assert.equal(wrong.status, 401)
      const ok = await app.get('/numbers', { headers: { authorization: `Basic ${Buffer.from(`anyone:${password}`).toString('base64')}` } })
      assert.equal(ok.status, 200)
      assert.match(ok.headers.get('x-robots-tag'), /noindex/)
      assert.equal(ok.headers.get('set-cookie'), null)
      const html = await ok.text()
      assert.match(html, /<b>1<\/b> page views/)
      assert.match(html, /<th scope="row">Free kick challenge<\/th><td>1<\/td><td>0<\/td>/)
      assert.match(html, /<th scope="row">The arcade<\/th><td>1<\/td>/)
      assert.ok(!html.includes(password))
    } finally {
      await app.close()
    }
  })

  test('wrong passwords are slowed down, and without a password the page is not there', async () => {
    const app = await startApp({ appOptions: { numbersPassword: 'a long invented password' } })
    try {
      const guess = { headers: { authorization: `Basic ${Buffer.from('a:guess').toString('base64')}` } }
      for (let n = 0; n < 10; n++) assert.equal((await app.get('/numbers', guess)).status, 401)
      assert.equal((await app.get('/numbers', guess)).status, 429)
    } finally {
      await app.close()
    }
    const bare = await startApp()
    try {
      assert.equal((await bare.get('/numbers')).status, 404)
    } finally {
      await bare.close()
    }
  })
})
