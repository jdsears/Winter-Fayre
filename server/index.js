// Starts the site. Railway sets PORT; the rest are the site's own
// variables (.env.example lists them):
//
//   SITE_ORIGIN       the site's full address, for the QR code on the TV
//   NODE_ENV          production on Railway: HTTPS only, and the stricter headers
//   NUMBERS_PASSWORD  the password for /numbers; without it the page is not there
//   DATA_DIR          a folder to keep the day's leaderboards and numbers in
//
// Railway also tells the service where its volume is, if one is
// attached (RAILWAY_VOLUME_MOUNT_PATH), and its public address
// (RAILWAY_PUBLIC_DOMAIN); each is used when its own variable is not set.

import { createApp, COUNTED } from './app.js'
import { createStore } from './store.js'
import { createBoards } from './board.js'
import { createCounts, FLUSH_MS } from './counts.js'

const env = process.env
const production = env.NODE_ENV === 'production'
const port = Number(env.PORT) || 3000

// The site's own address: what John set, else the address Railway gave
// the service, else this computer.
function siteOrigin() {
  const given = String(env.SITE_ORIGIN || '').trim().replace(/\/+$/, '')
  if (/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(given)) return given
  if (given) console.warn('SITE_ORIGIN is not a full address (it should look like https://example.up.railway.app). It is being ignored.')
  if (/^[a-z0-9.-]+$/i.test(env.RAILWAY_PUBLIC_DOMAIN || '')) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`
  return `http://localhost:${port}`
}
const origin = siteOrigin()
console.log(`The site's address, for the QR code: ${origin}`)

const dir = env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || null
const store = createStore({ dir })
console.log(store.kind === 'file'
  ? `The leaderboards and the numbers are kept in ${store.dir}, so a restart keeps the day.`
  : 'The leaderboards and the numbers are kept in memory only: a restart starts them again. Attach a volume to keep the day.')

const boards = createBoards({ store })
const counts = createCounts({ store, pages: Object.keys(COUNTED) })
const flushCounts = () => counts.flush().catch(err => console.warn(`Numbers: ${err.message}`))
setInterval(flushCounts, FLUSH_MS).unref()
console.log(env.NUMBERS_PASSWORD ? 'The numbers page is at /numbers.' : 'Set NUMBERS_PASSWORD to read the numbers at /numbers.')

const app = createApp({ origin, production, store, boards, counts, numbersPassword: env.NUMBERS_PASSWORD || null })
const server = app.listen(port, () => console.log(`Listening on port ${port}`))

function stop() {
  // What has been counted this minute is written out before stopping.
  flushCounts().finally(() => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
