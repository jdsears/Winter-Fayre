// Tells the site that a game was started or finished, for its own
// numbers (server/counts.js). Only the game and which of the two is
// sent: no cookie, and nothing about the visitor or their device. If it
// cannot be sent, nothing happens: the game does not depend on it.

import { GAME_KEYS } from '../../shared/games.js'

export const GAMES = GAME_KEYS

export function tally(game, moment, win = globalThis.window) {
  if (!GAMES.includes(game) || (moment !== 'play' && moment !== 'done')) return false
  try {
    win.fetch('/api/count', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game, moment }),
      keepalive: true,
    }).catch(() => {})
    return true
  } catch {
    return false
  }
}
