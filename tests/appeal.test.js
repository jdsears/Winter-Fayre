// The Sports Fund Appeal (shared/appeal.js, server/render/appeal.js): what
// the stall and its games are in aid of.
//
//   The arcade tells the appeal's story before the games menu.
//   Donate goes to the PSA's page on JustGiving by this site's own
//   /donate, which counts the tap and nothing else.
//   No page carries an address of another site, and no money is taken here.
//   The privacy page says what the Donate button does.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, PAGES, PERSON } from './support/helpers.js'
import { APPEAL, charityLine } from '../shared/appeal.js'
import { GAMES, MENU, othersFor } from '../shared/games.js'
import { SITE } from '../server/site.js'

const words = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('the appeal\'s own words', () => {
  test('are the PSA\'s: its name, its page, its charity number and its figures', () => {
    assert.equal(APPEAL.name, 'Sports Fund Appeal')
    assert.equal(APPEAL.url, 'https://www.justgiving.com/page/wymcol-psa-sports')
    assert.equal(APPEAL.shown, 'justgiving.com/page/wymcol-psa-sports')
    assert.equal(APPEAL.number, '273057')
    assert.equal(charityLine(), 'Wymondham College Parent Staff Association. Registered charity 273057.')
    assert.deepEqual(APPEAL.funded.items.map(i => [i.amount, i.what]), [['£8,500', 'Table tennis tables'], ['£5,000', 'Cricket irrigation'], ['£5,000', 'Rugby post protectors']])
    assert.deepEqual(APPEAL.raising.items.map(i => i.what), ['Football box goals', 'Cricket pitch covers'])
  })

  test('the page it sends to is the plain address: no tags to follow anyone by', () => {
    const url = new URL(APPEAL.url)
    assert.equal(url.protocol, 'https:')
    assert.equal(url.hostname, 'www.justgiving.com')
    assert.equal(url.search, '')
    assert.equal(url.hash, '')
  })
})

describe('the appeal on the arcade', () => {
  let app
  let html
  before(async () => {
    app = await startApp()
    html = await (await app.get('/', { headers: PERSON })).text()
  })
  after(() => app.close())

  test('comes before the games menu, so a visitor scrolls through it on the way', () => {
    const appeal = html.indexOf('<section id="appeal"')
    const games = html.indexOf('<section id="games"')
    assert.ok(appeal > 0 && games > appeal)
    assert.ok(html.indexOf('<header class="hero"') < appeal)
    // A keyboard can go straight to the games, and a button at the end leads on to them.
    assert.match(html, /<a class="skip" href="#games">Skip to the games<\/a>/)
    assert.match(html, /<a class="btn o" href="#games">On to the games<\/a>/)
  })

  test('tells the story in the PSA\'s words and figures', () => {
    const said = words(html)
    for (const part of [
      'Sports Fund Appeal',
      'Help us fund the next chapter of school sport',
      APPEAL.lede,
      APPEAL.why.text,
      'That is where the PSA steps in.',
      '£8,500 Table tennis tables',
      '£5,000 Cricket irrigation',
      '£5,000 Rugby post protectors',
      'Football box goals',
      'Cricket pitch covers',
      'Every donation, large or small, goes straight to sports equipment for the College.',
      'A single donation or a monthly contribution',
      'Gift Aid',
      'Thank you for supporting Wymondham College sport.',
      'Wymondham College Parent Staff Association. Registered charity 273057.',
    ]) assert.ok(said.includes(part), part)
  })

  test('has one way to give: a Donate button to this site\'s own /donate, opened beside the arcade and saying nothing of where it came from', () => {
    const buttons = html.match(/<a [^>]*href="\/donate"[^>]*>[^<]*<\/a>/g) || []
    assert.equal(buttons.length, 1)
    assert.equal(buttons[0], '<a class="btn y big" href="/donate" target="_blank" rel="noopener noreferrer">Donate on JustGiving</a>')
    // Where it goes is written out, as words and not as a link.
    assert.ok(words(html).includes('justgiving.com/page/wymcol-psa-sports'))
    assert.ok(!/href="[^"]*justgiving/i.test(html))
  })

  test('says what the games are in aid of at the top of the page', () => {
    assert.ok(words(html).includes('in aid of the PSA\'s Sports Fund Appeal'))
  })

  test('every page still loads from this site alone: none carries the address of another', async () => {
    for (const p of PAGES) {
      const page = await (await app.get(p, { headers: PERSON })).text()
      assert.ok(!/(?:src|href|action)="https?:/i.test(page), p)
    }
  })
})

