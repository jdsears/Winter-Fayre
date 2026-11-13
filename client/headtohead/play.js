// Head to head on the page (server/render/games.js draws its place):
// the rules (rules.js) played full screen, from the side, in a drawn
// stadium with the site's partners on the boards, the big sign in the
// stand and the games' sound.
//
// It is played with the phone held sideways: upright, it asks for the
// phone to be turned and waits. Four buttons, two under each thumb, run
// left and right, jump and kick; the arrow keys and Space do the same.
// Nothing is sent anywhere unless the visitor adds a run of wins to the
// leaderboard (games/board.js), and then only three letters, the run and
// the ticket.

import {
  W, H, GROUND, GOAL_D, BAR, BALL_R, HEAD_R, BODY_R, MATCH_SECONDS, FIRST_SKILL,
  HEAD_UP, BODY_UP, POWER_NAMES, sizeOf, ballR, barOf,
  newMatch, step, result, bootOf, computerInputs, newMind, nextSkill, afterMatch, readStreak, readBest,
} from './rules.js'
import { createAudio } from '../shootout/audio.js'
import { themeColours } from '../shootout/config.js'
import { kits as makeKits } from '../shootout/kit.js'
import { pageColours } from '../shootout/index.js'
import { prefersReducedMotion } from '../shootout/motion.js'
import { lookAt } from '../shootout/looks.js'
import { CHARACTERS, characterById, pickOpponent, readCharacter, keepCharacter, drawHead } from './characters.js'
import { mix } from '../shootout/colour.js'
import { boardLogosFrom, loadBoardLogos, logoReady, logoBox, topSignFrom, loadTopSign, drawTopSign } from '../shootout/boards.js'
import { boardsFrom, lockTouch } from '../games/stage.js'
import { tally } from '../games/count.js'
import { readRun, keepRun, placeOf } from './run.js'
import { othersFor, MENU } from '../../shared/games.js'
import { appealLine } from '../games/appeal.js'
import { drawPrize, clearPrize } from '../games/prize.js'
import { INITIALS_KEY, SAID, drawBoard, drawForm, fetchBoard, ordinal, sendGo, tidyInitials, wouldMake } from '../games/board.js'

const BOARD_PATH = '/api/board/headtohead'
const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif'
// Where the boards along the front of the stand stand, down the drawing.
const BOARDS = GROUND - 90
// The far and the near touchline, down the drawing: the players stand
// between them.
const FAR = GROUND - 30
const NEAR = GROUND + 26

function el(doc, tag, attrs = {}, ...children) {
  const node = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue
    if (k === 'class') node.className = v
    else if (k === 'hidden') node.hidden = Boolean(v)
    else node.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c)
  return node
}

// The clock as it is shown: whole seconds, counting down.
export const clockText = (seconds) => String(Math.max(0, Math.ceil(seconds)))

// The crowd's places in the stand, the same every time.
export function crowdSeats() {
  const seats = []
  let seed = 20261112
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let row = 0; row < 10; row++) {
    for (let i = 0; i < 56; i++) {
      if (rnd() < 0.1) continue
      seats.push({ x: 6 + i * 14.3 + (rnd() - 0.5) * 5, y: 48 + row * 17, tone: Math.floor(rnd() * 8), skin: Math.floor(rnd() * 5), phase: rnd() * 6.28, jumpy: rnd() < 0.7 })
    }
  }
  return seats
}

