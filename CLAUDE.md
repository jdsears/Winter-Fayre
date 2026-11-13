# CLAUDE.md: the Winter Fayre Sports Arcade

**Read `docs/HANDOVER.md` first.** It says what this site is, what John has decided, where things stand and what is left. This file holds the rules; the two agree, and the handover wins on anything this leaves out.

## What this is

A small website of quick sports games for a sports stall at a school Winter Fayre on Saturday 14 November 2026. The stall and the games are in aid of the Parent Staff Association's Sports Fund Appeal: their purpose is to guide parents to donate (John, 13 November 2026). Visitors play on their own phones (a QR code on the stall leads to the site) and a TV at the stall shows the day's leaderboards. Sweets are given as prizes. It is a site and a deployment of its own: a Node 22 service that draws every page on the server, with Vite building the page script and three.js drawing the stadium. No database.

It was built from John's repository `jdsears/morleyu14`, which was read and never changed. Never push to, open pull requests on, or change `jdsears/morleyu14` or `jdsears/football-hub` from here.

```
shared/
  games.js            the arcade's games, one list read by the server and the page script
  appeal.js           the PSA's Sports Fund Appeal: its words, figures and where a gift is made
  prizes.js           the prizes: the score that wins a sweet in each game, one sweet each, and the
                      football for the best keepy-uppies score by 13:30, all set in this one place
server/
  index.js            starts the service (PORT, SITE_ORIGIN, NODE_ENV, NUMBERS_PASSWORD, DATA_DIR)
  app.js              the routes: the pages, the TV screen (/tv) and its code (/qr.svg), the
                      leaderboards (/api/board/<game>, /api/boards), the numbers (/api/count,
                      /numbers), the crest (/media/badge/...), /donate (counts a tap and sends
                      the visitor on to the PSA's page on JustGiving) and /donate/tv (the same
                      for a scan of the code on the stall's TV, counted apart), /health, robots
  site.js             the site's names, the boards' words and the winter colours
  store.js            where the little the site keeps is kept: memory, and a small file if there is a folder
  board.js            the leaderboards: three letters, a score and the time, a board a game a day
  counts.js           the site's own numbers: page views and game plays a day
  security.js         Content-Security-Policy (with a nonce per response) and the other headers
  qr.js               the QR code, drawn as SVG from the site's own address
  crest.js            the PSA's crest, the one picture the site holds (crest/psa.webp)
  render/             the pages: games.js (the arcade and each game's page), appeal.js (the story
                      of the appeal on the arcade page), tv.js (the stall's TV
                      screen, and the appeal's turn on it), pages.js (privacy, not found),
                      numbers.js, layout.js (head, top bar,
                      snow, footer), css.js, html.js
client/               the page script (Vite): main.js, tv.js (the TV screen's turns and refresh),
                      games/ (the full-screen stage the games share, the leaderboard in a finish
                      panel, the prize, the game counts, and flat.js, the stadium drawn flat for
                      a stage game where the 3D will not run), shootout/ (penalties and the 3D
                      stadium, which dresses for each sport), keepy/ (keepy-uppies), freekick/
                      (the free kick challenge), headtohead/ (head to head, drawn flat), rugby/
                      (rugby conversion), netball/ (netball shot), cricket/ (cricket smash),
                      story/ (the appeal's story in 3D on the arcade page, scrolled through),
                      fonts/ (Barlow, OFL)
tests/                node:test server, safety and writing-rule tests
tools/check.mjs       npm run check: Playwright at 360, 375 and 390 wide, sideways, the 3D story, and the TV at 1920 by 1080
docs/HANDOVER.md      what is built, what John has decided, what is left
```

## Commands

```bash
npm install
npm run build        # the page script into dist/
npm run dev          # build, then serve on http://localhost:3000
npm start            # the service (Railway runs this)
npm test             # node:test (server, safety, rules) then vitest (client)
npm run check        # build, then Playwright at 360, 375 and 390 wide, and sideways
```

`npm run check` writes screenshots to `CHECK_SCREENSHOTS` (default `./screenshots`, ignored by git). It uses the Playwright installed on the machine (`require('playwright')`), not a dependency of the site.

## Rules

### Safety and privacy (requirements, not preferences)

This is a school event and children will play.

