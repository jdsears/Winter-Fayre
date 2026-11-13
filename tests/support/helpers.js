// Shared by the server tests: the app on a free port, with its
// leaderboards and numbers kept in memory and a clock a test can move.

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp, COUNTED } from '../../server/app.js'
import { createStore } from '../../server/store.js'
import { createBoards } from '../../server/board.js'
import { createCounts } from '../../server/counts.js'
import { GAMES } from '../../shared/games.js'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const quiet = { log() {}, warn() {}, error() {} }

// Every page a visitor can ask for.
export const PAGES = ['/', ...GAMES.map(g => g.path), '/privacy']

// Saturday 14 November 2026, ten in the morning: the fayre opens.
export const FAYRE = Date.UTC(2026, 10, 14, 10, 0, 0)

// The app on a free port. clock is { now } in milliseconds, moved by the
// test; store is where things are kept (memory unless one is given).
export async function startApp({ clock = { now: FAYRE }, store = createStore({ log: quiet }), origin = 'https://arcade.example', appOptions = {} } = {}) {
  const now = () => clock.now
  const boards = createBoards({ store, now })
  const counts = createCounts({ store, pages: Object.keys(COUNTED), now, log: quiet })
  const app = createApp({ origin, store, boards, counts, log: quiet, ...appOptions })
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const port = server.address().port
  return {
    base: `http://127.0.0.1:${port}`,
    clock,
    store,
    boards,
    counts,
    get: (p, init) => request(port, p, init),
    post: (p, body, headers = {}) => request(port, p, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (test)', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }),
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

// A request with any headers, answered as a small Response-like object.
// Paths are sent as written, never tidied, as an attacker would send them.
export function request(port, p, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        const h = new Headers()
        for (const [k, v] of Object.entries(res.headers)) h.set(k, Array.isArray(v) ? v.join(', ') : v)
        resolve({ status: res.statusCode, headers: h, text: async () => buf.toString('utf8'), json: async () => JSON.parse(buf.toString('utf8')), body: buf })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// A browser's request, as a person's phone would send it.
export const PERSON = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' }
