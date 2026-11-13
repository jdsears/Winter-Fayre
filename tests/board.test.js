// The games' leaderboards (server/board.js).
//
//   A board keeps three letters, a score and the time, and nothing else.
//   Anything but three letters A to Z is refused, and so are three
//   letters that spell something rude.
//   A go needs a ticket this service handed out; a ticket is used once,
//   and a score the time since the ticket does not allow is refused.
//   A new board starts each day, UK time, and the day before is deleted.
//   With a folder to write to, a restart keeps the day.
//   Every game in the arcade has a board of its own.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createBoard, createBoards, cleanInitials, readEntries, londonDay, dayName, BLOCKED, BOARD_SIZE, ADDS_A_MINUTE } from '../server/board.js'
import { createStore } from '../server/store.js'
import { GAMES } from '../shared/games.js'
import { startApp, quiet, FAYRE, PERSON } from './support/helpers.js'

// A board in memory with a clock the test moves.
function memoryBoard({ at = FAYRE, store = createStore({ log: quiet }), ...options } = {}) {
  const clock = { now: at }
  const board = createBoard({ store, now: () => clock.now, ...options })
  // A ticket, then a go of this many seconds.
  const go = async (initials, score, seconds = score) => {
    const ticket = board.ticket()
    clock.now += seconds * 1000
    return board.add({ initials, score, ticket })
  }
  return { board, clock, go, store }
}

describe('what the leaderboard takes', () => {
  test('only three letters A to Z', () => {
    assert.equal(cleanInitials('abc'), 'ABC')
    assert.equal(cleanInitials(' XYZ '), 'XYZ')
    for (const bad of ['', 'AB', 'ABCD', 'A B', 'A1C', 'Åsa', '<b>', 'Kai Hartley', null, undefined, 123, {}, ['A', 'B', 'C']]) assert.equal(cleanInitials(bad), null, String(bad))
  })

  test('three letters that spell something rude are refused', () => {
    assert.ok(BLOCKED.size > 35)
    for (const word of BLOCKED) {
      assert.match(word, /^[A-Z]{3}$/)
      assert.equal(cleanInitials(word), null)
      assert.equal(cleanInitials(word.toLowerCase()), null)
    }
    assert.equal(cleanInitials('AAA'), 'AAA')
  })

  test('a file is read field by field: nothing but letters, a score and a time comes through', () => {
    const raw = { entries: [
      { i: 'ABC', s: 12, t: 1700000000000, name: 'Kai Hartley', ip: '203.0.113.9' },
      { i: 'abc', s: 40 },
      { i: 'ASS', s: 99 },
      { i: 'TOOLONG', s: 5 },
      { i: 'DEF', s: 0 },
      { i: 'GHI', s: 2.5 },
      { i: 'JKL', s: 100000 },
      'nonsense',
      null,
    ], extra: 'ignored' }
    assert.deepEqual(readEntries(raw), [{ i: 'ABC', s: 40, t: null }, { i: 'ABC', s: 12, t: 1700000000000 }])
    assert.deepEqual(readEntries(null), [])
    assert.deepEqual(readEntries({ entries: 'no' }), [])
  })
})

