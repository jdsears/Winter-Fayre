// npm run check: the site in a real browser, on phones 360, 375 and 390
// wide, and with a phone on its side at 740 by 360 and 568 by 320.
//
// On every page, at every width:
//   no sideways scroll, and nothing wider than the screen;
//   every tap target at least 44px each way (a link inside a sentence
//   aside);
//   no words under 16px;
//   readable with the 3D off (no WebGL), with reduced motion on, and
//   with JavaScript off: every word shown, none faded out or hidden;
//   nothing asked of any other site, and no Content-Security-Policy
//   refusal.
//
// The games are opened too: each opens full screen, its buttons fit and
// do not overlap, and its finish panel fits the screen or scrolls inside
// itself. Head to head is played with the phone on its side. With the 3D
// off, the flat version of a game is played in its place.
//
// The stall's TV screen is checked at 1920 by 1080 with a full
// leaderboard: the QR code at least 400 pixels square, a leaderboard
// row's letters at least 40 pixels, everything on the one screen, and
// the leaderboards taking turns by themselves.
//
// The numbers page, behind its password, is checked on a phone too: it
// is where an entry is taken off a leaderboard at the stall.
//
// Screenshots go to CHECK_SCREENSHOTS (default ./screenshots, which git
// ignores). Uses the Playwright installed on the machine
// (require('playwright')); it is not one of the site's dependencies.

import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAMES } from '../shared/games.js'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shots = path.resolve(process.env.CHECK_SCREENSHOTS || path.join(root, 'screenshots'))
const WIDTHS = Object.fromEntries(Object.entries({ 360: 780, 375: 812, 390: 844 }).filter(([w]) => !process.env.CHECK_WIDTHS || process.env.CHECK_WIDTHS.split(',').includes(w)))
// A phone on its side.
const SIDEWAYS = [[740, 360], [568, 320]]
const PAGES = ['/', ...GAMES.map(g => g.path), '/tv', '/privacy', '/not-a-page']

// The games played on the stage: the page, a name for its picture, and
// whether it has a line under the top bar (the wind).
const STAGE_GAMES = [['/keepy-uppies', 'keepy', false], ['/free-kicks', 'freekick', false], ['/rugby', 'rugby', true], ['/netball', 'netball', false], ['/cricket', 'cricket', false]]
// The games made for the stage alone: with the 3D off, the stage draws
// the stadium flat for them.
const FLAT_STAGE_GAMES = ['/rugby', '/netball', '/cricket']

// A password for the numbers page, for this check's own copy of the site.
const NUMBERS = 'for-the-check-only'

const problems = []
const problem = (where, what) => problems.push(`${where}: ${what}`)

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

async function startServer() {
  const port = await freePort()
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), SITE_ORIGIN: '', DATA_DIR: '', RAILWAY_VOLUME_MOUNT_PATH: '', RAILWAY_PUBLIC_DOMAIN: '', NUMBERS_PASSWORD: NUMBERS, NODE_ENV: 'development' },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return { base, child }
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100))
  }
  child.kill()
  throw new Error('The server did not start')
}

