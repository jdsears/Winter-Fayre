// The stall's TV screen and the QR code (server/render/tv.js, server/qr.js).
//
//   The QR code is drawn here, as plain SVG, from the site's own address,
//   so it is right whatever address the site is on.
//   The TV page is whole without JavaScript: the code and every game's
//   leaderboard are in its HTML, and it asks for itself again.
//   It carries the appeal the stall is in aid of, with a code to scan to
//   donate that leads to this site's own path for it.
//   It carries the same strict browser rules as every other page.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { qrMatrix, qrSvg } from '../server/qr.js'
import { shortAddress, tvBoardHtml, tvAppealHtml, TV_REFRESH_SECONDS } from '../server/render/tv.js'
import { APPEAL, charityLine } from '../shared/appeal.js'
import { cspFor } from '../server/security.js'
import { GAMES } from '../shared/games.js'
import { SITE } from '../server/site.js'
import { TV_WIDE } from '../client/story/screen.js'
import { prizeLine } from '../shared/prizes.js'
import { startApp, PERSON } from './support/helpers.js'

// The three big squares in the corners of every QR code: a dark ring
// seven squares across, a light ring inside it and a dark middle.
function finderAt(m, row, column) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6
      const middle = r >= 2 && r <= 4 && c >= 2 && c <= 4
      if (m.dark(row + r, column + c) !== (edge || middle)) return false
    }
  }
  return true
}

describe('the QR code', () => {
  test('is a proper code: square, with the three corner squares where a scanner looks for them', () => {
    const m = qrMatrix('https://arcade.example/')
    assert.ok(m.size >= 21 && (m.size - 21) % 4 === 0, `size ${m.size}`)
    assert.ok(finderAt(m, 0, 0), 'top left')
    assert.ok(finderAt(m, 0, m.size - 7), 'top right')
    assert.ok(finderAt(m, m.size - 7, 0), 'bottom left')
  })

  test('is made from the address it is given: the same each time, and different for a different address', () => {
    const squares = (text) => { const m = qrMatrix(text); let s = ''; for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) s += m.dark(r, c) ? '1' : '0'; return s }
    assert.equal(squares('https://arcade.example/'), squares('https://arcade.example/'))
    assert.notEqual(squares('https://arcade.example/'), squares('https://another.example/'))
    // A longer address needs more squares.
    assert.ok(qrMatrix(`https://${'a'.repeat(120)}.example/`).size > qrMatrix('https://arcade.example/').size)
  })

  test('is drawn as plain SVG: dark on white with a quiet border, no script, no style, nothing fetched', () => {
    const m = qrMatrix('https://arcade.example/')
    const svg = qrSvg('https://arcade.example/', { label: 'A QR code that opens arcade.example' })
    const span = m.size + 8
    assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" class="qr" viewBox="0 0 ${span} ${span}"`))
    assert.match(svg, /role="img" aria-label="A QR code that opens arcade\.example"/)
    assert.match(svg, new RegExp(`<rect width="${span}" height="${span}" fill="#fff"/>`))
    assert.match(svg, /<path d="(M\d+ \d+h\d+v1h-\d+z)+" fill="#0c1626"\/>/)
    assert.ok(!/<script|style=|href=|<image|<foreignObject/i.test(svg))
    // Every dark square is in the path, and nothing is drawn in the quiet border.
    let dark = 0
    for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.dark(r, c)) dark++
    let drawn = 0
    for (const [, x, y, run] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1/g)) {
      drawn += Number(run)
      assert.ok(Number(x) >= 4 && Number(y) >= 4 && Number(x) + Number(run) <= m.size + 4 && Number(y) < m.size + 4)
    }
    assert.equal(drawn, dark)
  })

  test('a label with markup in it is escaped', () => {
    assert.ok(!qrSvg('x', { label: '"><script>alert(1)</script>' }).includes('<script>'))
  })
})

