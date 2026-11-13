// The PSA's crest (server/crest.js): the one picture the site holds.
//
//   It is served from this site, under a name made from what is in it.
//   The arcade, the stall's TV and the big sign in the stadium show it.
//   It counts no one, sets no cookie and is never asked of another site.
//   Without the file the site carries on in words alone.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startApp, PERSON, ROOT } from './support/helpers.js'
import { CREST, CREST_ALT, readCrest, crestImg } from '../server/crest.js'
import { topSignFrom } from '../client/shootout/boards.js'
import { GAMES } from '../shared/games.js'

describe('the crest', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('is the file in the repository, read once, with a name made from what is in it', () => {
    const bytes = readFileSync(path.join(ROOT, 'server', 'crest', 'psa.webp'))
    assert.ok(CREST)
    assert.deepEqual(CREST.bytes, bytes)
    assert.match(CREST.path, /^\/media\/badge\/[0-9a-f]{16}\.webp$/)
    assert.equal(CREST.alt, 'Wymondham College Parent Staff Association')
    assert.equal(CREST_ALT, CREST.alt)
    assert.equal(CREST.size, 256)
  })

  test('is served as a WebP picture a browser may keep for good, with the site\'s usual headers', async () => {
    const res = await app.get(CREST.path, { headers: PERSON })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/webp')
    assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.deepEqual(res.body, CREST.bytes)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.match(res.headers.get('x-robots-tag'), /noindex/)
    assert.equal(res.headers.get('set-cookie'), null)
  })

  test('is the only thing under that name: any other is not found', async () => {
    for (const p of ['/media/badge/0000000000000000.webp', '/media/badge/', '/media/badge/psa.webp', `${CREST.path}.png`, '/media/badge/..%2f..%2fpackage.json', '/server/crest/psa.webp']) {
      assert.equal((await app.get(p, { headers: PERSON })).status, 404, p)
    }
  })

  test('counts no one: asking for it is not a visit', async () => {
    const before = JSON.stringify(await app.counts.days?.() ?? null)
    await app.get(CREST.path, { headers: PERSON })
    assert.equal(JSON.stringify(await app.counts.days?.() ?? null), before)
  })

  test('is on the big sign of every game, by a path the games will take', async () => {
    for (const g of GAMES) {
      const html = await (await app.get(g.path, { headers: PERSON })).text()
      const raw = html.match(/data-top-sign="([^"]*)"/)?.[1].replace(/&quot;/g, '"')
      assert.ok(raw, g.key)
      // The games read the sign from the page and check it: words, and
      // only this site's own picture paths.
      const doc = { querySelector: () => ({ getAttribute: () => raw }) }
      assert.deepEqual(topSignFrom(doc), { name: 'Winter Fayre', logo: null, badge: CREST.path, over: 'Wymondham College PSA' }, g.key)
    }
  })

  test('is on the arcade and the stall\'s TV, with its size and what it shows, and on no other page', async () => {
    for (const [p, shown] of [['/', 72], ['/tv', 96]]) {
      const html = await (await app.get(p, { headers: PERSON })).text()
      assert.ok(html.includes(`<img class="crest" src="${CREST.path}" width="${shown}" height="${shown}" alt="Wymondham College Parent Staff Association" decoding="async">`), p)
      // It is at the top of the page, so it is not held back.
      assert.ok(!/loading="lazy"/.test(html), p)
    }
    for (const p of ['/privacy', ...GAMES.map(g => g.path)]) {
      assert.ok(!/<img\b/.test(await (await app.get(p, { headers: PERSON })).text()), p)
    }
  })

  test('is allowed by the page\'s own rules: pictures from this site only', async () => {
    const csp = (await app.get('/', { headers: PERSON })).headers.get('content-security-policy')
    assert.match(csp, /img-src 'self'(;|$)/)
  })
})

describe('without the crest', () => {
  test('a file that is not there, or is not a WebP picture, is no crest', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'crest-'))
    try {
      assert.equal(readCrest(path.join(dir, 'missing.webp')), null)
      const notOne = path.join(dir, 'not.webp')
      writeFileSync(notOne, 'This is not a picture.')
      assert.equal(readCrest(notOne), null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a page shows nothing in its place', () => {
    assert.equal(crestImg({ shown: 72 }, null), '')
    assert.match(crestImg({ shown: 40, lazy: true }, { path: '/media/badge/abcdef0123456789.webp', alt: 'A & B' }), /^<img class="crest" src="\/media\/badge\/abcdef0123456789\.webp" width="40" height="40" alt="A &amp; B" decoding="async" loading="lazy">$/)
  })
})