describe('Donate', () => {
  const password = 'a long invented password'
  const auth = { authorization: `Basic ${Buffer.from(`anyone:${password}`).toString('base64')}` }

  test('sends the visitor on to the PSA\'s page, with no cookie, nothing kept in between and nothing said of where they came from', async () => {
    const app = await startApp()
    try {
      const res = await app.get('/donate', { headers: PERSON })
      assert.equal(res.status, 302)
      assert.equal(res.headers.get('location'), 'https://www.justgiving.com/page/wymcol-psa-sports')
      assert.equal(res.headers.get('cache-control'), 'no-store')
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
      assert.equal(res.headers.get('set-cookie'), null)
      assert.match(res.headers.get('x-robots-tag'), /noindex/)
      // Whatever is added to the address is not passed on.
      const odd = await app.get('/donate?next=https://evil.example/&utm_source=x', { headers: PERSON })
      assert.equal(odd.headers.get('location'), 'https://www.justgiving.com/page/wymcol-psa-sports')
    } finally {
      await app.close()
    }
  })

  test('counts a person\'s tap as one more for the day, and a machine\'s not at all', async () => {
    const app = await startApp({ appOptions: { numbersPassword: password } })
    try {
      await app.get('/', { headers: PERSON })
      await app.get('/donate', { headers: PERSON })
      await app.get('/donate', { headers: PERSON })
      await app.get('/donate', { headers: { 'user-agent': 'Googlebot/2.1' } })
      await app.get('/donate')
      const today = (await app.counts.days(1))[0]
      assert.equal(today.pages['/donate'], 2)
      assert.equal(today.pages['/'], 1)
      // The numbers page shows taps apart from page views: a tap is not a page looked at.
      const numbers = words(await (await app.get('/numbers', { headers: auth })).text())
      assert.ok(numbers.includes('1 page views'), numbers.slice(0, 600))
      assert.ok(numbers.includes('2 taps on Donate'))
      assert.ok(!numbers.includes('Taps on Donate 2 '), 'not listed among the pages')
      assert.ok(numbers.includes('this site never does'))
    } finally {
      await app.close()
    }
  })

  test('a scan of the code on the stall\'s TV goes the same way, and is counted apart from a tap on Donate', async () => {
    const app = await startApp({ appOptions: { numbersPassword: password } })
    try {
      assert.equal(APPEAL.tvPath, '/donate/tv')
      const res = await app.get('/donate/tv', { headers: PERSON })
      assert.equal(res.status, 302)
      assert.equal(res.headers.get('location'), 'https://www.justgiving.com/page/wymcol-psa-sports')
      assert.equal(res.headers.get('cache-control'), 'no-store')
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
      assert.equal(res.headers.get('set-cookie'), null)
      assert.match(res.headers.get('x-robots-tag'), /noindex/)
      await app.get('/donate/tv', { headers: PERSON })
      await app.get('/donate/tv/?from=somewhere', { headers: PERSON })
      await app.get('/donate/tv', { headers: { 'user-agent': 'Googlebot/2.1' } })
      await app.get('/donate', { headers: PERSON })
      await app.get('/', { headers: PERSON })
      const today = (await app.counts.days(1))[0]
      assert.equal(today.pages['/donate/tv'], 3)
      assert.equal(today.pages['/donate'], 1)
      // The numbers page shows the two apart, and neither as a page looked at.
      const numbers = words(await (await app.get('/numbers', { headers: auth })).text())
      assert.ok(numbers.includes('1 page views'), numbers.slice(0, 600))
      assert.ok(numbers.includes('1 taps on Donate'))
      assert.ok(numbers.includes('3 scans of the TV\'s code'))
      assert.ok(!/Scans of the TV's code to donate \d/.test(numbers), 'not listed among the pages')
      // Nothing else under /donate is a way through.
      assert.equal((await app.get('/donate/elsewhere', { headers: PERSON })).status, 404)
    } finally {
      await app.close()
    }
  })

  test('is said on the privacy page: where it goes, that nothing is sent with you and that no money is taken here', async () => {
    const app = await startApp()
    try {
      const said = words(await (await app.get('/privacy', { headers: PERSON })).text())
      for (const part of [
        'in aid of the Parent Staff Association\'s Sports Fund Appeal',
        'how many times the Donate button is tapped',
        'The appeal is for parents and carers.',
        'a different website with its own privacy notice',
        'JustGiving is not told that you came from here',
        'this site never learns whether you gave, how much, or who you are',
        'No money is taken on this site.',
      ]) assert.ok(said.includes(part), part)
    } finally {
      await app.close()
    }
  })
})

describe('the appeal round the games', () => {
  let app
  before(async () => { app = await startApp() })
  after(() => app.close())

  test('the boards round the pitch read the PSA, the fayre and the appeal', () => {
    assert.deepEqual(SITE.boards, ['Wymondham College PSA', 'Winter Fayre', 'Sports Fund Appeal'])
  })

  test('every game\'s page has one line for grown-ups, with a link to the appeal on this site and never straight to where money is given', async () => {
    for (const g of GAMES) {
      const html = await (await app.get(g.path, { headers: PERSON })).text()
      assert.ok(words(html).includes(APPEAL.line), g.key)
      assert.match(html, /<p class="appeal-line">[^<]*<a href="\/#appeal">See the appeal<\/a><\/p>/, g.key)
      assert.ok(!html.includes('href="/donate"'), g.key)
    }
  })

  test('a link back from a game goes to the games menu, so the story is scrolled through once', async () => {
    assert.equal(MENU, '/#games')
    for (const g of GAMES) {
      assert.deepEqual(othersFor(g.key)[1], { href: '/#games', label: 'All games' })
      const html = await (await app.get(g.path, { headers: PERSON })).text()
      assert.match(html, /<a class="btn o" href="\/#games">More games<\/a>/, g.key)
    }
    assert.match(await (await app.get('/privacy', { headers: PERSON })).text(), /<a class="mail" href="\/#games">All games<\/a>/)
  })
})
