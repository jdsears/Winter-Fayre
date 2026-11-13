// Head to head (rules.js): how the players and the ball move, what a
// goal is, how the computer plays and how a run of wins is kept.
//
// Run with: npx vitest run client/headtohead/rules.test.js

import { describe, it, expect } from 'vitest'
import {
  W, GROUND, GOAL_D, BAR, BALL_R, HEAD_UP, MATCH_SECONDS, FIRST_SKILL, STREAK_KEY, BEST_KEY,
  newMatch, step, result, goalFor, headOf, bootOf, headerPower, sizeOf, ballR, barOf, dealPowers, POWERS, POWER_NAMES, DEAL, INVISIBLE_TIME, BIG_TIME, BIG_SIZE, FLAME_TIME, GIANT_TIME, GIANT_SIZE, WALL_TIME, SMALL_TIME, FREEZE_TIME, SWAP_TIME, computerInputs, newMind, nextSkill, afterMatch, readStreak, readBest,
} from './rules.js'

const rngOf = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const run = (m, inputs, seconds) => { let g = m; for (let i = 0; i < seconds * 60; i++) g = step(g, inputs, 1 / 60); return g }
const idle = { left: {}, right: {} }
// The computer playing the left side: the match seen in a mirror.
const mirror = (m) => {
  const flip = (p) => ({ ...p, x: W - p.x, vx: -p.vx, side: -p.side, face: -p.face })
  return { ...m, left: flip(m.right), right: flip(m.left), ball: { ...m.ball, x: W - m.ball.x, vx: -m.ball.vx } }
}
function play(skillLeft, skillRight, seed) {
  const rng = rngOf(seed)
  let m = newMatch()
  let right = newMind()
  let left = newMind()
  for (let i = 0; i < 60 * 240 && m.phase !== 'over'; i++) {
    right = computerInputs(m, skillRight, right, 1 / 60, rng)
    let mine = {}
    if (skillLeft !== null) {
      left = computerInputs(mirror(m), skillLeft, left, 1 / 60, rng)
      mine = { left: left.inputs.right, right: left.inputs.left, jump: left.inputs.jump, kick: left.inputs.kick }
    }
    m = step(m, { left: mine, right: right.inputs }, 1 / 60)
    expect(Number.isFinite(m.ball.x + m.ball.y)).toBe(true)
  }
  return m
}

describe('the players', () => {
  it('run, and stay out of the goals', () => {
    const m = run(newMatch(), { left: { left: true }, right: { right: true } }, 4)
    expect(m.left.x).toBeGreaterThan(GOAL_D)
    expect(m.left.x).toBeLessThan(120)
    expect(m.right.x).toBeLessThan(W - GOAL_D)
    expect(m.right.x).toBeGreaterThan(W - 120)
  })

  it('jump from the ground only, and come down', () => {
    let m = step(newMatch(), { left: { jump: true }, right: {} }, 1 / 60)
    expect(m.left.y).toBeLessThan(GROUND)
    const rising = m.left.vy
    m = step(m, { left: { jump: true }, right: {} }, 1 / 60)
    expect(m.left.vy).toBeGreaterThan(rising)
    expect(run(m, idle, 2).left.y).toBe(GROUND)
  })

  it('cannot stand in the same place', () => {
    const m = run(newMatch(), { left: { right: true }, right: { left: true } }, 3)
    expect(m.right.x - m.left.x).toBeGreaterThanOrEqual(38)
  })
})