// What the page looks like to someone on a phone, worked out inside it.
function measure() {
  const vw = document.documentElement.clientWidth
  const out = { overflow: [], taps: [], small: [], faded: [], scrollWidth: document.documentElement.scrollWidth, vw }
  const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`
  const hiddenAway = (el) => el.closest('.vh, [hidden], [aria-hidden="true"], noscript, dialog:not([open]), svg')
  const shown = (el) => {
    if (hiddenAway(el)) return false
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }

  // Nothing wider than the screen, unless inside something that scrolls
  // sideways on purpose or clips it.
  const scrolls = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.overflowX !== 'visible') return true
    }
    return false
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!shown(el) || scrolls(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) out.overflow.push(`${describe(el)} spans ${Math.round(r.left)} to ${Math.round(r.right)}`)
  }

  // Taps.
  const TAPPABLE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]'
  const words = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  for (const el of document.body.querySelectorAll(TAPPABLE)) {
    if (el.disabled || !shown(el)) continue
    const s = getComputedStyle(el)
    if (el.tagName === 'A' && s.display === 'inline' && el.parentElement && words(el.parentElement).length > words(el).length + 2) continue
    const r = el.getBoundingClientRect()
    if (r.width < 43.5 || r.height < 43.5) out.taps.push(`${describe(el)} is ${Math.round(r.width)} x ${Math.round(r.height)}px`)
  }

  // Words: none under 16px, and none faded out or hidden.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim()
    const el = n.parentElement
    if (!text || !el || hiddenAway(el) || el.closest('script, style')) continue
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    const s = getComputedStyle(el)
    if (parseFloat(s.fontSize) < 15.5) out.small.push(`${describe(el)} is ${s.fontSize}`)
    let opacity = 1
    for (let a = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity)
    // A prompt that beats (the stage's "Tap the ball") dims and comes back.
    if ((opacity < 0.5 || s.visibility === 'hidden') && !el.closest('.gs-prompt')) out.faded.push(`${describe(el)} at opacity ${opacity.toFixed(2)}`)
  }
  return out
}

// What is on a game's full-screen stage: every button inside the screen,
// and no two of the groups given lying over each other.
function measureStage(groups) {
  const vw = innerWidth
  const vh = innerHeight
  const out = { outside: [], overlaps: [], missing: [] }
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !el.closest('[hidden]') }
  const found = []
  for (const sel of groups) {
    const el = [...document.querySelectorAll(sel)].find(visible)
    if (!el) { out.missing.push(sel); continue }
    const b = box(el)
    if (b.l < -1 || b.t < -1 || b.r > vw + 1 || b.b > vh + 1) out.outside.push(`${sel} spans ${Math.round(b.l)},${Math.round(b.t)} to ${Math.round(b.r)},${Math.round(b.b)} on a ${vw} by ${vh} screen`)
    found.push({ sel, b })
  }
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i].b
      const c = found[j].b
      if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) out.overlaps.push(`${found[i].sel} lies over ${found[j].sel}`)
    }
  }
  return out
}

// Scroll down the page and back, so every section has been on screen.
async function scrollThrough(page) {
  const { height, step } = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, step: Math.round(innerHeight * 0.6) }))
  for (let y = 0; y < height; y += step) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y)
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(250)
}

async function openPage(context, base, p, where) {
  const page = await context.newPage()
  const origin = new URL(base).origin
  page.on('pageerror', e => problem(where, `script error: ${e.message}`))
  page.on('console', (m) => {
    const t = m.text()
    if (/Content Security Policy|Refused to/i.test(t)) problem(where, `refused by the page's rules: ${t.slice(0, 160)}`)
  })
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.origin !== origin && u.protocol !== 'data:' && u.protocol !== 'blob:') problem(where, `asked another site: ${u.origin}`)
  })
  await page.goto(base + p, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  return page
}

function report(where, m, { readable = false } = {}) {
  if (m.scrollWidth > m.vw + 1) problem(where, `the page is ${m.scrollWidth}px wide and scrolls sideways`)
  for (const o of m.overflow.slice(0, 5)) problem(where, `wider than the screen: ${o}`)
  for (const t of m.taps) problem(where, `tap target under 44px: ${t}`)
  for (const s of m.small) problem(where, `words under 16px: ${s}`)
  if (readable) for (const f of m.faded) problem(where, `not readable: ${f}`)
}

function reportStage(where, s) {
  for (const m of s.missing) problem(where, `not on the stage: ${m}`)
  for (const o of s.outside) problem(where, `off the screen: ${o}`)
  for (const o of s.overlaps) problem(where, `overlapping: ${o}`)
}

// The arcade's tiles: one column on a phone.
async function tilesInOneColumn(page, where) {
  const lefts = await page.evaluate(() => [...document.querySelectorAll('.gts > .gt')].map(li => Math.round(li.getBoundingClientRect().left)))
  if (!lefts.length) problem(where, 'the arcade has no tiles')
  if (new Set(lefts).size > 1) problem(where, 'the tiles are not in one column on a phone')
}

