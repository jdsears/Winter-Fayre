// The arcade and its games' pages.
//
// The arcade (/) is a picture tile for each game with a Play button. A
// game's own page opens the game full screen when the page's script
// runs; without the script the page says so. Each game is played in the
// visitor's browser. Nothing is asked of any other site, and nothing is
// sent anywhere unless the visitor adds a score to a leaderboard.

import { esc, attr } from './html.js'
import { snowBand } from './layout.js'
import { SITE, COLOURS } from '../site.js'
import { GAMES } from '../../shared/games.js'
import { prizeLine } from '../../shared/prizes.js'
import { shootoutConfig } from '../../client/shootout/config.js'
import { renderShootoutSection } from '../../client/shootout/section.js'

// ---------------------------------------------------------------------
// The tiles' pictures
// ---------------------------------------------------------------------

// A drawn picture for each game's tile: a winter night, the crowd, the
// boards with snow on them, the pitch, then what the game is about.
// Drawn shapes only.
const INK = COLOURS.ink
const ball = (x, y, r) => `<g transform="translate(${x} ${y}) scale(${r / 12})"><circle r="12" fill="#fff" stroke="${INK}" stroke-width="1.5"/><path d="M0-5.5 5.2-1.7 3.2 4.4H-3.2L-5.2-1.7Z" fill="${INK}"/><path d="M0-5.5V-12M5.2-1.7 11.4-3.7M3.2 4.4 7.1 9.7M-3.2 4.4-7.1 9.7M-5.2-1.7-11.4-3.7" stroke="${INK}" stroke-width="1.5"/></g>`
// A player: a shirt, shorts, a head and, for a splash of Christmas, a hat.
const figure = (x, y, shirt, h = 34, hat = false) => `<g transform="translate(${x} ${y})"><rect x="-6" y="${-h + 10}" width="12" height="${h - 16}" rx="4" fill="${shirt}"/><rect x="-5" y="-8" width="4" height="8" fill="${INK}"/><rect x="1" y="-8" width="4" height="8" fill="${INK}"/><circle cy="${-h + 5}" r="5" fill="#c98a5e"/>${hat ? `<path d="M-5 ${-h + 3}Q0 ${-h - 9} 6 ${-h - 4}L5 ${-h + 3}Z" fill="#c8102e"/><rect x="-6" y="${-h + 1}" width="12" height="3" rx="1.5" fill="#fff"/><circle cx="6.5" cy="${-h - 4}" r="2" fill="#fff"/>` : ''}</g>`
const CROWD = ['#f0c05a', '#fff', '#8fd6e8', '#c8102e', '#1e9e57', '#31507a']
function tileArt(kind) {
  const crowd = Array.from({ length: 40 }, (_, i) => `<rect x="${4 + i * 8}" y="${44 + (i % 3) * 5}" width="5" height="9" rx="2" fill="${CROWD[i % CROWD.length]}" opacity=".85"/>`).join('')
  const snow = Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 53 + 17) % 320}" cy="${(i * 37 + 9) % 150}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity="${0.5 + (i % 4) * 0.12}"/>`).join('')
  const goal = '<path d="M90 118V62H230V118" fill="none" stroke="#fff" stroke-width="4"/><path d="M90 62H230V118H90ZM110 62V118M130 62V118M150 62V118M170 62V118M190 62V118M210 62V118M90 76H230M90 90H230M90 104H230" fill="none" stroke="#ffffff55" stroke-width="1"/>'
  const scene = `<rect width="320" height="180" fill="${COLOURS.primary_deep}"/><rect y="40" width="320" height="34" fill="${COLOURS.primary}"/>${crowd}<rect y="74" width="320" height="16" fill="${COLOURS.accent}"/><rect y="72" width="320" height="4" rx="2" fill="#fff"/><rect y="90" width="320" height="90" fill="#3f8f5a"/><rect y="118" width="320" height="2" fill="#ffffffaa"/><rect y="134" width="320" height="22" fill="#357e50"/>`
  const what = {
    penalties: `${goal}${figure(160, 118, '#1e9e57', 38, true)}${ball(160, 158, 13)}`,
    keepy: `${goal}<path d="M160 150V70" stroke="#ffffff66" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/><ellipse cx="160" cy="160" rx="16" ry="4" fill="#0004"/>${ball(160, 62, 22)}<text x="250" y="52" class="gtx" fill="${COLOURS.accent}" text-anchor="middle">25</text>`,
    headtohead: `<path d="M24 118V70H50M296 118V70H270" fill="none" stroke="#fff" stroke-width="4"/><path d="M24 70H50V118H24ZM296 70H270V118H296ZM24 86H50M24 102H50M37 70V118M270 86H296M270 102H296M283 70V118" fill="none" stroke="#ffffff55" stroke-width="1"/><ellipse cx="112" cy="150" rx="26" ry="5" fill="#0004"/><ellipse cx="212" cy="150" rx="26" ry="5" fill="#0004"/><rect x="100" y="120" width="24" height="26" rx="7" fill="#c8102e"/><rect x="200" y="120" width="24" height="26" rx="7" fill="#f4f4f2"/><circle cx="112" cy="100" r="24" fill="#c98a5e"/><path d="M88 96a24 24 0 0 1 48 0c-10-9-38-9-48 0Z" fill="#3a2a1e"/><circle cx="122" cy="102" r="3" fill="${INK}"/><circle cx="212" cy="100" r="24" fill="#e8b48c"/><path d="M188 96a24 24 0 0 1 48 0c-10-9-38-9-48 0Z" fill="#1b1b22"/><circle cx="202" cy="102" r="3" fill="${INK}"/>${ball(162, 58, 15)}`,
    freekick: `${goal}${figure(196, 118, '#1e9e57', 38, true)}${[118, 132, 146, 160].map(x => figure(x, 142, '#f4f4f2', 40)).join('')}<path d="M150 166C86 150 70 96 104 72" fill="none" stroke="${COLOURS.accent}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/>${ball(150, 166, 10)}${ball(104, 72, 7)}`,
  }[kind] || ''
  return `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">${scene}${what}${snow}</svg>`
}

