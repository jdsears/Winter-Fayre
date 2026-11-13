// The Winter Fayre Sports Arcade: an Express app that draws every page
// on the server.
//
//   GET  /                 the arcade: a tile for each game
//   GET  /penalties, /keepy-uppies, /free-kicks, /head-to-head
//                          a page for each game (shared/games.js)
//   GET  /privacy          what the site keeps, in plain English
//   GET  /assets/...       the page's script, built by Vite
//   GET  /fonts/...        Barlow and Barlow Condensed, served from here
//   GET  /styles/...       the stylesheet
//   GET  /icon.svg         the site's icon, a snowflake
//   GET  /robots.txt       search engines are kept out
//   GET  /health           for Railway: the service is up
//   GET  /api/board/<game> a game's leaderboard for the day, and a ticket for a go
//   POST /api/board/<game> a go for the leaderboard: three letters and a score (board.js)
//   GET  /api/boards       every game's top ten, for the TV
//   POST /api/count        a game was started or finished (counts.js): no cookie, nothing about anyone
//   GET  /numbers          the site's own numbers, behind a password (NUMBERS_PASSWORD)

import express from 'express'
import crypto from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore, StoreUnavailable } from './store.js'
import { createBoards } from './board.js'
import { createCounts, isMachine, MOMENTS } from './counts.js'
import { renderNumbers } from './render/numbers.js'
import { securityHeaders, cspFor, newNonce } from './security.js'
import { SITE_CSS } from './render/css.js'
import { FACES } from './render/layout.js'
import { renderArcade, renderGame, renderPrivacy, renderNotFound, renderBareError } from './render/pages.js'
import { GAMES, GAME_KEYS, gameByKey } from '../shared/games.js'
import { COLOURS } from './site.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The pages that are counted, and what the numbers page calls each. A
// page is counted under one of these names and no other (counts.js).
export const COUNTED = {
  '/': 'The arcade',
  ...Object.fromEntries(GAMES.map(g => [g.path, g.title])),
  '/privacy': 'Privacy',
}

// How many of a board's entries the TV shows.
export const TV_TOP = 10

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest()

// The site's icon: a snowflake on the site's navy. Drawn here.
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${COLOURS.primary_deep}"/><g fill="none" stroke="${COLOURS.ice}" stroke-width="3.2" stroke-linecap="round" transform="translate(32 32)">${[0, 60, 120, 180, 240, 300].map(a => `<path transform="rotate(${a})" d="M0 0V-22M0-10l-6-6M0-10l6-6M0-17l-4-4M0-17l4-4"/>`).join('')}</g><circle cx="32" cy="32" r="4" fill="${COLOURS.accent}"/></svg>\n`

// The built script's address, from Vite's manifest; null before a build,
// and the pages read the same without it.
export function readAssets(dist = path.join(root, 'dist')) {
  const file = path.join(dist, '.vite', 'manifest.json')
  if (!existsSync(file)) return { script: null }
  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    const entry = Object.values(manifest).find(e => e.isEntry)
    return { script: entry ? `/${entry.file}` : null }
  } catch {
    return { script: null }
  }
}