export function playHeadToHead(root, win = window) {
  const doc = win.document
  const store = (() => { try { return win.localStorage } catch { return null } })()
  const reduce = prefersReducedMotion(win)
  const colours = themeColours(null, pageColours(doc))
  const kits = makeKits(colours)
  const audio = createAudio(win)
  const boards = boardsFrom(root)
  const logos = loadBoardLogos(boardLogosFrom(doc), { win })
  const sign = topSignFrom(doc)
  const signPics = loadTopSign(sign, { win })
  const seats = crowdSeats()
  // Winter coats, in the site's colours and Christmas red and green.
  const tones = [mix(colours.primary, '#ffffff', 0.25), colours.accent, '#ffffff', '#c8102e', '#1e9e57', '#8fd6e8', '#2b2f3a', mix(colours.primary, '#ffffff', 0.5)]
  // Falling snow, in the drawing's own units. With reduced motion it
  // hangs still.
  const flakes = Array.from({ length: 80 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 61.7) % 330, r: 1.2 + (i % 4) * 0.55, v: 22 + (i % 5) * 7, p: i * 1.7 }))
  const BULBS = ['#ff4d4d', '#3fe07a', '#ffd166', '#5cc8ff', '#ffffff']
  const skins = [0, 1, 2, 3, 4].map(i => lookAt(i).skin)
  // The visitor's player is the one they picked; the computer's is one
  // of the rest, picked afresh for each match.
  const picked = readCharacter(store)
  const me = { kit: kits.home, c: characterById(picked) }
  const them = { kit: kits.away, c: pickOpponent(me.c.id) }

  // ── The page ──────────────────────────────────────────────────────────
  const canvas = el(doc, 'canvas', { class: 'hh-view' })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const pitch = el(doc, 'div', { class: 'gs-pitch hh-pitch', tabindex: '0', role: 'img', 'aria-label': 'Head to head: the pitch' }, canvas)
  const scoreL = el(doc, 'b', {}, '0')
  const scoreR = el(doc, 'b', {}, '0')
  const clock = el(doc, 'b', { class: 'hh-clock' }, clockText(MATCH_SECONDS))
  // The three powers, each a button with its picture, used once a match.
  const powerArt = {
    invisible(g) {
      g.setLineDash([5, 5]); g.strokeStyle = '#ffffff'; g.lineWidth = 3
      g.beginPath(); g.arc(22, 22, 12, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
      g.fillStyle = '#ffffff55'; g.beginPath(); g.arc(22, 22, 5, 0, Math.PI * 2); g.fill()
    },
    big(g) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(25, 20, 13, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#ffffff99'; g.beginPath(); g.arc(11, 31, 6, 0, Math.PI * 2); g.fill()
    },
    flame(g) {
      g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(22, 4); g.bezierCurveTo(36, 16, 38, 28, 22, 40); g.bezierCurveTo(6, 28, 10, 18, 16, 14); g.bezierCurveTo(17, 20, 20, 20, 22, 4); g.fill()
      g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(22, 20); g.bezierCurveTo(29, 27, 28, 34, 22, 38); g.bezierCurveTo(15, 34, 16, 28, 22, 20); g.fill()
    },
    giant(g) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(22, 22, 17, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#0c1626'; g.beginPath()
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; g.lineTo(22 + Math.cos(a) * 7, 22 + Math.sin(a) * 7) }
      g.closePath(); g.fill()
    },
    curler(g) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round'
      g.beginPath(); g.moveTo(8, 36); g.quadraticCurveTo(14, 2, 34, 22); g.stroke()
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(38, 28); g.lineTo(27, 26); g.lineTo(35, 17); g.closePath(); g.fill()
    },
    wall(g) {
      g.fillStyle = '#e0703f'
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(6 + c * 11 + (r % 2 ? -5 : 0), 8 + r * 8, 10, 7)
    },
    small(g) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round'
      g.beginPath(); g.moveTo(10, 36); g.lineTo(10, 22); g.lineTo(34, 22); g.lineTo(34, 36); g.stroke()
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(22, 18); g.lineTo(15, 8); g.lineTo(29, 8); g.closePath(); g.fill()
    },
    freeze(g) {
      g.strokeStyle = '#9fe3ff'; g.lineWidth = 3.5; g.lineCap = 'round'
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; g.beginPath(); g.moveTo(22 - Math.cos(a) * 16, 22 - Math.sin(a) * 16); g.lineTo(22 + Math.cos(a) * 16, 22 + Math.sin(a) * 16); g.stroke() }
    },
    swap(g) {
      g.strokeStyle = '#ffe14d'; g.lineWidth = 6; g.lineCap = 'round'
      g.beginPath(); g.arc(22, 16, 15, 0.35, Math.PI - 0.35); g.stroke()
      g.fillStyle = '#6b4a1a'; g.beginPath(); g.arc(8, 22, 2.5, 0, Math.PI * 2); g.arc(36, 22, 2.5, 0, Math.PI * 2); g.fill()
    },
  }
  // Three buttons, one for each power dealt for the match in hand.
  const powerButtons = [0, 1, 2].map(() => el(doc, 'button', { type: 'button', class: 'hh-pow' }, el(doc, 'canvas', { width: '88', height: '88', 'aria-hidden': 'true' })))
  function dealButtons(names) {
    powerButtons.forEach((b, i) => {
      const name = names[i]
      b.hidden = !name
      if (!name) return
      b.disabled = false
      b.setAttribute('data-power', name)
      b.setAttribute('aria-label', `${POWER_NAMES[name]}, once a match. Key ${i + 1}.`)
      b.setAttribute('title', POWER_NAMES[name])
      const g = b.firstChild.getContext('2d')
      if (!g) return
      g.setTransform(2, 0, 0, 2, 0, 0)
      g.clearRect(0, 0, 44, 44)
      powerArt[name]?.(g)
    })
  }
  const pows = el(doc, 'div', { class: 'hh-pows', role: 'group', 'aria-label': 'Your powers' }, ...powerButtons)
  const score = el(doc, 'p', { class: 'hh-score' }, el(doc, 'span', {}, 'You'), scoreL, clock, scoreR, el(doc, 'span', {}, 'The Snowmen'))
  const soundState = el(doc, 'span', { class: 'gs-on' }, 'Off')
  const sound = el(doc, 'button', { type: 'button', class: 'gs-b', role: 'switch', 'aria-checked': 'false' }, 'Sound ', soundState)
  const musicState = el(doc, 'span', { class: 'gs-on' }, 'On')
  const musicSwitch = el(doc, 'button', { type: 'button', class: 'gs-b', role: 'switch', 'aria-checked': 'true' }, 'Music ', musicState)
  const leave = el(doc, 'a', { class: 'gs-b', href: MENU }, 'Leave')
  const banner = el(doc, 'p', { class: 'gs-banner hh-banner', 'aria-hidden': 'true', hidden: true })
  const white = el(doc, 'div', { class: 'hh-flash', 'aria-hidden': 'true' })
  const prompt = el(doc, 'p', { class: 'gs-prompt hh-prompt', hidden: !picked }, 'Tap to kick off')
  const key = (name, label, cls) => el(doc, 'button', { type: 'button', class: `hh-key ${cls}`, 'data-in': name, 'aria-label': label }, el(doc, 'span', { 'aria-hidden': 'true' }, { left: '◀', right: '▶', jump: 'Jump', kick: 'Low', lob: 'High' }[name]))
  const padL = el(doc, 'div', { class: 'hh-pad hh-pad-l' }, key('left', 'Run left', 'ar'), key('right', 'Run right', 'ar'))
  const padR = el(doc, 'div', { class: 'hh-pad hh-pad-r' }, key('kick', 'Low kick', 'wd'), key('lob', 'High kick', 'wd'), key('jump', 'Jump', 'wd'))
  const turn = el(doc, 'div', { class: 'hh-turn' },
    el(doc, 'div', { class: 'hh-phone', 'aria-hidden': 'true' }),
    el(doc, 'p', {}, 'Turn your phone sideways to play'),
    el(doc, 'a', { class: 'btn o', href: MENU }, 'Back to the games'))
  const endTitle = el(doc, 'h2', { class: 'gs-end-t' })
  const endLine = el(doc, 'p', { class: 'gs-end-l' })
  const endExtra = el(doc, 'div', { class: 'gs-extra' })
  // Where the prize is said: to a winner, to show the screen at the stall.
  const endPrize = el(doc, 'p', { class: 'gs-prize', hidden: true })
  const again = el(doc, 'button', { type: 'button', class: 'btn y' }, 'Play again')
  const change = el(doc, 'button', { type: 'button', class: 'gs-lbm' }, 'Change player')
  // The players to pick from: each a button with its head drawn on it.
  const options = CHARACTERS.map((c) => {
    const face = el(doc, 'canvas', { width: '132', height: '132', 'aria-hidden': 'true' })
    const g = face.getContext('2d')
    if (g) { g.scale(2, 2); drawHead(g, c, 33, 37, 22, 1, { ink: colours.ink }) }
    return el(doc, 'button', { type: 'button', class: 'hh-face', 'data-player': c.id, 'aria-pressed': String(c.id === me.c.id), 'aria-label': `The player with ${c.label}` }, face)
  })
  const go = el(doc, 'button', { type: 'button', class: 'btn y' }, 'Kick off')
  const pick = el(doc, 'div', { class: 'hh-pick', hidden: Boolean(picked) }, el(doc, 'h2', { class: 'gs-end-t' }, 'Pick your player'), el(doc, 'div', { class: 'hh-faces', role: 'group', 'aria-label': 'Players' }, ...options), go)
  const end = el(doc, 'div', { class: 'gs-end hh-end', hidden: true }, endTitle, endLine, endPrize, again, change, endExtra,
    el(doc, 'p', { class: 'gs-more' }, ...othersFor('headtohead').map(o => el(doc, 'a', { class: 'btn o', href: o.href }, o.label))),
    // And, last, what the games are in aid of.
    appealLine(doc).root)
  const status = el(doc, 'p', { class: 'vh', role: 'status' })
  const shell = el(doc, 'div', { class: 'gs hh', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Head to head' },
    pitch, el(doc, 'div', { class: 'gs-top hh-top' }, score, pows, el(doc, 'div', { class: 'gs-btns' }, sound, musicSwitch, leave)),
    white, banner, prompt, padL, padR, end, pick, turn, status)
  if (reduce) shell.setAttribute('data-reduced', 'true')
  doc.body.append(shell)
  doc.documentElement.classList.add('gs-open')
  const unlockTouch = lockTouch(shell, win)
  try { win.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open: true } })) } catch { /* old browser */ }

  // ── The match ─────────────────────────────────────────────────────────
  let match = newMatch()
  dealButtons(Object.keys(match.powers.left))
  let mind = newMind()
  let skill = FIRST_SKILL
  let started = false
  let streak = readStreak(store)
  let best = readBest(store)
  let cheerUntil = 0
  let shake = 0
  let bits = []
  // Fireworks waiting to go up, their sparks, the rings where a header
  // was met, how each net was last hit and how squashed the ball is.
  let rockets = []
  let sparks = []
  let pops = []
  const nets = { '-1': { power: 0, y: 0, at: -9 }, 1: { power: 0, y: 0, at: -9 } }
  let squash = 0
  // The power the visitor has just asked for, and the flames behind a
  // ball that is alight.
  let want = null
  let flames = []
  let now = 0
  let last = 0
  let raf = 0
  let bannerTimer = 0
  const held = { left: false, right: false, jump: false, kick: false, lob: false }
  const upright = () => { try { return win.matchMedia('(orientation: portrait)').matches } catch { return false } }

  // The leaderboard: a run of wins can be added after any win. The run
  // began after the ticket in hand was handed out, so the ticket is kept
  // until it is used. Once a run is on the board (posted), the site's
  // answer carries a ticket for that entry, and each win after sends the
  // run again with it, so the entry grows without being asked for twice.
  // When the run ends, the next one starts with the newest plain ticket.
  let ticket = root.getAttribute('data-ticket') || null
  const boardOn = Boolean(ticket)
  let fresh = null
  let posted = boardOn ? readRun(store, streak) : null
  if (posted) ticket = posted.ticket
  else keepRun(store, null)
  let matches = 0

  const say = (text) => { status.textContent = text }
  // small is for a power's name: smaller and higher, clear of the play.
  function flash(text, ms = 1300, small = false) {
    banner.classList.toggle('sm', small)
    banner.textContent = text
    banner.hidden = false
    banner.classList.remove('in')
    void banner.offsetWidth
    banner.classList.add('in')
    win.clearTimeout(bannerTimer)
    bannerTimer = win.setTimeout(() => { banner.hidden = true }, ms)
  }

  function burst(x, y) {
    if (reduce) return
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 120 + Math.random() * 320
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, life: 0.9 + Math.random() * 0.7, c: [colours.accent, '#ffffff', colours.primary][i % 3], s: 4 + Math.random() * 4 })
    }
  }

  // Fireworks over the stand: each goes up a moment after the last.
  function fireworks(count) {
    if (reduce) return
    const shades = [colours.accent, '#ffffff', '#ff6b9a', '#7ae7ff', '#b6ff6b', '#ffb347']
    for (let i = 0; i < count; i++) rockets.push({ at: now + i * 0.24 + Math.random() * 0.1, x: 90 + Math.random() * (W - 180), y: 26 + Math.random() * 100, c: shades[Math.floor(Math.random() * shades.length)] })
  }
  function explode(r) {
    for (let i = 0; i < 52; i++) {
      const a = (i / 52) * Math.PI * 2 + Math.random() * 0.2
      const v = (i % 2 ? 110 : 60) + Math.random() * 190
      sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + Math.random() * 0.7, c: i % 5 ? r.c : '#ffffff' })
    }
    audio.kick(0.18)
  }

  // claim is the run to put on the board: the run so far after a win,
  // or the run that has just ended.
  function leaderboard(claim, which) {
    endExtra.replaceChildren()
    if (!boardOn) return
    let shown = null
    let mine = 0
    let all = false
    const redraw = () => { if (shown && which === matches) drawBoard(doc, endExtra, shown, { mine, all, title: "Today's leaderboard: wins in a row", onMore: () => { all = true; redraw() } }) }
    // Sends the run. ui is the form it was asked from, or null when a run
    // already on the board is growing.
    const send = (initials, ui) => {
      sendGo({ initials, score: claim, ticket }, win, BOARD_PATH).then((out) => {
        if (out.ok) {
          if (out.ticket) ticket = out.ticket
          posted = { ticket, initials, score: claim }
          keepRun(store, posted)
        } else if (out.reason === 'ticket' || out.reason === 'low') {
          // The ticket is spent or no longer ours: start again with a new one.
          if (out.ticket) ticket = out.ticket
          posted = null
          keepRun(store, null)
        }
        if (which !== matches) return
        if (out.ok) {
          try { store?.setItem(INITIALS_KEY, initials) } catch { /* not kept: the box starts at AAA */ }
          shown = out
          mine = out.rank
          all = all || out.rank > 10
          ui?.form.remove()
          redraw()
          say(`Your run of ${claim} is ${ordinal(out.rank)} on today's leaderboard.`)
        } else if (ui) {
          ui.said.textContent = SAID[out.reason] || SAID.unavailable
          ui.button.disabled = out.reason !== 'initials' && out.reason !== 'busy' && out.reason !== 'unavailable'
        }
      }, () => { if (ui) { ui.said.textContent = SAID.unavailable; ui.button.disabled = false } })
    }
    fetchBoard(win, BOARD_PATH).then((b) => {
      fresh = b.ticket
      if (which !== matches) return
      shown = b
      mine = posted && posted.score === claim ? placeOf(b.entries, posted) : 0
      all = mine > 10
      redraw()
      if (!claim) return
      // A run already on the board grows by itself.
      if (posted) { if (claim > posted.score) send(posted.initials, null); return }
      if (!wouldMake(b.entries, claim)) return
      const lastUsed = (() => { try { return store?.getItem(INITIALS_KEY) } catch { return null } })()
      drawForm(doc, endExtra, {
        initials: tidyInitials(lastUsed) || 'AAA',
        onAdd(initials, ui) {
          ui.button.disabled = true
          ui.said.textContent = 'Adding your run.'
          send(initials, ui)
        },
      })
    }, () => {})
  }

  function finish() {
    tally('headtohead', 'done', win)
    const outcome = result(match)
    const after = afterMatch(store, outcome)
    streak = after.streak
    best = after.best
    skill = nextSkill(skill, outcome)
    if (outcome === 'win') { audio.roar(); cheerUntil = now + 4; burst(W / 2, 110); fireworks(10) } else if (outcome === 'lose') audio.groan()
    else audio.whistle()
    const line = `${match.score.left} - ${match.score.right}.`
    endTitle.textContent = outcome === 'win' ? 'You win' : outcome === 'lose' ? 'You lose' : 'A draw'
    endLine.textContent = outcome === 'win'
      ? `${line} That is ${streak} ${streak === 1 ? 'win' : 'wins'} in a row. Your best run on this device is ${best}.`
      : after.ended
        ? `${line} Your run of ${after.ended} ${after.ended === 1 ? 'win' : 'wins'} is over. Your best run on this device is ${best}.`
        : `${line} Win to start a run. Your best run on this device is ${best}.`
    // A win is a sweet (shared/prizes.js).
    const prize = drawPrize(doc, endPrize, 'headtohead', outcome === 'win' ? 1 : 0)
    end.hidden = false
    shell.classList.add('ended')
    again.focus({ preventScroll: true })
    say(`Full time. ${endTitle.textContent}. ${endLine.textContent} ${prize}`)
    leaderboard(outcome === 'win' ? streak : after.ended, matches)
  }

  function restart() {
    want = null
    flames = []
    matches += 1
    // A run that has ended is off the visitor's hands: the next run is a
    // new entry, with the newest plain ticket.
    if (streak === 0) {
      posted = null
      keepRun(store, null)
      if (fresh) { ticket = fresh; fresh = null }
    }
    match = newMatch()
    dealButtons(Object.keys(match.powers.left))
    mind = newMind()
    started = false
    bits = []
    rockets = []
    sparks = []
    pops = []
    end.hidden = true
    clearPrize(endPrize)
    shell.classList.remove('ended')
    prompt.hidden = false
    them.c = pickOpponent(me.c.id)
    scoreL.textContent = '0'
    scoreR.textContent = '0'
    clock.textContent = clockText(MATCH_SECONDS)
    pitch.focus({ preventScroll: true })
  }

  function begin() {
    if (started || !end.hidden || !pick.hidden) return
    started = true
    tally('headtohead', 'play', win)
    prompt.hidden = true
    audio.whistle()
    say('Kick off.')
  }

  function heard(events) {
    for (const e of events) {
      if (e.type === 'kick') audio.kick(0.55)
      else if (e.type === 'head') audio.kick(0.25)
      else if (e.type === 'header') {
        // A header met well is heard, and seen as a ring off the head.
        audio.kick(0.3 + 0.45 * e.power)
        if (!reduce) pops.push({ x: match.ball.x, y: match.ball.y, age: 0, power: e.power })
      } else if (e.type === 'net') {
        nets[e.side] = { power: e.power, y: e.y, at: now }
        audio.swish(0.5 + 0.5 * e.power)
      } else if (e.type === 'post') audio.clang()
      else if (e.type === 'bounce') {
        squash = reduce ? 0 : Math.min(0.32, e.speed / 2200)
        if (e.speed > 320) audio.kick(0.12)
      }
      else if (e.type === 'kickoff') audio.whistle()
      else if (e.type === 'power') {
        audio.chime()
        if (e.by === 'left') {
          for (const b of powerButtons) if (b.getAttribute('data-power') === e.name) b.disabled = true
          flash(`${POWER_NAMES[e.name]}!`, 1000, true)
          say(`You use ${POWER_NAMES[e.name]}.`)
        } else {
          flash(`They use ${POWER_NAMES[e.name]}`, 1000, true)
          say(`The Snowmen use ${POWER_NAMES[e.name]}.`)
        }
      } else if (e.type === 'flame') {
        audio.kick(1)
        audio.swish(1)
        shake = reduce ? 0 : 0.2
      } else if (e.type === 'curl') {
        audio.kick(0.75)
        audio.swish(0.6)
      } else if (e.type === 'wall') {
        audio.kick(0.45)
        shake = reduce ? 0 : 0.12
      } else if (e.type === 'knock') {
        audio.clang()
        shake = reduce ? 0 : 0.25
      }
      else if (e.type === 'goal') {
        scoreL.textContent = String(match.score.left)
        scoreR.textContent = String(match.score.right)
        shake = reduce ? 0 : 0.35
        if (e.by === 'left') {
          audio.cheer()
          cheerUntil = now + 2.6
          burst(W - GOAL_D / 2, BAR + 60)
          fireworks(6)
          white.classList.remove('on')
          void white.offsetWidth
          white.classList.add('on')
          flash('Goal!', 1700)
          say(`Goal! ${match.score.left} - ${match.score.right}.`)
        } else {
          audio.groan()
          flash('They score')
          say(`The Snowmen score. ${match.score.left} - ${match.score.right}.`)
        }
      } else if (e.type === 'over') finish()
    }
  }

  // ── The drawing ───────────────────────────────────────────────────────
  let view = { w: 1, h: 1, k: 1, ox: 0, oy: 0, dpr: 1 }
  function resize() {
    const r = pitch.getBoundingClientRect()
    const dpr = Math.min(2, win.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(r.width))
    const h = Math.max(1, Math.round(r.height))
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const k = Math.min(w / W, h / H)
    view = { w, h, k, ox: (w - W * k) / 2, oy: Math.max(0, (h - H * k) / 2), dpr }
  }

  function drawBall(b) {
    // A fast ball leaves a faint trail behind it.
    const speed = Math.hypot(b.vx, b.vy)
    if (speed > 520 && !reduce) {
      ctx.fillStyle = '#ffffff'
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.16 - i * 0.04
        ctx.beginPath(); ctx.arc(b.x - (b.vx / speed) * i * 11, b.y - (b.vy / speed) * i * 11, BALL_R - i * 1.5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.save()
    const grown = ballR(match) / BALL_R
    ctx.translate(b.x, b.y + squash * BALL_R * grown)
    // Flattened for a moment as it comes off the ground.
    ctx.scale((1 + squash) * grown, (1 - squash) * grown)
    ctx.rotate(b.spin)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = colours.ink
    ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = colours.ink
    ctx.beginPath()
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6) }
    ctx.closePath(); ctx.fill()
    ctx.beginPath()
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * BALL_R, Math.sin(a) * BALL_R) }
    ctx.stroke()
    ctx.restore()
  }

  function drawPlayer(p, who) {
    // Drawn at the player's own size, from the feet up: bigger while
    // super sized. The places below are for a player of the usual size.
    const k = sizeOf(p)
    const head = { x: p.x, y: p.y - HEAD_UP }
    const body = { x: p.x, y: p.y - BODY_UP }
    const reach = bootOf(p)
    const boot = reach ? { x: p.x + (reach.x - p.x) / k, y: p.y + (reach.y - p.y) / k } : null
    const f = p.face
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.scale(k, k)
    ctx.translate(-p.x, -p.y)
    // Knocked back, the player flickers; with a flaming shot waiting,
    // they glow.
    if (p.stun > 0 && !reduce) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now * 40)
    if (p.armed > 0) {
      ctx.strokeStyle = '#ff7a1a'
      ctx.lineWidth = 4
      ctx.globalAlpha = reduce ? 0.8 : 0.5 + 0.4 * Math.sin(now * 12)
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 44, 36, 50, 0, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    }
    const running = Math.abs(p.vx) > 10 && p.y >= GROUND
    const stride = running ? Math.sin(now * 18) * 7 : 0
    // Legs and boots.
    ctx.fillStyle = who.kit.socks
    const legY = p.y - 16
    ctx.fillRect(p.x - 11 + stride * 0.5, legY, 8, 12)
    if (!boot) ctx.fillRect(p.x + 3 - stride * 0.5, legY, 8, 12)
    ctx.fillStyle = '#15161a'
    ctx.beginPath(); ctx.roundRect(p.x - 13 + stride * 0.5 + (f > 0 ? 0 : -4), p.y - 6, 16, 7, 3); ctx.fill()
    if (boot) {
      ctx.strokeStyle = who.kit.socks
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(p.x + f * 4, p.y - 22); ctx.lineTo(boot.x - f * 6, boot.y); ctx.stroke()
      ctx.beginPath(); ctx.roundRect(boot.x - 9, boot.y - 5, 18, 10, 4); ctx.fill()
    } else {
      ctx.beginPath(); ctx.roundRect(p.x + 1 - stride * 0.5 + (f > 0 ? 0 : -4), p.y - 6, 16, 7, 3); ctx.fill()
    }
    // Shorts and shirt.
    ctx.fillStyle = who.kit.shorts
    ctx.beginPath(); ctx.roundRect(p.x - 15, body.y + 6, 30, 12, 4); ctx.fill()
    ctx.fillStyle = who.kit.shirt
    ctx.beginPath(); ctx.roundRect(p.x - 17, body.y - 18, 34, 28, 9); ctx.fill()
    ctx.fillStyle = who.kit.trim
    ctx.fillRect(p.x - 17, body.y - 3, 34, 3)
    // The head: big, with the player's own hair (characters.js).
    // Jumping, the head leans in; meeting the ball, it is thrown forward.
    const lunge = (p.y < GROUND ? 3 : 0) + Math.sin(Math.min(1, (p.nod || 0) / 0.22) * Math.PI) * 10
    drawHead(ctx, who.c, head.x + f * lunge, head.y + lunge * 0.25, HEAD_R, f, { look: (match.ball.y - (p.y - HEAD_UP * k)) / 40, ink: colours.ink })
    // Frozen, the player is in a block of ice; on a banana skin, question
    // marks go round their head.
    if (p.frozen > 0) {
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#bfeaff'
      ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 98, 76, 102, 12); ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 98, 76, 102, 12); ctx.stroke()
    }
    if (p.swap > 0) {
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffe14d'
      ctx.font = `800 22px ${FONT}`
      ctx.textAlign = 'center'
      for (let i = 0; i < 3; i++) { const a = now * 5 + (i * Math.PI * 2) / 3; ctx.fillText('?', head.x + Math.cos(a) * 30, head.y - HEAD_R - 2 + Math.sin(a) * 6) }
    }
    // Stars round the head of a player knocked back.
    if (p.stun > 0) {
      ctx.globalAlpha = 1
      ctx.fillStyle = colours.accent
      for (let i = 0; i < 3; i++) { const a = now * 7 + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.arc(head.x + Math.cos(a) * 22, head.y - HEAD_R - 6 + Math.sin(a) * 5, 4, 0, Math.PI * 2); ctx.fill() }
    }
    ctx.restore()
  }

  // A goal: the frame, and a net that bulges where the ball has hit it
  // and swings back.
  function drawGoal(side) {
    const out = side < 0 ? -1 : 1
    const back = side < 0 ? 4 : W - 4
    const front = side < 0 ? GOAL_D : W - GOAL_D
    const hit = nets[side]
    const age = now - hit.at
    const resting = match.phase === 'goal' && Math.abs(match.ball.x - (side < 0 ? BALL_R : W - BALL_R)) < 3 ? 5 : 0
    const push = reduce ? resting : resting + hit.power * 24 * Math.exp(-age * 2.4) * Math.cos(age * 12)
    const at = resting && !hit.power ? match.ball.y : hit.y || (BAR + GROUND) / 2
    // How far a point of the net is pushed out: most at the back, where
    // the ball hit, and less away from it.
    const give = (x, y) => out * push * (Math.abs(x - front) / Math.abs(back - front)) * Math.exp(-(((y - at) / 52) ** 2))
    ctx.strokeStyle = '#ffffff55'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i <= 5; i++) {
      const x = back + ((front - back) * i) / 6
      ctx.moveTo(x + give(x, BAR), BAR)
      for (let y = BAR + 12; y <= GROUND; y += 12) ctx.lineTo(x + give(x, y), y)
    }
    for (let y = BAR + 18; y < GROUND; y += 18) { ctx.moveTo(back + give(back, y), y); ctx.lineTo(front, y) }
    ctx.stroke()
    // The frame, with depth: a far post behind and a little up, the near
    // post in front and a little down, and the bar between their tops.
    const owner = side < 0 ? 'left' : 'right'
    const bar = barOf(match, owner)
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#cfd8ea'
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(front - out * 7, BAR - 14); ctx.lineTo(front - out * 7, FAR); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(back, BAR - 6); ctx.lineTo(front - out * 7, BAR - 14); ctx.stroke()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(back, BAR); ctx.lineTo(front, BAR); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(front - out * 7, BAR - 14); ctx.lineTo(front + out * 6, BAR + 10); ctx.lineTo(front + out * 6, NEAR - 4); ctx.stroke()
    // A small goal: a lower bar, and the goal shut above it.
    if (bar > BAR) {
      ctx.fillStyle = mix(colours.deep, '#000000', 0.2)
      ctx.globalAlpha = 0.9
      ctx.fillRect(Math.min(back, front), BAR + 3, Math.abs(front - back), bar - BAR - 3)
      ctx.globalAlpha = 1
      ctx.strokeStyle = colours.accent
      ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(back, bar); ctx.lineTo(front + out * 6, bar + 8); ctx.stroke()
    }
    // A brick wall across the mouth.
    if (match.wall?.[owner] > 0) {
      const x0 = front + out * 2 - 9
      for (let r = 0; (r + 1) * 13 <= GROUND - BAR + 6; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#c95f33' : '#e0703f'
          ctx.fillRect(x0 + c * 9 + (r % 2 ? -3 : 0), GROUND - (r + 1) * 13 + 4, 8.4, 12)
        }
      }
    }
  }

  function draw() {
    const { w, h, k, ox, oy, dpr } = view
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = colours.deep
    ctx.fillRect(0, 0, w, h)
    const sx = shake > 0 ? Math.sin(now * 90) * shake * 10 : 0
    const sy = shake > 0 ? Math.cos(now * 70) * shake * 7 : 0
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox + sx), dpr * (oy + sy))
    // On a screen wider than the pitch the stand, the boards' line and
    // the grass carry on to the edges.
    ctx.fillStyle = mix(colours.deep, '#1c2230', 0.55)
    ctx.fillRect(-900, 34, W + 1800, BOARDS - 34)
    ctx.fillStyle = mix(colours.deep, '#000000', 0.25)
    ctx.fillRect(-900, BOARDS, W + 1800, 31)
    ctx.fillStyle = '#357e50'
    ctx.fillRect(-900, BOARDS + 31, W + 1800, H - BOARDS + 400)
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, H + 400); ctx.clip()

    // The sky and the stand.
    const sky = ctx.createLinearGradient(0, 0, 0, 50)
    sky.addColorStop(0, mix(colours.deep, '#000000', 0.4))
    sky.addColorStop(1, colours.deep)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, 50)
    ctx.fillStyle = mix(colours.deep, '#1c2230', 0.55)
    ctx.fillRect(0, 34, W, BOARDS - 34)
    // The crowd, which jumps when there is something to cheer.
    const cheering = now < cheerUntil && !reduce
    for (const s of seats) {
      const lift = cheering ? (s.jumpy ? Math.max(0, Math.sin(now * 9 + s.phase)) * 7 : 0) : 0
      ctx.fillStyle = tones[s.tone]
      ctx.fillRect(s.x - 5, s.y - lift, 10, 11)
      ctx.fillStyle = skins[s.skin]
      ctx.beginPath(); ctx.arc(s.x, s.y - 4 - lift, 3.6, 0, Math.PI * 2); ctx.fill()
      // About one in four of the crowd wears a Christmas hat.
      if (s.phase < 1.6) {
        ctx.fillStyle = '#c8102e'
        ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 6.5 - lift); ctx.lineTo(s.x + 4, s.y - 6.5 - lift); ctx.lineTo(s.x + 1.5, s.y - 13 - lift); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.arc(s.x + 1.5, s.y - 13 - lift, 1.5, 0, Math.PI * 2); ctx.fill()
      }
    }
    // Floodlights at each end of the stand, and the light they throw.
    for (const side of [-1, 1]) {
      const x = side < 0 ? 34 : W - 34
      ctx.fillStyle = '#5b6170'
      ctx.fillRect(x - 3, 22, 6, BOARDS - 22)
      ctx.fillStyle = '#2b2f3a'
      ctx.beginPath(); ctx.roundRect(x - 26, 6, 52, 20, 4); ctx.fill()
      ctx.fillStyle = '#fff6d8'
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - 18 + i * 12, 16, 4.2, 0, Math.PI * 2); ctx.fill() }
      if (!reduce) {
        const beam = ctx.createLinearGradient(x, 20, x - side * 190, GROUND)
        beam.addColorStop(0, '#fff6d833')
        beam.addColorStop(1, '#fff6d800')
        ctx.fillStyle = beam
        ctx.beginPath(); ctx.moveTo(x - 20, 24); ctx.lineTo(x + 20, 24); ctx.lineTo(x - side * 60, NEAR); ctx.lineTo(x - side * 330, NEAR); ctx.closePath(); ctx.fill()
      }
    }
    // The big sign across the middle of the stand.
    if (sign) {
      ctx.save()
      ctx.translate(W / 2 - 180, 96)
      drawTopSign(ctx, 360, 52, sign, { ...signPics, colours, font: FONT })
      ctx.restore()
    }
    // The boards along the front of the stand.
    const names = boards.length ? boards : ['Winter Fayre']
    for (let i = 0; i < 8; i++) {
      const name = names[i % names.length]
      const x = i * 100
      const img = logos.get(name.toLowerCase())
      if (logoReady(img)) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, BOARDS, 100, 30)
        const b = logoBox(img, 100, 30, { across: 0.84, up: 0.66 })
        ctx.drawImage(img, x + b.x, BOARDS + b.y, b.w, b.h)
      } else {
        ctx.fillStyle = i % 2 ? colours.deep : colours.primary
        ctx.fillRect(x, BOARDS, 100, 30)
        ctx.fillStyle = i % 2 ? colours.accent : '#ffffff'
        ctx.font = `800 16px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(name.toUpperCase(), x + 50, BOARDS + 16, 90)
      }
      ctx.fillStyle = '#0003'
      ctx.fillRect(x + 99, BOARDS, 1, 30)
    }
    ctx.fillStyle = colours.accent
    ctx.fillRect(0, BOARDS + 28, W, 3)
    // Snow lying along the top of the boards, and a string of fairy
    // lights over it that twinkle.
    ctx.fillStyle = '#f2f7ff'
    ctx.beginPath(); ctx.roundRect(-900, BOARDS - 3, W + 1800, 5, 2.5); ctx.fill()
    for (let i = 0; i < 67; i++) {
      ctx.globalAlpha = reduce ? 1 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now * 2.6 + i * 2.4))
      ctx.fillStyle = BULBS[i % BULBS.length]
      ctx.beginPath(); ctx.arc(6 + i * 12, BOARDS - 5 + Math.cos(i * 1.57) * 1.2, 2.1, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    // The pitch, striped, seen a little from above: the far touchline,
    // the near one, the goal lines, the penalty areas, the halfway line
    // and the centre circle. Below the near touchline is the strip where
    // a phone's buttons sit.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#357e50' : '#3f8f5a'
      ctx.fillRect(i * 100, BOARDS + 31, 100, H - BOARDS + 400)
    }
    // A line across the pitch leans, so its near end is further out.
    const lean = (x, y, side) => x + side * (y - GROUND) * 0.32
    ctx.strokeStyle = '#ffffffd9'
    ctx.lineCap = 'butt'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, FAR); ctx.lineTo(W, FAR)
    ctx.moveTo(W / 2, FAR); ctx.lineTo(W / 2, NEAR)
    for (const side of [-1, 1]) {
      const line = side < 0 ? GOAL_D : W - GOAL_D
      const box = line - side * 118
      ctx.moveTo(lean(line, FAR, side), FAR); ctx.lineTo(lean(line, NEAR, side), NEAR)
      ctx.moveTo(lean(line, FAR + 7, side), FAR + 7); ctx.lineTo(lean(box, FAR + 7, side), FAR + 7); ctx.lineTo(lean(box, NEAR - 7, side), NEAR - 7); ctx.lineTo(lean(line, NEAR - 7, side), NEAR - 7)
    }
    ctx.stroke()
    ctx.beginPath(); ctx.ellipse(W / 2, GROUND, 64, 22, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(-900, NEAR); ctx.lineTo(W + 900, NEAR); ctx.stroke()
    ctx.fillStyle = '#00000030'
    ctx.fillRect(-900, NEAR + 2, W + 1800, H - NEAR + 400)

    // Shadows, the goals, the players and the ball.
    ctx.fillStyle = '#00000044'
    for (const p of [match.left, match.right]) { ctx.beginPath(); ctx.ellipse(p.x, GROUND + 5, (24 - Math.min(10, (GROUND - p.y) / 12)) * sizeOf(p), 5, 0, 0, Math.PI * 2); ctx.fill() }
    const up = Math.max(0, GROUND - BALL_R - match.ball.y)
    ctx.beginPath(); ctx.ellipse(match.ball.x, GROUND + 5, Math.max(5, ballR(match) - up / 30), 4, 0, 0, Math.PI * 2); ctx.fill()
    drawPlayer(match.left, me)
    drawPlayer(match.right, them)
    // A ball on fire trails flame. An invisible ball is a faint ghost to
    // the side that hid it, and only its shadow to the other.
    for (const fl of flames) {
      ctx.globalAlpha = Math.max(0, fl.life / 0.4)
      ctx.fillStyle = fl.white ? '#ffffff' : fl.life > 0.22 ? '#ffd400' : '#ff7a1a'
      ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.white ? 3 + fl.life * 10 : 4 + fl.life * 26, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    if (match.flame) {
      const glow = ctx.createRadialGradient(match.ball.x, match.ball.y, 4, match.ball.x, match.ball.y, 34)
      glow.addColorStop(0, '#ffd400cc')
      glow.addColorStop(1, '#ff7a1a00')
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(match.ball.x, match.ball.y, 34, 0, Math.PI * 2); ctx.fill()
    }
    if (!match.hidden) drawBall(match.ball)
    else if (match.hidden.by === 'left') {
      ctx.globalAlpha = 0.3
      drawBall(match.ball)
      ctx.globalAlpha = 1
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(match.ball.x, match.ball.y, BALL_R + 5, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
    }
    // The snow, falling in front of the pitch.
    ctx.fillStyle = '#ffffff'
    for (const f of flakes) {
      const fy = reduce ? f.y : (f.y + now * f.v) % 330
      const fx = reduce ? f.x : (f.x + Math.sin(now * 0.9 + f.p) * 10 + now * 6) % W
      ctx.globalAlpha = 0.55 + (f.r - 1.2) * 0.2
      ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, b.life)
      ctx.fillStyle = b.c
      ctx.fillRect(b.x - b.s / 2, b.y - b.s / 2, b.s, b.s * 0.6)
    }
    // Fireworks, and the ring where a header was met.
    ctx.lineCap = 'round'
    for (const k of sparks) {
      ctx.globalAlpha = Math.min(1, k.life * 1.4)
      ctx.strokeStyle = k.c
      ctx.lineWidth = 3.2
      ctx.beginPath(); ctx.moveTo(k.px, k.py); ctx.lineTo(k.x, k.y); ctx.stroke()
    }
    for (const o of pops) {
      ctx.globalAlpha = Math.max(0, 1 - o.age / 0.3)
      ctx.strokeStyle = o.power > 0.6 ? colours.accent : '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(o.x, o.y, 12 + o.age * (90 + 120 * o.power), 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.restore()
    // The goals are drawn over the edge of the pitch, so a net can bulge
    // past it on a wide screen.
    drawGoal(-1)
    drawGoal(1)
  }

  // ── The loop ──────────────────────────────────────────────────────────
  function frame(t) {
    raf = win.requestAnimationFrame(frame)
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
    last = t
    now += dt
    const waiting = upright() || doc.hidden
    if (started && end.hidden && !waiting) {
      mind = computerInputs(match, skill, mind, dt)
      match = step(match, { left: want ? { ...held, power: want } : held, right: mind.inputs }, dt)
      want = null
      heard(match.events)
      clock.textContent = clockText(match.clock)
    }
    shake = Math.max(0, shake - dt)
    for (const b of bits) { b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt }
    squash = Math.max(0, squash - dt * 2.6)
    if (match.curling && !reduce) flames.push({ x: match.ball.x, y: match.ball.y, life: 0.3, white: true })
    if (match.flame && !reduce) flames.push({ x: match.ball.x + (Math.random() - 0.5) * 8, y: match.ball.y + (Math.random() - 0.5) * 8, life: 0.4 })
    for (const fl of flames) { fl.life -= dt; fl.y -= 30 * dt }
    flames = flames.filter(fl => fl.life > 0)
    for (const r of rockets) if (now >= r.at) explode(r)
    rockets = rockets.filter(r => now < r.at)
    for (const k of sparks) { k.px = k.x; k.py = k.y; k.vx *= 1 - 1.6 * dt; k.vy = k.vy * (1 - 1.6 * dt) + 150 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.life -= dt }
    sparks = sparks.filter(k => k.life > 0)
    for (const o of pops) o.age += dt
    pops = pops.filter(o => o.age < 0.3)
    bits = bits.filter(b => b.life > 0 && b.y < H + 20)
    draw()
  }

  // ── What the visitor does ─────────────────────────────────────────────
  for (const button of shell.querySelectorAll('[data-in]')) {
    const name = button.getAttribute('data-in')
    const set = (on) => (e) => {
      e.preventDefault()
      held[name] = on
      button.classList.toggle('on', on)
      if (on) begin()
    }
    button.addEventListener('pointerdown', set(true))
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, set(false))
    button.addEventListener('contextmenu', (e) => e.preventDefault())
  }
  pitch.addEventListener('pointerdown', (e) => { e.preventDefault(); begin() })
  // A thumb on a control or the pitch is never a zoom, a scroll or a long press.
  for (const node of [pitch, padL, padR]) node.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault() }, { passive: false })
  const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ' ': 'kick', ArrowDown: 'lob', x: 'lob', X: 'lob' }
  const onKey = (on) => (e) => {
    if (e.key === 'Escape' && on) { win.location.assign(MENU); return }
    if (e.target.closest?.('button, a, input')) return
    if (on && ['1', '2', '3'].includes(e.key)) { ask(powerButtons[Number(e.key) - 1].getAttribute('data-power')); return }
    const name = keys[e.key]
    if (!name) { if (on && e.key === 'Enter') begin(); return }
    e.preventDefault()
    held[name] = on
    if (on) begin()
  }
  const keyDown = onKey(true)
  const keyUp = onKey(false)
  shell.addEventListener('keydown', keyDown)
  shell.addEventListener('keyup', keyUp)
  const letGo = () => { for (const k of Object.keys(held)) held[k] = false; for (const b of shell.querySelectorAll('.hh-key.on')) b.classList.remove('on') }
  const onVisibility = () => { last = 0; letGo(); if (doc.hidden) audio.suspend(); else audio.resume() }
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('blur', letGo)
  win.addEventListener('resize', resize)
  win.addEventListener('orientationchange', resize)
  sound.addEventListener('click', () => {
    const on = audio.setEnabled(sound.getAttribute('aria-checked') !== 'true')
    sound.setAttribute('aria-checked', String(on))
    soundState.textContent = on ? 'On' : 'Off'
    if (on) audio.kick(0.3)
  })
  musicSwitch.addEventListener('click', () => {
    const on = audio.setMusic(musicSwitch.getAttribute('aria-checked') !== 'true')
    musicSwitch.setAttribute('aria-checked', String(on))
    musicState.textContent = on ? 'On' : 'Off'
  })
  again.addEventListener('click', restart)
  // A power: tap its button, or press 1, 2 or 3.
  const ask = (name) => { if (name && started && end.hidden && match.powers.left[name]) want = name }
  for (const b of powerButtons) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); ask(b.getAttribute('data-power')) })
    b.addEventListener('click', (e) => { e.preventDefault(); ask(b.getAttribute('data-power')) })
  }
  // Picking a player: tap a face, then Kick off. The computer's player
  // is picked again from the rest, so the two are never the same.
  for (const option of options) {
    option.addEventListener('click', () => {
      me.c = characterById(keepCharacter(store, option.getAttribute('data-player')))
      them.c = pickOpponent(me.c.id)
      for (const o of options) o.setAttribute('aria-pressed', String(o === option))
      say(`You picked the player with ${me.c.label}.`)
    })
  }
  const openPick = () => {
    end.hidden = true
    clearPrize(endPrize)
    pick.hidden = false
    prompt.hidden = true
    shell.classList.add('ended')
    ;(options.find(o => o.getAttribute('aria-pressed') === 'true') || options[0]).focus({ preventScroll: true })
  }
  change.addEventListener('click', openPick)
  go.addEventListener('click', () => {
    keepCharacter(store, me.c.id)
    pick.hidden = true
    restart()
  })
  if (!picked) shell.classList.add('ended')

  resize()
  say(`Head to head. You have won ${streak} in a row. Use the arrow keys to run and jump, and Space to kick.`)
  try { doc.fonts?.load?.(`800 30px "Barlow Condensed"`) } catch { /* the fallback face stays */ }
  raf = win.requestAnimationFrame(frame)
  pitch.focus({ preventScroll: true })

  return {
    close() {
      win.cancelAnimationFrame(raf)
      win.clearTimeout(bannerTimer)
      doc.removeEventListener('visibilitychange', onVisibility)
      win.removeEventListener('blur', letGo)
      win.removeEventListener('resize', resize)
      win.removeEventListener('orientationchange', resize)
      audio.dispose()
      unlockTouch()
      shell.remove()
      doc.documentElement.classList.remove('gs-open')
    },
  }
}