// ---------------------------------------------------------------------
// The arcade
// ---------------------------------------------------------------------

export function arcadeHtml() {
  const tiles = GAMES.map(g => `<li class="gt"><a href="${attr(g.href)}">${tileArt(g.key)}<span class="gt-b"><span class="gt-t">${esc(g.title)}</span><span class="gt-p">${esc(g.text)}</span>${prizeLine(g.key) ? `<span class="gt-w">${esc(prizeLine(g.key))}</span>` : ''}<span class="btn y">${esc(g.play)}</span></span></a></li>`).join('')
  return `<header class="hero" id="top">
  <div class="wrap">
    <div class="wm">${esc(SITE.host)}</div>
    <h1>${esc(SITE.short)} <em>Sports Arcade</em></h1>
    <p>Quick sports games to play on your phone. Beat a game's target and show your screen at the sports stall to claim a sweet, and put your three letters on today's leaderboard.</p>
  </div>
  ${snowBand({ w: 1600, h: 90, count: 96 })}
</header>
<main>
<section id="games" class="band deep arcade"><div class="wrap">
  <h2 class="vh">The games</h2>
  <ul class="gts">${tiles}</ul>
</div></section>
</main>`
}

// ---------------------------------------------------------------------
// The games' pages
// ---------------------------------------------------------------------

// What every game's place on its page carries for the stadium: the words
// for the boards round the pitch and for the big sign across the stand,
// and the first go's ticket for the leaderboard.
function stadiumAttrs(ticket) {
  return ` data-boards="${attr(JSON.stringify(SITE.boards))}" data-top-sign="${attr(JSON.stringify(SITE.sign))}"${ticket ? ` data-ticket="${attr(ticket)}"` : ''}`
}

const more = '<div class="cta"><a class="btn o" href="/">More games</a></div>'

// The penalty shootout's settings, in the shape its modules read
// (client/shootout/config.js).
export function penaltiesConfig() {
  return shootoutConfig({
    slug: 'winterfayre',
    content: {
      site_name: SITE.name,
      short_name: SITE.short,
      partners: { names: SITE.boards.map(name => ({ name })) },
      shootout: { eyebrow: 'Penalties', heading: 'Beat the *keeper*', line: 'Five penalties each, then sudden death if it is level. Take your kicks and make your saves.' },
    },
    theme: { colours: COLOURS },
    settings: { shootout: { enabled: true, opponent_name: 'The Snowmen' } },
  }, { share: false })
}

