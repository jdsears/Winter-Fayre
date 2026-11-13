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
import { CREST, crestImg } from '../crest.js'
import { appealHtml, ICONS } from './appeal.js'
import { APPEAL } from '../../shared/appeal.js'
import { GAMES } from '../../shared/games.js'
import { prizeLine, FOOTBALL, ONE_EACH, footballWords } from '../../shared/prizes.js'
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
    rugby: `<path d="M128 118V34M192 118V34M128 80H192" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="123" y="100" width="10" height="18" rx="2" fill="${COLOURS.accent}"/><rect x="187" y="100" width="10" height="18" rx="2" fill="${COLOURS.accent}"/><path d="M128 34l14 5-14 5ZM192 34l14 5-14 5Z" fill="#c8102e"/><path d="M168 150C178 110 172 74 160 56" fill="none" stroke="${COLOURS.accent}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/><ellipse cx="160" cy="56" rx="5" ry="8" transform="rotate(-24 160 56)" fill="#f6f3ea" stroke="${INK}" stroke-width="1.2"/><ellipse cx="168" cy="160" rx="16" ry="4" fill="#0004"/><g transform="rotate(18 168 146)"><ellipse cx="168" cy="146" rx="10" ry="15" fill="#f6f3ea" stroke="${INK}" stroke-width="1.5"/><ellipse cx="168" cy="133.5" rx="5" ry="3.6" fill="#c8102e"/><ellipse cx="168" cy="158.5" rx="5" ry="3.6" fill="#c8102e"/></g>`,
    netball: `<path d="M160 118V46" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="155" y="84" width="10" height="34" rx="3" fill="${COLOURS.accent}"/><path d="M132 60l5 26h20l5-26" fill="none" stroke="#ffffffcc" stroke-width="1.5"/><path d="M139 60l3 26M147 60v26M155 60l-3 26M134 70h26M136 79h22" fill="none" stroke="#ffffff88" stroke-width="1"/><ellipse cx="147" cy="60" rx="15" ry="4.5" fill="none" stroke="#e0263c" stroke-width="3.5"/><path d="M160 60h-4" stroke="#fff" stroke-width="3"/><path d="M96 118a64 20 0 0 0 128 0" fill="none" stroke="#ffffffaa" stroke-width="2"/><path d="M212 156C204 96 176 44 148 50" fill="none" stroke="${COLOURS.accent}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/><ellipse cx="214" cy="166" rx="15" ry="4" fill="#0004"/><g><circle cx="212" cy="150" r="15" fill="#fbfbf6" stroke="${INK}" stroke-width="1.5"/><ellipse cx="212" cy="150" rx="14.4" ry="5.4" transform="rotate(28 212 150)" fill="none" stroke="#4bb8d6" stroke-width="2.6"/><ellipse cx="212" cy="150" rx="5.4" ry="14.4" transform="rotate(20 212 150)" fill="none" stroke="${COLOURS.accent}" stroke-width="2.6"/></g>`,
    cricket: `<path d="M128 180L146 96H174L192 180Z" fill="#cfbf8c"/><path d="M143 110H177" stroke="#fff" stroke-width="1.5"/><path d="M152 96V80M160 96V80M168 96V80M151 80H169" stroke="#f0e2b6" stroke-width="2.4" stroke-linecap="round"/>${figure(184, 100, '#8fd6e8', 26)}<path d="M132 176V132M148 176V132M164 176V132M130 131H166" stroke="#f0e2b6" stroke-width="5" stroke-linecap="round"/><g transform="rotate(-38 118 150)"><rect x="110" y="104" width="16" height="50" rx="4" fill="#e9d7a3" stroke="${INK}" stroke-width="1.5"/><rect x="114.5" y="84" width="7" height="22" rx="2" fill="${COLOURS.primary}"/></g><path d="M176 120C200 96 236 76 276 60" fill="none" stroke="${COLOURS.accent}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/><circle cx="278" cy="58" r="8" fill="#c8102e" stroke="${INK}" stroke-width="1.5"/><path d="M278 50v16" stroke="#fff" stroke-width="1.5"/><text x="262" y="44" class="gtx" fill="${COLOURS.accent}" text-anchor="middle">6</text>`,
    freekick: `${goal}${figure(196, 118, '#1e9e57', 38, true)}${[118, 132, 146, 160].map(x => figure(x, 142, '#f4f4f2', 40)).join('')}<path d="M150 166C86 150 70 96 104 72" fill="none" stroke="${COLOURS.accent}" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/>${ball(150, 166, 10)}${ball(104, 72, 7)}`,
  }[kind] || ''
  return `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">${scene}${what}${snow}</svg>`
}

// ---------------------------------------------------------------------
// The arcade
// ---------------------------------------------------------------------

