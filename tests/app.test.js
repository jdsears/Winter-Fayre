// The site's pages and what each answer carries (server/app.js).
//
//   Every page is whole on the server: its words are in its HTML.
//   The arcade has a tile for each game, and each game has a page.
//   Every answer carries the strict browser rules, and every page is
//   kept out of search engines.
//   Only what the site means to serve is served.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, PAGES, PERSON } from './support/helpers.js'
import { GAMES } from '../shared/games.js'
import { cspFor } from '../server/security.js'

describe('the pages', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('every page answers, as HTML in British English, with the site\'s name', async () => {
    for (const p of PAGES) {
      const res = await app.get(p, { headers: PERSON })
      assert.equal(res.status, 200, p)
      assert.match(res.headers.get('content-type'), /^text\/html; charset=utf-8/)
      const html = await res.text()
      assert.match(html, /^<!DOCTYPE html>\n<html lang="en-GB">/)
      assert.match(html, /<title>[^<]*Winter Fayre Sports Arcade<\/title>/, p)
      assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${p} has one h1`)
      assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/icon.svg">'), p)
    }
  })

  test('the arcade has a tile for each game, with a Play button, and says whose fayre it is', async () => {
    const html = await (await app.get('/')).text()
    assert.match(html, /<h1>Winter Fayre <em>Sports Arcade<\/em><\/h1>/)
    assert.match(html, /Wymondham College PSA/)
    for (const g of GAMES) {
      assert.ok(html.includes(`<a href="${g.href}">`), g.key)
      assert.ok(html.includes(`<span class="gt-t">${g.title}</span>`), g.key)
      assert.ok(html.includes(`<span class="btn y">${g.play}</span>`), g.key)
    }
    assert.equal((html.match(/<li class="gt">/g) || []).length, GAMES.length)
    // The tiles are drawn. The one picture is the PSA's crest, from this
    // site, with its size given so the page does not jump as it loads.
    const pictures = html.match(/<img\b[^>]*>/g) || []
    assert.equal(pictures.length, 1)
    assert.match(pictures[0], /^<img class="crest" src="\/media\/badge\/[0-9a-f]{16}\.webp" width="96" height="96" alt="Wymondham College Parent Staff Association" decoding="async">$/)
    assert.match(html, /<a class="mail" href="\/privacy">Privacy<\/a>/)
  })

  test('each game\'s page carries the boards\' words, the sign and a ticket, and a way back', async () => {
    for (const g of GAMES) {
      const html = await (await app.get(g.path)).text()
      assert.match(html, /data-boards="\[&quot;Wymondham College PSA&quot;,&quot;Winter Fayre&quot;\]"/, g.key)
      assert.match(html, /data-top-sign="\{&quot;name&quot;:&quot;Winter Fayre&quot;,&quot;over&quot;:&quot;Wymondham College PSA&quot;,&quot;badge&quot;:&quot;\/media\/badge\/[0-9a-f]{16}\.webp&quot;\}"/, g.key)
      assert.match(html, /data-ticket="[0-9a-z]+\.[\w-]{12}\.[\w-]{22}"/, g.key)
      assert.match(html, /<a class="btn o" href="\/">More games<\/a>/, g.key)
      assert.match(html, /<noscript>/, g.key)
      assert.match(html, /<a class="bar-play" href="\/">All games<\/a>/, g.key)
    }
  })

  test('a page that is not there says so, and is not counted as one that is', async () => {
    for (const p of ['/not-a-page', '/games', '/penalties/extra', '/.env', '/server/index.js', '/package.json']) {
      const res = await app.get(p, { headers: PERSON })
      assert.equal(res.status, 404, p)
      assert.match(await res.text(), /This page is <em>not here<\/em>/)
    }
    assert.equal((await app.get('/', { method: 'POST' })).status, 404)
    assert.equal((await app.get('/', { method: 'DELETE' })).status, 404)
  })
})

describe('what every answer carries', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('a page allows only this site\'s own script, styles, fonts and pictures', async () => {
    for (const p of [...PAGES, '/not-a-page']) {
      const res = await app.get(p)
      const csp = res.headers.get('content-security-policy')
      const html = await res.text()
      const nonce = /<style nonce="([^"]+)">/.exec(html)?.[1]
      assert.ok(nonce, `${p} has its one style block`)
      assert.equal(csp, cspFor({ nonce }), p)
      assert.match(csp, /default-src 'self'/)
      assert.match(csp, /script-src 'self'(;|$)/)
      assert.match(csp, /script-src-attr 'none'/)
      assert.match(csp, /style-src-attr 'none'/)
      assert.match(csp, /form-action 'none'/)
      assert.match(csp, /frame-ancestors 'none'/)
      assert.ok(!/unsafe-inline|unsafe-eval|\*|https?:|data:/.test(csp), p)
      // One style block, no inline script, no style attribute, no handler.
      assert.equal((html.match(/<style\b/g) || []).length, 1, p)
      assert.ok(!/\sstyle\s*=/.test(html.replace(/<style[\s\S]*?<\/style>/, '')), `${p} has a style attribute`)
      for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) assert.match(tag, /^<script type="module" src="\/assets\/[\w-]+\.js">$/, p)
      for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) assert.ok(!/\son[a-z]+\s*=/i.test(tag), `${p}: ${tag.slice(0, 60)}`)
    }
  })

  test('a fresh nonce on every response', async () => {
    const a = /<style nonce="([^"]+)">/.exec(await (await app.get('/')).text())[1]
    const b = /<style nonce="([^"]+)">/.exec(await (await app.get('/')).text())[1]
    assert.notEqual(a, b)
  })

  test('the other headers, on pages and on everything else', async () => {
    for (const p of ['/', '/privacy', '/health', '/robots.txt', '/icon.svg', '/api/board/keepy', '/not-a-page']) {
      const h = (await app.get(p)).headers
      assert.equal(h.get('x-content-type-options'), 'nosniff', p)
      assert.equal(h.get('x-frame-options'), 'DENY', p)
      assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin', p)
      assert.equal(h.get('cross-origin-opener-policy'), 'same-origin', p)
      assert.match(h.get('permissions-policy'), /camera=\(\), microphone=\(\), geolocation=\(\)/, p)
      assert.match(h.get('x-robots-tag'), /noindex, nofollow/, p)
      assert.equal(h.get('x-powered-by'), null, p)
      assert.equal(h.get('set-cookie'), null, `${p} sets no cookie`)
    }
    // Anything that is not a page may run nothing at all.
    assert.equal((await app.get('/health')).headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'; sandbox")
  })

  test('HTTPS only in production', async () => {
    const live = await startApp({ appOptions: { production: true } })
    try {
      const res = await live.get('/')
      assert.equal(res.headers.get('strict-transport-security'), 'max-age=15552000')
      assert.match(res.headers.get('content-security-policy'), /upgrade-insecure-requests/)
    } finally {
      await live.close()
    }
    assert.equal((await app.get('/')).headers.get('strict-transport-security'), null)
  })

  test('search engines are kept out, in the page, the header and robots.txt', async () => {
    for (const p of PAGES) assert.match(await (await app.get(p)).text(), /<meta name="robots" content="noindex, nofollow">/, p)
    const robots = await app.get('/robots.txt')
    assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n')
    assert.equal((await app.get('/sitemap.xml')).status, 404)
  })
})

describe('what is served besides pages', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('the stylesheet, by its hashed name, kept for a year', async () => {
    const html = await (await app.get('/')).text()
    const href = /<link rel="stylesheet" href="(\/styles\/site\.[0-9a-f]{12}\.css)">/.exec(html)[1]
    const res = await app.get(href)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /^text\/css/)
    assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    const css = await res.text()
    assert.ok(!/@import|url\(\s*["']?https?:/i.test(css), 'the stylesheet asks nothing of another site')
    assert.equal((await app.get('/styles/site.000000000000.css')).status, 404)
  })

  test('the fonts the pages name, and no other file', async () => {
    const html = await (await app.get('/')).text()
    const fonts = [...html.matchAll(/url\((\/fonts\/[\w-]+\.woff2)\)/g)].map(m => m[1])
    assert.equal(fonts.length, 4)
    for (const f of fonts) {
      const res = await app.get(f)
      assert.equal(res.status, 200, f)
      assert.equal(res.headers.get('content-type'), 'font/woff2')
    }
    for (const p of ['/fonts/OFL.txt', '/fonts/../main.js', '/fonts/%2e%2e%2fmain.js', '/fonts/nope.woff2']) assert.equal((await app.get(p)).status, 404, p)
  })

  test('the health check says the service is up and how the day is kept', async () => {
    const res = await app.get('/health')
    assert.deepEqual(await res.json(), { ok: true, kept: 'memory' })
    assert.equal(res.headers.get('cache-control'), 'no-store')
  })

  test('the icon is a drawing served from here', async () => {
    const res = await app.get('/icon.svg')
    assert.match(res.headers.get('content-type'), /^image\/svg\+xml/)
    const svg = await res.text()
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.ok(!/<script|href=|<image/i.test(svg))
  })
})