describe('the ball', () => {
  it('comes off a head and goes up', () => {
    let m = newMatch()
    m = { ...m, ball: { x: m.left.x, y: headOf(m.left).y - 80, vx: 0, vy: 300, spin: 0 } }
    let headed = false
    for (let i = 0; i < 40 && !headed; i++) { m = step(m, idle, 1 / 60); headed = m.events.some(e => e.type === 'head') }
    expect(headed).toBe(true)
    expect(m.ball.vy).toBeLessThan(0)
  })

  it('is headed on purpose by a player in the air, hardest off the forehead', () => {
    const p = { ...newMatch().left, y: GROUND - 60 }
    const h = headOf(p)
    const at = (dx, dy) => headerPower(p, { x: h.x + dx, y: h.y + dy })
    // Up and in front of the head, full on; straight above, less; behind, none.
    expect(at(30, -24)).toBeGreaterThan(0.95)
    expect(at(0, -40)).toBeGreaterThan(0.5)
    expect(at(0, -40)).toBeLessThan(at(30, -24))
    expect(at(-30, 0)).toBe(0)
    expect(at(0, 40)).toBe(0)
    // The same ball met on the forehead leaves faster than one met on top.
    const struck = (dx, dy) => {
      let m = { ...newMatch(), left: { ...p, vy: -200 }, ball: { x: h.x + dx, y: h.y + dy, vx: 0, vy: 0, spin: 0 } }
      for (let i = 0; i < 6; i++) {
        m = step(m, idle, 1 / 60)
        const e = m.events.find(x => x.type === 'header')
        if (e) return { speed: Math.hypot(m.ball.vx, m.ball.vy), power: e.power, vx: m.ball.vx, nod: m.left.nod }
      }
      return null
    }
    const forehead = struck(24, -20)
    const top = struck(0, -34)
    expect(forehead.power).toBeGreaterThan(top.power)
    expect(forehead.speed).toBeGreaterThan(top.speed + 60)
    expect(forehead.vx).toBeGreaterThan(200)
    expect(forehead.nod).toBeGreaterThan(0)
  })

  it('only comes off the head of a player on the ground, with no header', () => {
    let m = newMatch()
    m = { ...m, ball: { x: m.left.x + 10, y: headOf(m.left).y - 60, vx: 0, vy: 250, spin: 0 } }
    const seen = []
    for (let i = 0; i < 30; i++) { m = step(m, idle, 1 / 60); seen.push(...m.events.map(e => e.type)) }
    expect(seen).toContain('head')
    expect(seen).not.toContain('header')
  })

  it('is sent forward and up by a kick, once for each kick', () => {
    let m = newMatch()
    m = { ...m, ball: { x: m.left.x + 44, y: GROUND - BALL_R, vx: 0, vy: 0, spin: 0 } }
    let kicks = 0
    let struck = null
    for (let i = 0; i < 30; i++) {
      m = step(m, { left: { kick: i < 3 }, right: {} }, 1 / 60)
      const n = m.events.filter(e => e.type === 'kick').length
      if (n && !struck) struck = m.ball
      kicks += n
    }
    expect(kicks).toBe(1)
    expect(struck.vx).toBeGreaterThan(300)
    expect(struck.vy).toBeLessThan(0)
    expect(bootOf(newMatch().left)).toBeNull()
  })

  it('goes straight up when both boots meet it at once', () => {
    let m = newMatch()
    m = { ...m, left: { ...m.left, x: 370 }, right: { ...m.right, x: 430 }, ball: { x: 400, y: GROUND - BALL_R - 6, vx: 0, vy: 0, spin: 0 } }
    let both = null
    for (let i = 0; i < 12 && !both; i++) {
      m = step(m, { left: { kick: true }, right: { kick: true } }, 1 / 60)
      if (m.events.filter(e => e.type === 'kick').length === 2) both = m
    }
    expect(both).not.toBeNull()
    expect(Math.abs(both.ball.vx)).toBeLessThan(150)
    expect(both.ball.vy).toBeLessThan(0)
  })

  it('stays on the pitch whatever is done to it', () => {
    let m = { ...newMatch(), ball: { x: 400, y: 100, vx: 5000, vy: -5000, spin: 0 } }
    for (let i = 0; i < 600; i++) {
      m = step(m, idle, 1 / 60)
      if (m.phase !== 'play') break
      expect(m.ball.x).toBeGreaterThanOrEqual(BALL_R - 0.01)
      expect(m.ball.x).toBeLessThanOrEqual(W - BALL_R + 0.01)
      expect(m.ball.y).toBeLessThanOrEqual(GROUND - BALL_R + 0.01)
    }
  })
})

