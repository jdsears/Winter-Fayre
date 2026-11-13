# CLAUDE.md: the Winter Fayre Sports Arcade

**Read `docs/HANDOVER.md` first.** It says what this site is, what John has decided, where things stand and what is left. This file holds the rules; the two agree, and the handover wins on anything this leaves out.

## What this is

A small website of quick sports games for a sports stall at a school Winter Fayre on Saturday 14 November 2026. Visitors play on their own phones (a QR code on the stall leads to the site) and a TV at the stall shows the day's leaderboards. Sweets are given as prizes. It is a site and a deployment of its own: a Node 22 service that draws every page on the server, with Vite building the page script and three.js drawing the stadium. No database.

It was built from John's repository `jdsears/morleyu14`, which was read and never changed. Never push to, open pull requests on, or change `jdsears/morleyu14` or `jdsears/football-hub` from here.

```
shared/
  games.js            the arcade's games, one list read by the server and the page script
  prizes.js           the sweets: the score that wins one in each game, set in this one place
server/
  index.js            starts the service (PORT, SITE_ORIGIN, NODE_ENV, NUMBERS_PASSWORD, DATA_DIR)
  app.js              the routes: the pages, the TV screen (/tv) and its code (/qr.svg), the
                      leaderboards (/api/board/<game>, /api/boards), the numbers (/api/count,
                      /numbers), /health, robots
  site.js             the site's names, the boards' words and the winter colours
  store.js            where the little the site keeps is kept: memory, and a small file if there is a folder
  board.js            the leaderboards: three letters, a score and the time, a board a game a day
  counts.js           the site's own numbers: page views and game plays a day
  security.js         Content-Security-Policy (with a nonce per response) and the other headers
  qr.js               the QR code, drawn as SVG from the site's own address
  render/             the pages: games.js (the arcade and each game's page), tv.js (the stall's TV
                      screen), pages.js (privacy, not found), numbers.js, layout.js (head, top bar,
                      snow, footer), css.js, html.js
client/               the page script (Vite): main.js, tv.js (the TV screen's turns and refresh),
                      games/ (the full-screen stage the games share, the leaderboard in a finish
                      panel, the game counts), shootout/ (penalties and the 3D stadium), keepy/
                      (keepy-uppies), freekick/ (the free kick challenge), headtohead/ (head to
                      head, drawn flat), fonts/ (Barlow, OFL)
tests/                node:test server, safety and writing-rule tests
tools/check.mjs       npm run check: Playwright at 360, 375 and 390 wide, sideways, and the TV at 1920 by 1080
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

- The only thing kept from a visitor is a leaderboard entry they choose to add: three letters, a score and the time. Nothing else: no name, no account, no email, nothing about the device. Never keep anything else with an entry, never loosen the three letters to free text, and keep the list of refused letters (`server/board.js`).
- The leaderboards are for the day. A new board starts each day (UK time) and the day before is deleted when it does, so nothing is kept after the fayre. They are kept in the service's memory, and in a small file on a Railway volume if one is attached. Do not set up a storage bucket or a database unless John asks.
- No analytics service, no advertising, no third-party cookies, no external fonts or scripts. The site sets no cookie at all. Its own anonymous daily totals of page views and game plays are fine (`server/counts.js`): nothing that identifies a visitor or a device, and a page or a game is counted only under a name fixed in the code. Never add anything to a count that could tell one visitor from another.
- No photos or films of anyone, and no real child, parent or member of staff named anywhere, including tests and screenshots. Invented names only in tests. A test proves the repository holds no picture, film or sound file.
- The privacy page (`server/render/pages.js`) says, in a few plain sentences, exactly what the site does. If what the site keeps changes, the page changes in the same piece of work.
- An entry that should not be on show is taken off from the numbers page (`/numbers`, behind `NUMBERS_PASSWORD`): each of today's entries has a Take off button. The button is a plain form, accepted only with the password and only when it comes from the numbers page itself.
- Every page is noindex, and robots.txt turns search engines away.

### Security

- A strict Content-Security-Policy: self only, a fresh nonce on the one inline style block, no inline script, no style attributes. A form may be sent only from a page that says so, and only to this site.
- Escape every value that is not the site's own fixed words (`server/render/html.js`).
- Never commit secrets. Variable names go in `.env.example` only. Never ask John to paste a password or key into the chat.

### The look and the words

- The site is called "Winter Fayre Sports Arcade". The boards round the pitch read "Wymondham College PSA" and "Winter Fayre", and the big sign carries both: John's instruction, 13 November 2026.
- The College's crest is not used until John supplies the file. He has said he has permission. Until then the site is words only.
- A winter palette after the fayre's poster: deep navy, ice blue, white and a warm gold (`server/site.js`). Every game is winter themed with a splash of Christmas, as John asked: snow, fairy lights, Christmas trees and Christmas hats.
- The games are original, in this site's own drawn style. Do not copy the name, look, characters or layout of any existing commercial game.
- The prizes are set in one place, `shared/prizes.js`: the score that wins a sweet in each game. The finish panel, the arcade's tiles and the TV all read it. A winner is shown John's words: "Show this screen at the sports stall to claim a sweet."
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
- Where 3D cannot run, a game falls back to its flat version. With reduced motion the snow hangs still and nothing shakes or sweeps.
- No large picture downloads. The tiles are drawn (SVG). Anything raster would be WebP, sized for its place, with width and height set, and lazy-loaded below the first screen.
- Barlow, served from the site itself. Body text no smaller than 16 pixels; headings scale with `clamp`.
- The TV page is the one page made for a large screen (1920 by 1080, read from three metres): leaderboard rows' letters at least 40 pixels, the QR code at least 400 pixels square, sized by the screen so a smaller or larger television shows the same picture. It must still be usable, stacked, on a phone, and readable with no script.

### Dependencies, services and secrets

- Dependencies: Express, three.js and Vite, with vitest and @babel/parser for tests, and `qrcode-generator` for the QR code, which John agreed to (13 November 2026) and which is used on the server only. Ask John before adding any other dependency or any paid service.

### Branches, pull requests and commits

- Each piece of work goes on its own branch and merges through a pull request whose description has these sections: What this is, Safety and privacy, Mobile, Checks.
- Before every push: `npm test` and `npm run check`.
- GitHub runs both on every pull request and on `main` (`.github/workflows/checks.yml`). Merge only when that run is green.
- John's instruction for this project (13 November 2026): pull requests may be merged by the session that opened them once the checks pass, because the fayre is the next day. `main` must always be something John could use at the stall.
- Keep `docs/HANDOVER.md` up to date with what is built, what John has decided and what is left.
