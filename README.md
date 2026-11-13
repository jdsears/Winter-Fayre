# Winter Fayre Sports Arcade

Quick sports games to play on a phone at the Winter Fayre, with a leaderboard for the day for every game and a screen for the stall's TV (`/tv`: a QR code to scan and the leaderboards taking turns). A small Node 22 service draws every page on the server; the games are added on top and played in the visitor's browser.

Start with `docs/HANDOVER.md`, then `CLAUDE.md` for the rules.

```bash
npm install
npm run dev     # http://localhost:3000
npm test
npm run check   # Playwright at 360, 375 and 390 wide, and sideways
```

On Railway: `railway.toml` installs with `npm ci`, builds with `npm run build`, starts with `npm start` and checks `/health`. Set `NODE_ENV`, `NUMBERS_PASSWORD` and `SITE_ORIGIN` (see `.env.example`). Attach a volume to keep the day's leaderboards through a restart.