async function main() {
  mkdirSync(shots, { recursive: true })
  const { base, child } = await startServer()
  // The server is stopped however the check ends.
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); process.exit(130) })
  const browsers = {
    normal: await chromium.launch(),
    no3d: await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] }),
  }
  let pagesChecked = 0
  try {
    for (const [w, h] of Object.entries(WIDTHS)) {
      const width = Number(w)
      const modes = [
        ['3D on', browsers.normal, {}],
        ['3D off', browsers.no3d, {}],
        ['reduced motion', browsers.normal, { reducedMotion: 'reduce' }],
        ['no JavaScript', browsers.normal, { javaScriptEnabled: false }],
      ]
      for (const [mode, browser, extra] of modes) {
        const context = await browser.newContext({ viewport: { width, height: h }, deviceScaleFactor: width === 375 ? 2 : 1, isMobile: true, hasTouch: true, ...extra })
        for (const p of PAGES) {
          const where = `${p} at ${width} (${mode})`
          const started = performance.now()
          const page = await openPage(context, base, p, where)
          // A game's page opens its game over itself; the page under it
          // is measured with the script off, and the game below.
          if (!GAMES.some(g => g.path === p) || mode === 'no JavaScript' || mode === '3D off') await scrollThrough(page)
          report(where, await page.evaluate(measure), { readable: mode !== '3D on' })
          if (p === '/') await tilesInOneColumn(page, where)
          if (width === 375 && p === '/' && mode === '3D on') await page.screenshot({ path: path.join(shots, 'arcade-375.png'), fullPage: true })
          if (width === 375 && p === '/' && mode === 'no JavaScript') await page.screenshot({ path: path.join(shots, 'arcade-375-no-js.png'), fullPage: true })
          if (width === 375 && p === '/privacy' && mode === '3D on') await page.screenshot({ path: path.join(shots, 'privacy-375.png'), fullPage: true })
          pagesChecked++
          if (process.env.CHECK_VERBOSE) console.log(`  ${where}: ${Math.round(performance.now() - started)}ms`)
          await page.close()
        }
        await context.close()
      }
      await openTheGames(browsers.normal, base, width, h)
    }
    await flatGames(browsers.no3d, base)
    for (const [w, h] of SIDEWAYS) await sideways(browsers.normal, base, w, h)
    await widerScreens(browsers.normal, base)
    await television(browsers.normal, base)
    await numbersPage(browsers.normal, base)
  } finally {
    await browsers.normal.close()
    await browsers.no3d.close()
    child.kill()
  }
  if (problems.length) {
    console.error(`npm run check: ${problems.length} problems on ${pagesChecked} page views`)
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }
  console.log(`npm run check: ${pagesChecked} page views at ${Object.keys(WIDTHS).join(', ')} wide, with the 3D on and off, reduced motion and no JavaScript, every game opened, head to head on its side at ${SIDEWAYS.map(s => s.join(' by ')).join(' and ')}, and the TV screen at 1920 by 1080: no problems. Screenshots in ${shots}`)
}

// Each game opened at a phone's width: its stage fills the screen, its
// numbers and its Sound, Music and Leave buttons fit without lying over
// each other, and the finish panel fits or scrolls inside itself.
async function openTheGames(browser, base, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width === 375 ? 2 : 1, isMobile: true, hasTouch: true })
  const shot = (name) => (width === 375 ? { path: path.join(shots, `${name}-375.png`) } : null)

  // Penalties: the section's Play button opens the game.
  {
    const where = `/penalties at ${width} (the game)`
    const page = await openPage(context, base, '/penalties', where)
    await page.locator('.shootout-play').click()
    try {
      await page.waitForSelector('.tso:not([data-phase="loading"])', { state: 'visible', timeout: 45000 })
      await page.waitForTimeout(900)
      const styled = await page.evaluate(() => getComputedStyle(document.querySelector('.tso')).position === 'fixed')
      if (!styled) problem(where, 'the game opened without its styles')
      reportStage(where, await page.evaluate(measureStage, ['.tso-top-actions', '.tso-board', '.tso-hint']))
      report(where, await page.evaluate(measure))
      if (shot('penalties')) await page.screenshot(shot('penalties'))
    } catch {
      problem(where, 'the penalty shootout did not open')
    }
    await page.keyboard.press('Escape')
    await page.close()
  }

  // A link ending #play opens it straight away.
  {
    const where = `/penalties#play at ${width}`
    const page = await openPage(context, base, '/penalties#play', where)
    try {
      await page.waitForSelector('.tso', { state: 'visible', timeout: 45000 })
    } catch {
      problem(where, 'the game did not open from the arcade\'s link')
    }
    await page.close()
  }

  // Keepy-uppies, free kicks and the games made for the stage: played on it.
  for (const [p, name, note] of STAGE_GAMES) {
    const where = `${p} at ${width} (the game)`
    const page = await openPage(context, base, p, where)
    try {
      await page.waitForSelector('.gs', { state: 'visible', timeout: 45000 })
      await page.waitForTimeout(700)
      reportStage(where, await page.evaluate(measureStage, ['.gs-hud', '.gs-btns', '.gs-prompt', ...(note ? ['.gs-note'] : [])]))
      report(where, await page.evaluate(measure))
      if (shot(name)) await page.screenshot(shot(name))
    } catch {
      problem(where, 'the game did not open')
    }
    if (name === 'keepy') await finishPanel(page, where, shot('keepy-finish'))
    await page.close()
  }
  await context.close()
}

