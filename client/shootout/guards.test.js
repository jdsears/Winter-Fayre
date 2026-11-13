// The rules the shootout's code is held to, read from its source:
//   no em or en dash, and no spaced hyphen, in its words or comments;
//   British spelling in its sentences; no real team anywhere;
//   nothing sent anywhere (no requests, beacons or analytics), and the
//   best result the only thing stored, in storage.js;
//   loaded on demand: the section's script imports only the config, the
//   game comes with import() when Play is tapped, and three.js only with
//   the 3D scene, itself loaded with import() by the game;
//   reduced motion and the motion helpers;
//   the players' looks from one list, picked at random, never by kind.
//
// Run with: npx vitest run client/shootout/guards.test.js

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import { LOOKS, HOME_KEEPER, HOME_KEEPER_LOOK, lookAt, pickLook } from './looks.js'
import { effects, prefersReducedMotion, shakeOffset, slowMotionScale } from './motion.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const sources = readdirSync(here).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
const read = (f) => readFileSync(path.join(here, f), 'utf8')
const everything = [
  ...readdirSync(here).filter((f) => f.endsWith('.js')).map((f) => [f, read(f)]),
  ['testing/fakeDom.js', read('testing/fakeDom.js')],
]

// The en and em dash, written by their codes so this file has neither.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
// A real team's name, likewise kept out of this file's own text: the game
// reads every name from the page, so its code names no team at all.
const REAL_TEAM = new RegExp(['mor', 'ley'].join(''), 'i')

// The code of a file, its comments left out.
function code(src) {
  const ast = parse(src, { sourceType: 'module', errorRecovery: true })
  let out = src
  for (const c of [...ast.comments].reverse()) out = out.slice(0, c.start) + out.slice(c.end)
  return out
}

// The words in a file: its comments, strings and template text.
function words(src) {
  const ast = parse(src, { sourceType: 'module', tokens: true, errorRecovery: true })
  const out = ast.comments.map((c) => c.value)
  for (const t of ast.tokens) {
    if (t.type.label === 'string' || t.type.label === 'template') out.push(String(t.value ?? ''))
  }
  return out
}

function imports(src) {
  const ast = parse(src, { sourceType: 'module' })
  const staticImports = ast.program.body.filter((n) => n.type === 'ImportDeclaration').map((n) => n.source.value)
  const dynamicImports = [...src.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])
  return { staticImports, dynamicImports }
}

describe('the words', () => {
  it('have no em or en dash anywhere, and no spaced hyphen in words or comments', () => {
    for (const [file, src] of everything) {
      expect(DASHES.test(src), `${file} has an em or en dash`).toBe(false)
      if (!file.endsWith('.js')) continue
      // A stylesheet's calc() needs its spaced minus: CSS is code, not words.
      for (const w of words(src).filter((x) => !/[{};]/.test(x))) expect(/\s-\s/.test(w), `${file}: "${w.trim().slice(0, 60)}"`).toBe(false)
    }
  })

  it('are spelt the British way in every sentence', () => {
    const american = /\b(colou?r(?<!colour)|colors?|center(ed|s)?|favorites?|organiz\w*|realiz\w*|analyz\w*|gray|behaviors?|canceled|meters?)\b/i
    for (const file of sources) {
      for (const w of words(read(file))) {
        if (!/\s/.test(w.trim())) continue
        if (/[{};:]\s*$|^\s*\./m.test(w) && /[{}]/.test(w)) continue
        expect(american.test(w), `${file}: "${w.trim().slice(0, 80)}"`).toBe(false)
      }
    }
  })

  it('never name a real team', () => {
    for (const [file, src] of everything) expect(REAL_TEAM.test(src), file).toBe(false)
  })
})

