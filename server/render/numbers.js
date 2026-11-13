// The numbers page: John's own, behind a password. How many pages were
// looked at and how many games were played, a day at a time, from the
// site's own counts (server/counts.js).
//
// It is never indexed. Its bars are meter elements: the page has no
// style attributes.

import { esc } from './html.js'
import { headHtml, documentHtml } from './layout.js'
import { GAMES, GAME_NAMES, dayTotal } from '../counts.js'
import { SITE } from '../site.js'

const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const dateOf = (day) => DATE.format(new Date(`${day}T12:00:00Z`))
const sum = (list, f) => list.reduce((a, d) => a + f(d), 0)
const plays = (d) => GAMES.reduce((a, g) => a + d.games[g].play, 0)

// names: { name: 'What it is called' } for each page that is counted.
export function renderNumbers({ days, names, nonce, stylesheet, kept = 'memory' }) {
  const head = headHtml({ meta: { title: `Numbers: ${SITE.name}`, description: null }, stylesheet, nonce })
  const spans = [['Today', days.slice(0, 1)], ['Last 7 days', days.slice(0, 7)], ['Last 30 days', days.slice(0, 30)]]
  const cards = spans.map(([label, list]) => `<li class="num"><span class="nl">${label}</span><b>${sum(list, dayTotal)}</b> page views<br><b>${sum(list, plays)}</b> games started</li>`).join('')

  const month = days.slice(0, 30)
  const pageTotals = Object.keys(names).map(n => [n, sum(month, d => d.pages[n] || 0)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const top = Math.max(1, ...pageTotals.map(([, n]) => n))
  const pageRows = pageTotals.map(([n, v]) => `<tr><th scope="row">${esc(names[n])}</th><td>${v}</td><td class="meter"><meter min="0" max="${top}" value="${v}">${v}</meter></td></tr>`).join('')

  const gameRows = GAMES.map((g) => {
    const started = sum(month, d => d.games[g].play)
    const finished = sum(month, d => d.games[g].done)
    return `<tr><th scope="row">${esc(GAME_NAMES[g])}</th><td>${started}</td><td>${finished}</td></tr>`
  }).join('')

  const dayRows = month.map(d => `<tr><th scope="row">${esc(dateOf(d.day))}</th><td>${dayTotal(d)}</td><td>${plays(d)}</td></tr>`).join('')

  return documentHtml({
    head,
    body: `<main class="band white nums"><div class="wrap">
  <div class="eyebrow">${esc(SITE.name)}</div>
  <h1>The <em>numbers</em></h1>
  <p class="lede">Page views and games played, counted by the site itself. These are visits, not visitors: one person looking at three pages is three. No cookies are used and nothing about anyone is kept.</p>
  <p>${kept === 'file' ? 'The numbers and the leaderboards are being written to the volume, so a restart keeps them.' : 'No volume is attached, so the numbers and the leaderboards are kept in memory only and start again after a restart.'}</p>
  <ul class="numgrid">${cards}</ul>
  <h2>Games, last 30 days</h2>
  <div class="tw"><table><thead><tr><th scope="col">Game</th><th scope="col">Started</th><th scope="col">Finished</th></tr></thead><tbody>${gameRows}</tbody></table></div>
  <h2>Pages, last 30 days</h2>
  ${pageRows ? `<div class="tw"><table><thead><tr><th scope="col">Page</th><th scope="col">Views</th><th scope="col"><span class="vh">Share</span></th></tr></thead><tbody>${pageRows}</tbody></table></div>` : '<p>No page has been looked at yet.</p>'}
  <h2>Day by day</h2>
  <div class="tw"><table><thead><tr><th scope="col">Day</th><th scope="col">Page views</th><th scope="col">Games started</th></tr></thead><tbody>${dayRows}</tbody></table></div>
  <p><a class="btn o dark" href="/">Back to the games</a></p>
</div></main>`,
  })
}
