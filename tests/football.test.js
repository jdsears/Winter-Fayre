// The football (shared/prizes.js, server/board.js): aside from the
// sweets, the best keepy-uppies score on the leaderboard at half past
// one wins a FIFA approved football.
//
//   A score counts if it is on the leaderboard by the cut-off, UK time.
//   Whoever leads then has won; the leaderboard carries on.
//   The winner's code is told to the phone that added the entry and
//   shown on the numbers page, and nowhere else.
//   Nothing more is kept with an entry for it.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, PERSON, quiet } from './support/helpers.js'
import { createBoard, createBoards, londonMoment } from '../server/board.js'
import { createStore } from '../server/store.js'
import { FOOTBALL, footballLine, ONE_EACH } from '../shared/prizes.js'
import { GAMES } from '../shared/games.js'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000
// The fayre's day, by the UK's clocks (winter time: the same as UTC).
const at = (h, m = 0) => Date.UTC(2026, 10, 14, h, m)
const words = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, '\'').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

// A board with a clock of its own, and a go added to it honestly.
function board(start = at(10)) {
  const clock = { now: start }
  const store = createStore({ log: quiet })
  const b = createBoard({ store, name: 'keepy', football: { until: FOOTBALL.until }, now: () => clock.now })
  const add = async (initials, score, when) => {
    clock.now = when - 2 * MINUTE
    const ticket = b.ticket()
    clock.now = when
    return b.add({ initials, score, ticket })
  }
  return { b, clock, store, add }
}

describe('the football\'s cut-off', () => {
  test('is half past one by the UK\'s clocks, winter or summer', () => {
    assert.equal(FOOTBALL.until, '13:30')
    assert.equal(londonMoment('2026-11-14', '13:30'), Date.UTC(2026, 10, 14, 13, 30))
    // In summer the UK is an hour ahead of UTC.
    assert.equal(londonMoment('2026-07-04', '13:30'), Date.UTC(2026, 6, 4, 12, 30))
    assert.equal(londonMoment('2026-11-14', '00:00'), Date.UTC(2026, 10, 14, 0, 0))
  })

  test('is on the keepy-uppies board and no other', async () => {
    const clock = { now: at(10) }
    const boards = createBoards({ store: createStore({ log: quiet }), now: () => clock.now })
    for (const g of GAMES) {
      const top = await boards[g.key].top()
      assert.equal('football' in top, g.key === 'keepy', g.key)
      assert.equal((await boards[g.key].winner()) === null, g.key !== 'keepy', g.key)
    }
  })
})

describe('who leads for the football', () => {
  test('no one, until a score is on the leaderboard', async () => {
    const { b } = board()
    assert.deepEqual((await b.top()).football, { until: '13:30', closed: false, leader: null })
    assert.deepEqual(await b.winner(), { until: '13:30', closed: false, leader: null })
  })

  test('the best score on the leaderboard, and of two the same, the earlier', async () => {
    const { b, add } = board()
    await add('ABC', 30, at(10, 30))
    await add('XYZ', 57, at(11, 0))
    await add('LMN', 57, at(11, 30))
    await add('QRS', 12, at(12, 0))
    assert.deepEqual((await b.top()).football, { until: '13:30', closed: false, leader: { initials: 'XYZ', score: 57 } })
  })

  test('at half past one the leader has won, and a better score after it does not change that', async () => {
    const { b, clock, add } = board()
    await add('ABC', 30, at(11, 0))
    const last = await add('XYZ', 41, at(13, 29))
    assert.deepEqual(last.football, { until: '13:30', closed: false, leader: { initials: 'XYZ', score: 41 } })
    // Exactly at the cut-off it is still open; a moment after, it is closed.
    clock.now = at(13, 30)
    assert.equal((await b.top()).football.closed, false)
    clock.now = at(13, 30) + 1
    assert.equal((await b.top()).football.closed, true)
    const late = await add('LMN', 90, at(13, 45))
    assert.equal(late.ok, true)
    assert.equal(late.rank, 1)
    // The leaderboard carries on: the late score tops it. The football does not move.
    assert.deepEqual(late.entries[0], { initials: 'LMN', score: 90 })
    assert.deepEqual(late.football, { until: '13:30', closed: true, leader: { initials: 'XYZ', score: 41 } })
    assert.deepEqual((await b.top()).football.leader, { initials: 'XYZ', score: 41 })
  })

  test('if no score is on the leaderboard in time, the football is not won', async () => {
    const { b, add } = board()
    await add('ABC', 30, at(14, 0))
    assert.deepEqual((await b.top()).football, { until: '13:30', closed: true, leader: null })
  })

  test('taking the leader off puts the next best in its place, before the close or after', async () => {
    const { b, clock, add } = board()
    await add('ABC', 30, at(11, 0))
    await add('XYZ', 57, at(12, 0))
    clock.now = at(14, 0)
    const out = await b.remove({ place: 1, initials: 'XYZ', score: 57 })
    assert.equal(out.ok, true)
    assert.deepEqual(out.football.leader, { initials: 'ABC', score: 30 })
    assert.deepEqual((await b.winner()).leader.initials, 'ABC')
  })
})