// Keepy-uppies played until the ball drops: the finish panel, with the
// day's leaderboard and the box for three letters in it. The wait is a
// long one: a machine with no graphics card draws the stadium a few
// frames a second, and the ball falls a frame at a time.
async function finishPanel(page, where, shot) {
  try {
    // The panel at its tallest: a sweet waiting to be collected, with the
    // stall's button, above the football's line and the leaderboard.
    await page.evaluate(() => {
      const two = (n) => String(n).padStart(2, '0')
      const d = new Date()
      localStorage.setItem('winterfayre:sweet', JSON.stringify({ day: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, game: 'penalties', at: '10:42', given: null }))
    })
    await page.locator('.gs-pitch').focus()
    await page.keyboard.press('Space')
    await page.waitForSelector('.gs-end:not([hidden])', { timeout: 120000 })
    await page.waitForSelector('.gs-lbw', { timeout: 30000 })
    await page.waitForTimeout(400)
    const fits = await page.evaluate(() => {
      const end = document.querySelector('.gs-end')
      const r = end.getBoundingClientRect()
      const top = document.querySelector('.gs-btns').getBoundingClientRect()
      const given = document.querySelector('.gs-given')?.getBoundingClientRect()
      return {
        inside: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
        clear: r.top >= top.bottom - 1,
        scrolls: getComputedStyle(end).overflowY,
        given: given ? [Math.round(given.width), Math.round(given.height)] : null,
        football: Boolean(document.querySelector('.gs-fb')),
        appeal: Boolean(document.querySelector('.gs-end .gs-appeal a')),
      }
    })
    if (!fits.inside) problem(where, 'the finish panel does not fit the screen')
    if (!fits.clear) problem(where, 'the finish panel lies over the Sound, Music and Leave buttons')
    if (fits.scrolls !== 'auto' && fits.scrolls !== 'scroll') problem(where, 'the finish panel does not scroll inside itself')
    if (!fits.given) problem(where, 'a sweet that is waiting has no button for the stall')
    else if (fits.given[0] < 44 || fits.given[1] < 44) problem(where, `the stall's button is ${fits.given[0]} by ${fits.given[1]}, under 44`)
    if (!fits.football) problem(where, 'the keepy-uppies finish panel does not say how the football stands')
    if (!fits.appeal) problem(where, 'the finish panel has no line about the appeal')
    report(`${where}, finished`, await page.evaluate(measure))
    if (shot) await page.screenshot(shot)
  } catch {
    problem(where, 'the finish panel and its leaderboard did not appear')
  }
}