- The only thing kept from a visitor is a leaderboard entry they choose to add: three letters, a score and the time. Nothing else: no name, no account, no email, nothing about the device. What a phone remembers for itself (a best score, the three letters last used, the sweet it has won, a football code) stays on that phone. Never keep anything else with an entry, never loosen the three letters to free text, and keep the list of refused letters (`server/board.js`).
- The leaderboards are for the day. A new board starts each day (UK time) and the day before is deleted when it does, so nothing is kept after the fayre. They are kept in the service's memory, and in a small file on a Railway volume if one is attached. Do not set up a storage bucket or a database unless John asks.
- No analytics service, no advertising, no third-party cookies, no external fonts or scripts. The site sets no cookie at all. Its own anonymous daily totals of page views and game plays are fine (`server/counts.js`): nothing that identifies a visitor or a device, and a page or a game is counted only under a name fixed in the code. Never add anything to a count that could tell one visitor from another.
- No photos or films of anyone, and no real child, parent or member of staff named anywhere, including tests and screenshots. Invented names only in tests. A test proves the repository holds no picture, film or sound file but the PSA's crest.
- The privacy page (`server/render/pages.js`) says, in a few plain sentences, exactly what the site does. If what the site keeps changes, the page changes in the same piece of work.
- An entry that should not be on show is taken off from the numbers page (`/numbers`, behind `NUMBERS_PASSWORD`): each of today's entries has a Take off button. The button is a plain form, accepted only with the password and only when it comes from the numbers page itself.
- Every page is noindex, and robots.txt turns search engines away.
- The appeal is for parents and carers, and no money is taken on this site. Its one Donate button goes to this site's own `/donate`, which counts the tap as an anonymous total and sends the visitor on to the PSA's page on JustGiving, saying nothing of where they came from. The stall's TV shows a code to scan in the button's place, which leads to this site's own `/donate/tv`: the same, counted apart. No page carries the address of another site to follow. Inside a game, the line about the appeal links to the appeal on the arcade page, never straight to `/donate`: a child with the phone in hand is one step further from where money is given.

### Security

- A strict Content-Security-Policy: self only, a fresh nonce on the one inline style block, no inline script, no style attributes. A form may be sent only from a page that says so, and only to this site.
- Escape every value that is not the site's own fixed words (`server/render/html.js`).
- Never commit secrets. Variable names go in `.env.example` only. Never ask John to paste a password or key into the chat.

### The look and the words

- The site is called "Winter Fayre Sports Arcade". The boards round the pitch read "Wymondham College PSA", "Winter Fayre" and "Sports Fund Appeal", and the big sign carries the first two: John's instructions, 13 November 2026.
- The appeal's words and figures are the PSA's own, from its JustGiving page and the slide John supplied, kept in one place (`shared/appeal.js`). Do not add to them or round them up. The appeal is shown in the PSA's plum and gold; the rest of the site keeps the winter palette.
- On the arcade page the story of the appeal comes before the games menu, so a visitor scrolls through it on the way (John, 13 November 2026). Links back from a game go to the games menu (`/#games`), so it is scrolled through once, on arrival.
- The arcade page is the site's landing page, and its two points are playing and giving (John, 13 November 2026). It opens on the story's picture, at the very top, with the heading under it; the story of the appeal follows, and then the games menu. No button at the head of the page jumps to the games: a visitor scrolls through the story to reach them, as John chose.
- Where a phone can draw 3D, the picture is the story told in 3D as the page is scrolled through (John, 13 November 2026; `client/story/`): it is pinned to the top of the screen and its camera flies to each thing as its words are read. The picture's room is in the page from the start, drawn as a winter's night with the five things in gold, so nothing moves when the 3D arrives and a page without it is still whole. The words are the story: it must never change, move, hide or cover them, or the Donate button. The things on the stage are drawn from plain shapes to look as the College's own do in the slide John supplied, in their own colours (dark blue tables on white frames, white and blue post protectors with the College's name up them, a white box goal on wheels with a square net, blue covers): no photograph, no maker's name, and not the crest. The field round them is dressed as the Winter Fayre's poster is, as John asked when he sent it (13 November 2026): a deep navy night, the poster's teal and gold snowflakes and four-pointed stars hung among the trees, the fayre's navy boards beside the appeal's plum ones, snow under the Christmas trees, lights on them, presents and snowmen.
- The crest of the College's Parent Staff Association is the one picture on the site. John supplied it and has said he has permission to use it (13 November 2026). It is used whole, as he sent it, on its own plum background: on the arcade page, on the TV screen and on the big sign in the stadium (`server/crest.js`). The picture he had was a soft one and he asked for it to be sharpened, so its blur has been undone as far as it can be without leaving marks; nothing was redrawn. Do not crop, recolour or redraw it, and do not put it anywhere else or use the College's colours for the site unless John asks.
- A winter palette after the fayre's poster: deep navy, ice blue, white and a warm gold (`server/site.js`). Every game is winter themed with a splash of Christmas, as John asked: snow, fairy lights, Christmas trees and Christmas hats.
- The games are original, in this site's own drawn style. Do not copy the name, look, characters or layout of any existing commercial game.
- The prizes are set in one place, `shared/prizes.js`: the score that wins a sweet in each game. The finish panel, the arcade's tiles and the TV all read it. A winner is shown John's words: "Show this screen at the sports stall to claim a sweet."
- One sweet each (John, 13 November 2026). The first go on a phone that reaches a game's number wins the sweet; the phone remembers it for the day, shows it on every finish panel and on the arcade page until it is collected, and the stall's helper taps "Stall: sweet given" twice on the winner's phone when it is handed over. All of that is kept in the phone's own storage (`client/games/prize.js`): the site is told nothing, and must never be.
- The football (John, 13 November 2026): the best keepy-uppies score on the leaderboard by 13:30, UK time, wins a FIFA approved football. The leader at the cut-off has won and the board carries on. The phone that added an entry in time is told a four digit code for it, made from the entry and the service's own secret, and keeps it; the numbers page shows the leader's code, and nothing else ever does. Nothing more is kept with an entry for this. The ball is described in words and drawn in the site's own style: no maker's name, logo or photograph.
- British English. No invented claims, names or facts. If words or a picture are missing, leave the space out and ask.
- No em or en dashes, and no spaced hyphens, in content, UI text, comments, docs or commit messages. Scores are written "2 - 2", the one exception.
- Plain English for John, calm in tone, with no exclamation marks, and numbered yes or no questions when he needs to decide something. He is not a coder.
- No model identifiers anywhere in the repository.