describe('a goal', () => {
  it('is the ball under the bar and past the post, for the side attacking that goal', () => {
    expect(goalFor({ x: W - 20, y: GROUND - 30 })).toBe('left')
    expect(goalFor({ x: 20, y: GROUND - 30 })).toBe('right')
    expect(goalFor({ x: 20, y: BAR - 30 })).toBeNull()
    expect(goalFor({ x: W / 2, y: GROUND - 30 })).toBeNull()
    expect(goalFor({ x: GOAL_D + 2, y: GROUND - 30 })).toBeNull()
  })

  it('is counted, then the ball is dropped in the middle again', () => {
    let m = { ...newMatch(), ball: { x: W - GOAL_D - 30, y: GROUND - 60, vx: 500, vy: 0, spin: 0 } }
    let scored = null
    for (let i = 0; i < 60 && !scored; i++) { m = step(m, idle, 1 / 60); if (m.events.some(e => e.type === 'goal')) scored = m }
    expect(scored.score).toEqual({ left: 1, right: 0 })
    expect(scored.phase).toBe('goal')
    const clock = scored.clock
    // While it is celebrated the ball stays in the net.
    const during = run(scored, idle, 1)
    expect(during.phase).toBe('goal')
    expect(during.ball.x).toBeGreaterThan(W - GOAL_D)
    expect(during.ball.y).toBeGreaterThan(BAR)
    const after = run(scored, idle, 2.5)
    expect(after.phase).toBe('play')
    expect(after.ball.x).toBe(W / 2)
    expect(after.left.x).toBe(newMatch().left.x)
    // The clock stood still while the goal was celebrated.
    expect(after.clock).toBeGreaterThan(clock - 1.2)
  })

  it('a ball on top of the bar is not a goal', () => {
    let m = { ...newMatch(), ball: { x: 30, y: BAR - 60, vx: 0, vy: 0, spin: 0 } }
    for (let i = 0; i < 90; i++) { m = step(m, idle, 1 / 60); expect(m.score.right).toBe(0) }
  })
})

describe('the match', () => {
  it('lasts sixty seconds and then stands still', () => {
    const m = run(newMatch(), idle, MATCH_SECONDS + 1)
    expect(m.phase).toBe('over')
    expect(m.clock).toBe(0)
    expect(step(m, idle, 1)).toBe(step(step(m, idle, 1), idle, 1))
    expect(result({ score: { left: 2, right: 1 } })).toBe('win')
    expect(result({ score: { left: 0, right: 1 } })).toBe('lose')
    expect(result({ score: { left: 1, right: 1 } })).toBe('draw')
  })

  it('does not jump when a frame is late', () => {
    const m = step(newMatch(), idle, 5)
    expect(m.clock).toBeGreaterThan(MATCH_SECONDS - 0.1)
  })
})

describe('the computer', () => {
  it('scores against a player who stands still', () => {
    let goals = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) goals += play(null, 0.4, seed).score.right
    expect(goals).toBeGreaterThan(6)
  })

  it('is the same from either side: two the same are evenly matched', () => {
    let left = 0
    let right = 0
    for (let seed = 1; seed <= 16; seed++) { const m = play(0.5, 0.5, seed); left += m.score.left; right += m.score.right }
    expect(left + right).toBeGreaterThan(20)
    expect(Math.abs(left - right) / (left + right)).toBeLessThan(0.3)
  })

  it('a sharper one beats a weaker one', () => {
    let sharp = 0
    let weak = 0
    for (let seed = 1; seed <= 12; seed++) {
      const a = play(1, 0.2, seed); sharp += a.score.left; weak += a.score.right
      const b = play(0.2, 1, seed + 100); sharp += b.score.right; weak += b.score.left
    }
    expect(sharp).toBeGreaterThan(weak * 1.25)
  })

  it('gets sharper when the visitor wins and easier when they lose, within bounds', () => {
    expect(nextSkill(FIRST_SKILL, 'win')).toBeGreaterThan(FIRST_SKILL)
    expect(nextSkill(FIRST_SKILL, 'lose')).toBeLessThan(FIRST_SKILL)
    let s = FIRST_SKILL
    for (let i = 0; i < 30; i++) s = nextSkill(s, 'win')
    expect(s).toBe(1)
    for (let i = 0; i < 30; i++) s = nextSkill(s, 'lose')
    expect(s).toBe(0.04)
  })
})

