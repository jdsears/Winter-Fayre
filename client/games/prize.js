// The prize on a game's finish panel (shared/prizes.js sets the numbers).
//
// A go that reaches its game's number is told to show the screen at the
// sports stall, with the time it was won, so the stall can see it is this
// go and not an old picture of one. A go that falls short is told what
// to aim for.

import { prizeFor } from '../../shared/prizes.js'

// 'Won at 10:42' in the visitor's own time.
export function wonAt(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0')
  return `Won at ${two(now.getHours())}:${two(now.getMinutes())}`
}

// Fills the prize's place in a finish panel for a game and a score.
// Returns what was said, for a screen reader, or '' when nothing was.
export function drawPrize(doc, into, game, score, now = new Date()) {
  const prize = prizeFor(game, score)
  while (into.firstChild) into.removeChild(into.firstChild)
  if (!prize) {
    into.setAttribute('hidden', '')
    return ''
  }
  const add = (tag, cls, text) => {
    const node = doc.createElement(tag)
    if (cls) node.className = cls
    node.textContent = text
    into.appendChild(node)
    return node
  }
  into.removeAttribute('hidden')
  into.className = prize.won ? 'gs-prize won' : 'gs-prize'
  if (prize.won) {
    add('b', '', 'You have won a sweet')
    add('span', '', prize.words)
    add('span', 't', wonAt(now))
    return `You have won a sweet. ${prize.words}`
  }
  add('span', '', prize.words)
  return prize.words
}

// Empties the prize's place, for the next go.
export function clearPrize(into) {
  while (into.firstChild) into.removeChild(into.firstChild)
  into.setAttribute('hidden', '')
}
