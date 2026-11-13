// The game in its overlay, played by keyboard in a stand-in browser
// (testing/fakeDom.js) that has no WebGL, so it runs the 2D version:
//   the overlay is a dialog: focus moves in and goes back to Play, Escape
//   and Leave game leave, Tab stays inside, the page behind is inert;
//   a kick and a save by the keys alone, and a whole shootout to the
//   results, with the live region saying each outcome and the score;
//   the 2D version's tap where to shoot; reduced motion's fades; no
//   storage, no sound, a hidden tab, and everything let go on leaving;
//   and the details: the tracker marked with the banner, the prompt off
//   the screen for the run up, a held Space let go when the page stops
//   hearing it, focus back on the pitch, dive buttons that go on touch,
//   a swipe read by the browser's own times and every point it saw, a
//   tap held across the strike taken as a dive after it (the result is
//   the keeper drawn), a device's first shootout kinder in goal, no Share
//   on a draft, the game closed when the page is put away, and the
//   results' Tab order.
//
// Run with: npx vitest run client/shootout/game.test.js

import { describe, it, expect } from 'vitest'
import { createFakeBrowser } from './testing/fakeDom.js'
import { chooseRenderer, openShootout, webglAvailable } from './game.js'
import { effects } from './motion.js'
import { enhanceShootout } from './index.js'
import { shootoutConfig } from './config.js'
import { renderShootoutSection } from './section.js'
import { aimToScreen, screenGeometry } from './camera.js'
import { simulate } from './physics.js'

const SITE = {
  slug: 'wicklewood-u12',
  theme: { colours: { primary: '#1e3a8a', accent: '#f5b700' } },
  settings: { shootout: { enabled: true, presented_by: 'Hartley Bakery' } },
  content: { site_name: 'Wicklewood Wanderers Under-12s', short_name: 'Wanderers U12s', partners: { names: ['Hartley Bakery', 'Oakfield Motors'] } },
}
const CONFIG = shootoutConfig(SITE, { url: 'https://wicklewoodwanderers.example/' })

function setup(opts = {}) {
  const b = createFakeBrowser(opts)
  const page = b.doc.createElement('main')
  b.doc.body.appendChild(page)
  const play = b.doc.createElement('button')
  play.textContent = 'Play the shootout'
  page.appendChild(play)
  play.focus()
  const events = []
  const game = openShootout(CONFIG, {
    window: b.win,
    document: b.doc,
    returnFocus: play,
    seed: opts.seed ?? 42,
    reduceMotion: opts.reduceMotion,
    onEvent: (type, detail) => events.push({ type, ...detail }),
  })
  const overlay = () => b.doc.body.children.find((c) => c.getAttribute('role') === 'dialog')
  const live = () => overlay()?.querySelector('.tso-live')?.textContent ?? ''
  return { ...b, page, play, game, events, overlay, live }
}

// A shot by the keys: aim with the arrows, hold Space, let go.
function keyShot(t, arrows = ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp'], holdMs = 500) {
  for (const a of arrows) t.key('keydown', a)
  t.key('keydown', ' ')
  t.advance(holdMs)
  t.key('keyup', ' ')
}

// Waits for the computer's taker to be running in, then dives.
function keySave(t, key = 'ArrowRight') {
  for (let i = 0; i < 80 && t.game.state().kick?.stage !== 'runup'; i++) t.advance(50)
  t.advance(1100)
  t.key('keydown', key)
}

function untilPhase(t, phases, max = 20000) {
  for (let waited = 0; waited < max; waited += 50) {
    if (phases.includes(t.game.state().phase) && t.game.state().kick?.stage !== 'done') return true
    t.advance(50)
  }
  return false
}