// With the 3D off, keepy-uppies and free kicks are played flat on the
// page, and penalties on its flat pitch.
async function flatGames(browser, base) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  for (const p of ['/keepy-uppies', '/free-kicks']) {
    const where = `${p} at 375 (3D off, the flat game)`
    const page = await openPage(context, base, p, where)
    await page.waitForTimeout(1200)
    const state = await page.evaluate(() => ({ stage: Boolean(document.querySelector('.gs')), canvas: Boolean(document.querySelector('.ku-pitch')?.getBoundingClientRect().height) }))
    if (state.stage) problem(where, 'the 3D stage opened with WebGL off')
    if (!state.canvas) problem(where, 'the flat game is not on the page')
    await page.screenshot({ path: path.join(shots, `${p.slice(1)}-flat-375.png`) })
    await page.close()
  }
  // A game made for the stage is played on it all the same, drawn flat.
  for (const p of FLAT_STAGE_GAMES) {
    const where = `${p} at 375 (3D off, drawn flat)`
    const page = await openPage(context, base, p, where)
    try {
      await page.waitForSelector('.gs[data-renderer="2d"]', { state: 'visible', timeout: 45000 })
      await page.waitForTimeout(600)
      reportStage(where, await page.evaluate(measureStage, ['.gs-hud', '.gs-btns', '.gs-prompt']))
      await page.screenshot({ path: path.join(shots, `${p.slice(1)}-flat-375.png`) })
    } catch {
      problem(where, 'the game did not open drawn flat')
    }
    await page.close()
  }
  const where = '/penalties at 375 (3D off, the flat pitch)'
  const page = await openPage(context, base, '/penalties', where)
  await page.locator('.shootout-play').click()
  try {
    await page.waitForSelector('.tso[data-renderer="2d"]', { state: 'visible', timeout: 45000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(shots, 'penalties-flat-375.png') })
  } catch {
    problem(where, 'the flat penalty shootout did not open')
  }
  await page.close()
  await context.close()
}

