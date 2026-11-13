# Handover: the Winter Fayre Sports Arcade

A small website of quick sports games for John's sports stall at the Winter Fayre on Saturday 14 November 2026. Visitors play on their own phones, reached by a QR code on the stall, and a TV at the stall shows the day's leaderboards. Sweets are given as prizes. The point is engagement: a conversation starter about sport.

The repository is **jdsears/Winter-Fayre**. Work only in it. It was built from `jdsears/morleyu14`, which was read and never changed.

## What John has decided

1. **One more dependency, for the QR code** (13 November 2026). `qrcode-generator`, used on the server only, so the QR code is drawn from the site's own address.
2. **The boards read "Wymondham College PSA" and "Winter Fayre"** (13 November 2026). John's instruction for the signage. The big sign across the stand carries both.
3. **The College's crest and colours** (13 November 2026). John has said he has permission and will supply the crest file. Until it arrives the site uses words only, in a winter palette after the fayre's poster: deep navy, ice blue, white and a warm gold.
4. **Every game is winter themed with a splash of Christmas** (13 November 2026). The stadium is a winter night: stars, falling snow, snow on the boards, fairy lights, a Christmas tree either side of the goal, and Christmas hats in the crowd and on the keeper. The visitor's player wears a Christmas red with white trim, the keeper an elf's green. The games' tune is the chorus of Jingle Bells, made on the spot like the rest of the sound.
5. **Pull requests may be merged once the checks pass** (13 November 2026). For this project only, because the fayre is the next day.
6. **The prizes are harder than first suggested: 80%** (13 November 2026). Read as: four of five penalties, eight of ten free kicks, and the same step up for the games that have no fixed number. They sit in one file so they are easy to change.

## What is built

- **The arcade** at `/`: a heading, then a picture tile for each game with a Play button. This is where the QR code lands.
- **Four games**, each on a page of its own and played full screen:
  1. Penalties (`/penalties`): five kicks each, always all five, then sudden death if it is level.
  2. Keepy-uppies (`/keepy-uppies`).
  3. Free kick challenge (`/free-kicks`): ten kicks.
  4. Head to head (`/head-to-head`): one against one for sixty seconds, with the phone held sideways.
- **A leaderboard for the day for every game**: three letters and a score, the top ten shown and the top fifty one tap away. Penalties counts goals and saves; keepy-uppies counts touches; free kicks counts goals; head to head counts wins in a row.
- **The privacy page** at `/privacy`.
- **The numbers** at `/numbers`, behind `NUMBERS_PASSWORD`: anonymous daily totals of page views and games started and finished.

## How the day is kept

The leaderboards and the numbers are kept in the service's memory. If a Railway volume is attached they are also written to small files on it, so a restart or a new deploy does not wipe the day. Without a volume everything still works, but a restart starts the leaderboards again. A new leaderboard starts each day (UK time) and the day before is deleted, so nothing is left after the fayre.

## Deployment

- **Railway**, a new project from this repository. `railway.toml` installs with `npm ci`, builds with `npm run build`, starts with `npm start` and checks `/health`.
- **Variables:** `NODE_ENV=production`, `NUMBERS_PASSWORD` (John chooses it and sets it himself) and `SITE_ORIGIN` (the site's full address, for the QR code). If `SITE_ORIGIN` is left out, the address Railway gave the service is used.
- **Optional:** a volume, mounted anywhere (for example `/data`). The service finds it by itself.

## What is left

In the order John asked for, each shipped before the next is started:

1. The `/tv` page and the QR code.
2. Prize messages on each finish panel, and a way to take a leaderboard entry off from the numbers page.
3. Rugby conversion.
4. Netball shot.
5. Cricket smash.

Also waiting on John: the crest file, if he wants it on the big sign and the arcade page.

## Working rules

See `CLAUDE.md`. In short: phones first; three letters and a score and nothing else; no trackers, no cookies, nothing from other sites; British English with no dashes; `npm test` and `npm run check` before every push; a pull request for each piece of work.
