// The site's pages, each whole without JavaScript: the arcade, a page
// for each game, privacy, and the page for an address that is not there.

import { esc } from './html.js'
import { headHtml, barHtml, footerHtml, documentHtml } from './layout.js'
import { arcadeHtml, gameHtml } from './games.js'
import { SITE } from '../site.js'

// nonce    this response's style nonce
// assets   { stylesheet, script }
function shell({ nonce, assets, meta, body, home = false, script = true }) {
  const head = headHtml({ meta, stylesheet: assets.stylesheet, nonce })
  return documentHtml({
    head,
    body: `${home ? '' : `${barHtml()}\n`}${body}\n${footerHtml()}`,
    script: script ? assets.script : null,
  })
}

// The arcade: where the QR code lands.
export function renderArcade(opts) {
  return shell({ ...opts, home: true, meta: { title: SITE.name, description: SITE.description }, body: arcadeHtml() })
}

// One game's page. ticket is the first go's ticket for its leaderboard.
export function renderGame(game, { ticket = null, ...opts }) {
  return shell({
    ...opts,
    meta: { title: `${game.title}: ${SITE.name}`, description: game.text },
    body: `<main>\n<h1 class="vh">${esc(game.title)}</h1>\n${gameHtml(game.key, { ticket })}\n</main>`,
  })
}

// ---------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------

// In plain English: the little the site keeps, and what it never does.
// John checks this wording before the fayre.
export const PRIVACY_UPDATED = 'November 2026'

export function renderPrivacy(opts) {
  const main = `<main>
<article class="band white report"><div class="wrap">
  <div class="eyebrow">Privacy</div>
  <h1 class="art">Your privacy on this site</h1>
  <p class="updated">Last updated ${PRIVACY_UPDATED}</p>
  <div class="prose">
<p>This site is a small set of sports games for the Winter Fayre, run by the sports stall. It is made to be played by children, so it keeps as little as it can.</p>

<h2>What the site keeps</h2>
<ul>
<li><strong>A leaderboard entry, if you choose to add one.</strong> Three letters, your score and the time. Nothing else is kept with it: no name, no account, no email address and nothing about your phone. Adding a score is your choice, and every game plays the same without it.</li>
<li><strong>The leaderboards are for the day.</strong> They show the day's best scores here and on the screen at the sports stall. A new leaderboard starts each day and the one before is deleted, so the leaderboards are cleared after the fayre.</li>
<li><strong>The site's own counts.</strong> The site counts how many times each page is looked at and how many times each game is started and finished, as a total for the day. It uses no cookie for this, keeps nothing about you or your phone, and cannot tell one visitor from another.</li>
</ul>

<h2>What stays on your phone</h2>
<p>Your best score in each game, the three letters you last used and the player you picked in head to head are kept in your own browser, so the games can show them to you again. If you add a run of wins in head to head, your browser also keeps what the site needs to let that entry grow as you win. None of this is sent anywhere unless you add a score to a leaderboard. Clearing this site's data in your browser removes it.</p>

<h2>What the site never does</h2>
<ul>
<li><strong>No cookies.</strong> The site sets no cookies of its own, and no one else's.</li>
<li><strong>No analytics service and no advertising.</strong> There is no tracking of any kind.</li>
<li><strong>No fonts or scripts from elsewhere.</strong> Everything a page needs comes from this site.</li>
<li><strong>No photos or films of anyone, and no one is named.</strong></li>
</ul>

<h2>Technical logs</h2>
<p>Like any website, the computers that serve it see your phone's internet address and the page it asked for. These are used only to keep the site working and safe, and are not used to identify anyone.</p>

<h2>Asking for something to come off</h2>
<p>If you would like a leaderboard entry taken off, ask at the sports stall and it will be removed.</p>
  </div>
  <div class="cta"><a class="btn y" href="/">Back to the games</a></div>
</div></article>
</main>`
  return shell({ ...opts, script: false, meta: { title: `Privacy: ${SITE.name}`, description: 'What the Winter Fayre Sports Arcade keeps, and what it never does.' }, body: main })
}

// ---------------------------------------------------------------------
// Not found, and something went wrong
// ---------------------------------------------------------------------

export function renderNotFound(opts) {
  const main = `<main>
<section class="band stripes empty"><div class="wrap">
  <div class="eyebrow">Page not found</div>
  <h1 class="art">This page is <em>not here</em></h1>
  <p>The address may be mistyped. Every game is on the arcade page.</p>
  <div class="cta"><a class="btn y" href="/">Go to the games</a></div>
</div></section>
</main>`
  return shell({ ...opts, script: false, meta: { title: `Page not found: ${SITE.name}`, description: null }, body: main })
}

// With no stylesheet at all, for when even that cannot be had.
export function renderBareError() {
  return '<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Back soon</title></head><body><main><h1>Back soon</h1><p>Something went wrong. Please try again in a minute.</p><p><a href="/">Go to the games</a></p></main></body></html>\n'
}
