// The game's words: the banners, the prompts and hints, and what the
// live region says after each kick. British English, no dashes.

import { standing } from './rules.js'

export const BANNERS = {
  goal: 'GOAL!',
  saved: 'SAVED!',
  post: 'POST!',
  bar: 'CROSSBAR!',
  over: 'OVER!',
  wide: 'WIDE!',
}

// The banner for an outcome: the word, a line under it, and whether it
// is good news for the visitor.
export function banner(side, outcome, { opponentName, switched = false, woodwork = null, topCorner = false, wrongWay = false, caught = false } = {}) {
  const word = BANNERS[outcome] || ''
  if (side === 'us') {
    const sub = outcome === 'goal'
      ? (woodwork === 'post' ? 'In off the post' : woodwork === 'bar' ? 'In off the bar' : topCorner ? 'Top corner' : wrongWay ? 'Sent the wrong way' : '')
      : outcome === 'saved' ? (caught ? 'Held by the keeper' : 'The keeper keeps it out') : ''
    return { word, sub, good: outcome === 'goal' }
  }
  const sub = outcome === 'goal'
    ? (switched ? 'Too early. They saw you go' : `${opponentName} score`)
    : outcome === 'saved' ? (caught ? 'Safe hands' : 'What a save') : ''
  return { word, sub, good: outcome !== 'goal' }
}

const OURS = {
  goal: 'Goal!',
  saved: 'Saved by the keeper.',
  post: 'Off the post.',
  bar: 'Off the crossbar.',
  over: 'Over the bar.',
  wide: 'Wide.',
}
const THEIRS = {
  goal: (n) => `${n} score.`,
  saved: () => 'Saved! You kept it out.',
  post: () => 'They hit the post.',
  bar: () => 'They hit the crossbar.',
  over: () => 'They put it over the bar.',
  wide: () => 'They put it wide.',
}

// What the live region says once a kick is done, with the score.
export function outcomeWords(side, outcome, state, opponentName, { switched = false } = {}) {
  const what = side === 'us' ? OURS[outcome] : THEIRS[outcome](opponentName)
  const early = side === 'them' && switched && outcome === 'goal' ? ' You went too early.' : ''
  return `${what}${early} ${standing(state, opponentName)}`
}

export function promptFor(side, { round, suddenDeath }) {
  return {
    title: side === 'us' ? 'Your kick' : 'Your save',
    eyebrow: suddenDeath ? 'Sudden death' : `Penalty ${round} of 5`,
  }
}

export function hintFor(side, touch, renderer = '3d') {
  if (renderer === '2d') {
    return side === 'us'
      ? (touch ? 'Tap where to shoot in the goal.' : 'Click where to shoot, or aim with the arrows and hold Space.')
      : (touch ? 'Tap where to dive as they strike.' : 'Click or press an arrow for where to dive as they strike.')
  }
  if (side === 'us') {
    return touch
      ? 'Swipe from the ball to where you want it in the goal. Faster hits harder.'
      : 'Drag up from the ball, or aim with the arrows and hold Space.'
  }
  return touch
    ? 'Watch the taker, then swipe or tap a side as they strike.'
    : 'Watch the taker, then press an arrow as they strike.'
}

export function turnWords(side, { round, suddenDeath }) {
  const which = suddenDeath ? 'Sudden death.' : `Penalty ${round} of 5.`
  return side === 'us' ? `${which} Your kick.` : `${which} Your save. Here comes the taker.`
}