// football is how the football stands ({ closed, leader }), from its
// leaderboard, or null: the tile of the game it is won in says so.
export function arcadeHtml({ football = null } = {}) {
  const prize = (g) => `${prizeLine(g.key) ? `<span class="gt-w">${esc(prizeLine(g.key))}</span>` : ''}${g.key === FOOTBALL.game ? `<span class="gt-w gt-f">${esc(footballWords(football))}</span>` : ''}`
  const tiles = GAMES.map(g => `<li class="gt"><a href="${attr(g.href)}">${tileArt(g.key)}<span class="gt-b"><span class="gt-t">${esc(g.title)}</span><span class="gt-p">${esc(g.text)}</span>${prize(g)}<span class="btn y">${esc(g.play)}</span></span></a></li>`).join('')
  // The story of the appeal comes first: the games are in aid of it, and
  // a visitor scrolls through it on the way to them (John, 13 November
  // 2026). A link for a keyboard goes straight to the games.
  //
  // The page opens on the story's picture, with games and giving as its
  // two points (John, 13 November 2026). The picture's room is here in
  // the page from the start, so nothing moves when the page's script
  // fills it with the 3D (client/story): until then, and where 3D will
  // not run, it is a winter's night with the five things drawn in gold.
  const still = ['tables', 'water', 'posts', 'goals', 'covers'].map(key => ICONS[key]).join('')
  return `<a class="skip" href="#games">Skip to the games</a>
<main>
<div class="lead" data-story-root>
<div class="st-stage" data-stage aria-hidden="true">
  <div class="st-still">${still}</div>
  ${snowBand({ w: 800, h: 90, count: 46, seed: 31 })}
</div>
<header class="hero" id="top" data-stop="hello">
  <div class="wrap">
    <div class="wm host">${crestImg({ shown: 96 })}<span>${esc(SITE.host)}</span></div>
    <h1>${esc(SITE.short)} <em>Sports Arcade</em></h1>
    <p class="hero-two"><b>Play.</b> Quick sports games on your phone. Beat a game's target and show your screen at the sports stall to claim a sweet. ${esc(ONE_EACH)}</p>
    <p class="hero-two"><b>Give.</b> Every game is in aid of the PSA's ${esc(APPEAL.name)}, which buys sports equipment for the College.</p>
    <p class="hero-cue">Scroll down for the appeal's story, then the games.</p>
  </div>
  ${snowBand({ w: 1600, h: 90, count: 96 })}
</header>
${appealHtml()}
</div>
<section id="games" class="band deep arcade"><div class="wrap">
  <h2>The <em>games</em></h2>
  <p class="gs-prize mine" data-mine hidden></p>
  <p class="gs-fb mine-fb" data-mine-football role="status" hidden></p>
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
  // The big sign carries the PSA's crest beside its words.
  const sign = CREST ? { ...SITE.sign, badge: CREST.path } : SITE.sign
  return ` data-boards="${attr(JSON.stringify(SITE.boards))}" data-top-sign="${attr(JSON.stringify(sign))}"${ticket ? ` data-ticket="${attr(ticket)}"` : ''}`
}

// Back to the games menu, not to the top of the arcade: the story of the
// appeal is scrolled through once, on arrival. And one line for
// grown-ups on what the games are in aid of.
const appealLine = `<p class="appeal-line">${esc(APPEAL.line)} <a href="/#appeal">${esc(APPEAL.more)}</a></p>`
const more = `<div class="cta"><a class="btn o" href="/#games">More games</a></div>
  ${appealLine}`

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
  return renderShootoutSection(penaltiesConfig(), { id: 'penalties' })
    .replace(' data-shootout=', `${stadiumAttrs(ticket)} data-shootout=`)
    // The line on what the games are in aid of, under the shootout's own way back.
    .replace('<noscript><p class="shootout-status">', `${appealLine}\n      <noscript><p class="shootout-status">`)
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

// A game played only on the stage (in 3D, or drawn flat where the 3D
// will not run): its page is a heading, a line on how to play and the
// place the page's script opens the game from.
//   words  { first, second } the heading, the second word in the accent
//   how    how it is played, by touch
//   keys   how it is played on a keyboard
function stageGameHtml(key, { first, second, how, keys }, { ticket = null } = {}) {
  return `<section id="${key}" class="band deep game"><div class="wrap">
  <div class="eyebrow">Winter Fayre Sports Arcade</div>
  <h2>${esc(first)} <em>${esc(second)}</em></h2>
  <p class="lede">${esc(how)}</p>
  <div class="ku" data-${key}${stadiumAttrs(ticket)}>
    <p class="ku-said" data-game-said role="status">The game is loading.</p>
    <noscript><p class="ku-said">This game needs JavaScript switched on.</p></noscript>
    <p class="hint left">${esc(keys)}</p>
  </div>
  ${more}
</div></section>`
}

const rugbyHtml = (opts) => stageGameHtml('rugby', {
  first: 'Rugby',
  second: 'conversion',
  how: 'Swipe up from the ball to kick it over the bar and between the posts. Mind the wind.',
  keys: 'On a keyboard, the left and right arrows aim, up and down set the power, and Space kicks.',
}, opts)

const netballHtml = (opts) => stageGameHtml('netball', {
  first: 'Netball',
  second: 'shot',
  how: 'Flick the ball up into the ring. A longer flick sends it further. Thirty seconds, as many as you can.',
  keys: 'On a keyboard, the up and down arrows set how far the shot goes, left and right aim it, and Space shoots.',
}, opts)

const cricketHtml = (opts) => stageGameHtml('cricket', {
  first: 'Cricket',
  second: 'smash',
  how: 'The bowler runs in and bowls six balls. Tap once as each ball reaches the bat. Time it well for a four or a six. Miss a straight one and you are out, and the next batter comes in.',
  keys: 'On a keyboard, press Space as the ball reaches the bat.',
}, opts)

const PAGES = { penalties: penaltiesHtml, keepy: keepyHtml, freekick: freeKickHtml, headtohead: headToHeadHtml, rugby: rugbyHtml, netball: netballHtml, cricket: cricketHtml }

// A game's place on its own page, or '' for a game with none.
export function gameHtml(key, opts = {}) {
  return PAGES[key] ? PAGES[key](opts) : ''
}