// A phone on its side: head to head is played this way, and every other
// page still fits.
async function sideways(browser, base, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  for (const p of ['/', '/privacy']) {
    const where = `${p} at ${width} by ${height}`
    const page = await openPage(context, base, p, where)
    await scrollThrough(page)
    report(where, await page.evaluate(measure))
    await page.close()
  }
  for (const [p, groups] of STAGE_GAMES.map(([page, , note]) => [page, ['.gs-hud', '.gs-btns', ...(note ? ['.gs-note'] : [])]])) {
    const where = `${p} at ${width} by ${height} (the game)`
    const page = await openPage(context, base, p, where)
    try {
      await page.waitForSelector('.gs', { state: 'visible', timeout: 45000 })
      await page.waitForTimeout(500)
      reportStage(where, await page.evaluate(measureStage, groups))
      report(where, await page.evaluate(measure))
    } catch {
      problem(where, 'the game did not open')
    }
    await page.close()
  }
  {
    const where = `/penalties at ${width} by ${height} (the game)`
    const page = await openPage(context, base, '/penalties', where)
    await page.locator('.shootout-play').click()
    try {
      await page.waitForSelector('.tso:not([data-phase="loading"])', { state: 'visible', timeout: 45000 })
      await page.waitForTimeout(700)
      reportStage(where, await page.evaluate(measureStage, ['.tso-top-actions', '.tso-board']))
      report(where, await page.evaluate(measure))
    } catch {
      problem(where, 'the penalty shootout did not open')
    }
    await page.close()
  }

  const where = `/head-to-head at ${width} by ${height}`
  const page = await openPage(context, base, '/head-to-head', where)
  try {
    await page.waitForSelector('.hh', { state: 'visible', timeout: 45000 })
    await page.waitForTimeout(500)
    const turn = await page.evaluate(() => getComputedStyle(document.querySelector('.hh-turn')).display)
    if (turn !== 'none') problem(where, 'the phone is on its side but is still asked to turn')
    // Picking a player: the panel fits, or scrolls inside itself.
    const pick = await page.evaluate(() => {
      const el = document.querySelector('.hh-pick')
      if (!el || el.hidden) return null
      const r = el.getBoundingClientRect()
      return { inside: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 }
    })
    if (pick && !pick.inside) problem(where, 'the pick-a-player panel does not fit the screen')
    report(`${where}, picking`, await page.evaluate(measure))
    if (pick) await page.locator('.hh-pick .btn').click()
    await page.waitForTimeout(600)
    reportStage(where, await page.evaluate(measureStage, ['.hh-score', '.hh-pows', '.gs-btns', '.hh-pad-l', '.hh-pad-r']))
    report(where, await page.evaluate(measure))
    const jump = await page.evaluate(() => { const r = document.querySelector('.hh-key[data-in=jump]').getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)) })
    if (jump < 88 && !(width >= 900 && height >= 560)) problem(where, `the Jump button is ${jump}px, not 88`)
    await page.screenshot({ path: path.join(shots, `head-to-head-${width}x${height}.png`) })
  } catch (err) {
    problem(where, `head to head did not open (${String(err.message).split('\n')[0]})`)
  }
  await page.close()

  // Held upright, it asks for the phone to be turned.
  const upright = await browser.newContext({ viewport: { width: height, height: width }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const u = await openPage(upright, base, '/head-to-head', `/head-to-head at ${height} by ${width}`)
  try {
    await u.waitForSelector('.hh', { state: 'visible', timeout: 45000 })
    const turn = await u.evaluate(() => getComputedStyle(document.querySelector('.hh-turn')).display)
    if (turn === 'none') problem(`/head-to-head at ${height} by ${width}`, 'held upright, it does not ask for the phone to be turned')
  } catch {
    problem(`/head-to-head at ${height} by ${width}`, 'head to head did not open')
  }
  await u.close()
  await upright.close()
  await context.close()
}

// The arcade's tiles on wider screens: two columns from about 560 and
// three from about 900.
async function widerScreens(browser, base) {
  for (const [width, columns] of [[600, 2], [960, 3], [1280, 3]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const where = `/ at ${width}`
    const page = await openPage(context, base, '/', where)
    const lefts = await page.evaluate(() => [...document.querySelectorAll('.gts > .gt')].map(li => Math.round(li.getBoundingClientRect().left)))
    const got = new Set(lefts).size
    if (got !== Math.min(columns, lefts.length)) problem(where, `the tiles are in ${got} columns, not ${columns}`)
    const m = await page.evaluate(measure)
    if (m.scrollWidth > m.vw + 1) problem(where, 'the page scrolls sideways')
    if (width === 1280) await page.screenshot({ path: path.join(shots, 'arcade-1280.png'), fullPage: true })
    await page.close()
    await context.close()
  }
}

// The numbers page on a phone, behind its password: nothing wider than
// the screen, every Take off button big enough for a thumb, and a tap on
// one takes that entry off. The television check has put ten invented
// entries on the keepy-uppies leaderboard by now.
async function numbersPage(browser, base) {
  const where = '/numbers at 375'
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, httpCredentials: { username: 'check', password: NUMBERS } })
  const page = await openPage(context, base, '/numbers', where)
  await scrollThrough(page)
  report(where, await page.evaluate(measure))
  const before = await page.locator('form[action="/numbers/remove"]').count()
  if (before !== 10) problem(where, `${before} entries have a Take off button, not the 10 that were added`)
  if (before) {
    await page.locator('form[action="/numbers/remove"] button').first().click()
    await page.waitForLoadState('load')
    const said = await page.getByText('That entry has been taken off').count()
    const after = await page.locator('form[action="/numbers/remove"]').count()
    if (!said || after !== before - 1) problem(where, 'a tap on Take off did not take the entry off')
    await page.screenshot({ path: path.join(shots, 'numbers-375.png'), fullPage: true })
  }
  await page.close()
  await context.close()
  // Without the password it is not shown.
  const closed = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const res = await (await closed.newPage()).goto(`${base}/numbers`)
  if (res.status() !== 401) problem(where, `without the password it answered ${res.status()}, not 401`)
  await closed.close()
}