describe('nothing leaves the device', () => {
  it('sends no request, beacon or analytics', () => {
    for (const file of sources) {
      const src = code(read(file))
      for (const banned of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /gtag|dataLayer|analytics/i, /navigator\.geolocation/]) {
        expect(banned.test(src), `${file} matches ${banned}`).toBe(false)
      }
    }
  })

  it('stores only in storage.js, every read and write wrapped', () => {
    for (const file of sources.filter((f) => f !== 'storage.js')) {
      expect(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code(read(file))), file).toBe(false)
    }
    const src = read('storage.js')
    expect((src.match(/try \{/g) || []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('loading on demand', () => {
  it('keeps the section\'s script small: the config only, and the game by import()', () => {
    const { staticImports, dynamicImports } = imports(read('index.js'))
    expect(staticImports).toEqual(['./config.js'])
    expect(dynamicImports).toEqual(['./game.js'])
    expect(imports(read('config.js')).staticImports).toEqual(['./colour.js'])
  })

  it('brings three.js only with the 3D scene, which the game loads by import()', () => {
    for (const file of sources) {
      const { staticImports } = imports(read(file))
      const three = staticImports.filter((s) => s === 'three' || s.startsWith('three/'))
      if (file === 'scene3d.js') expect(three.length).toBeGreaterThan(0)
      else expect(three, file).toEqual([])
      if (file !== 'scene3d.js') expect(staticImports.includes('./scene3d.js'), file).toBe(false)
    }
    expect(imports(read('game.js')).dynamicImports).toEqual(['./scene3d.js'])
  })

  it('caps the pixel ratio at 2 and lets the WebGL context go on leaving', () => {
    const scene = read('scene3d.js')
    expect(scene).toMatch(/Math\.min\(2, win\.devicePixelRatio \|\| 1\)/)
    expect(scene).toMatch(/renderer\.dispose\(\)/)
    expect(scene).toMatch(/forceContextLoss\(\)/)
    expect(read('game.js')).toMatch(/visibilitychange/)
  })
})

describe('motion', () => {
  it('reads the visitor\'s reduced motion setting, and copes with none', () => {
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false)
    expect(prefersReducedMotion({})).toBe(false)
    expect(prefersReducedMotion({ matchMedia: () => { throw new Error('no') } })).toBe(false)
  })

  it('slows only the winning moment, and only when motion is welcome', () => {
    expect(slowMotionScale(0.5, 0.6, true)).toBeLessThan(1)
    expect(slowMotionScale(0.1, 0.6, true)).toBe(1)
    expect(slowMotionScale(0.5, 0.6, false)).toBe(1)
  })

  it('shakes the camera a little, briefly, and not at all with reduced motion', () => {
    const s = shakeOffset(0.05, effects(false).shake)
    expect(Math.hypot(s.x, s.y)).toBeGreaterThan(0)
    expect(Math.hypot(s.x, s.y)).toBeLessThan(0.08)
    expect(shakeOffset(0.05, effects(true).shake)).toEqual({ x: 0, y: 0 })
    expect(shakeOffset(0.9, 1)).toEqual({ x: 0, y: 0 })
  })
})

describe('the players\' looks', () => {
  it('come from one list both pitches share, and never from the kind of taker', () => {
    for (const file of ['scene2d.js', 'scene3d.js']) {
      expect(imports(read(file)).staticImports, file).toContain('./looks.js')
      // No skin or hair colours of their own.
      expect(code(read(file)), file).not.toMatch(/const (SKIN|HAIR)\b/)
    }
    expect(code(read('keeper.js'))).not.toMatch(/\blook\b/)
    // The game picks each one at random, from a source kept apart from play.
    const game = code(read('game.js'))
    expect(game).toMatch(/look: pickLook\(lookRng\)/)
    expect(game).not.toMatch(/plan\.look/)
  })

  it('the home keeper alone has a look of her own, which no one else is given', () => {
    expect(HOME_KEEPER.ponytail).toBe(true)
    expect(lookAt(HOME_KEEPER_LOOK)).toBe(HOME_KEEPER)
    expect(LOOKS).not.toContain(HOME_KEEPER)
    for (let i = 0; i < 200; i++) expect(pickLook(() => i / 200)).toBeLessThan(HOME_KEEPER_LOOK)
    for (const look of LOOKS) expect(look.ponytail).toBeUndefined()
    const game = code(read('game.js'))
    expect(game).toMatch(/us: HOME_KEEPER_LOOK, them: pickLook\(lookRng\)/)
  })
})