describe('the powers', () => {
  // A match in which both sides hold every power, to try each one.
  const all = () => newMatch({ powers: { left: POWERS, right: POWERS } })
  const use = (m, side, name) => step(m, { left: side === 'left' ? { power: name } : {}, right: side === 'right' ? { power: name } : {} }, 1 / 60)

  it('each side is dealt three different powers a match, at random', () => {
    expect(POWERS.length).toBe(9)
    for (const name of POWERS) expect(POWER_NAMES[name]).toMatch(/\w/)
    const seen = new Set()
    for (let seed = 1; seed <= 40; seed++) {
      const hand = dealPowers(rngOf(seed))
      expect(hand.length).toBe(DEAL)
      expect(new Set(hand).size).toBe(DEAL)
      for (const n of hand) { expect(POWERS).toContain(n); seen.add(n) }
    }
    expect(seen.size).toBe(POWERS.length)
    const m = newMatch({ rng: rngOf(7) })
    expect(Object.keys(m.powers.left).length).toBe(3)
    expect(Object.keys(m.powers.right).length).toBe(3)
    expect(Object.values(m.powers.left)).toEqual([true, true, true])
  })

  it('a power is used once, and only one that side was dealt', () => {
    let m = all()
    for (const name of POWERS) {
      m = use(m, 'left', name)
      expect(m.events.filter(e => e.type === 'power')).toEqual([{ type: 'power', by: 'left', name }])
      expect(m.powers.left[name]).toBe(false)
      expect(m.powers.right[name]).toBe(true)
      expect(use(m, 'left', name).events.filter(e => e.type === 'power')).toEqual([])
    }
    const dealt = newMatch({ powers: { left: ['big'], right: ['freeze'] } })
    expect(use(dealt, 'left', 'freeze').events).toEqual([])
    expect(use(dealt, 'left', 'everything').powers).toEqual(dealt.powers)
  })

  it('the invisible ball lasts four seconds, and the computer plays where the ball was', () => {
    const m = use(all(), 'left', 'invisible')
    expect(m.hidden.by).toBe('left')
    expect(run(m, idle, INVISIBLE_TIME - 0.5).hidden).not.toBeNull()
    expect(run(m, idle, INVISIBLE_TIME + 0.2).hidden).toBeNull()
    const there = { ...m, ball: { ...m.ball, x: 700, y: 250 } }
    let mind = computerInputs(there, 1, newMind(), 1 / 60, () => 0.5)
    expect(mind.seen.x).toBe(700)
    const moved = { ...there, ball: { ...there.ball, x: 120 } }
    mind = computerInputs(moved, 1, { ...mind, wait: 0 }, 1 / 60, () => 0.5)
    expect(mind.seen.x).toBe(700)
    const theirs = use(all(), 'right', 'invisible')
    expect(computerInputs(theirs, 1, newMind(), 1 / 60, () => 0.5).seen).toBeNull()
  })

  it('super size makes a player bigger for six seconds, so they reach a ball they would have missed', () => {
    const m = use(all(), 'left', 'big')
    expect(sizeOf(m.left)).toBe(BIG_SIZE)
    expect(sizeOf(m.right)).toBe(1)
    expect(headOf(m.left).y).toBeLessThan(headOf(newMatch().left).y - 30)
    expect(sizeOf(run(m, idle, BIG_TIME + 0.2).left)).toBe(1)
    const over = (match) => {
      let g = { ...match, ball: { x: match.left.x + 44, y: headOf(newMatch().left).y - 34, vx: 0, vy: 0, spin: 0 } }
      g = step(g, idle, 1 / 60)
      return g.events.some(e => e.type === 'head' || e.type === 'header')
    }
    expect(over(all())).toBe(false)
    expect(over(m)).toBe(true)
  })

  it('the flaming ball: the next kick is fast and flat, and knocks the other player back without stopping', () => {
    let m = use(all(), 'left', 'flame')
    expect(m.left.armed).toBeGreaterThan(5)
    m = { ...m, right: { ...m.right, x: 520 }, ball: { x: m.left.x + 44, y: GROUND - BALL_R, vx: 0, vy: 0, spin: 0 } }
    let lit = null
    let knocked = false
    for (let i = 0; i < 60; i++) {
      m = step(m, { left: { kick: i < 3 }, right: {} }, 1 / 60)
      if (!lit && m.events.some(e => e.type === 'flame')) lit = { vx: m.ball.vx, vy: m.ball.vy, armed: m.left.armed, flame: m.flame }
      if (m.events.some(e => e.type === 'knock' && e.by === 'right')) { knocked = true; break }
    }
    expect(lit.vx).toBeGreaterThan(900)
    expect(Math.abs(lit.vy)).toBeLessThan(300)
    expect(lit.armed).toBe(0)
    expect(lit.flame.by).toBe('left')
    expect(knocked).toBe(true)
    expect(m.right.stun).toBeGreaterThan(0)
    expect(m.ball.vx).toBeGreaterThan(500)
    const x = m.right.x
    expect(step(m, { left: {}, right: { left: true } }, 1 / 60).right.x).toBe(x)
    expect(run(m, idle, FLAME_TIME + 0.3).flame).toBeNull()
  })

  it('the giant ball is nearly twice the size for five seconds, and sits on the ground, not in it', () => {
    let m = { ...all(), ball: { x: 400, y: GROUND - BALL_R, vx: 0, vy: 0, spin: 0 } }
    m = use(m, 'left', 'giant')
    expect(ballR(m)).toBeCloseTo(BALL_R * GIANT_SIZE, 6)
    expect(m.ball.y).toBeLessThanOrEqual(GROUND - ballR(m) + 0.01)
    const later = run(m, idle, 1)
    expect(later.ball.y).toBeLessThanOrEqual(GROUND - ballR(later) + 0.01)
    expect(ballR(run(m, idle, GIANT_TIME + 0.2))).toBe(BALL_R)
    // A head that would miss the usual ball meets the giant one.
    const beside = (match) => {
      let g = { ...match, ball: { x: match.left.x + 48, y: headOf(match.left).y, vx: 0, vy: 0, spin: 0 } }
      g = step(g, idle, 1 / 60)
      return g.events.some(e => e.type === 'head' || e.type === 'header')
    }
    expect(beside(all())).toBe(false)
    expect(beside(use(all(), 'left', 'giant'))).toBe(true)
  })

  it('the curler: the next kick goes up and over, then dips towards the goal', () => {
    let m = use(all(), 'left', 'curler')
    expect(m.left.curl).toBeGreaterThan(5)
    m = { ...m, right: { ...m.right, x: 700 }, ball: { x: m.left.x + 44, y: GROUND - BALL_R, vx: 0, vy: 0, spin: 0 } }
    let struck = null
    let top = GROUND
    for (let i = 0; i < 90 && m.phase === 'play'; i++) {
      m = step(m, { left: { kick: i < 3 }, right: {} }, 1 / 60)
      if (!struck && m.events.some(e => e.type === 'curl')) struck = { vy: m.ball.vy, curl: m.left.curl, curling: m.curling }
      top = Math.min(top, m.ball.y)
    }
    expect(struck.vy).toBeLessThan(-500)
    expect(struck.curl).toBe(0)
    expect(struck.curling.by).toBe('left')
    // It clears a standing player's head by a long way.
    expect(top).toBeLessThan(headOf(newMatch().left).y - 60)
  })

  it('the brick wall keeps a shot out of its own goal for four seconds', () => {
    const shot = (m) => {
      let g = { ...m, right: { ...m.right, x: 500 }, ball: { x: W - GOAL_D - 40, y: GROUND - 50, vx: 500, vy: 0, spin: 0 } }
      const seen = []
      for (let i = 0; i < 40; i++) { g = step(g, idle, 1 / 60); seen.push(...g.events.map(e => e.type)) }
      return { score: g.score.left, seen }
    }
    expect(shot(all()).score).toBe(1)
    const walled = use(all(), 'right', 'wall')
    expect(walled.wall.right).toBeGreaterThan(WALL_TIME - 0.1)
    const kept = shot(walled)
    expect(kept.score).toBe(0)
    expect(kept.seen).toContain('wall')
    expect(shot(run(walled, idle, WALL_TIME + 0.2)).score).toBe(1)
  })

  it('the small goal halves the height of its own goal for five seconds', () => {
    const m = use(all(), 'right', 'small')
    expect(barOf(m, 'right')).toBeCloseTo(GROUND - (GROUND - BAR) / 2, 6)
    expect(barOf(m, 'left')).toBe(BAR)
    const high = { x: W - 20, y: BAR + 30 }
    const low = { x: W - 20, y: GROUND - 20 }
    expect(goalFor(high, all())).toBe('left')
    expect(goalFor(high, m)).toBeNull()
    expect(goalFor(low, m)).toBe('left')
    // A shot above the lowered bar comes back out.
    let g = { ...m, right: { ...m.right, x: 500 }, ball: { x: W - GOAL_D - 40, y: BAR + 30, vx: 500, vy: 0, spin: 0 } }
    for (let i = 0; i < 20; i++) g = step(g, idle, 1 / 60)
    expect(g.score.left).toBe(0)
    expect(barOf(run(m, idle, SMALL_TIME + 0.2), 'right')).toBe(BAR)
  })

  it('freeze stops the other player for two seconds, and the banana skin swaps their left and right for four', () => {
    let m = use(all(), 'left', 'freeze')
    expect(m.right.frozen).toBeGreaterThan(FREEZE_TIME - 0.1)
    const x = m.right.x
    expect(run(m, { left: {}, right: { left: true, jump: true } }, 1).right.x).toBe(x)
    expect(run(m, { left: {}, right: { left: true } }, FREEZE_TIME + 0.5).right.x).toBeLessThan(x)
    m = use(all(), 'left', 'swap')
    expect(m.right.swap).toBeGreaterThan(SWAP_TIME - 0.1)
    expect(run(m, { left: {}, right: { left: true } }, 0.5).right.x).toBeGreaterThan(x)
    const after = run(m, idle, SWAP_TIME + 0.2)
    expect(run(after, { left: {}, right: { left: true } }, 0.5).right.x).toBeLessThan(after.right.x)
    // The side that used it is not affected.
    expect(m.left.swap).toBe(0)
  })

  it('a power still running carries over a kick off, and the ball starts again in sight, unlit and the usual size', () => {
    let m = use(use(use(all(), 'left', 'big'), 'right', 'invisible'), 'left', 'giant')
    m = { ...m, ball: { x: W - GOAL_D - 60, y: GROUND - 60, vx: 500, vy: 0, spin: 0 } }
    for (let i = 0; i < 60 && m.phase !== 'goal'; i++) m = step(m, idle, 1 / 60)
    expect(m.phase).toBe('goal')
    expect(m.hidden).toBeNull()
    expect(ballR(m)).toBe(BALL_R)
    const after = run(m, idle, 2.3)
    expect(after.phase).toBe('play')
    expect(sizeOf(after.left)).toBe(BIG_SIZE)
    expect(after.powers.left.big).toBe(false)
  })

  it('the computer uses the powers it holds, each once, and never one it does not', () => {
    const used = new Set()
    for (let seed = 1; seed <= 12; seed++) {
      const rng = rngOf(seed)
      let m = all()
      let mind = newMind()
      for (let i = 0; i < 60 * 240 && m.phase !== 'over'; i++) {
        mind = computerInputs(m, 1, mind, 1 / 60, rng)
        m = step(m, { left: {}, right: mind.inputs }, 1 / 60)
      }
      for (const name of POWERS) if (!m.powers.right[name]) used.add(name)
      expect(Object.values(m.powers.left).every(Boolean)).toBe(true)
    }
    expect(used.size).toBeGreaterThanOrEqual(4)
    // Holding only one, it can only use that one.
    let m = newMatch({ powers: { left: [], right: ['big'] } })
    let mind = newMind()
    const rng = rngOf(3)
    for (let i = 0; i < 60 * 240 && m.phase !== 'over'; i++) {
      mind = computerInputs(m, 1, mind, 1 / 60, rng)
      expect([null, undefined, 'big']).toContain(mind.inputs.power)
      m = step(m, { left: {}, right: mind.inputs }, 1 / 60)
    }
  })
})