describe('adding a go', () => {
  test('a go with a ticket goes on the board, best first, the earlier of two the same ahead', async () => {
    const { board, go } = memoryBoard()
    assert.deepEqual((await board.top()).entries, [])
    assert.equal((await go('ABC', 10)).rank, 1)
    assert.equal((await go('DEF', 25)).rank, 1)
    const third = await go('GHI', 10)
    assert.equal(third.ok, true)
    assert.equal(third.rank, 3)
    assert.deepEqual(third.entries, [{ initials: 'DEF', score: 25 }, { initials: 'ABC', score: 10 }, { initials: 'GHI', score: 10 }])
    assert.equal(third.day, '2026-11-14')
    assert.equal(third.name, 'Saturday 14 November')
  })

  test('letters, scores and tickets are checked', async () => {
    const { board, clock } = memoryBoard()
    const ticket = board.ticket()
    clock.now += 60000
    assert.deepEqual(await board.add({ initials: 'A<C', score: 5, ticket }), { ok: false, reason: 'initials' })
    assert.deepEqual(await board.add({ initials: 'FUK', score: 5, ticket }), { ok: false, reason: 'initials' })
    for (const score of [0, -3, 2.5, '7', null, 1001, NaN]) assert.deepEqual(await board.add({ initials: 'ABC', score, ticket }), { ok: false, reason: 'score' }, String(score))
    for (const bad of [undefined, '', 'made-up', `${ticket}x`, ticket.replace(/.$/, c => (c === 'a' ? 'b' : 'a'))]) assert.deepEqual(await board.add({ initials: 'ABC', score: 5, ticket: bad }), { ok: false, reason: 'ticket' }, String(bad))
    assert.equal((await board.add({ initials: 'ABC', score: 5, ticket })).ok, true)
  })

  test('a ticket is used once, goes stale, and is good for its own game only', async () => {
    const store = createStore({ log: quiet })
    const clock = { now: FAYRE }
    const boards = createBoards({ store, now: () => clock.now })
    const ticket = boards.keepy.ticket()
    clock.now += 30000
    assert.equal((await boards.freekick.add({ initials: 'ABC', score: 3, ticket })).reason, 'ticket')
    assert.equal((await boards.keepy.add({ initials: 'ABC', score: 3, ticket })).ok, true)
    assert.equal((await boards.keepy.add({ initials: 'ABC', score: 3, ticket })).reason, 'ticket')
    const old = boards.keepy.ticket()
    clock.now += 3 * 60 * 60 * 1000 + 1000
    assert.equal((await boards.keepy.add({ initials: 'ABC', score: 3, ticket: old })).reason, 'ticket')
  })

  test('a score the time does not allow is refused', async () => {
    const { go } = memoryBoard()
    // Keepy-uppies: two and a half touches a second at the very most.
    assert.equal((await go('ABC', 100, 10)).reason, 'score')
    assert.equal((await go('ABC', 100, 60)).ok, true)
  })

  test('the board holds fifty, and a go below them all is told so', async () => {
    const { board, clock, go } = memoryBoard()
    for (let n = 0; n < BOARD_SIZE; n++) {
      // A minute apart, so the flood guard stays out of it.
      clock.now += 60000
      assert.equal((await go('ABC', 100 + n, 100)).ok, true)
    }
    clock.now += 60000
    assert.deepEqual(await go('LOW', 5, 30), { ok: false, reason: 'low' })
    clock.now += 60000
    const top = await go('TOP', 500, 300)
    assert.equal(top.rank, 1)
    assert.equal((await board.top()).entries.length, BOARD_SIZE)
  })

  test('a flood is turned away', async () => {
    const { board, clock } = memoryBoard()
    const tickets = Array.from({ length: ADDS_A_MINUTE + 1 }, () => board.ticket())
    clock.now += 30000
    for (let n = 0; n < ADDS_A_MINUTE; n++) assert.equal((await board.add({ initials: 'ABC', score: 3, ticket: tickets[n] })).ok, true)
    assert.deepEqual(await board.add({ initials: 'ABC', score: 3, ticket: tickets[ADDS_A_MINUTE] }), { ok: false, reason: 'busy' })
    clock.now += 61000
    assert.equal((await board.add({ initials: 'ABC', score: 3, ticket: tickets[ADDS_A_MINUTE] })).ok, true)
  })

  test('an entry can be taken off, and only the one that was meant', async () => {
    const { board, go } = memoryBoard()
    await go('ABC', 10)
    await go('DEF', 25)
    await go('GHI', 7)
    // The board as it was looked at: DEF 25, ABC 10, GHI 7.
    assert.deepEqual(await board.remove({ place: 2, initials: 'DEF', score: 25 }), { ok: false })
    assert.deepEqual(await board.remove({ place: 9, initials: 'ABC', score: 10 }), { ok: false })
    const out = await board.remove({ place: 2, initials: 'ABC', score: 10 })
    assert.equal(out.ok, true)
    assert.deepEqual((await board.top()).entries, [{ initials: 'DEF', score: 25 }, { initials: 'GHI', score: 7 }])
  })
})