describe('the overlay is a dialog', () => {
  it('opens over the page: focus moves in, the page behind is inert and cannot scroll', async () => {
    const t = setup()
    await t.game.ready
    const o = t.overlay()
    expect(o).toBeTruthy()
    expect(o.getAttribute('aria-modal')).toBe('true')
    expect(o.getAttribute('aria-labelledby')).toBe('tso-title')
    expect(o.contains(t.doc.activeElement)).toBe(true)
    expect(t.doc.activeElement.getAttribute('role')).toBe('application')
    expect(t.page.hasAttribute('inert')).toBe(true)
    expect(t.doc.documentElement.style.overflow).toBe('hidden')
    expect(t.doc.body.style.touchAction).toBe('none')
  })

  it('leaves with Escape, and focus goes back to Play', async () => {
    const t = setup()
    await t.game.ready
    const keyListeners = t.doc.listenerCount('keydown')
    t.key('keydown', 'Escape')
    await t.game.closed
    expect(t.overlay()).toBeFalsy()
    expect(t.doc.activeElement).toBe(t.play)
    expect(t.page.hasAttribute('inert')).toBe(false)
    expect(t.doc.documentElement.style.overflow).toBe('')
    expect(t.doc.listenerCount('keydown')).toBeLessThan(keyListeners)
    expect(t.win.events.map((e) => e.detail)).toEqual([{ open: true }, { open: false }])
  })

  it('leaves with the worded Leave game button', async () => {
    const t = setup()
    await t.game.ready
    const leave = t.overlay().querySelectorAll('button').find((b) => b.textContent === 'Leave game')
    expect(leave).toBeTruthy()
    leave.click()
    await t.game.closed
    expect(t.doc.activeElement).toBe(t.play)
  })

  it('keeps Tab inside, from the last control back to the first', async () => {
    const t = setup()
    await t.game.ready
    const o = t.overlay()
    const leave = o.querySelectorAll('button').find((b) => b.textContent === 'Leave game')
    const zones = o.querySelector('.tso-zones')
    expect(zones.hasAttribute('hidden')).toBe(true)
    leave.focus()
    t.key('keydown', 'Tab')
    expect(t.doc.activeElement.getAttribute('role')).toBe('application')
    t.key('keydown', 'Tab', { shiftKey: true })
    expect(t.doc.activeElement).toBe(leave)
  })

  it('has words on every button', async () => {
    const t = setup()
    await t.game.ready
    const words = t.overlay().querySelectorAll('button').map((b) => b.textContent.trim())
    expect(words).toEqual(['Sound Off', 'Music On', 'Leave game', 'Dive left', 'Jump', 'Dive right', 'Play again', 'Share', 'Leave game'])
  })
})

