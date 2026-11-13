// The shootout itself: loaded only when Play is tapped (index.js), it
// opens the overlay, draws the pitch in 3D where WebGL works and in 2D
// where it does not, and runs the kicks: the visitor's, then the
// computer's, best of five, then sudden death, then the results.
//
// Nothing leaves the device: the best result is kept in localStorage
// (storage.js), and sharing is the visitor's own share sheet or Copy link.

import { announce, buildOverlay, openOverlay, setPrompt, setTracker, show } from './overlay.js'
import { injectStyles } from './styles.js'
import * as R from './rules.js'
import { launch, simulate, pathAt, keeperPose, predictCrossing, aimPoint, GOAL, SPOT, SHOT } from './physics.js'
import { answerEarlyDive, FIRST_GAME, keeperLevel, keeperPlan, kickSeen, playerDivePlan, playerKeeperLevel, runupProgress, runupTime, takerFor, takerLevel, takerOrder, takerPlan, TAKER } from './keeper.js'
import { aimWords, isShootKey, KEYS, keyboardAim, keyboardShot, keyToDive, powerAfter, swipeAim, swipeToDive, swipeToShot } from './input.js'
import { kits as makeKits } from './kit.js'
import { makeRng } from './rng.js'
import { pickLook, HOME_KEEPER_LOOK } from './looks.js'
import { effects, prefersReducedMotion, shakeOffset, slowMotionScale } from './motion.js'
import { createAudio } from './audio.js'
import { boardLogosFrom, topSignFrom } from './boards.js'
import { loadRecord, saveResult } from './storage.js'
import { canShare, shareLink, shareResult, shareText } from './share.js'
import { banner as bannerFor, hintFor, outcomeWords, promptFor, turnWords } from './copy.js'
import { createFx } from './fx.js'
import { createScene2D } from './scene2d.js'

// Timings, in seconds of game time.
export const TIMING = {
  step: 0.3, // the visitor's step into the ball after the swipe
  wait: 0.85, // before the computer's taker sets off (the run up is the taker's own)
  hold: 1.55, // the banner, before the next kick
  holdDeciding: 2.2,
  strike: 0.16, // the kicking leg's swing
  earliestMove: -0.32, // a dive before this still commits, but the keeper only sets off here
}

const READY = { kind: 'ready', start: 0, duration: 1 }
// The arcade plays all five kicks each (rules.js), so a score and a
// prize mean the same for every visitor.
const FULL = true

// The score the day's leaderboard counts: a point for every goal the
// visitor scores and every save they make.
export const pointsFor = (stats) => stats.goals + stats.saves

