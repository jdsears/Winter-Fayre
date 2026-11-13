// Where the site keeps the little it keeps (server/store.js).
//
//   In memory always; in a small file as well when it has a folder, so
//   a restart does not wipe the day.
//   Only the site's own names can be kept: nothing a visitor sends ever
//   becomes a file's name.
//   Yesterday's leaderboards are deleted when they are pruned.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createStore } from '../server/store.js'
import { quiet } from './support/helpers.js'

function tempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'arcade-store-'))
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) }
}

describe('kept in memory', () => {
  test('what is written is read back, and nothing is there before', async () => {
    const store = createStore({ log: quiet })
    assert.equal(store.kind, 'memory')
    assert.equal(await store.read('boards/keepy-2026-11-14'), null)
    await store.write('boards/keepy-2026-11-14', { entries: [{ i: 'ABC', s: 3 }] })
    assert.deepEqual(await store.read('boards/keepy-2026-11-14'), { entries: [{ i: 'ABC', s: 3 }] })
  })

  test('only the site\'s own names are kept', async () => {
    const store = createStore({ log: quiet })
    for (const bad of ['../etc/passwd', 'boards/../../x', 'boards/Keepy', 'other/thing', 'boards/', 'boards/a b', '/boards/x', 'boards/x.json']) {
      await assert.rejects(() => store.write(bad, {}), /Not a name/, bad)
      await assert.rejects(() => store.read(bad), /Not a name/, bad)
    }
  })
})

describe('kept in a folder', () => {
  test('a restart keeps the day: a new store on the same folder reads what the old one wrote', async () => {
    const t = tempDir()
    try {
      const first = createStore({ dir: t.dir, log: quiet })
      assert.equal(first.kind, 'file')
      await first.write('boards/keepy-2026-11-14', { entries: [{ i: 'ABC', s: 12, t: 1 }] })
      await first.write('counts/2026-11-14', { pages: { '/': 4 }, games: {} })
      assert.deepEqual(readdirSync(path.join(t.dir, 'boards')), ['keepy-2026-11-14.json'])
      assert.deepEqual(JSON.parse(readFileSync(path.join(t.dir, 'boards', 'keepy-2026-11-14.json'), 'utf8')), { entries: [{ i: 'ABC', s: 12, t: 1 }] })
      const second = createStore({ dir: t.dir, log: quiet })
      assert.deepEqual(await second.read('boards/keepy-2026-11-14'), { entries: [{ i: 'ABC', s: 12, t: 1 }] })
      assert.deepEqual(await second.read('counts/2026-11-14'), { pages: { '/': 4 }, games: {} })
    } finally {
      t.done()
    }
  })

  test('a file that is not JSON reads as nothing, and no half written file is left behind', async () => {
    const t = tempDir()
    try {
      const store = createStore({ dir: t.dir, log: quiet })
      writeFileSync(path.join(t.dir, 'boards', 'keepy-2026-11-14.json'), '{not json')
      assert.equal(await store.read('boards/keepy-2026-11-14'), null)
      await store.write('boards/keepy-2026-11-14', { entries: [] })
      assert.deepEqual(readdirSync(path.join(t.dir, 'boards')), ['keepy-2026-11-14.json'])
    } finally {
      t.done()
    }
  })

  test('pruning deletes what is not wanted, from memory and from the folder', async () => {
    const t = tempDir()
    try {
      const store = createStore({ dir: t.dir, log: quiet })
      await store.write('boards/keepy-2026-11-13', { entries: [{ i: 'OLD', s: 9 }] })
      await store.write('boards/keepy-2026-11-14', { entries: [{ i: 'NEW', s: 5 }] })
      await store.write('counts/2026-11-13', { pages: {}, games: {} })
      await store.prune('boards', name => name.endsWith('-2026-11-14'))
      assert.equal(await store.read('boards/keepy-2026-11-13'), null)
      assert.deepEqual(await store.read('boards/keepy-2026-11-14'), { entries: [{ i: 'NEW', s: 5 }] })
      assert.deepEqual(readdirSync(path.join(t.dir, 'boards')), ['keepy-2026-11-14.json'])
      // The numbers are a different folder, and are left alone.
      assert.deepEqual(readdirSync(path.join(t.dir, 'counts')), ['2026-11-13.json'])
    } finally {
      t.done()
    }
  })

  test('the ticket key outlives a restart in a folder, and is made afresh without one', () => {
    const t = tempDir()
    try {
      const a = createStore({ dir: t.dir, log: quiet }).secret()
      const b = createStore({ dir: t.dir, log: quiet }).secret()
      assert.equal(a.length, 32)
      assert.deepEqual(a, b)
      assert.notDeepEqual(createStore({ log: quiet }).secret(), createStore({ log: quiet }).secret())
    } finally {
      t.done()
    }
  })

  test('a folder that cannot be used falls back to memory, and says so', async () => {
    const t = tempDir()
    try {
      const file = path.join(t.dir, 'a-file')
      writeFileSync(file, 'x')
      const said = []
      const store = createStore({ dir: path.join(file, 'under'), log: { warn: (m) => said.push(m) } })
      assert.equal(store.kind, 'memory')
      assert.equal(said.length, 1)
      await store.write('boards/keepy-2026-11-14', { entries: [] })
      assert.deepEqual(await store.read('boards/keepy-2026-11-14'), { entries: [] })
    } finally {
      t.done()
    }
  })
})