describe('played by keyboard', () => {
  it('takes a kick: the arrows aim and say where, Space builds power, letting go shoots', async () => {
    const t = setup()
    await t.game.ready
    expect(t.game.state().phase).toBe('aim')
    t.advance(100)
    expect(t.live()).toBe('Penalty 1 of 5. Your kick.')
    t.key('keydown', 'ArrowLeft')
    t.advance(400)
    expect(t.live()).toMatch(/^Aiming /)
    const power = t.overlay().querySelector('.tso-power')
    expect(power.hasAttribute('hidden')).toBe(true)
    t.key('keydown', ' ')
    expect(power.hasAttribute('hidden')).toBe(false)
    t.advance(500)
    t.key('keyup', ' ')
    const shot = t.events.find((e) => e.type === 'shot')
    expect(shot.shot.power).toBeGreaterThan(0.4)
    expect(shot.shot.power).toBeLessThan(0.6)
    expect(shot.shot.aimX).toBeLessThan(0)
    t.advance(1000)
    expect(t.events.some((e) => e.type === 'outcome' && e.side === 'us')).toBe(true)
    t.advance(2500)
    expect(t.live()).toMatch(/^(Goal!|Saved by the keeper\.|Off the post\.|Off the crossbar\.|Over the bar\.|Wide\.) (You lead 1 to 0\.|Level at 0 each\.) Penalty 1 of 5\. Your save\. Here comes the taker\.$/)
  })

  it('makes a save: an arrow dives, as the taker strikes', async () => {
    const t = setup()
    await t.game.ready
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
    expect(t.overlay().querySelector('.tso-zones').hasAttribute('hidden')).toBe(false)
    keySave(t, 'ArrowRight')
    const dive = t.events.find((e) => e.type === 'dive')
    expect(dive.dir).toBe('right')
    t.advance(4000)
    const theirs = t.events.find((e) => e.type === 'outcome' && e.side === 'them')
    expect(theirs).toBeTruthy()
    expect(t.live()).toMatch(/(score\.|Saved! You kept it out\.|They hit the|They put it).*(lead|Level).* Penalty 2 of 5\. Your kick\.$/)
  })

  it('plays a whole shootout to the results, and keeps the best on this device', async () => {
    const t = setup({ seed: 7 })
    await t.game.ready
    for (let i = 0; i < 120 && t.game.state().phase !== 'results'; i++) {
      if (!untilPhase(t, ['aim', 'save', 'results'])) break
      const { phase } = t.game.state()
      if (phase === 'aim') keyShot(t, i % 2 ? ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight'] : ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp'])
      else if (phase === 'save') keySave(t, i % 3 ? 'ArrowLeft' : 'ArrowRight')
      t.advance(600)
    }
    t.advance(1500)
    const s = t.game.state()
    expect(s.phase).toBe('results')
    const results = t.events.find((e) => e.type === 'results')
    const o = t.overlay()
    const title = o.querySelector('.tso-results-title')
    expect(title.textContent).toMatch(/^You (won|lost) the shootout \d+ to \d+$/)
    expect(t.doc.activeElement).toBe(title)
    const stats = o.querySelectorAll('dd').map((d) => d.textContent)
    expect(stats[0]).toBe(`${results.goals} of ${results.shots}`)
    expect(stats[1]).toBe(String(results.saves))
    // The score the day's leaderboard counts: goals and saves.
    expect(stats[2]).toBe(String(results.goals + results.saves))
    expect(stats[3]).toMatch(/^(Won|Lost) \d+ to \d+$/)
    expect(t.live()).toContain(title.textContent)
    // Nothing but the best result is kept, and only here.
    const kept = JSON.parse(t.store.get('winterfayre-penalties:wicklewood-u12'))
    expect(kept).toEqual({ played: 1, won: results.won ? 1 : 0, best: { us: results.us, them: results.them, won: results.won, saves: results.saves } })
    // Copy link where there is no share sheet; Play again starts afresh.
    const buttons = o.querySelectorAll('button')
    expect(buttons.find((b) => b.textContent === 'Copy link')).toBeTruthy()
    buttons.find((b) => b.textContent === 'Play again').click()
    t.advance(800)
    expect(t.game.state().phase).toBe('aim')
    expect(t.game.state().shootout.kicks).toEqual([])
    expect(o.querySelector('.tso-results').hasAttribute('hidden')).toBe(true)
  })
})

describe('the fallbacks', () => {
  it('draws in 2D with no WebGL, and a tap on the goal shoots there', async () => {
    expect(chooseRenderer({ webgl: false })).toBe('2d')
    expect(chooseRenderer({ webgl: true })).toBe('3d')
    expect(chooseRenderer({ webgl: true, forceFallback: true })).toBe('2d')
    const t = setup()
    expect(webglAvailable(t.doc)).toBe(false)
    await t.game.ready
    expect(t.game.state().renderer).toBe('2d')
    expect(t.overlay().querySelector('.tso-hint').textContent).toBe('Tap where to shoot in the goal.')
    const stage = t.overlay().querySelector('.tso-stage')
    const at = (type, x, y) => {
      const e = new t.Event(type, { clientX: x, clientY: y, pointerId: 1, button: 0 })
      e.target = stage
      stage.dispatchEvent(e)
    }
    // Top left of the goal on a 390 by 844 screen.
    at('pointerdown', 80, 320)
    at('pointerup', 81, 320)
    const shot = t.events.find((e) => e.type === 'shot')
    expect(shot).toBeTruthy()
    expect(shot.shot.aimX).toBeLessThan(-0.4)
    expect(shot.shot.aimY).toBeGreaterThan(0.5)
  })

  it('with reduced motion: no shake, confetti or slow motion, and fades between kicks', async () => {
    expect(effects(true)).toEqual({ shake: 0, confetti: false, slowMotion: false, follow: false, transition: 'fade', crowd: false })
    expect(effects(false).transition).toBe('sweep')
    const t = setup({ reduceMotion: true })
    await t.game.ready
    expect(t.overlay().getAttribute('data-reduced')).toBe('true')
    expect(t.game.state().reduce).toBe(true)
    keyShot(t)
    let faded = false
    let wiped = false
    for (let i = 0; i < 120; i++) {
      t.advance(50)
      if (t.overlay().getAttribute('data-fade') === 'out') faded = true
      if (t.overlay().getAttribute('data-wipe') === 'on') wiped = true
    }
    expect(faded).toBe(true)
    expect(wiped).toBe(false)
    expect(t.game.state().phase).toBe('save')
  })

  it('sweeps between kicks without reduced motion', async () => {
    const t = setup({ reduceMotion: false })
    await t.game.ready
    keyShot(t)
    let wiped = false
    for (let i = 0; i < 120 && !wiped; i++) {
      t.advance(50)
      if (t.overlay().getAttribute('data-wipe') === 'on') wiped = true
    }
    expect(wiped).toBe(true)
  })

  it('plays on when the browser keeps no storage', async () => {
    const t = setup({ storage: false, seed: 3 })
    await t.game.ready
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
  })

  it('starts with the sound off, and says so when the browser has no Web Audio', async () => {
    const t = setup()
    await t.game.ready
    const sound = t.overlay().querySelector('.tso-sound')
    expect(sound.getAttribute('aria-checked')).toBe('false')
    sound.click()
    expect(sound.getAttribute('aria-checked')).toBe('false')
    t.advance(100)
    expect(t.live()).toBe('Sound is not available in this browser.')
  })
})