// Penalties: a section with a Play button, which the page's script shows
// and which opens the game full screen (client/shootout). A link ending
// #play opens the game straight away.
function penaltiesHtml({ ticket = null } = {}) {
  return renderShootoutSection(penaltiesConfig(), { id: 'penalties' }).replace(' data-shootout=', `${stadiumAttrs(ticket)} data-shootout=`)
}

// Keepy-uppies: a canvas the page's script plays the flat game on where
// the 3D will not run (client/keepy).
function keepyHtml({ ticket = null } = {}) {
  return `<section id="keepy" class="band deep game"><div class="wrap">
  <div class="eyebrow">Winter Fayre Sports Arcade</div>
  <h2>Keepy-<em>uppies</em></h2>
  <p class="lede">Tap the ball to keep it off the snow.</p>
  <div class="ku" data-keepy${stadiumAttrs(ticket)}>
    <p class="ku-count"><span><b data-ku-now>0</b> now</span><span><b data-ku-best>0</b> best on this device</span></p>
    <div class="ku-stage">
      <canvas class="ku-pitch" width="360" height="480" tabindex="0" role="img" aria-label="The keepy-uppies pitch. Tap the ball, or press Space, to keep it up."></canvas>
      <button type="button" class="btn y" data-ku-start hidden>Play again</button>
    </div>
    <p class="ku-said" data-ku-said role="status">Tap the ball to start.</p>
    <noscript><p class="ku-said">This game needs JavaScript switched on.</p></noscript>
    <p class="hint left">On a keyboard, press Space as the ball comes down.</p>
  </div>
  ${more}
</div></section>`
}

// The free kick challenge, the same way (client/freekick).
function freeKickHtml({ ticket = null } = {}) {
  return `<section id="freekick" class="band deep game"><div class="wrap">
  <div class="eyebrow">Winter Fayre Sports Arcade</div>
  <h2>Free kick <em>challenge</em></h2>
  <p class="lede">Swipe up from the ball. Curl your swipe to bend it round the wall.</p>
  <div class="ku" data-freekick${stadiumAttrs(ticket)}>
    <p class="ku-count"><span><b data-fk-now>0</b> scored</span><span>kick <b data-fk-kick>1</b> of 10</span><span><b data-fk-best>0</b> best</span></p>
    <div class="ku-stage">
      <canvas class="ku-pitch" width="360" height="480" tabindex="0" role="img" aria-label="The free kick pitch. Swipe up from the ball to shoot, or use the arrow keys to aim and Space to shoot."></canvas>
      <button type="button" class="btn y" data-fk-start hidden>Play again</button>
    </div>
    <p class="ku-said" data-fk-said role="status">Swipe up from the ball to take the first kick.</p>
    <noscript><p class="ku-said">This game needs JavaScript switched on.</p></noscript>
    <p class="hint left">On a keyboard, the arrow keys move your aim and Space shoots.</p>
  </div>
  ${more}
</div></section>`
}

// Head to head: the page's script plays the game full screen, with the
// phone held sideways (client/headtohead).
function headToHeadHtml({ ticket = null } = {}) {
  return `<section id="headtohead" class="band deep game"><div class="wrap">
  <div class="eyebrow">Winter Fayre Sports Arcade</div>
  <h2>Head to <em>head</em></h2>
  <p class="lede">One against one for sixty seconds. Most goals wins.</p>
  <div class="ku" data-headtohead${stadiumAttrs(ticket)}>
    <p class="ku-said" data-hh-said role="status">The game is loading. Turn your phone sideways to play.</p>
    <noscript><p class="ku-said">This game needs JavaScript switched on.</p></noscript>
    <p class="hint left">On a keyboard, the arrow keys run and jump and Space kicks.</p>
    <button type="button" class="btn y" data-hh-start hidden>Play head to head</button>
  </div>
  ${more}
</div></section>`
}

const PAGES = { penalties: penaltiesHtml, keepy: keepyHtml, freekick: freeKickHtml, headtohead: headToHeadHtml }

// A game's place on its own page, or '' for a game with none.
export function gameHtml(key, opts = {}) {
  return PAGES[key] ? PAGES[key](opts) : ''
}
