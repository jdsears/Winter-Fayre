// The stall's TV screen (/tv): made for a 1920 by 1080 television seen
// from a few metres. A large QR code and the words "Scan to play", and
// beside it the day's leaderboards. And, in its turn, what the stall is
// in aid of: the PSA's Sports Fund Appeal, with a code to scan to donate.
//
// The page is whole without JavaScript: the QR codes are plain SVG, every
// leaderboard and the appeal are in its HTML, and it asks for itself
// again every minute. With the page's script (client/tv.js) the
// leaderboards take turns on the screen and refresh themselves, with no
// reload, and after every three of them the appeal fills the screen for
// ten seconds or so (John, 13 November 2026).
//
// It needs no touch and no keyboard, and is safe to leave running all
// day. On a phone it stacks: the code, then each leaderboard in turn,
// then the appeal with its Donate button in place of a code.

import { esc, attr } from './html.js'
import { headHtml, documentHtml, snowBand } from './layout.js'
import { qrSvg } from '../qr.js'
import { SITE } from '../site.js'
import { CREST, crestImg } from '../crest.js'
import { prizeLine, footballTv } from '../../shared/prizes.js'
import { APPEAL, charityLine } from '../../shared/appeal.js'
import { ICONS, donateButton } from './appeal.js'

// How many seconds between asking again, with no script.
export const TV_REFRESH_SECONDS = 60

// The site's address as a person would type it: no https, no last slash.
export const shortAddress = (origin) => String(origin).replace(/^https?:\/\//, '').replace(/\/+$/, '')

// One leaderboard: its game, what its scores count, and its rows.
// board: { key, title, scores, entries: [{ initials, score }] }
export function tvBoardHtml(board, { first = false } = {}) {
  const rows = board.entries.map((e, i) => `<li><span class="n">${i + 1}</span><span class="i">${esc(e.initials)}</span><span class="s">${esc(e.score)}</span></li>`).join('')
  return `<section class="tvb${board.football ? ' fb' : ''}${first ? ' on' : ''}" data-tv-board="${attr(board.key)}" aria-labelledby="tvb-${attr(board.key)}">
    <h2 id="tvb-${attr(board.key)}">${esc(board.title)}</h2>
    <p class="tvc">Counting ${esc(board.scores)}${prizeLine(board.key) ? `. <b>${esc(prizeLine(board.key))}</b>` : ''}</p>${board.football ? `
    <p class="tvf${board.football.closed && board.football.leader ? ' won' : ''}" data-tv-football>${esc(footballTv(board.football))}</p>` : ''}
    <ol class="tvl"${board.entries.length ? '' : ' hidden'}>${rows}</ol>
    <p class="tve"${board.entries.length ? ' hidden' : ''}>No scores yet. Scan the code and be the first.</p>
  </section>`
}

// The appeal's turn on the screen, in the PSA's plum and gold: what is
// being raised for now, what has been funded, and a code to scan to
// donate. The words are the PSA's own (shared/appeal.js). The code leads
// to this site's own path for it, which counts the scan and sends the
// visitor on to the PSA's page on JustGiving: its squares are drawn
// here, so the page still carries no address of another site to follow.
// On a phone, where a code cannot be scanned, the Donate button stands
// in its place.
export function tvAppealHtml(origin) {
  const a = APPEAL
  const tile = (i) => `<li>${ICONS[i.key]}<span>${esc(i.what)}</span></li>`
  return `<section class="tvx" data-tv-appeal aria-labelledby="tvx-h">
    <div class="tvx-w">
      <p class="tvx-eye">${crestImg({ shown: 96 })}<span>${esc(a.name)}</span></p>
      <h2 id="tvx-h">${esc(a.headline[0])} <em>${esc(a.headline[1])}</em></h2>
      <div class="tvx-g">
        <div><p class="tvx-t">${esc(a.raising.title)}</p><ul class="tvx-l">${a.raising.items.map(tile).join('')}</ul></div>
        <div><p class="tvx-t">${esc(a.funded.title)}</p><ul class="tvx-l">${a.funded.items.map(tile).join('')}</ul></div>
      </div>
      <p class="tvx-ch">${esc(charityLine())}</p>
    </div>
    <div class="tvx-q">
      <p class="tvx-s">${esc(a.scan[0])} <em>${esc(a.scan[1])}</em></p>
      <div class="tvcode">${qrSvg(`${origin}${a.tvPath}`, { label: `A QR code that opens the ${a.name}'s page on JustGiving, to donate`, ink: '#241524' })}</div>
      ${donateButton('btn y tvx-b')}
      <p class="tvx-a">${esc(a.shown)}</p>
    </div>
  </section>`
}

// origin    the site's own address, which the QR code leads to
// boards    every game's top ten: [{ key, title, scores, entries }]
// day       the day's name: 'Saturday 14 November'
// version   changes when the site is deployed again, so the script can
//           tell and reload the page
export function renderTv({ origin, boards, day, version = '', nonce, assets }) {
  const head = headHtml({
    meta: { title: `The stall's screen: ${SITE.name}`, description: null },
    stylesheet: assets.stylesheet,
    nonce,
    refresh: TV_REFRESH_SECONDS,
  })
  const address = shortAddress(origin)
  const body = `<main class="tv" data-tv data-version="${attr(version)}">
  <h1 class="vh">${esc(SITE.name)}: scan to play, today's leaderboards, and the ${esc(APPEAL.name)}</h1>
  <section class="tvq" aria-label="Scan to play">
    <p class="wm host">${crestImg({ shown: 96 })}<span>${esc(SITE.host)}${CREST ? '<br>' : ' '}${esc(SITE.short)}</span></p>
    <p class="tvh">Scan to <em>play</em></p>
    <div class="tvcode">${qrSvg(`${origin}/`, { label: `A QR code that opens ${address} on your phone` })}</div>
    <p class="tva">${esc(address)}</p>
  </section>
  <div class="tvr">
    <p class="tvd"><b>Today's leaderboards</b> <span data-tv-day>${esc(day)}</span></p>
    <div class="tvbs">
    ${boards.map((b, i) => tvBoardHtml(b, { first: i === 0 })).join('\n    ')}
    </div>
    <p class="tvp" data-tv-dots aria-hidden="true">${boards.map((b, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</p>
  </div>
  ${tvAppealHtml(origin)}
  ${snowBand({ w: 1600, h: 90, count: 70, seed: 25 })}
</main>`
  return documentHtml({ head, body, script: assets.script })
}