export function webglAvailable(doc = globalThis.document) {
  try {
    const canvas = doc.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension?.('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

// Which pitch to draw: 3D where WebGL works and nothing says otherwise.
export function chooseRenderer({ webgl, forceFallback = false }) {
  return webgl && !forceFallback ? '3d' : '2d'
}

const screenToWorld = (dir) => (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)

export function openShootout(config, options = {}) {
  const win = options.window || globalThis.window
  const doc = options.document || win.document
  const reduce = options.reduceMotion ?? prefersReducedMotion(win)
  const fxOn = effects(reduce)
  const seed = options.seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
  const rng = makeRng(seed)
  // Looks come from a random source of their own, so how a player looks
  // never touches how the shootout goes.
  const lookRng = makeRng((seed ^ 0x2c1b3c6d) >>> 0)
  const touch = (() => {
    try { return win.matchMedia('(pointer: coarse)').matches } catch { return false }
  })()
  const emit = (type, detail = {}) => {
    try { options.onEvent?.(type, detail) } catch { /* a listener's problem is not the game's */ }
  }
  const allKits = makeKits(config.colours)

  injectStyles(doc)
  const ui = buildOverlay(doc, config)
  // The leaderboard speaks through the game's own live region.
  if (options.board) options.board.say = (text) => announce(ui, text, win)
  if (reduce) ui.root.setAttribute('data-reduced', 'true')
  const view2dCanvas = doc.createElement('canvas')
  view2dCanvas.className = 'tso-view'

  let stopped = false
  let resolveClosed
  const closed = new Promise((r) => { resolveClosed = r })
  const closeOverlay = openOverlay(ui, { doc, win, returnFocus: options.returnFocus, onLeave: () => close() })
  try { win.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open: true } })) } catch { /* old browser */ }

  const audio = createAudio(win)
  const fx = createFx(ui.fx, { accent: config.colours.accent, primary: config.colours.primary, win })
  let view = null
  let raf = 0
  let lastNow = 0
  let clock = 0
  let hidden = false
  const timers = new Set()
  const later = (fn, ms) => {
    const id = win.setTimeout(() => { timers.delete(id); if (!stopped) fn() }, ms)
    timers.add(id)
    return id
  }

  // ── State ────────────────────────────────────────────────────────────
  let shootout = R.newShootout({ first: 'us', full: FULL })
  let stats = { goals: 0, shots: 0, saves: 0 }
  // The computer's five takers in this shootout, and where the visitor's
  // kicks have gone, which its keeper remembers.
  let takers = takerOrder(rng)
  // The first shootout on this device is a little kinder in goal.
  const firstOnDevice = loadRecord(config.storageKey, win).played === 0
  let shootoutsHere = 0
  // The home keeper is always herself (looks.js). The other team's is
  // picked at random. A pick is still drawn for the home keeper, so the
  // rest of the looks fall as they always have.
  const pickKeepers = () => {
    pickLook(lookRng)
    return { us: HOME_KEEPER_LOOK, them: pickLook(lookRng) }
  }
  let keeperLooks = pickKeepers()
  let theirKicks = 0
  let history = []
  let kick = null
  let phase = 'loading'
  const hints = { us: true, them: true }
  let aim = { ...KEYS.start }
  let aimShown = false
  let aimFaint = false
  let charging = null
  let pointer = null
  let bannerTimer = 0
  let shake = { at: -1, strength: 0 }
  let aimWordsTimer = 0
  // The last kick's outcome, said with what comes next in one go, so a
  // screen reader is not cut off by the next announcement.
  let said = ''
  // Who is in which kit for the kick in play, for a view made mid-game.
  let teams = null

  const setPhase = (p) => {
    phase = p
    ui.root.setAttribute('data-phase', p)
  }

  // ── The view ─────────────────────────────────────────────────────────
  function measure() {
    const r = ui.stage.getBoundingClientRect()
    return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), dpr: Math.min(2, win.devicePixelRatio || 1) }
  }
  function resize() {
    if (!view) return
    const m = measure()
    view.resize(m.width, m.height, m.dpr)
    fx.resize(m.width, m.height, m.dpr)
  }

  function use2D() {
    view?.dispose()
    ui.stage.insertBefore(view2dCanvas, ui.fx)
    view = createScene2D({ canvas: view2dCanvas, colours: config.colours, kits: allKits, boards: config.boards, boardLogos: boardLogosFrom(doc), win, doc })
    if (teams) view.setTeams(teams)
  }

  async function start() {
    const kind = chooseRenderer({ webgl: webglAvailable(doc), forceFallback: options.forceFallback })
    if (kind === '3d') {
      try {
        const { createScene3D } = await import('./scene3d.js')
        if (stopped) return
        const canvas = doc.createElement('canvas')
        canvas.className = 'tso-view'
        ui.stage.insertBefore(canvas, ui.fx)
        view = await createScene3D({
          canvas, colours: config.colours, kits: allKits, boards: config.boards, boardLogos: boardLogosFrom(doc), topSign: topSignFrom(doc), win, doc,
          onLost: () => { canvas.remove(); use2D(); resize() },
        })
      } catch (err) {
        view = null
        emit('fallback', { reason: String(err?.message || err) })
      }
    }
    if (stopped) { view?.dispose(); return }
    if (!view) use2D()
    ui.root.setAttribute('data-renderer', view.kind)
    resize()
    emit('ready', { renderer: view.kind })
    startKick()
    lastNow = win.performance.now()
    raf = win.requestAnimationFrame(frame)
  }

  // ── The loop ─────────────────────────────────────────────────────────
  function timeScale() {
    if (!kick || !kick.slow || !kick.result || kick.stage !== 'flight') return 1
    return slowMotionScale(clock - kick.strikeAt, kick.result.decidedAt, true)
  }

  function frame(now) {
    if (stopped || hidden) return
    raf = win.requestAnimationFrame(frame)
    const realDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000))
    lastNow = now
    clock += realDt * timeScale()
    step()
    if (charging) {
      const p = powerAfter(now - charging.since)
      ui.powerFill.style.height = `${Math.round(p * 100)}%`
      ui.power.setAttribute('data-hot', String(p > SHOT.liftFrom))
    }
    view.draw(sceneState(now / 1000))
    fx.draw(realDt, now)
  }

  function sceneState(nowSec) {
    const mode = kick?.side === 'them' ? 'save' : 'shoot'
    const t = kick && kick.strikeAt !== null ? clock - kick.strikeAt : null
    let ball = { ...SPOT }
    if (kick?.result && t !== null && t >= 0) ball = pathAt(kick.result.path, t)
    const keeperPlanNow = kick?.keeperPlan || READY
    const keeper = keeperPose(keeperPlanNow, t === null ? -99 : t)
    let taker = { phase: 'ready', u: 0 }
    if (kick && t !== null) {
      if (kick.side === 'us') {
        if (t < 0) taker = { phase: 'runup', u: 1 + t / TIMING.step }
        else if (t < TIMING.strike) taker = { phase: 'strike', u: t / TIMING.strike }
        else taker = { phase: 'follow', u: Math.min(1, (t - TIMING.strike) / 0.6) }
      } else if (kick.stage !== 'wait') {
        if (t < 0) taker = { phase: 'runup', ...runupProgress(kick.plan, clock - kick.runupAt) }
        else if (t < TIMING.strike) taker = { phase: 'strike', u: t / TIMING.strike }
        else taker = { phase: 'follow', u: Math.min(1, (t - TIMING.strike) / 0.6) }
      }
      if (kick.side === 'them') Object.assign(taker, { tellDir: kick.plan.tell.dir, high: kick.plan.tell.high })
    }
    const aimPt = aimShown && kick?.side === 'us' && kick.stage === 'aim' ? { ...aimPoint(aim), faint: aimFaint } : null
    const follow = fxOn.follow && kick?.side === 'us' && t !== null && t > 0 ? Math.min(1, t / 0.8) : 0
    const s = shakeOffset(clock - shake.at, shake.strength * fxOn.shake, shake.at)
    const holding = Boolean(kick?.result?.caught && t !== null && kick.result.events.some((e) => e.type === 'keeper' && e.t <= t))
    return { mode, t, ball, keeper, holding, taker, aim: aimPt, follow, shake: s, now: nowSec, power: charging ? powerAfter(win.performance.now() - charging.since) : null }
  }

  // ── The kicks ────────────────────────────────────────────────────────
  function startKick() {
    const side = R.nextSide(shootout)
    if (!side) return showResults()
    const sudden = R.isSuddenDeath(shootout)
    const round = R.roundOf(shootout)
    const words = promptFor(side, { round, suddenDeath: sudden })
    const hint = hints[side] ? hintFor(side, touch, view?.kind) : ''
    hints[side] = false
    setPrompt(ui, { ...words, hint })
    setTracker(ui, R.trackerRows(shootout), R.tally(shootout))
    hideBanner(true)
    fx.clearTrail()
    show(ui.power, false)
    show(ui.zones, side === 'them')
    for (const b of ui.diveButtons) b.removeAttribute('data-picked')
    aimShown = false
    aimFaint = false
    aim = { ...KEYS.start }
    charging = null
    let plan = null
    if (side === 'them') plan = takerPlan(rng, takerLevel({ suddenDeath: sudden }), takerFor(takers, theirKicks++, rng))
    // Each taker's look is picked afresh, whatever kind of taker it is.
    teams = side === 'us'
      ? { taker: allKits.home, keeper: allKits.awayKeeper, number: '9', look: pickLook(lookRng), keeperLook: keeperLooks.them }
      : { taker: allKits.away, keeper: allKits.homeKeeper, number: plan.number, look: pickLook(lookRng), keeperLook: keeperLooks.us }
    view?.setTeams?.(teams)
    if (side === 'us') {
      kick = { side, stage: 'aim', strikeAt: null, keeperPlan: null, result: null, eventIndex: 0, banner: false }
      setPhase('aim')
    } else {
      // Each taker's own run up, so no two kicks have the same rhythm.
      const runupAt = clock + TIMING.wait
      const kind = firstOnDevice && shootoutsHere === 0 && theirKicks <= FIRST_GAME.saves
      kick = { side, stage: 'wait', plan, runupAt, strikeAt: runupAt + runupTime(plan), keeperPlan: null, result: null, eventIndex: 0, banner: false, dive: null, switched: false, keeperLevel: playerKeeperLevel({ kind }), kind }
      setPhase('save')
    }
    // The keys work at once, whatever was last pressed.
    if (ui.root.contains(doc.activeElement)) ui.stage.focus()
    audio.whistle()
    announce(ui, [said, turnWords(side, { round, suddenDeath: sudden })].filter(Boolean).join(' '), win)
    said = ''
    emit('kick', { side, round, suddenDeath: sudden })
  }

  // The visitor's shot, from a swipe or the keys.
  function shoot(shot) {
    if (!kick || kick.side !== 'us' || kick.stage !== 'aim') return
    const sudden = R.isSuddenDeath(shootout)
    const flight = launch(shot, rng)
    const plan = keeperPlan(flight, keeperLevel({ suddenDeath: sudden }), rng, history)
    history.push(kickSeen(flight))
    const result = simulate(flight, plan)
    Object.assign(kick, { stage: 'step', shot, flight, keeperPlan: plan, result, strikeAt: clock + TIMING.step })
    kick.slow = winningKick(result)
    setPrompt(ui, {})
    show(ui.power, false)
    charging = null
    aimShown = false
    aimFaint = false
    emit('shot', { shot, outcome: result.outcome })
  }

  // Whether this kick wins it for the visitor: then it plays in slow
  // motion (not with reduced motion).
  function winningKick(result) {
    if (!fxOn.slowMotion) return false
    const st = R.stakes(shootout)
    if (!st) return false
    return (result.scored ? st.ifScored : st.ifMissed) === 'us'
  }

  // A dive in goal: dir is 'left', 'right' or 'up' as the screen shows.
  // at is the game clock when the visitor moved (a tap is read when the
  // finger lifts, but counts from when it touched). Once the ball has
  // gone, a dive is one after the strike whenever the finger went down:
  // the result is worked out again with it, and the taker, who has
  // already struck, can no longer change his mind.
  function dive(dir, at = clock) {
    if (!kick || kick.side !== 'them' || kick.dive || kick.stage === 'wait') return
    const struck = Boolean(kick.result)
    const t = struck ? Math.max(0, Math.min(at, clock) - kick.strikeAt) : Math.min(at, clock) - kick.strikeAt
    if (struck && t >= predictCrossing(kick.flight, 1).t) return
    const worldDir = screenToWorld(dir)
    kick.dive = { dir: worldDir, start: t }
    for (const b of ui.diveButtons) b.setAttribute('data-picked', String(b.getAttribute('data-dive') === dir))
    setPrompt(ui, {})
    if (!struck) {
      // Before the strike: the taker may see it, and the keeper commits
      // to the side on what the taker's body says.
      // A keeper who goes very early is seen going, but sets off only
      // just before the strike rather than lying down during the run up.
      const answered = answerEarlyDive(kick.plan, worldDir, t, rng, TAKER)
      kick.plan = answered
      kick.switched = answered.switched
      kick.keeperPlan = playerDivePlan(worldDir, Math.max(t, TIMING.earliestMove), launch(answered.shot), rng, kick.keeperLevel) || READY
    } else {
      kick.keeperPlan = playerDivePlan(worldDir, t, kick.flight, rng, kick.keeperLevel) || READY
      const result = simulate(kick.flight, kick.keeperPlan)
      kick.result = result
      kick.slow = winningKick(result)
      // What has already happened by now has been seen and heard.
      const now = clock - kick.strikeAt
      kick.eventIndex = result.events.filter((e) => e.t <= now).length
    }
    emit('dive', { dir, start: t })
  }

  function step() {
    if (!kick) return
    if (kick.side === 'them' && kick.stage === 'wait' && clock >= kick.runupAt) {
      kick.stage = 'runup'
      // Out of the way of the taker's tells; a first hint stays until the strike.
      setPrompt(ui, { hint: ui.hint.textContent })
    }
    if (kick.side === 'them' && kick.stage === 'runup' && clock >= kick.strikeAt) {
      kick.flight = launch(kick.plan.shot, rng)
      kick.keeperPlan = kick.keeperPlan || READY
      kick.result = simulate(kick.flight, kick.keeperPlan)
      kick.slow = winningKick(kick.result)
      kick.stage = 'flight'
      audio.kick(kick.plan.shot.power)
      setPrompt(ui, {})
      emit('strike', { side: 'them' })
    }
    if (kick.side === 'us' && kick.stage === 'step' && clock >= kick.strikeAt) {
      kick.stage = 'flight'
      audio.kick(kick.shot.power)
      emit('strike', { side: 'us' })
    }
    if (kick.stage !== 'flight') return
    const t = clock - kick.strikeAt
    const { result } = kick
    while (kick.eventIndex < result.events.length && result.events[kick.eventIndex].t <= t) {
      onEvent(result.events[kick.eventIndex])
      kick.eventIndex += 1
    }
    if (!kick.banner && t >= result.decidedAt) {
      kick.banner = true
      onOutcome()
    }
    const deciding = R.stakes(shootout)?.deciding
    if (kick.banner && t >= result.decidedAt + (deciding ? TIMING.holdDeciding : TIMING.hold) && kick.stage === 'flight') {
      kick.stage = 'done'
      finishKick()
    }
  }

  function onEvent(e) {
    if (e.type === 'post' || e.type === 'bar') {
      audio.clang()
      shake = { at: clock, strength: 1 }
    } else if (e.type === 'net') {
      audio.swish(Math.min(1, 0.4 + (e.speed || 0) / 10))
      view.ripple?.({ x: e.x, y: e.y, z: e.z }, Math.min(1, 0.35 + (e.speed || 0) / 8))
    } else if (e.type === 'keeper') {
      audio.kick(0.2)
    } else if (e.type === 'board') {
      audio.kick(0.1)
    }
  }

  function onOutcome() {
    const { result } = kick
    const line = result.events.find((e) => e.type === 'line')
    const plan = kick.keeperPlan
    const b = bannerFor(kick.side, result.outcome, {
      opponentName: config.opponentName,
      switched: kick.switched,
      woodwork: result.woodwork,
      caught: result.caught,
      topCorner: Boolean(line && Math.abs(line.x) > 2.6 && line.y > 1.55),
      wrongWay: Boolean(line && plan && plan.kind === 'dive' && Math.sign(plan.target.x) === -Math.sign(line.x) && Math.abs(line.x) > 0.8),
    })
    showBanner(b)
    // The dots and the score change with the banner, not after it.
    const after = R.addKick(shootout, result.scored)
    setTracker(ui, R.trackerRows(after), R.tally(after))
    const goodForUs = b.good
    if (kick.side === 'us' && result.scored) {
      audio.cheer()
      if (fxOn.crowd) view.celebrate?.(2.2)
    } else if (kick.side === 'them' && !result.scored) {
      audio.cheer()
      if (fxOn.crowd && result.outcome === 'saved') view.celebrate?.(1.6)
    } else {
      audio.groan()
    }
    emit('outcome', { side: kick.side, outcome: result.outcome, good: goodForUs, woodwork: result.woodwork, switched: kick.switched || false })
  }

  function finishKick() {
    const { result, side } = kick
    shootout = R.addKick(shootout, result.scored)
    if (side === 'us') {
      stats.shots += 1
      if (result.scored) stats.goals += 1
    } else if (result.outcome === 'saved') {
      stats.saves += 1
    }
    setTracker(ui, R.trackerRows(shootout), R.tally(shootout))
    said = outcomeWords(side, result.outcome, shootout, config.opponentName, { switched: kick.switched })
    hideBanner()
    if (R.isOver(shootout)) {
      later(showResults, 450)
      return
    }
    transition(startKick)
  }

  // Between kicks: a sweep of the site's colours, or a fade with reduced
  // motion.
  function transition(next) {
    if (fxOn.transition === 'sweep') {
      ui.root.setAttribute('data-wipe', 'on')
      later(next, 300)
      later(() => ui.root.removeAttribute('data-wipe'), 660)
    } else {
      ui.root.setAttribute('data-fade', 'out')
      later(() => { next(); ui.root.removeAttribute('data-fade') }, 300)
    }
  }

  // ── The banner ───────────────────────────────────────────────────────
  function showBanner({ word, sub, good }) {
    win.clearTimeout(bannerTimer)
    ui.bannerWord.textContent = word
    ui.bannerSub.textContent = sub || ''
    ui.banner.style.setProperty?.('--len', String(Math.max(4, word.length)))
    ui.banner.setAttribute('data-good', String(good))
    ui.banner.classList.remove('is-out', 'is-in')
    show(ui.banner, true)
    void ui.banner.offsetWidth
    ui.banner.classList.add('is-in')
  }
  function hideBanner(now = false) {
    if (ui.banner.hasAttribute('hidden')) return
    if (now) {
      show(ui.banner, false)
      return
    }
    ui.banner.classList.remove('is-in')
    ui.banner.classList.add('is-out')
    bannerTimer = later(() => show(ui.banner, false), 320)
  }

  // ── The results ──────────────────────────────────────────────────────
  function showResults() {
    setPhase('results')
    shootoutsHere += 1
    kick = null
    show(ui.zones, false)
    setPrompt(ui, {})
    const t = R.tally(shootout)
    const won = R.winner(shootout) === 'us'
    const { record, newBest } = saveResult(config.storageKey, { won, us: t.us, them: t.them, saves: stats.saves }, win)
    const best = record.best
    const r = ui.results
    r.eyebrow.textContent = won ? 'Shootout won' : 'Shootout over'
    r.title.textContent = R.resultLine(shootout)
    r.goals.textContent = `${stats.goals} of ${stats.shots}`
    r.saves.textContent = String(stats.saves)
    r.points.textContent = String(pointsFor(stats))
    // The day's leaderboard, when the page has one (games/board.js).
    r.extra.replaceChildren?.()
    options.board?.show(r.extra, pointsFor(stats))
    r.best.textContent = best ? `${best.won ? 'Won' : 'Lost'} ${R.scoreWords(best.us, best.them)}` : `${won ? 'Won' : 'Lost'} ${R.scoreWords(t.us, t.them)}`
    show(r.newBest, newBest && record.played > 1)
    r.share.textContent = canShare(win.navigator) ? 'Share' : 'Copy link'
    // A draft's only address is its secret link: nothing to share.
    show(r.share, config.share !== false)
    r.note.textContent = ''
    show(r.link, false)
    show(r.root, true)
    r.title.focus()
    if (won) {
      audio.roar()
      if (fxOn.confetti) fx.confetti()
      if (fxOn.crowd) view?.celebrate?.(4)
    } else {
      audio.groan()
    }
    announce(ui, [said, `${R.resultLine(shootout)}. You scored ${stats.goals} of ${stats.shots} and made ${stats.saves} ${stats.saves === 1 ? 'save' : 'saves'}.`].filter(Boolean).join(' '), win)
    said = ''
    emit('results', { won, us: t.us, them: t.them, goals: stats.goals, shots: stats.shots, saves: stats.saves, newBest })
  }

  function playAgain() {
    show(ui.results.root, false)
    fx.stopConfetti()
    shootout = R.newShootout({ first: 'us', full: FULL })
    stats = { goals: 0, shots: 0, saves: 0 }
    options.board?.next()
    ui.results.extra.replaceChildren?.()
    takers = takerOrder(rng)
    keeperLooks = pickKeepers()
    theirKicks = 0
    history = []
    ui.stage.focus()
    emit('again')
    transition(startKick)
  }

  async function shareIt() {
    if (config.share === false) return
    const t = R.tally(shootout)
    const won = R.winner(shootout) === 'us'
    const url = shareLink(config.url, win)
    const text = shareText({ won, us: t.us, them: t.them, siteName: config.siteName })
    const how = await shareResult({ title: config.siteName, text, url }, win.navigator)
    const r = ui.results
    if (how === 'copied') r.note.textContent = 'Link copied. Paste it anywhere to share.'
    else if (how === 'shared') r.note.textContent = 'Thanks for sharing.'
    else if (how === 'failed') {
      r.note.textContent = 'Copy this link to share it.'
      r.link.value = url
      show(r.link, true)
      r.link.focus()
      r.link.select?.()
    }
  }

  // ── Input ────────────────────────────────────────────────────────────
  // Where and when the browser saw a pointer: its own time stamp, which
  // shares performance.now's clock, rather than when the handler ran.
  function stagePoint(e) {
    const r = ui.stage.getBoundingClientRect()
    const t = Number.isFinite(e.timeStamp) && e.timeStamp > 0 ? e.timeStamp : win.performance.now()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return
    if (e.target !== ui.stage && !ui.stage.contains(e.target)) return
    if (phase !== 'aim' && phase !== 'save') return
    pointer = { id: e.pointerId, points: [stagePoint(e)], at: clock, dived: false }
    try { ui.stage.setPointerCapture?.(e.pointerId) } catch { /* not captured: still tracked */ }
    const p = pointer.points[0]
    fx.addTrail(p.x, p.y, p.t)
    if (phase === 'aim' && kick?.stage === 'aim') setPrompt(ui, {})
  }
  function onPointerMove(e) {
    if (!pointer || e.pointerId !== pointer.id) return
    // Every point the browser saw since the last event, for a true speed.
    const seen = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
    for (const one of seen.length ? seen : [e]) {
      const p = stagePoint(one)
      pointer.points.push(p)
      fx.addTrail(p.x, p.y, p.t)
    }
    if (pointer.points.length > 160) pointer.points.splice(1, pointer.points.length - 160)
    const last = pointer.points[pointer.points.length - 1]
    if (phase === 'aim' && kick?.stage === 'aim') {
      // A faint marker under the finger: where the shot will go.
      const geom = view.geometry()
      if (last.y < geom.ball.y - 20) {
        aim = swipeAim(pointer.points[0], last, geom)
        aimShown = true
        aimFaint = true
      }
    } else if (phase === 'save' && !pointer.dived) {
      // A dive as soon as the swipe says which way, as a key would.
      const dir = swipeToDive(pointer.points)
      if (dir) {
        pointer.dived = true
        dive(dir)
      }
    }
  }
  function onPointerUp(e) {
    if (!pointer || e.pointerId !== pointer.id) return
    const { points, at, dived } = pointer
    pointer = null
    aimFaint = false
    if (phase === 'aim' && kick?.stage === 'aim') {
      const geom = view.geometry()
      const shot = swipeToShot(points, geom)
      const last = points[points.length - 1]
      const tapped = points.length && Math.hypot(last.x - points[0].x, last.y - points[0].y) < 20
      if (shot) shoot(shot)
      else if (tapped && view.tapToAim && last.y < geom.ball.y - 20) {
        // The flat pitch: a tap on the goal shoots there, firmly.
        shoot({ ...view.tapToAim(last.x, last.y), power: 0.6, curve: 0 })
      } else if (tapped) {
        setPrompt(ui, { title: 'Your kick', hint: view.tapToAim ? hintFor('us', touch, '2d') : touch ? 'Swipe up from the ball to shoot.' : 'Drag up from the ball to shoot.' })
      }
    } else if (phase === 'save' && !dived) {
      let dir = swipeToDive(points)
      let when = clock
      if (!dir && points.length) {
        const last = points[points.length - 1]
        const moved = Math.hypot(last.x - points[0].x, last.y - points[0].y)
        if (moved < 16) {
          // A tap on a side: it counts from when the finger touched.
          const w = measure().width
          dir = last.x < w / 3 ? 'left' : last.x > (2 * w) / 3 ? 'right' : 'up'
          when = at
        }
      }
      if (dir) dive(dir, when)
    }
  }
  function onPointerCancel() {
    pointer = null
    aimFaint = false
  }

  // A charge never sticks: a held Space that the page stops hearing (the
  // window left, the tab hidden) is let go of without a kick.
  function dropCharge() {
    if (!charging) return
    charging = null
    show(ui.power, false)
  }

  function onKeyDown(e) {
    if (stopped) return
    const onControl = e.target && e.target !== ui.stage && /^(BUTTON|INPUT|A)$/.test(e.target.tagName || '')
    if (phase === 'aim' && kick?.stage === 'aim') {
      const next = keyboardAim(aim, e.key)
      if (next) {
        e.preventDefault()
        aim = next
        aimShown = true
        setPrompt(ui, { title: 'Your kick', hint: 'Hold Space to build power. Let go to shoot.' })
        win.clearTimeout(aimWordsTimer)
        aimWordsTimer = later(() => announce(ui, aimWords(aim), win), 260)
        return
      }
      if (isShootKey(e.key) && !onControl) {
        e.preventDefault()
        if (!e.repeat && !charging) {
          charging = { since: win.performance.now() }
          aimShown = true
          ui.powerFill.style.height = '0%'
          show(ui.power, true)
          setPrompt(ui, {})
        }
      }
      return
    }
    if (phase === 'save') {
      const dir = keyToDive(e.key)
      if (dir) {
        e.preventDefault()
        dive(dir)
      }
    }
  }
  function onKeyUp(e) {
    if (!charging || !isShootKey(e.key)) return
    e.preventDefault()
    const held = win.performance.now() - charging.since
    charging = null
    shoot(keyboardShot(aim, held))
  }

  function onVisibility() {
    if (doc.visibilityState === 'hidden') {
      dropCharge()
      hidden = true
      win.cancelAnimationFrame(raf)
      audio.suspend()
    } else if (hidden) {
      hidden = false
      audio.resume()
      lastNow = win.performance.now()
      if (view && !stopped) raf = win.requestAnimationFrame(frame)
    }
  }

  ui.stage.addEventListener('pointerdown', onPointerDown)
  ui.stage.addEventListener('pointermove', onPointerMove)
  ui.stage.addEventListener('pointerup', onPointerUp)
  ui.stage.addEventListener('pointercancel', onPointerCancel)
  ui.stage.addEventListener('lostpointercapture', onPointerCancel)
  doc.addEventListener('keydown', onKeyDown)
  doc.addEventListener('keyup', onKeyUp)
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('resize', resize)
  win.addEventListener('blur', dropCharge)
  win.addEventListener('pagehide', close)
  // A dive button goes as it is touched, as a key does; the click (from the
  // keyboard, or the touch's own) finds the dive already made.
  for (const b of ui.diveButtons) {
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return
      dive(b.getAttribute('data-dive'))
    })
    b.addEventListener('click', () => dive(b.getAttribute('data-dive')))
  }
  ui.music.addEventListener('click', () => {
    const on = audio.setMusic(ui.music.getAttribute('aria-checked') !== 'true')
    ui.music.setAttribute('aria-checked', String(on))
    ui.musicState.textContent = on ? 'On' : 'Off'
    if (phase === 'aim' || phase === 'save') ui.stage.focus()
  })
  ui.sound.addEventListener('click', () => {
    const on = ui.sound.getAttribute('aria-checked') !== 'true'
    const works = audio.setEnabled(on)
    const state = on && works
    ui.sound.setAttribute('aria-checked', String(state))
    ui.soundState.textContent = state ? 'On' : 'Off'
    if (on && !works) announce(ui, 'Sound is not available in this browser.', win)
    if (state) audio.whistle()
    // Back to the pitch, so Space shoots rather than switching it again.
    if (phase === 'aim' || phase === 'save') ui.stage.focus()
  })
  ui.results.again.addEventListener('click', playAgain)
  ui.results.share.addEventListener('click', () => { shareIt() })

  function close() {
    if (stopped) return
    stopped = true
    win.cancelAnimationFrame(raf)
    for (const id of timers) win.clearTimeout(id)
    timers.clear()
    ui.stage.removeEventListener('pointerdown', onPointerDown)
    ui.stage.removeEventListener('pointermove', onPointerMove)
    ui.stage.removeEventListener('pointerup', onPointerUp)
    ui.stage.removeEventListener('pointercancel', onPointerCancel)
    ui.stage.removeEventListener('lostpointercapture', onPointerCancel)
    doc.removeEventListener('keydown', onKeyDown)
    doc.removeEventListener('keyup', onKeyUp)
    doc.removeEventListener('visibilitychange', onVisibility)
    win.removeEventListener('resize', resize)
    win.removeEventListener('blur', dropCharge)
    win.removeEventListener('pagehide', close)
    try { view?.dispose() } catch { /* already gone */ }
    view = null
    fx.dispose()
    audio.dispose()
    closeOverlay()
    try { win.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open: false } })) } catch { /* old browser */ }
    emit('closed')
    resolveClosed()
  }

  const ready = start().catch((err) => {
    emit('error', { message: String(err?.message || err) })
    const note = doc.createElement('p')
    note.className = 'tso-error'
    note.textContent = 'The game could not start here. Leave the game and try again.'
    ui.root.appendChild(note)
  })

  return {
    ready,
    closed,
    close,
    // For the demo page's checks and the tests: where things stand.
    state: () => ({ phase, shootout, stats: { ...stats }, kick: kick && { side: kick.side, stage: kick.stage, outcome: kick.result?.outcome ?? null, switched: Boolean(kick.switched) }, renderer: view?.kind ?? null, reduce }),
    // For the tests: the kick as the game holds it, and seconds since the
    // strike (negative before it).
    inspect: () => kick && { t: kick.strikeAt === null ? null : clock - kick.strikeAt, flight: kick.flight ?? null, keeperPlan: kick.keeperPlan, result: kick.result, dive: kick.dive ?? null, switched: Boolean(kick.switched), plan: kick.plan ?? null, kind: Boolean(kick.kind) },
    goal: GOAL,
  }
}