describe('the TV page', () => {
  test('carries the code for the site\'s own address, the words Scan to play and the address to type', async () => {
    const app = await startApp({ origin: 'https://arcade.example' })
    try {
      const res = await app.get('/tv', { headers: PERSON })
      assert.equal(res.status, 200)
      const html = await res.text()
      assert.match(html, /<p class="tvh">Scan to <em>play<\/em><\/p>/)
      assert.ok(html.includes(qrSvg('https://arcade.example/', { label: 'A QR code that opens arcade.example on your phone' })), 'the code is the one for this address')
      assert.match(html, /<p class="tva">arcade\.example<\/p>/)
      assert.match(html, /<span>Wymondham College PSA<br>Winter Fayre<\/span>/)
      // No picture is fetched for the code: it is in the page. The one
      // picture is the PSA's crest, from this site: by the code to play,
      // and again at the head of the appeal.
      const pictures = html.match(/<img\b[^>]*>/g) || []
      assert.equal(pictures.length, 2)
      for (const picture of pictures) assert.match(picture, /^<img class="crest" src="\/media\/badge\/[0-9a-f]{16}\.webp" width="96" height="96" alt="Wymondham College Parent Staff Association" decoding="async">$/)
      assert.equal(new Set(pictures).size, 1)
    } finally {
      await app.close()
    }
  })

  test('carries the appeal the stall is in aid of, in the PSA\'s own words, with a code to scan to donate', async () => {
    const app = await startApp({ origin: 'https://arcade.example' })
    try {
      const html = await (await app.get('/tv', { headers: PERSON })).text()
      const scenes = html.match(/<section class="tvx" data-tv-appeal[\s\S]*?<\/section>/g) || []
      assert.equal(scenes.length, 1)
      const scene = scenes[0]
      assert.equal(scene, tvAppealHtml('https://arcade.example'))
      assert.ok(scene.includes(`<span>${APPEAL.name}</span>`))
      assert.ok(scene.includes(`<h2 id="tvx-h">${APPEAL.headline[0]} <em>${APPEAL.headline[1]}</em></h2>`))
      for (const part of [APPEAL.raising, APPEAL.funded]) {
        assert.ok(scene.includes(`<p class="tvx-t">${part.title}</p>`), part.title)
        for (const i of part.items) assert.ok(scene.includes(`<span>${i.what}</span></li>`), i.what)
      }
      assert.ok(scene.includes(`<p class="tvx-ch">${charityLine()}</p>`))
      assert.match(scene, /<p class="tvx-s">Scan to <em>donate<\/em><\/p>/)
      // The code leads to this site's own path for it, which counts the
      // scan and sends the visitor on: the page carries no address of
      // another site to follow.
      assert.ok(scene.includes(qrSvg('https://arcade.example/donate/tv', { label: 'A QR code that opens the Sports Fund Appeal\'s page on JustGiving, to donate', ink: '#241524' })))
      assert.ok(!/(?:href|src|action)="[^"]*justgiving/i.test(html))
      // Where it leads is there to read. On a phone, where a code cannot
      // be scanned, the site's own Donate button stands in its place.
      assert.ok(scene.includes(`<p class="tvx-a">${APPEAL.shown}</p>`))
      assert.deepEqual(scene.match(/<a\b[^>]*>/g), ['<a class="btn y tvx-b" href="/donate" target="_blank" rel="noopener noreferrer">'])
      // It comes after the leaderboards, so with no script they are read first.
      assert.ok(html.indexOf('data-tv-appeal') > html.lastIndexOf('data-tv-board='))
    } finally {
      await app.close()
    }
  })

  test('is ready for the appeal\'s story in 3D behind its words, which the page\'s script adds where a television can draw it', async () => {
    const app = await startApp({ origin: 'https://arcade.example' })
    try {
      const html = await (await app.get('/tv', { headers: PERSON })).text()
      const scene = /<section class="tvx" data-tv-appeal[\s\S]*?<\/section>/.exec(html)[0]
      // The boards along the back of the field read as the boards round the games' pitch do.
      assert.ok(scene.startsWith(`<section class="tvx" data-tv-appeal aria-labelledby="tvx-h" data-boards="${JSON.stringify(SITE.boards).replace(/"/g, '&quot;')}">`))
      // The two lists are marked, so the script can show the one the camera is at.
      assert.deepEqual([...scene.matchAll(/data-tv-list="([a-z]+)"/g)].map(m => m[1]), ['raising', 'funded'])
      for (const [name, part] of [['raising', APPEAL.raising], ['funded', APPEAL.funded]]) {
        assert.ok(scene.includes(`<div data-tv-list="${name}"><p class="tvx-t">${part.title}</p>`), name)
      }
      // The page itself carries no picture to draw on: with no script, or
      // where 3D will not run, the appeal's turn is its words and its code.
      const page = html.replace(/<style[\s\S]*?<\/style>/g, '')
      assert.ok(!page.includes('<canvas'))
      assert.ok(!/class="tvx[^"]*\bs3\b/.test(page))
      // And a picture the script adds is not shown unless the screen is
      // laid out for it, which it is only on a television's shape.
      const href = /<link rel="stylesheet" href="(\/styles\/site\.[0-9a-f]{12}\.css)">/.exec(html)[1]
      const css = await (await app.get(href)).text()
      assert.ok(css.includes('.tvx-c{display:none}'))
      // The script draws on the screens the stylesheet lays out as a television, and no others.
      const television = `@media ${TV_WIDE}{`
      assert.equal(css.split(television).length, 2, 'the television\'s layout is one block of the stylesheet')
      assert.ok(css.indexOf('.js .tvx.s3') > css.indexOf(television), 'the 3D layout is for a television only')
      assert.ok(css.slice(css.indexOf(television)).includes('.js .tvx.s3 .tvx-c{display:block;'))
    } finally {
      await app.close()
    }
  })

  test('the appeal\'s code follows the site\'s address too, and is a different code from the one to play', () => {
    const play = qrSvg('https://winter.example/', { label: 'x' })
    const scene = tvAppealHtml('https://winter.example')
    assert.ok(scene.includes(qrSvg('https://winter.example/donate/tv', { label: 'A QR code that opens the Sports Fund Appeal\'s page on JustGiving, to donate', ink: '#241524' })))
    assert.ok(!scene.includes(play.slice(play.indexOf('<path'))))
    // Its ink is a deep plum, as dark against white as the code to play.
    const m = qrMatrix('https://winter.example/donate/tv')
    assert.ok(finderAt(m, 0, 0) && finderAt(m, 0, m.size - 7) && finderAt(m, m.size - 7, 0))
    // A short address: few squares, so each is large on the screen.
    assert.ok(m.size <= 33, `${m.size} squares a side`)
  })

  test('the address in the code follows the site\'s address, whatever it is', async () => {
    const app = await startApp({ origin: 'https://winter.example' })
    try {
      const html = await (await app.get('/tv')).text()
      assert.ok(html.includes(qrSvg('https://winter.example/', { label: 'A QR code that opens winter.example on your phone' })))
      const alone = await app.get('/qr.svg')
      assert.match(alone.headers.get('content-type'), /^image\/svg\+xml/)
      assert.equal(await alone.text(), `${qrSvg('https://winter.example/', { label: 'A QR code that opens winter.example' })}\n`)
    } finally {
      await app.close()
    }
    assert.equal(shortAddress('https://arcade.example/'), 'arcade.example')
    assert.equal(shortAddress('http://localhost:3000'), 'localhost:3000')
  })

  test('every game\'s leaderboard is in the page, readable with no script, and the page asks for itself again', async () => {
    const app = await startApp()
    try {
      const tickets = Array.from({ length: 12 }, () => app.boards.keepy.ticket())
      app.clock.now += 5 * 60 * 1000
      for (let n = 0; n < 12; n++) await app.boards.keepy.add({ initials: ['ABC', 'XYZ', 'LMN'][n % 3], score: 10 + n, ticket: tickets[n] })
      const html = await (await app.get('/tv')).text()
      for (const g of GAMES) {
        assert.ok(html.includes(`data-tv-board="${g.key}"`), g.key)
        assert.ok(html.includes(`<h2 id="tvb-${g.key}">${g.title}</h2>`), g.key)
        // What its scores count, and what wins a sweet.
        assert.ok(html.includes(`<p class="tvc">Counting ${g.scores}. <b>${prizeLine(g.key)}</b></p>`), g.key)
      }
      // Keepy-uppies: its top ten, best first.
      const keepy = /data-tv-board="keepy"[\s\S]*?<\/section>/.exec(html)[0]
      assert.equal((keepy.match(/<li>/g) || []).length, 10)
      assert.match(keepy, /<li><span class="n">1<\/span><span class="i">LMN<\/span><span class="s">21<\/span><\/li>/)
      assert.match(keepy, /<p class="tve" hidden>/)
      // A game no one has played yet says so.
      const kicks = /data-tv-board="freekick"[\s\S]*?<\/section>/.exec(html)[0]
      assert.match(kicks, /<ol class="tvl" hidden><\/ol>/)
      assert.match(kicks, /<p class="tve">No scores yet\. Scan the code and be the first\.<\/p>/)
      assert.match(html, /Saturday 14 November/)
      assert.ok(html.includes(`<noscript><meta http-equiv="refresh" content="${TV_REFRESH_SECONDS}"></noscript>`))
    } finally {
      await app.close()
    }
  })

  test('it keeps the strict rules, is not indexed and is not counted as a visit', async () => {
    const app = await startApp()
    try {
      const res = await app.get('/tv', { headers: PERSON })
      const html = await res.text()
      const nonce = /<style nonce="([^"]+)">/.exec(html)[1]
      assert.equal(res.headers.get('content-security-policy'), cspFor({ nonce }))
      assert.match(html, /<meta name="robots" content="noindex, nofollow">/)
      assert.ok(!/\sstyle\s*=/.test(html.replace(/<style[\s\S]*?<\/style>/, '')))
      assert.equal(res.headers.get('set-cookie'), null)
      const [today] = await app.counts.days(1)
      assert.deepEqual(today.pages, {})
    } finally {
      await app.close()
    }
  })

  test('the page and the answer the script asks for carry the same version, so a new deploy is noticed', async () => {
    const app = await startApp()
    try {
      const html = await (await app.get('/tv')).text()
      const version = /data-version="([0-9a-f]{10})"/.exec(html)[1]
      const all = await (await app.get('/api/boards')).json()
      assert.equal(all.version, version)
    } finally {
      await app.close()
    }
  })

  test('a board\'s letters are escaped as they are written', () => {
    const html = tvBoardHtml({ key: 'keepy', title: 'Keepy-uppies', scores: 'keepy-uppies', entries: [{ initials: '<b>', score: 3 }] })
    assert.ok(html.includes('<span class="i">&lt;b&gt;</span>'))
    assert.ok(!html.includes('<span class="i"><b>'))
  })
})
