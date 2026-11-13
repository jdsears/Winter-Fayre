// Safety and privacy at a school event, checked.
//
//   The only thing kept from a visitor is a leaderboard entry they
//   choose to add: three letters, a score and the time.
//   Nothing a visitor sends is ever written into a page as markup.
//   No page asks anything of another site: no analytics, no adverts, no
//   outside fonts, scripts, pictures or frames.
//   No cookie is ever set.
//   The repository holds no photo or film of anyone: its one picture
//   is the PSA's crest.
//   The privacy page says what the site does, and no more.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { startApp, PAGES, PERSON, ROOT } from './support/helpers.js'
import { GAMES } from '../shared/games.js'

const ATTACK = '<script>alert(1)</script><img src=x onerror=alert(2)>"\'><svg onload=alert(3)>'

describe('what a visitor sends never becomes part of a page', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('a leaderboard takes three letters and nothing else, whatever is sent', async () => {
    const { ticket } = await (await app.get('/api/board/keepy')).json()
    app.clock.now += 60000
    for (const initials of [ATTACK, '<b>', 'A<C', 'AB', 'ABCD', 'A B', '   ', 'Kai Hartley', '%3Cb%3E', { $ne: null }, ['A', 'B', 'C'], 123, null]) {
      const res = await app.post('/api/board/keepy', { initials, score: 3, ticket })
      assert.equal(res.status, 422, JSON.stringify(initials))
      const body = await res.text()
      assert.ok(!body.includes('<'), 'nothing sent is echoed back')
    }
    assert.deepEqual((await (await app.get('/api/board/keepy')).json()).entries, [])
  })

  test('an address, a query or a header planted with markup is never written into a page', async () => {
    for (const p of [`/${encodeURIComponent(ATTACK)}`, `/?q=${encodeURIComponent(ATTACK)}`, `/keepy-uppies?x=${encodeURIComponent(ATTACK)}`, '/%3Cscript%3Ealert(1)%3C/script%3E']) {
      const res = await app.get(p, { headers: { ...PERSON, referer: `https://example.com/${ATTACK}`, 'x-forwarded-host': 'evil.example' } })
      const html = await res.text()
      assert.ok(!html.includes('<script>alert'), p)
      assert.ok(!/<img src=x/i.test(html), p)
      assert.ok(!html.includes('evil.example'), p)
    }
  })

  test('a game count carries the game and the moment and nothing else', async () => {
    assert.equal((await app.post('/api/count', { game: 'keepy', moment: 'play', name: 'Kai Hartley', device: 'a phone' }, PERSON)).status, 204)
    assert.equal((await app.post('/api/count', { game: ATTACK, moment: 'play' }, PERSON)).status, 422)
    assert.equal((await app.post('/api/count', '{not json', PERSON)).status, 400)
    assert.equal(await app.counts.flush(), true)
    const kept = JSON.stringify(await app.store.read('counts/2026-11-14'))
    assert.ok(!kept.includes('Kai') && !kept.includes('phone') && !kept.includes('Mozilla'))
  })
})