describe('the winner\'s code', () => {
  test('is four digits, told to the phone that adds an entry in time and not to one that is late', async () => {
    const { add } = board()
    const early = await add('ABC', 30, at(11, 0))
    assert.match(early.claim, /^\d{4}$/)
    const onTime = await add('XYZ', 31, at(13, 30))
    assert.match(onTime.claim, /^\d{4}$/)
    const late = await add('LMN', 32, at(13, 31))
    assert.equal(late.ok, true)
    assert.equal('claim' in late, false)
  })

  test('is the one the numbers page is given for the leader, and belongs to that entry alone', async () => {
    const { b, add } = board()
    const first = await add('ABC', 30, at(11, 0))
    const second = await add('ABC', 30, at(11, 5))
    const best = await add('XYZ', 57, at(12, 0))
    const w = await b.winner()
    assert.deepEqual(w, { until: '13:30', closed: false, leader: { initials: 'XYZ', score: 57, at: at(12, 0), code: best.claim } })
    // The same letters and score added at another time have a code of their own (ten thousand to one against a match).
    assert.notEqual(first.claim, second.claim)
  })

  test('is made from the entry and the service\'s own secret: nothing more is kept, and another service would not know it', async () => {
    const { b, store, add } = board()
    const out = await add('ABC', 30, at(11, 0))
    const kept = await store.read('boards/keepy-2026-11-14')
    assert.deepEqual(kept, { entries: [{ i: 'ABC', s: 30, t: at(11, 0) }] })
    assert.ok(!JSON.stringify(kept).includes(out.claim))
    // The same board read by a service with another secret gives another code.
    const clock = { now: at(12, 0) }
    const other = createBoard({ store, name: 'keepy', football: { until: '13:30' }, now: () => clock.now, ticketKey: Buffer.from('another service, another secret') })
    assert.notEqual((await other.winner()).leader.code, (await b.winner()).leader.code)
  })

  test('a board with no football tells no code', async () => {
    const clock = { now: at(10) }
    const b = createBoard({ store: createStore({ log: quiet }), name: 'rugby', maxScore: 130, perSecond: 6, slack: 18, now: () => clock.now })
    const ticket = b.ticket()
    clock.now += 5 * MINUTE
    const out = await b.add({ initials: 'ABC', score: 60, ticket })
    assert.equal(out.ok, true)
    assert.equal('claim' in out, false)
    assert.equal('football' in out, false)
  })
})