describe('a board for the day', () => {
  test('the day is the UK day, and is named in words', () => {
    assert.equal(londonDay(Date.UTC(2026, 10, 14, 23, 59)), '2026-11-14')
    assert.equal(londonDay(Date.UTC(2026, 10, 15, 0, 0)), '2026-11-15')
    // In summer the UK day starts an hour before the UTC one.
    assert.equal(londonDay(Date.UTC(2026, 5, 30, 23, 30)), '2026-07-01')
    assert.equal(dayName('2026-11-14'), 'Saturday 14 November')
  })

  test('a new board starts each day, and the day before is deleted', async () => {
    const { board, clock, go, store } = memoryBoard({ at: Date.UTC(2026, 10, 14, 13, 0, 0) })
    await go('ABC', 20)
    assert.equal((await board.top()).entries.length, 1)
    assert.ok(await store.read('boards/keepy-2026-11-14'))
    clock.now = Date.UTC(2026, 10, 15, 9, 0, 0)
    const next = await board.top()
    assert.equal(next.day, '2026-11-15')
    assert.deepEqual(next.entries, [])
    // Given a moment to tidy, nothing of the day before is left.
    await new Promise(r => setTimeout(r, 20))
    assert.equal(await store.read('boards/keepy-2026-11-14'), null)
  })

  test('with a folder, a restart keeps the day and the tickets; the file holds letters, scores and times only', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'arcade-board-'))
    try {
      const clock = { now: FAYRE }
      const first = createBoard({ store: createStore({ dir, log: quiet }), now: () => clock.now })
      const ticket = first.ticket()
      const later = first.ticket()
      clock.now += 20000
      assert.equal((await first.add({ initials: 'ABC', score: 12, ticket })).ok, true)
      assert.deepEqual(readdirSync(path.join(dir, 'boards')), ['keepy-2026-11-14.json'])
      const file = JSON.parse(readFileSync(path.join(dir, 'boards', 'keepy-2026-11-14.json'), 'utf8'))
      assert.deepEqual(file, { entries: [{ i: 'ABC', s: 12, t: clock.now }] })
      // The service restarts: a new store and a new board on the same folder.
      const second = createBoard({ store: createStore({ dir, log: quiet }), now: () => clock.now })
      assert.deepEqual((await second.top()).entries, [{ initials: 'ABC', score: 12 }])
      assert.equal((await second.add({ initials: 'DEF', score: 9, ticket: later })).ok, true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('without a folder a restart starts the board again, and old tickets are refused', async () => {
    const clock = { now: FAYRE }
    const first = createBoard({ store: createStore({ log: quiet }), now: () => clock.now })
    const ticket = first.ticket()
    const later = first.ticket()
    clock.now += 20000
    assert.equal((await first.add({ initials: 'ABC', score: 12, ticket })).ok, true)
    const second = createBoard({ store: createStore({ log: quiet }), now: () => clock.now })
    assert.deepEqual((await second.top()).entries, [])
    assert.equal((await second.add({ initials: 'DEF', score: 9, ticket: later })).reason, 'ticket')
  })
})

describe('every game has a board of its own', () => {
  test('one for each game in the arcade, each with its own highest score and its own speed', async () => {
    const clock = { now: FAYRE }
    const boards = createBoards({ store: createStore({ log: quiet }), now: () => clock.now })
    assert.deepEqual(Object.keys(boards), GAMES.map(g => g.key))
    const tickets = GAMES.map(g => [boards[g.key].ticket(), boards[g.key].ticket()])
    // Two hours: long enough for a hundred of anything, honestly. One
    // wait for them all, so that however many games there are the day
    // does not turn before the last is added.
    clock.now += 2 * 60 * 60 * 1000
    for (const [i, g] of GAMES.entries()) {
      const b = boards[g.key]
      const [ticket, over] = tickets[i]
      const score = Math.min(g.board.maxScore, 100)
      assert.equal((await b.add({ initials: 'ABC', score, ticket })).ok, true, g.key)
      assert.equal((await b.add({ initials: 'ABC', score: g.board.maxScore + 1, ticket: over })).reason, 'score', g.key)
    }
    // Each is kept apart.
    assert.equal((await boards.keepy.top()).entries[0].score, 100)
    assert.equal((await boards.freekick.top()).entries[0].score, 10)
    assert.equal((await boards.penalties.top()).entries[0].score, 40)
  })

  test('free kicks: ten goals cannot be scored in ten seconds', async () => {
    const clock = { now: FAYRE }
    const { freekick } = createBoards({ store: createStore({ log: quiet }), now: () => clock.now })
    const quick = freekick.ticket()
    const honest = freekick.ticket()
    clock.now += 10000
    assert.equal((await freekick.add({ initials: 'ABC', score: 10, ticket: quick })).reason, 'score')
    clock.now += 30000
    assert.equal((await freekick.add({ initials: 'ABC', score: 10, ticket: honest })).ok, true)
  })
})

describe('head to head: wins in a row', () => {
  const streaks = (at = FAYRE) => {
    const clock = { now: at }
    const board = createBoards({ store: createStore({ log: quiet }), now: () => clock.now }).headtohead
    return { board, clock }
  }

  test('a run cannot grow faster than a match a minute', async () => {
    const { board, clock } = streaks()
    const ticket = board.ticket()
    clock.now += 60 * 1000
    assert.equal((await board.add({ initials: 'ABC', score: 6, ticket })).reason, 'score')
    const again = board.ticket()
    clock.now += 4 * 60 * 1000
    assert.equal((await board.add({ initials: 'ABC', score: 6, ticket: again })).ok, true)
  })

  test('a run added while it is going grows in place, by its own ticket only', async () => {
    const { board, clock } = streaks()
    const ticket = board.ticket()
    clock.now += 70 * 1000
    const first = await board.add({ initials: 'ABC', score: 1, ticket })
    assert.equal(first.ok, true)
    assert.match(first.ticket, /\.ABC\.1\./)
    // The next win: the same entry, now 2.
    clock.now += 65 * 1000
    const second = await board.add({ initials: 'ABC', score: 2, ticket: first.ticket })
    assert.equal(second.ok, true)
    assert.deepEqual(second.entries, [{ initials: 'ABC', score: 2 }])
    // The old ticket is spent, and a run cannot jump.
    assert.equal((await board.add({ initials: 'ABC', score: 3, ticket: first.ticket })).reason, 'ticket')
    clock.now += 65 * 1000
    assert.equal((await board.add({ initials: 'ABC', score: 9, ticket: second.ticket })).reason, 'score')
  })

  test('a board whose entries do not grow refuses a ticket that names one', async () => {
    const clock = { now: FAYRE }
    const boards = createBoards({ store: createStore({ log: quiet }), now: () => clock.now })
    const ticket = boards.headtohead.ticket()
    clock.now += 70 * 1000
    const run = await boards.headtohead.add({ initials: 'ABC', score: 1, ticket })
    clock.now += 70 * 1000
    assert.equal((await boards.keepy.add({ initials: 'ABC', score: 2, ticket: run.ticket })).reason, 'ticket')
  })
})

describe('the leaderboards on the site', () => {
  test('each game\'s page carries a ticket, and a go is added and read back with nothing else kept', async () => {
    const app = await startApp()
    try {
      for (const g of GAMES) {
        const html = await (await app.get(g.path, { headers: PERSON })).text()
        const m = /data-ticket="([^"]+)"/.exec(html)
        assert.ok(m, `${g.path} carries a ticket`)
        app.clock.now += 5 * 60 * 1000
        const res = await app.post(`/api/board/${g.key}`, { initials: 'abc', score: 1, ticket: m[1], name: 'Kai Hartley', email: 'kai@example.com' })
        assert.equal(res.status, 200, g.key)
        assert.equal(res.headers.get('cache-control'), 'no-store')
        const out = await res.json()
        assert.equal(out.ok, true)
        assert.equal(out.rank, 1)
        assert.ok(out.ticket, 'a ticket for the next go')
        const board = await (await app.get(`/api/board/${g.key}`)).json()
        assert.deepEqual(board.entries, [{ initials: 'ABC', score: 1 }])
        assert.equal(board.day, '2026-11-14')
        assert.ok(board.ticket)
        // What is kept: three letters, a score and the time. Nothing else.
        const kept = await app.store.read(`boards/${g.key}-2026-11-14`)
        assert.deepEqual(Object.keys(kept), ['entries'])
        assert.deepEqual(Object.keys(kept.entries[0]).sort(), ['i', 's', 't'])
        assert.ok(!JSON.stringify(kept).includes('Kai'))
      }
    } finally {
      await app.close()
    }
  })

  test('a refused go is told why, with a fresh ticket; a game that is not there is not found', async () => {
    const app = await startApp()
    try {
      const { ticket } = await (await app.get('/api/board/keepy')).json()
      app.clock.now += 60000
      const rude = await app.post('/api/board/keepy', { initials: 'FUK', score: 3, ticket })
      assert.equal(rude.status, 422)
      const body = await rude.json()
      assert.equal(body.reason, 'initials')
      assert.ok(body.ticket)
      assert.equal((await app.post('/api/board/keepy', { initials: 'ABC', score: 3, ticket: 'made-up' })).status, 422)
      assert.equal((await app.get('/api/board/snooker')).status, 404)
      assert.equal((await app.post('/api/board/snooker', { initials: 'ABC', score: 3, ticket })).status, 404)
      assert.equal((await app.get('/api/board/__proto__')).status, 404)
      // Not JSON, and too long: refused, and nothing breaks.
      assert.equal((await app.post('/api/board/keepy', '{not json')).status, 400)
      assert.equal((await app.post('/api/board/keepy', JSON.stringify({ initials: 'ABC', score: 3, ticket, pad: 'x'.repeat(2000) }))).status, 413)
      assert.equal((await app.get('/api/board/keepy')).status, 200)
    } finally {
      await app.close()
    }
  })

  test('the TV is given every game\'s top ten in one answer, with no tickets', async () => {
    const app = await startApp()
    try {
      const tickets = Array.from({ length: 12 }, () => app.boards.keepy.ticket())
      app.clock.now += 5 * 60 * 1000
      for (let n = 0; n < 12; n++) await app.boards.keepy.add({ initials: 'ABC', score: 10 + n, ticket: tickets[n] })
      const res = await app.get('/api/boards')
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('cache-control'), 'no-store')
      const all = await res.json()
      assert.equal(all.day, '2026-11-14')
      assert.equal(all.name, 'Saturday 14 November')
      assert.deepEqual(all.boards.map(b => b.key), GAMES.map(g => g.key))
      const keepy = all.boards.find(b => b.key === 'keepy')
      assert.equal(keepy.title, 'Keepy-uppies')
      assert.equal(keepy.entries.length, 10)
      assert.deepEqual(keepy.entries[0], { initials: 'ABC', score: 21 })
      assert.ok(!JSON.stringify(all).includes('ticket'))
    } finally {
      await app.close()
    }
  })
})