### Phones first

Most visitors play on a phone, so that is the main view.

- Every page is checked at 360, 375 and 390 wide by `npm run check`, and the games with a phone on its side at 740 by 360 and 568 by 320.
- On the arcade page the tiles are one column at 360 to 390, two from about 560 and three from about 900. Nothing sits side by side on a phone.
- On a game's page the stage fills the screen. The numbers, the Sound, Music and Leave buttons and the finish panel fit without overlapping, and the finish panel scrolls inside itself if it is taller than the screen.
- Every button and link is at least 44 by 44 pixels. Game controls are larger (Jump in head to head is 88).
- No sideways scrolling, on any page, at any width.
- Head to head asks for the phone to be turned, and locks the touches that would zoom or drag the page.
- Where 3D cannot run, a game falls back to its flat version. The four games from the base each have a flat version of their own. A game made for the stage (rugby and after) hands the stage a small painter, and the stage draws the whole stadium flat for it (`client/games/flat.js`), so it plays the same: the same rules, swipes, finish panel and leaderboard. With reduced motion the snow hangs still and nothing shakes or sweeps.
- No large picture downloads. The tiles are drawn (SVG). The one raster picture is the crest: WebP, 512 pixels square, about eighteen kilobytes, with its width and height set. Anything else raster would be WebP too, sized for its place, with width and height set, and lazy-loaded below the first screen.
- The story's picture takes no more than half a phone's screen and leaves at least 320 pixels for the words under it. It is not filled with the 3D, and not pinned, where 3D will not run, with reduced motion, with no script, on a screen under 480 pixels high, or for a visitor sent straight to the games menu (`/#games`): there it stays the drawn night at the head of the page, and the story reads as its words. Nothing on the page may move when the 3D arrives.
- Barlow, served from the site itself. Body text no smaller than 16 pixels; headings scale with `clamp`.
- The TV page is the one page made for a large screen (1920 by 1080, read from three metres): leaderboard rows' letters at least 40 pixels, the QR code at least 400 pixels square, sized by the screen so a smaller or larger television shows the same picture. After every three leaderboards the appeal fills the screen for ten seconds, with its own code to scan to donate, also at least 400 pixels square (John, 13 November 2026). It must still be usable, stacked, on a phone, and readable with no script.

### Dependencies, services and secrets

- Dependencies: Express, three.js and Vite, with vitest and @babel/parser for tests, and `qrcode-generator` for the QR code, which John agreed to (13 November 2026) and which is used on the server only. Ask John before adding any other dependency or any paid service.

### Branches, pull requests and commits

- Each piece of work goes on its own branch and merges through a pull request whose description has these sections: What this is, Safety and privacy, Mobile, Checks.
- Before every push: `npm test` and `npm run check`.
- GitHub runs both on every pull request and on `main` (`.github/workflows/checks.yml`). Merge only when that run is green.
- John's instruction for this project (13 November 2026): pull requests may be merged by the session that opened them once the checks pass, because the fayre is the next day. `main` must always be something John could use at the stall.
- Keep `docs/HANDOVER.md` up to date with what is built, what John has decided and what is left.