// The stall's TV screen, as a television shows it, with one leaderboard
// full: ten invented goes of one or two keepy-uppies, which the site
// takes at once.
async function television(browser, base) {
  for (let n = 0; n < 10; n++) {
    const { ticket } = await (await fetch(`${base}/api/board/keepy`)).json()
    const res = await fetch(`${base}/api/board/keepy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initials: ['ABC', 'XYZ', 'LMN', 'QRS', 'TUV'][n % 5], score: n < 5 ? 2 : 1, ticket }) })
    if (!res.ok) problem('/tv', `an invented score for the picture was refused (${res.status})`)
  }
  for (const [width, height, name] of [[1920, 1080, 'tv-1920x1080'], [1280, 720, 'tv-1280x720'], [3840, 2160, null]]) {
    const where = `/tv at ${width} by ${height}`
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await openPage(context, base, '/tv', where)
    await page.waitForTimeout(700)
    // Each board in its turn, keepy-uppies (the full one) among them. The
    // check gives each its turn here, so it need not wait for them all.
    const seen = new Set()
    for (let turn = 0; turn < GAMES.length; turn++) {
      const m = await page.evaluate((index) => {
        const all = [...document.querySelectorAll('.tvb')]
        all.forEach((b, n) => b.classList.toggle('on', n === index))
        const on = all.filter(b => getComputedStyle(b).display !== 'none')
        const board = on[0]
        const code = document.querySelector('.tvcode svg').getBoundingClientRect()
        const card = board?.getBoundingClientRect()
        const row = board?.querySelector('.tvl li')
        const snow = document.querySelector('.tv .snow').getBoundingClientRect()
        return {
          shown: on.length,
          key: board?.getAttribute('data-tv-board'),
          rows: board ? board.querySelectorAll('.tvl li').length : 0,
          code: Math.round(Math.min(code.width, code.height)),
          codeInside: code.top >= 0 && code.bottom <= innerHeight && code.left >= 0 && code.right <= innerWidth,
          letters: row ? parseFloat(getComputedStyle(row).fontSize) : null,
          cardInside: card ? card.top >= 0 && card.bottom <= snow.top + 1 && card.right <= innerWidth : false,
          scrolls: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
          address: document.querySelector('.tva').getBoundingClientRect().bottom <= snow.top + 1,
        }
      }, turn)
      seen.add(m.key)
      const scale = width / 1920
      if (m.shown !== 1) problem(where, `${m.shown} leaderboards are on the screen at once, not one`)
      if (m.code < 400 * scale) problem(where, `the QR code is ${m.code}px square, under ${Math.round(400 * scale)}`)
      if (!m.codeInside) problem(where, 'the QR code is not wholly on the screen')
      if (m.letters !== null && m.letters < 40 * scale) problem(where, `a leaderboard row's letters are ${m.letters}px, under ${Math.round(40 * scale)}`)
      if (!m.cardInside) problem(where, `the ${m.key} leaderboard, with ${m.rows} rows, does not fit the screen`)
      if (!m.address) problem(where, 'the address under the code runs into the snow')
      if (m.scrolls) problem(where, 'the screen scrolls')
      if (m.key === 'keepy') {
        if (m.rows !== 10) problem(where, `the full leaderboard shows ${m.rows} rows, not 10`)
        await page.waitForTimeout(700)
        if (name) await page.screenshot({ path: path.join(shots, `${name}.png`) })
      }
    }
    // And left alone, the next board takes its turn by itself.
    if (width === 1920) {
      const was = await page.evaluate(() => document.querySelector('.tvb.on')?.getAttribute('data-tv-board'))
      try {
        await page.waitForFunction((key) => document.querySelector('.tvb.on')?.getAttribute('data-tv-board') !== key, was, { timeout: 14000 })
      } catch {
        problem(where, 'the leaderboards do not take turns by themselves')
      }
    }
    if (seen.size !== GAMES.length) problem(where, `only ${seen.size} of the ${GAMES.length} leaderboards took a turn`)
    await page.close()
    await context.close()
  }

  // With no script the code and every leaderboard are still there to read.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, javaScriptEnabled: false })
  const where = '/tv at 1920 by 1080 (no JavaScript)'
  const page = await openPage(context, base, '/tv', where)
  const m = await page.evaluate(() => ({
    code: Math.round(document.querySelector('.tvcode svg').getBoundingClientRect().width),
    boards: [...document.querySelectorAll('.tvb')].filter(b => getComputedStyle(b).display !== 'none').length,
    rows: document.querySelectorAll('.tvb[data-tv-board="keepy"] .tvl li').length,
    wide: document.documentElement.scrollWidth > innerWidth + 1,
  }))
  if (m.code < 400) problem(where, `the QR code is ${m.code}px square, under 400`)
  if (m.boards !== GAMES.length) problem(where, `${m.boards} leaderboards can be read, not ${GAMES.length}`)
  if (m.rows !== 10) problem(where, 'the full leaderboard is not all there')
  if (m.wide) problem(where, 'the page scrolls sideways')
  await page.screenshot({ path: path.join(shots, 'tv-1920x1080-no-js.png'), fullPage: true })
  await page.close()
  await context.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