describe('the football on the site', () => {
  const password = 'a long invented password'
  const auth = { authorization: `Basic ${Buffer.from(`anyone:${password}`).toString('base64')}` }

  async function played(app, initials, score, when) {
    app.clock.now = when - 2 * MINUTE
    const { ticket } = await (await app.get('/api/board/keepy')).json()
    app.clock.now = when
    return (await app.post('/api/board/keepy', { initials, score, ticket })).json()
  }

  test('the leaderboard everyone can ask for says who leads, and never the code', async () => {
    const app = await startApp({ clock: { now: at(10) } })
    try {
      const added = await played(app, 'ABC', 44, at(11, 0))
      assert.match(added.claim, /^\d{4}$/)
      const open = await (await app.get('/api/board/keepy')).json()
      assert.deepEqual(open.football, { until: '13:30', closed: false, leader: { initials: 'ABC', score: 44 } })
      const all = await (await app.get('/api/boards')).json()
      assert.deepEqual(all.boards.find(b => b.key === 'keepy').football, open.football)
      assert.ok(all.boards.filter(b => b.key !== 'keepy').every(b => !('football' in b)))
      for (const body of [JSON.stringify(open), JSON.stringify(all)]) assert.ok(!body.includes(added.claim))
      // No other game's board has a football.
      assert.equal('football' in await (await app.get('/api/board/rugby')).json(), false)
    } finally {
      await app.close()
    }
  })

  test('the arcade says the rule on the keepy-uppies tile, who leads, and then who won', async () => {
    const app = await startApp({ clock: { now: at(10) } })
    try {
      let said = words(await (await app.get('/', { headers: PERSON })).text())
      assert.ok(said.includes(`Win a sweet: do 20 keepy-uppies. ${footballLine()} Play keepy-uppies`), said.slice(0, 300))
      assert.ok(said.includes(`claim a sweet. ${ONE_EACH}`))
      assert.equal(said.split(footballLine()).length - 1, 1, 'on one tile only')
      await played(app, 'ABC', 44, at(11, 0))
      said = words(await (await app.get('/', { headers: PERSON })).text())
      assert.ok(said.includes(`${footballLine()} Leading now: ABC with 44.`))
      app.clock.now = at(13, 31)
      said = words(await (await app.get('/', { headers: PERSON })).text())
      assert.ok(said.includes('The football is won: ABC with 44. Come to the sports stall.'))
      assert.ok(!said.includes(footballLine()))
    } finally {
      await app.close()
    }
  })

  test('the arcade has a place for this phone\'s own prizes, empty until the phone fills it', async () => {
    const app = await startApp()
    try {
      const html = await (await app.get('/', { headers: PERSON })).text()
      assert.match(html, /<p class="gs-prize mine" data-mine hidden><\/p>/)
      assert.match(html, /<p class="gs-fb mine-fb" data-mine-football role="status" hidden><\/p>/)
    } finally {
      await app.close()
    }
  })

  test('the TV says the rule on the keepy-uppies board, then the winner', async () => {
    const app = await startApp({ clock: { now: at(10) } })
    try {
      let html = await (await app.get('/tv', { headers: PERSON })).text()
      assert.match(html, /<section class="tvb fb[^"]*" data-tv-board="keepy"/)
      assert.match(html, /<p class="tvf" data-tv-football>A FIFA approved football for the best score by 1:30pm<\/p>/)
      assert.equal((html.match(/data-tv-football/g) || []).length, 1)
      await played(app, 'ABC', 44, at(11, 0))
      app.clock.now = at(13, 40)
      html = await (await app.get('/tv', { headers: PERSON })).text()
      assert.match(html, /<p class="tvf won" data-tv-football>The football is won: ABC with 44\. Come to the sports stall\.<\/p>/)
    } finally {
      await app.close()
    }
  })

  test('the numbers page, behind its password, shows the leader and the winner\'s code', async () => {
    const app = await startApp({ clock: { now: at(10) }, appOptions: { numbersPassword: password } })
    try {
      let said = words(await (await app.get('/numbers', { headers: auth })).text())
      assert.ok(said.includes('The football Open until 1:30pm.'))
      assert.ok(said.includes('No one is on the leaderboard yet.'))
      const added = await played(app, 'ABC', 44, at(11, 7))
      said = words(await (await app.get('/numbers', { headers: auth })).text())
      assert.ok(said.includes(`ABC with 44 , added at 11:07. Winner's code: ${added.claim}`), said.slice(said.indexOf('The football'), said.indexOf('The football') + 400))
      app.clock.now = at(13, 45)
      said = words(await (await app.get('/numbers', { headers: auth })).text())
      assert.ok(said.includes('Closed at 1:30pm.'))
      assert.ok(said.includes(`Winner's code: ${added.claim}`))
      assert.ok(said.includes('Give the football to the phone that shows the same code.'))
      // Without the password there is no numbers page, and so no code.
      assert.equal((await app.get('/numbers')).status, 401)
      for (const p of ['/', '/tv', '/keepy-uppies']) assert.ok(!(await (await app.get(p, { headers: PERSON })).text()).includes(added.claim), p)
    } finally {
      await app.close()
    }
  })

  test('the privacy page says what the phone keeps for the sweet and the football', async () => {
    const app = await startApp()
    try {
      const said = words(await (await app.get('/privacy', { headers: PERSON })).text())
      assert.ok(said.includes('whether you have won your sweet today (there is one sweet each)'))
      assert.ok(said.includes('a four digit code that lets the stall see the winning score is yours'))
    } finally {
      await app.close()
    }
  })
})