describe('looking after the phone', () => {
  it('stops drawing while the tab is hidden, and picks up again', async () => {
    const t = setup()
    await t.game.ready
    keyShot(t)
    t.doc.visibilityState = 'hidden'
    t.doc.dispatchEvent(new t.Event('visibilitychange'))
    const before = t.game.state().kick.stage
    t.advance(5000)
    expect(t.game.state().kick.stage).toBe(before)
    t.doc.visibilityState = 'visible'
    t.doc.dispatchEvent(new t.Event('visibilitychange'))
    t.advance(5000)
    expect(t.game.state().shootout.kicks.length).toBe(1)
  })

  it('lets everything go on leaving', async () => {
    const t = setup()
    await t.game.ready
    const canvas = t.overlay().querySelector('canvas')
    t.game.close()
    await t.game.closed
    expect(canvas.width).toBe(1)
    t.advance(2000)
    expect(t.events.filter((e) => e.type === 'kick')).toHaveLength(1)
  })
})

describe('the details', () => {
  // A pointer event on an element, with the browser's own time stamp and
  // any points it coalesced into it.
  const pointer = (t, el, type, x, y, timeStamp, coalesced) => {
    const e = new t.Event(type, { clientX: x, clientY: y, pointerId: 1, button: 0, timeStamp, bubbles: true })
    if (coalesced) e.getCoalescedEvents = () => coalesced.map((c) => ({ clientX: c.x, clientY: c.y, timeStamp: c.t }))
    e.target = el
    el.dispatchEvent(e)
  }
  const dotState = (t, side, i = 0) => t.overlay().querySelectorAll('.tso-dot').filter((d) => d.getAttribute('data-side') === side)[i].getAttribute('data-state')

  it('marks the kick on the tracker as the banner shows, not after it', async () => {
    const t = setup()
    await t.game.ready
    expect(dotState(t, 'us')).toBe('next')
    keyShot(t)
    for (let i = 0; i < 300 && !t.events.some((e) => e.type === 'outcome'); i++) t.advance(16)
    const outcome = t.events.find((e) => e.type === 'outcome')
    expect(t.overlay().querySelector('.tso-banner').hasAttribute('hidden')).toBe(false)
    expect(dotState(t, 'us')).toBe(outcome.outcome === 'goal' ? 'scored' : 'missed')
    expect(t.overlay().querySelectorAll('.tso-score')[0].textContent).toBe(outcome.outcome === 'goal' ? '1' : '0')
  })

  it('takes Your save off the screen as the taker starts the run up', async () => {
    const t = setup()
    await t.game.ready
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
    const prompt = t.overlay().querySelector('.tso-prompt')
    expect(prompt.hasAttribute('hidden')).toBe(false)
    expect(t.overlay().querySelector('.tso-prompt-title').textContent).toBe('Your save')
    for (let i = 0; i < 80 && t.game.state().kick?.stage !== 'runup'; i++) t.advance(16)
    expect(t.game.state().kick.stage).toBe('runup')
    expect(prompt.hasAttribute('hidden')).toBe(true)
  })

  it('lets go of a held Space without a kick when the window loses focus or the tab is hidden', async () => {
    const t = setup()
    await t.game.ready
    const power = t.overlay().querySelector('.tso-power')
    t.key('keydown', ' ')
    t.advance(300)
    t.win.dispatchEvent(new t.Event('blur'))
    expect(power.hasAttribute('hidden')).toBe(true)
    t.key('keyup', ' ')
    expect(t.events.some((e) => e.type === 'shot')).toBe(false)

    t.key('keydown', ' ')
    t.advance(300)
    t.doc.visibilityState = 'hidden'
    t.doc.dispatchEvent(new t.Event('visibilitychange'))
    t.doc.visibilityState = 'visible'
    t.doc.dispatchEvent(new t.Event('visibilitychange'))
    t.key('keyup', ' ')
    expect(t.events.some((e) => e.type === 'shot')).toBe(false)
    // And a fresh press still shoots.
    keyShot(t, [])
    expect(t.events.some((e) => e.type === 'shot')).toBe(true)
  })

  it('puts the keys back on the pitch after the Sound switch, and at each kick', async () => {
    const t = setup()
    await t.game.ready
    const sound = t.overlay().querySelector('.tso-sound')
    sound.focus()
    sound.click()
    expect(t.doc.activeElement.getAttribute('role')).toBe('application')
    keyShot(t)
    t.advance(300)
    t.overlay().querySelectorAll('button').find((b) => b.textContent === 'Leave game').focus()
    expect(untilPhase(t, ['save'])).toBe(true)
    expect(t.doc.activeElement.getAttribute('role')).toBe('application')
  })

  it('dives as a dive button is touched, not when the finger lifts', async () => {
    const t = setup()
    await t.game.ready
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
    for (let i = 0; i < 80 && t.game.state().kick?.stage !== 'runup'; i++) t.advance(50)
    t.advance(600)
    const right = t.overlay().querySelectorAll('button').find((b) => b.textContent === 'Dive right')
    pointer(t, right, 'pointerdown', 300, 800, t.now)
    const dives = () => t.events.filter((e) => e.type === 'dive')
    expect(dives()).toHaveLength(1)
    expect(dives()[0].dir).toBe('right')
    t.advance(120)
    right.click()
    expect(dives()).toHaveLength(1)
  })

  it('reads a swipe by the browser\'s own times, and every point it saw', async () => {
    const geom = screenGeometry('shoot', 390, 844)
    const end = aimToScreen('shoot', 390, 844, { aimX: 0.5, aimY: 0.4 })
    const swipe = async ({ ms, bowed }) => {
      const t = setup()
      await t.game.ready
      const stage = t.overlay().querySelector('.tso-stage')
      const { x, y } = geom.ball
      const t0 = 5000
      pointer(t, stage, 'pointerdown', x, y, t0)
      // One move event carries the swipe's middle points, bowed or not.
      const mid = []
      for (let i = 1; i < 10; i++) {
        const k = i / 10
        mid.push({ x: x + (end.x - x) * k + (bowed ? Math.sin(k * Math.PI) * 40 : 0), y: y + (end.y - y) * k, t: t0 + ms * k })
      }
      pointer(t, stage, 'pointermove', mid[8].x, mid[8].y, mid[8].t, mid)
      pointer(t, stage, 'pointerup', end.x, end.y, t0 + ms)
      return t.events.find((e) => e.type === 'shot').shot
    }
    const slow = await swipe({ ms: 700 })
    const quick = await swipe({ ms: 150 })
    // The handlers all ran at the same moment: only the time stamps differ.
    expect(quick.power).toBeGreaterThan(slow.power + 0.2)
    expect(Math.abs(quick.aimX - 0.5)).toBeLessThan(0.1)
    const bowed = await swipe({ ms: 150, bowed: true })
    expect(Math.abs(bowed.curve)).toBeGreaterThan(0.3)
    expect(Math.abs(quick.curve)).toBeLessThan(0.05)
  })

  it('takes a tap held across the strike as a dive after it, so the result is the keeper drawn', async () => {
    const seen = new Set()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const t = setup({ seed })
      await t.game.ready
      keyShot(t)
      expect(untilPhase(t, ['save'])).toBe(true)
      const stage = t.overlay().querySelector('.tso-stage')
      // Down on a side a moment before the strike, up after it.
      for (let i = 0; i < 400 && !(t.game.inspect()?.t >= -0.12); i++) t.advance(8)
      const x = seed % 2 ? 40 : 350
      pointer(t, stage, 'pointerdown', x, 600, t.now)
      for (let i = 0; i < 400 && !(t.game.inspect().t >= 0.2); i++) t.advance(8)
      pointer(t, stage, 'pointerup', x, 600, t.now)
      const k = t.game.inspect()
      expect(k.dive, `seed ${seed}`).toBeTruthy()
      expect(k.dive.start).toBe(0)
      expect(k.switched).toBe(false)
      expect(k.result.outcome, `seed ${seed}`).toBe(simulate(k.flight, k.keeperPlan).outcome)
      seen.add(k.result.outcome)
      t.advance(3000)
      const outcome = t.events.find((e) => e.type === 'outcome' && e.side === 'them')
      expect(outcome.outcome).toBe(k.result.outcome)
      expect(outcome.switched).toBe(false)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('takes a tap lifted before the strike as a dive before it, which the result then plays against', async () => {
    const t = setup({ seed: 4 })
    await t.game.ready
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
    const stage = t.overlay().querySelector('.tso-stage')
    for (let i = 0; i < 400 && !(t.game.inspect()?.t >= -0.2); i++) t.advance(8)
    pointer(t, stage, 'pointerdown', 350, 600, t.now)
    t.advance(40)
    pointer(t, stage, 'pointerup', 350, 600, t.now)
    expect(t.game.inspect().dive.start).toBeLessThan(0)
    for (let i = 0; i < 400 && !t.game.inspect().result; i++) t.advance(8)
    const k = t.game.inspect()
    expect(k.result.outcome).toBe(simulate(k.flight, k.keeperPlan).outcome)
  })

  it('closes when the page is put away, and tells the page so', async () => {
    const t = setup()
    await t.game.ready
    expect(t.win.listenerCount('pagehide')).toBe(1)
    t.win.dispatchEvent(new t.Event('pagehide'))
    await t.game.closed
    expect(t.overlay()).toBeFalsy()
    expect(t.win.listenerCount('pagehide')).toBe(0)
    expect(t.win.listenerCount('blur')).toBe(0)
    expect(t.win.events.filter((e) => e.type === 'arcade:game').map((e) => e.detail)).toEqual([{ open: true }, { open: false }])
  })

  it('is a little kinder in goal for the first two saves of a device\'s first shootout, and only then', async () => {
    // A first visit: nothing kept on this device when the game opens.
    const t = setup({ seed: 5 })
    await t.game.ready
    const kinds = []
    for (let i = 0; i < 120 && t.game.state().phase !== 'results'; i++) {
      if (!untilPhase(t, ['aim', 'save', 'results'])) break
      const { phase } = t.game.state()
      if (phase === 'aim') keyShot(t)
      else if (phase === 'save') {
        const faced = t.game.state().shootout.kicks.filter((k) => k.side === 'them').length
        if (kinds.length === faced) kinds.push(t.game.inspect().kind)
        keySave(t, 'ArrowLeft')
      }
      t.advance(600)
    }
    expect(kinds.slice(0, 4)).toEqual([true, true, false, false])
    // Play again: no longer the first shootout.
    t.advance(1500)
    t.overlay().querySelectorAll('button').find((b) => b.textContent === 'Play again').click()
    t.advance(800)
    keyShot(t)
    expect(untilPhase(t, ['save'])).toBe(true)
    expect(t.game.inspect().kind).toBe(false)

    // A device that has played before is not given it.
    const b = createFakeBrowser()
    b.store.set('winterfayre-penalties:wicklewood-u12', JSON.stringify({ played: 3, won: 1, best: null }))
    const game = openShootout(CONFIG, { window: b.win, document: b.doc, seed: 5 })
    const u = { ...b, game }
    await game.ready
    keyShot(u)
    expect(untilPhase(u, ['save'])).toBe(true)
    expect(game.inspect().kind).toBe(false)
  })

  it('has no Share or Copy link on a draft, whose only address is its secret link', async () => {
    const b = createFakeBrowser()
    const page = b.doc.createElement('main')
    b.doc.body.appendChild(page)
    const events = []
    const game = openShootout({ ...CONFIG, url: null, share: false }, { window: b.win, document: b.doc, seed: 7, onEvent: (type, detail) => events.push({ type, ...detail }) })
    const t = { ...b, game, events }
    await game.ready
    for (let i = 0; i < 120 && game.state().phase !== 'results'; i++) {
      if (!untilPhase(t, ['aim', 'save', 'results'])) break
      if (game.state().phase === 'aim') keyShot(t)
      else if (game.state().phase === 'save') keySave(t, 'ArrowLeft')
      t.advance(600)
    }
    t.advance(1500)
    expect(game.state().phase).toBe('results')
    const o = b.doc.body.children.find((c) => c.getAttribute('role') === 'dialog')
    const share = o.querySelector('.tso-results').querySelectorAll('button').find((x) => /Share|Copy link/.test(x.textContent))
    expect(share.hasAttribute('hidden')).toBe(true)
    t.key('keydown', 'Tab')
    expect(b.doc.activeElement.textContent).toBe('Play again')
    t.key('keydown', 'Tab')
    expect(b.doc.activeElement.textContent).toBe('Leave game')
  })

  it('puts Play again first after the title on the results, for Tab', async () => {
    const t = setup({ seed: 7 })
    await t.game.ready
    for (let i = 0; i < 120 && t.game.state().phase !== 'results'; i++) {
      if (!untilPhase(t, ['aim', 'save', 'results'])) break
      const { phase } = t.game.state()
      if (phase === 'aim') keyShot(t)
      else if (phase === 'save') keySave(t, 'ArrowLeft')
      t.advance(600)
    }
    t.advance(1500)
    expect(t.game.state().phase).toBe('results')
    expect(t.doc.activeElement.textContent).toMatch(/^You (won|lost)/)
    t.key('keydown', 'Tab')
    expect(t.doc.activeElement.textContent).toBe('Play again')
  })
})

describe('the section\'s Play button', () => {
  it('shows once the script is there, loads the game only when tapped, and hands focus back', async () => {
    const b = createFakeBrowser()
    const holder = b.doc.createElement('div')
    b.doc.body.appendChild(holder)
    const section = b.doc.createElement('section')
    section.setAttribute('data-shootout', JSON.parse(JSON.stringify(renderShootoutSection(CONFIG).match(/data-shootout="([^"]*)"/)[1])).replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    const button = b.doc.createElement('button')
    button.setAttribute('data-shootout-play', '')
    button.setAttribute('hidden', '')
    button.textContent = 'Play the shootout'
    const status = b.doc.createElement('p')
    status.setAttribute('data-shootout-status', '')
    section.appendChild(button)
    section.appendChild(status)
    holder.appendChild(section)
    let loads = 0
    let opened = null
    const count = enhanceShootout({
      root: b.doc,
      load: async () => { loads++; return { openShootout: (config, options) => { opened = { config, options }; return {} } } },
    })
    expect(count).toBe(1)
    expect(button.hasAttribute('hidden')).toBe(false)
    expect(loads).toBe(0)
    button.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(loads).toBe(1)
    expect(opened.options.returnFocus).toBe(button)
    expect(opened.config.siteName).toBe('Wicklewood Wanderers Under-12s')
    expect(button.textContent).toBe('Play the shootout')
  })

  it('says so in words when the game cannot load', async () => {
    const b = createFakeBrowser()
    const section = b.doc.createElement('section')
    section.setAttribute('data-shootout', '{}')
    const button = b.doc.createElement('button')
    button.setAttribute('data-shootout-play', '')
    const status = b.doc.createElement('p')
    status.setAttribute('data-shootout-status', '')
    section.appendChild(button)
    section.appendChild(status)
    b.doc.body.appendChild(section)
    enhanceShootout({ root: b.doc, load: async () => { throw new Error('offline') } })
    button.click()
    // The page's own 3D is told at once, and told again when it will not open.
    expect(b.win.events.map((e) => e.detail)).toEqual([{ open: true }])
    await new Promise((r) => setTimeout(r, 0))
    expect(status.textContent).toBe('The game could not load. Check your connection and try again.')
    expect(b.win.events.map((e) => e.detail)).toEqual([{ open: true }, { open: false }])
  })
})