// origin           the site's own address, for the QR code
// production       HTTPS only, and the stricter headers that go with it
// store            where the leaderboards and the numbers are kept (store.js)
// boards           a leaderboard for each game, by its key (board.js)
// counts           the site's own page views and game plays, a day at a time (counts.js)
// numbersPassword  the password for /numbers; without it the page is not there
export function createApp({ origin = 'http://localhost:3000', production = false, store = createStore(), boards = createBoards({ store }), counts = createCounts({ store, pages: Object.keys(COUNTED) }), numbersPassword = null, dist = path.join(root, 'dist'), log = console } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('etag', false)
  app.use(securityHeaders({ production }))

  const cssHash = crypto.createHash('sha256').update(SITE_CSS).digest('hex').slice(0, 12)
  const stylesheet = `/styles/site.${cssHash}.css`
  const built = readAssets(dist)
  if (!built.script) log.warn?.('No built script in dist: the pages read the same, but no game can be played. Run npm run build.')
  const assets = { stylesheet, script: built.script }

  // counted is the name a page is counted under (counts.js), for a page
  // a person asked for: not a machine, and not a page that was not found.
  function page(req, res, html, { status = 200, counted = null, forms = false } = {}) {
    if (counted && status === 200 && !isMachine(req.headers['user-agent'])) counts.page(counted)
    res.status(status)
    res.set('Content-Security-Policy', cspFor({ nonce: res.locals.nonce, forms, production }))
    res.set('Cache-Control', 'no-cache')
    res.type('html').send(html)
  }

  app.use((req, res, next) => {
    res.locals.nonce = newNonce()
    next()
  })
  const opts = (req) => ({ origin, nonce: req.res.locals.nonce, assets })

  // ---------------------------------------------------------------------
  // What is not a page
  // ---------------------------------------------------------------------

  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ ok: true, kept: store.kind })
  })

  app.get(stylesheet, (req, res) => {
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.type('text/css').send(SITE_CSS)
  })

  app.get('/icon.svg', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400')
    res.type('image/svg+xml').send(ICON)
  })

  const fontsDir = path.join(root, 'client', 'fonts')
  const fontFiles = new Set(FACES.map(f => f.file))
  app.get('/fonts/:file', (req, res, next) => {
    if (!fontFiles.has(req.params.file)) return next()
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.type('font/woff2').sendFile(req.params.file, { root: fontsDir })
  })

  app.use('/assets', express.static(path.join(dist, 'assets'), {
    index: false,
    dotfiles: 'ignore',
    immutable: true,
    maxAge: '365d',
  }))

  app.get('/robots.txt', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.type('text/plain').send('User-agent: *\nDisallow: /\n')
  })

  // ---------------------------------------------------------------------
  // The leaderboards
  // ---------------------------------------------------------------------

  const answer = (res, status, body) => res.status(status).set('Cache-Control', 'no-store').json(body)
  const failed = (res, err) => {
    if (!(err instanceof StoreUnavailable)) log.error?.(err)
    else log.warn?.(`Leaderboard: ${err.message}`)
    answer(res, 503, { error: 'unavailable' })
  }

  app.get('/api/board/:game', async (req, res) => {
    const b = GAME_KEYS.includes(req.params.game) ? boards[req.params.game] : null
    if (!b) return answer(res, 404, { error: 'no such game' })
    try {
      answer(res, 200, { ...(await b.top()), ticket: b.ticket() })
    } catch (err) {
      failed(res, err)
    }
  })

  app.post('/api/board/:game', express.json({ limit: 400, strict: true }), async (req, res) => {
    const b = GAME_KEYS.includes(req.params.game) ? boards[req.params.game] : null
    if (!b) return answer(res, 404, { error: 'no such game' })
    const { initials, score, ticket } = req.body || {}
    try {
      const out = await b.add({ initials, score, ticket })
      // A fresh ticket either way, for the next go; a run's own ticket where it has one.
      answer(res, out.ok ? 200 : out.reason === 'busy' ? 429 : 422, { ...out, ticket: out.ticket || b.ticket() })
    } catch (err) {
      failed(res, err)
    }
  })

  // Every game's best of the day in one answer, for the TV.
  app.get('/api/boards', async (req, res) => {
    try {
      const all = []
      let day = null
      let name = null
      for (const g of GAMES) {
        const top = await boards[g.key].top()
        day = top.day
        name = top.name
        all.push({ key: g.key, title: g.title, scores: g.scores, entries: top.entries.slice(0, TV_TOP) })
      }
      answer(res, 200, { day, name, boards: all })
    } catch (err) {
      failed(res, err)
    }
  })

  // ---------------------------------------------------------------------
  // The site's own numbers
  // ---------------------------------------------------------------------

  // A game was started or finished. Only the game and which of the two
  // is read; nothing about who sent it is kept.
  app.post('/api/count', express.json({ limit: 200, strict: true }), (req, res) => {
    res.set('Cache-Control', 'no-store')
    const { game, moment } = req.body || {}
    if (!GAME_KEYS.includes(game) || !MOMENTS.includes(moment)) return res.status(422).end()
    if (!isMachine(req.headers['user-agent'])) counts.game(game, moment)
    res.status(204).end()
  })

  // John's page, behind his password (asked for by the browser, with no
  // cookie). A few wrong tries a minute at most, from everyone.
  let wrong = []
  app.get('/numbers', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!numbersPassword) return res.status(404).type('text').send('Not found\n')
    wrong = wrong.filter(at => Date.now() - at < 60 * 1000)
    if (wrong.length >= 10) return res.status(429).set('Retry-After', '60').type('text').send('Too many tries. Wait a minute.\n')
    const m = /^Basic\s+(.+)$/i.exec(String(req.headers.authorization || ''))
    const given = m ? Buffer.from(m[1], 'base64').toString('utf8') : ''
    const password = given.slice(given.indexOf(':') + 1)
    if (!m || !crypto.timingSafeEqual(sha256(password), sha256(numbersPassword))) {
      if (m) wrong.push(Date.now())
      return res.status(401).set('WWW-Authenticate', 'Basic realm="The numbers", charset="UTF-8"').type('text').send('A password is needed.\n')
    }
    try {
      const nonce = res.locals.nonce
      res.set('Content-Security-Policy', cspFor({ nonce, production }))
      res.type('html').send(renderNumbers({ days: await counts.days(30), names: COUNTED, nonce, stylesheet, kept: store.kind }))
    } catch (err) {
      if (!(err instanceof StoreUnavailable)) log.error?.(err)
      res.status(503).set('Retry-After', '30').type('text').send('The numbers cannot be reached. Try again in a minute.\n')
    }
  })

  // ---------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------

  app.get('/', (req, res) => {
    page(req, res, renderArcade(opts(req)), { counted: '/' })
  })

  // A game's page carries a ticket for its first go at the leaderboard.
  for (const g of GAMES) {
    app.get(g.path, (req, res) => {
      page(req, res, renderGame(gameByKey(g.key), { ...opts(req), ticket: boards[g.key].ticket() }), { counted: g.path })
    })
  }

  app.get('/privacy', (req, res) => {
    page(req, res, renderPrivacy(opts(req)), { counted: '/privacy' })
  })

  // Anything else: not here.
  app.use((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).type('text').send('Not found\n')
    page(req, res, renderNotFound(opts(req)), { status: 404 })
  })

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // A request that was not what it should be (a body that is not JSON,
    // or too long) is the sender's mistake, not the site's.
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err.status === 400 || err.status === 413)) {
      return res.status(err.status || 400).set('Cache-Control', 'no-store').type('text').send('That could not be read.\n')
    }
    log.error?.(err)
    if (res.headersSent) return
    res.status(500).set('Cache-Control', 'no-store').type('html').send(renderBareError())
  })

  return app
}