describe('no page asks anything of another site', () => {
  let app
  let pages
  before(async () => {
    app = await startApp()
    pages = []
    for (const p of [...PAGES, '/not-a-page']) pages.push({ path: p, res: await app.get(p, { headers: PERSON }) })
    for (const p of pages) p.html = await p.res.text()
  })
  after(() => app.close())

  test('every address a page loads from is this site\'s own', () => {
    for (const { path: p, html } of pages) {
      for (const [, attr, value] of html.matchAll(/\s(src|href|action|poster|data|srcset)="([^"]*)"/g)) {
        assert.ok(value.startsWith('/') || value.startsWith('#'), `${p}: ${attr}="${value}"`)
        assert.ok(!value.startsWith('//'), `${p}: ${attr}="${value}"`)
      }
      assert.ok(!/<(iframe|object|embed|form|link rel="(?!stylesheet|icon|preload))/i.test(html), p)
      assert.ok(!/google|facebook|gtag\(|doubleclick|hotjar|segment\.io|plausible|matomo/i.test(html), p)
    }
  })

  test('no cookie is set by any page or any answer', async () => {
    for (const { path: p, res } of pages) assert.equal(res.headers.get('set-cookie'), null, p)
    for (const p of ['/api/board/keepy', '/api/boards', '/health', '/robots.txt', '/icon.svg']) assert.equal((await app.get(p)).headers.get('set-cookie'), null, p)
  })

  test('no one is named, and no real place beyond the fayre\'s own name', () => {
    for (const { path: p, html } of pages) {
      const words = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')
      assert.ok(!/\b(Mr|Mrs|Ms|Miss|Dr)\.? [A-Z]/.test(words), p)
      assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(words), `${p} carries an email address`)
    }
  })
})

describe('the privacy page says what the site does', () => {
  test('what is kept, what is not, and that the leaderboards are cleared after the fayre', async () => {
    const app = await startApp()
    try {
      const html = await (await app.get('/privacy')).text()
      const words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      for (const said of [
        'Three letters, your score and the time',
        'no name, no account, no email address and nothing about your phone',
        'the leaderboards are cleared after the fayre',
        'No cookies',
        'No analytics service and no advertising',
        'No fonts or scripts from elsewhere',
        'No photos or films of anyone, and no one is named',
        'cannot tell one visitor from another',
        'ask at the sports stall',
      ]) assert.ok(words.includes(said), said)
    } finally {
      await app.close()
    }
  })
})

describe('the repository', () => {
  const SKIP = new Set(['node_modules', 'dist', '.git', 'screenshots'])
  function files(dir = ROOT) {
    const out = []
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) out.push(...files(full))
      else out.push(full)
    }
    return out
  }

  test('holds no photo or film of anyone: no picture, film or sound file but the PSA\'s crest', () => {
    const media = files().map(f => path.relative(ROOT, f)).filter(f => /\.(jpe?g|png|gif|webp|avif|heic|bmp|tiff?|svg|mp4|mov|webm|m4v|mp3|wav|ogg|m4a)$/i.test(f))
    assert.deepEqual(media, [path.join('server', 'crest', 'psa.webp')])
  })

  test('the crest is a small WebP picture, 256 pixels square: nothing a phone would notice fetching', () => {
    const bytes = readFileSync(path.join(ROOT, 'server', 'crest', 'psa.webp'))
    assert.ok(bytes.length < 12 * 1024, `${bytes.length} bytes`)
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF')
    assert.equal(bytes.subarray(8, 16).toString('latin1'), 'WEBPVP8X')
    // The size the picture says it is: width and height, each less one.
    assert.equal(bytes.readUIntLE(24, 3) + 1, 256)
    assert.equal(bytes.readUIntLE(27, 3) + 1, 256)
  })

  test('holds no secret: no .env, and nothing that looks like a key', () => {
    const all = files().map(f => path.relative(ROOT, f))
    assert.ok(!all.includes('.env'))
    for (const f of all.filter(f => /\.(js|mjs|json|md|toml|yml|example)$/.test(f) && f !== 'package-lock.json')) {
      const src = readFileSync(path.join(ROOT, f), 'utf8')
      assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b/.test(src), f)
    }
  })

  test('the built script asks nothing of another site', { skip: !existsSync(path.join(ROOT, 'dist', 'assets')) && 'run npm run build first' }, () => {
    const dir = path.join(ROOT, 'dist', 'assets')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, f), 'utf8')
      // The only addresses in it are names of standards and of the 3D
      // library's own pages, in words it would print as a warning: never
      // one it fetches from, and no tracker.
      assert.ok(!/google-analytics|googletagmanager|doubleclick|facebook\.net|hotjar|sentry\.io|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com/i.test(src), f)
      assert.ok(!/\bfetch\(\s*["'`]https?:/.test(src), f)
    }
  })

  test('every game is played on its own page and counted under its own name', () => {
    const keys = GAMES.map(g => g.key)
    assert.equal(new Set(keys).size, keys.length)
    assert.equal(new Set(GAMES.map(g => g.path)).size, keys.length)
    for (const g of GAMES) {
      assert.match(g.key, /^[a-z]+$/)
      assert.match(g.path, /^\/[a-z-]+$/)
      assert.ok(g.href === g.path || g.href === `${g.path}#play`)
      assert.ok(Number.isInteger(g.board.maxScore) && g.board.maxScore > 0)
    }
  })
})
