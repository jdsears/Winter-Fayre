// The Sports Fund Appeal on the arcade page: what the stall and its
// games are in aid of, told as a short story a visitor scrolls through
// on the way to the games menu. The words and figures are the PSA's own
// (shared/appeal.js).
//
// It is written for parents and carers. Its one button, Donate, goes to
// this site's own /donate, which counts the tap and sends the visitor on
// to the PSA's page on JustGiving: no page here carries an address of
// another site, and nothing about the visitor is sent with them.
//
// Each part of the story is whole without the page's script and without
// its pictures, which are drawn here. Where a phone can draw 3D, the
// page's script pins the picture at the top of the page above these
// words as they are scrolled through (client/story): the parts it stops
// at are marked data-stop, from the page's heading (in games.js) to the
// button on to the games.

import { esc, attr } from './html.js'
import { APPEAL, charityLine } from '../../shared/appeal.js'
import { SITE } from '../site.js'

// A drawn picture for each part: gold lines on the plum. Shapes only.
const icon = (inner) => `<svg class="beat-i" viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`
export const ICONS = {
  // A stopwatch: day to day teaching.
  why: icon('<circle cx="32" cy="37" r="19"/><path d="M32 37V25M25 9h14M32 9v9M47 20l4-4"/>'),
  // A table tennis bat and ball.
  tables: icon('<circle cx="26" cy="26" r="17" fill="currentColor" stroke="none"/><path d="M37 37l13 13" stroke-width="8"/><circle cx="53" cy="13" r="5"/>'),
  // A sprinkler on the square.
  water: icon('<path d="M32 52V38M22 56h20M32 38C25 24 15 22 8 28M32 38c7-14 17-16 24-10M32 34V16"/><circle cx="8" cy="36" r="1.6" fill="currentColor" stroke="none"/><circle cx="56" cy="36" r="1.6" fill="currentColor" stroke="none"/><circle cx="32" cy="10" r="1.6" fill="currentColor" stroke="none"/>'),
  // Rugby posts, their feet padded.
  posts: icon('<path d="M20 6v36M44 6v36M20 26h24"/><rect x="14" y="40" width="12" height="18" rx="3" fill="currentColor" stroke="none"/><rect x="38" y="40" width="12" height="18" rx="3" fill="currentColor" stroke="none"/>'),
  // A box goal.
  goals: icon('<path d="M5 50V16h54v34"/><path d="M5 16l9 9h36l9-9M14 25v19M50 25v19M14 44l-9 6M50 44l9 6" stroke-width="2"/><path d="M23 25v19M32 25v19M41 25v19M14 34h36" stroke-width="1.2"/>'),
  // Covers over the square, and rain.
  covers: icon('<path d="M6 46c4-24 48-24 52 0Z"/><path d="M6 46h52"/><circle cx="16" cy="53" r="4"/><circle cx="48" cy="53" r="4"/><path d="M18 6v6M32 3v6M46 6v6"/>'),
  // A heart.
  give: icon('<path d="M32 54C11 40 7 29 7 22a12 12 0 0 1 25-5 12 12 0 0 1 25 5c0 7-4 18-25 32Z"/>'),
}

// The Donate button: this site's own /donate, opened beside the arcade
// so a game in hand is not lost, with nothing said of where it came from.
export const donateButton = (cls = 'btn y') => `<a class="${attr(cls)}" href="${attr(APPEAL.path)}" target="_blank" rel="noopener noreferrer">${esc(APPEAL.button)}</a>`

// Each thing is a stop on the 3D story (client/story), where it is drawn.
const item = (i) => `<li data-stop="${attr(i.key)}"><span class="fund-i">${ICONS[i.key]}</span><span class="fund-t">${i.amount ? `<b class="am">${esc(i.amount)}</b>` : ''}<b>${esc(i.what)}</b><span>${esc(i.text)}</span></span></li>`

export function appealHtml() {
  const a = APPEAL
  // The words for the boards in the 3D story are the ones round the games' pitch.
  return `<section id="appeal" class="story" aria-labelledby="appeal-h" data-story data-boards="${attr(JSON.stringify(SITE.boards))}">
  <div class="wrap story-top">
    <p class="st-eye">${esc(a.name)}</p>
    <h2 id="appeal-h">${esc(a.headline[0])} <em>${esc(a.headline[1])}</em></h2>
    <p class="st-lede">${esc(a.lede)}</p>
  </div>
  <div class="wrap" data-story-body>
  <ol class="beats">
    <li class="beat" data-beat="why" data-stop="why">
      ${ICONS.why}
      <h3>${esc(a.why.title)}</h3>
      <p>${esc(a.why.text)}</p>
      <p class="beat-k">${esc(a.why.key)}</p>
    </li>
    <li class="beat" data-beat="funded">
      <h3>${esc(a.funded.title)}</h3>
      <p>${esc(a.funded.lede)}</p>
      <ul class="fund">${a.funded.items.map(item).join('')}</ul>
      <p class="st-small">${esc(a.funded.more)}</p>
    </li>
    <li class="beat" data-beat="raising">
      <h3>${esc(a.raising.title)}</h3>
      <ul class="fund">${a.raising.items.map(item).join('')}</ul>
    </li>
    <li class="beat give" data-beat="give" data-stop="give">
      ${ICONS.give}
      <h3>${esc(a.give.title)}</h3>
      <p>${esc(a.give.text)}</p>
      ${donateButton('btn y big')}
      <p class="st-to">${esc(a.shown)}</p>
      <p class="st-small">${esc(a.give.ways)} ${esc(a.give.giftAid)}</p>
      <p class="st-small">${esc(a.give.thanks)}</p>
      <p class="st-small st-ch">${esc(charityLine())}</p>
    </li>
  </ol>
  <p class="st-next" data-stop="games"><a class="btn o" href="#games">On to the games</a></p>
  </div>
</section>`
}