describe('the two kicks', () => {
  const kicked = (input) => {
    let m = newMatch()
    m = { ...m, right: { ...m.right, x: 720 }, ball: { x: m.left.x + 44, y: GROUND - BALL_R, vx: 0, vy: 0, spin: 0 } }
    for (let i = 0; i < 20; i++) {
      m = step(m, { left: i < 3 ? input : {}, right: {} }, 1 / 60)
      if (m.events.some(e => e.type === 'kick')) return m.ball
    }
    return null
  }

  it('a low kick is a drive along the ground and a high kick is a lob', () => {
    const low = kicked({ kick: true })
    const high = kicked({ lob: true })
    expect(low.vx).toBeGreaterThan(high.vx + 150)
    expect(high.vy).toBeLessThan(low.vy - 250)
    // The lob clears a standing player's head; the drive does not.
    const rise = (vy) => (vy * vy) / (2 * 1150)
    expect(rise(high.vy)).toBeGreaterThan(HEAD_UP + 27 + 40)
    expect(rise(low.vy)).toBeLessThan(HEAD_UP)
  })
})

describe('wins in a row', () => {
  const store = () => { const kept = {}; return { kept, getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = v } } }

  it('grow with each win, end on a loss or a draw, and the best is kept on the device', () => {
    const s = store()
    expect(afterMatch(s, 'win')).toEqual({ streak: 1, best: 1, ended: 0 })
    expect(afterMatch(s, 'win')).toEqual({ streak: 2, best: 2, ended: 0 })
    expect(afterMatch(s, 'draw')).toEqual({ streak: 0, best: 2, ended: 2 })
    expect(afterMatch(s, 'lose')).toEqual({ streak: 0, best: 2, ended: 0 })
    expect(afterMatch(s, 'win')).toEqual({ streak: 1, best: 2, ended: 0 })
    expect(s.kept[STREAK_KEY]).toBe('1')
    expect(s.kept[BEST_KEY]).toBe('2')
    expect(readStreak(s)).toBe(1)
    expect(readBest(s)).toBe(2)
  })

  it('plays on in a browser that keeps nothing, and ignores nonsense', () => {
    expect(afterMatch(null, 'win')).toEqual({ streak: 1, best: 1, ended: 0 })
    expect(readStreak({ getItem: () => 'lots' })).toBe(0)
    expect(readBest({ getItem: () => { throw new Error('blocked') } })).toBe(0)
  })
})
