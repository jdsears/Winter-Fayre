// The numbers of the appeal's 3D story (path.js): its stops, where the
// camera is for each, and how far through it a scroll is.

import { describe, it, expect } from 'vitest'
import { STOPS, PLACES, RAISING, GAP, THE_GAMES, viewOf, viewAt, progressAt, cheerAt, stopAt, captionFor, TV_SHOT, TV_VIEWS, TV_ASPECT, TV_TURNS_AT, tvViewAt, tvListAt, tvPlaceAt, tvShape } from './path.js'
import { TV_MIDDLE } from './screen.js'
import { APPEAL } from '../../shared/appeal.js'
import { project } from '../shootout/camera.js'

// Stages of every shape the page makes: a phone upright, a small phone,
// a tablet and a wide desk screen (width over height).
const SHAPES = [[360, 343], [390, 371], [820, 440], [1040, 352]]
const onScreen = (cam, p, w, h, edge = 0) => {
  const at = project(cam, p, w, h)
  return at.depth > 0 && at.x >= edge && at.x <= w - edge && at.y >= edge && at.y <= h - edge
}

describe('the stops of the story', () => {
  it('are the page\'s own, in the order its words come: its heading, why, what has been funded, what is being raised for, your part, and on to the games', () => {
    expect(STOPS).toEqual(['hello', 'why', ...APPEAL.funded.items.map(i => i.key), ...APPEAL.raising.items.map(i => i.key), 'give', 'games'])
    expect(RAISING).toEqual(APPEAL.raising.items.map(i => i.key))
  })

  it('every thing has a place on the field, in a row, a good step apart', () => {
    const things = STOPS.slice(2, -2)
    expect(Object.keys(PLACES)).toEqual(things)
    things.forEach((name, i) => {
      expect(PLACES[name].z).toBe(0)
      if (i) expect(PLACES[name].x - PLACES[things[i - 1]].x).toBe(GAP)
    })
    expect(GAP).toBeGreaterThanOrEqual(10)
  })
})

describe('the camera at a stop', () => {
  it('looks at its thing from the near side, at about head height, with the thing whole in the picture on every stage', () => {
    for (const name of Object.keys(PLACES)) {
      for (const [w, h] of SHAPES) {
        const cam = viewOf(name, w / h)
        const at = PLACES[name]
        expect(cam.look.x).toBe(at.x)
        expect(cam.pos.z).toBeGreaterThan(at.z + 8)
        expect(cam.pos.y).toBeGreaterThan(1.5)
        expect(cam.pos.y).toBeLessThan(6)
        // The thing's middle, and a step either side of it, are in the picture.
        for (const dx of [-2.5, 0, 2.5]) expect(onScreen(cam, { x: at.x + dx, y: 1, z: at.z }, w, h), `${name} on ${w} by ${h}`).toBe(true)
      }
    }
  })

  it('stands further back on a narrow stage than on a wide one', () => {
    for (const name of STOPS) {
      const narrow = viewOf(name, 0.9)
      const wide = viewOf(name, 2.9)
      const far = (v) => Math.hypot(v.pos.x - v.look.x, v.pos.y - v.look.y, v.pos.z - v.look.z)
      expect(far(narrow), name).toBeGreaterThan(far(wide))
    }
  })

  it('opens the page low down at one end of the row, looking along it: every thing is in the first picture, the nearest the largest', () => {
    for (const [w, h] of SHAPES) {
      const cam = viewOf('hello', w / h)
      const seen = Object.keys(PLACES).map(name => project(cam, { ...PLACES[name], y: 1 }, w, h))
      Object.keys(PLACES).forEach((name, i) => {
        expect(onScreen(cam, { ...PLACES[name], y: 1 }, w, h), `${name} on ${w} by ${h}`).toBe(true)
        // Each is further off, and so drawn smaller, than the one before it.
        if (i) expect(seen[i].scale).toBeLessThan(seen[i - 1].scale)
        if (i) expect(seen[i].x).toBeGreaterThan(seen[i - 1].x)
      })
      // A person's eye level, or a little above: not a view from the air.
      expect(cam.pos.y).toBeLessThan(5)
      expect(cam.pos.y).toBeGreaterThan(2.5)
    }
  })

  it('closes on the whole field from above: every thing is in the last picture', () => {
    for (const [w, h] of SHAPES) {
      const cam = viewOf('games', w / h)
      for (const name of Object.keys(PLACES)) expect(onScreen(cam, { ...PLACES[name], y: 0.5 }, w, h), `${name} on ${w} by ${h}`).toBe(true)
      expect(cam.pos.y).toBeGreaterThan(12)
    }
  })

  it('shows the whole row from one end as the story begins: every thing is in that picture', () => {
    for (const [w, h] of SHAPES) {
      const cam = viewOf('why', w / h)
      for (const name of Object.keys(PLACES)) expect(onScreen(cam, { ...PLACES[name], y: 0.5 }, w, h), `${name} on ${w} by ${h}`).toBe(true)
      expect(cam.pos.y).toBeGreaterThan(8)
    }
  })

  it('ends on the two things being raised for, side by side, with room round them', () => {
    for (const [w, h] of SHAPES) {
      const cam = viewOf('give', w / h)
      for (const name of RAISING) {
        for (const dx of [-3.7, 3.7]) expect(onScreen(cam, { x: PLACES[name].x + dx, y: 1, z: 0 }, w, h, 4), `${name} on ${w} by ${h}`).toBe(true)
      }
      expect(cam.look.x).toBe((PLACES.goals.x + PLACES.covers.x) / 2)
    }
  })
})

describe('the camera along the story', () => {
  it('is at each stop\'s own view when the story is at that stop', () => {
    STOPS.forEach((name, i) => {
      for (const aspect of [1.05, 2.9]) {
        const a = viewAt(i, aspect)
        const b = viewOf(name, aspect)
        for (const k of ['x', 'y', 'z']) {
          expect(a.pos[k]).toBeCloseTo(b.pos[k], 6)
          expect(a.look[k]).toBeCloseTo(b.look[k], 6)
        }
        expect(a.fov).toBeCloseTo(b.fov, 6)
      }
    })
  })

  it('moves smoothly between them: never a jump, never under the grass, always on the near side of the row', () => {
    const last = STOPS.length - 1
    let was = viewAt(0, 1.05)
    for (let t = 0.01; t <= last + 0.001; t += 0.01) {
      const now = viewAt(t, 1.05)
      const moved = Math.hypot(now.pos.x - was.pos.x, now.pos.y - was.pos.y, now.pos.z - was.pos.z)
      expect(moved, `at ${t.toFixed(2)}`).toBeLessThan(1.2)
      expect(now.pos.y).toBeGreaterThan(1.5)
      expect(now.pos.z).toBeGreaterThan(8)
      expect(now.fov).toBeGreaterThanOrEqual(40)
      expect(now.fov).toBeLessThanOrEqual(50)
      was = now
    }
  })

  it('rests at a stop: it has hardly moved a little either side of one', () => {
    for (let i = 2; i < STOPS.length - 2; i++) {
      const at = viewAt(i, 1.05)
      for (const t of [i - 0.05, i + 0.05]) {
        const near = viewAt(t, 1.05)
        expect(Math.hypot(near.pos.x - at.pos.x, near.pos.y - at.pos.y, near.pos.z - at.pos.z)).toBeLessThan(0.35)
      }
    }
  })

  it('keeps to the ends when the story is before its first stop or after its last, or is not a number', () => {
    const first = viewAt(0, 1.2)
    const last = viewAt(STOPS.length - 1, 1.2)
    expect(viewAt(-3, 1.2)).toEqual(first)
    expect(viewAt(NaN, 1.2)).toEqual(first)
    expect(viewAt(99, 1.2)).toEqual(last)
  })
})

describe('how far through the story a scroll is', () => {
  const centres = [300, 700, 820, 990, 1300, 1480, 1900]

  it('is nought until the first stop is being read, and the last stop once it is', () => {
    expect(progressAt(-50, centres)).toBe(0)
    expect(progressAt(300, centres)).toBe(0)
    expect(progressAt(1900, centres)).toBe(6)
    expect(progressAt(5000, centres)).toBe(6)
  })

  it('is each stop\'s number when its middle is being read, and part way between two in step with the scroll', () => {
    centres.forEach((c, i) => expect(progressAt(c, centres)).toBeCloseTo(i, 9))
    expect(progressAt(500, centres)).toBeCloseTo(0.5, 9)
    expect(progressAt(730, centres)).toBeCloseTo(1.25, 9)
    expect(progressAt(1795, centres)).toBeCloseTo(5.75, 9)
  })

  it('only ever goes forward as the page is scrolled down', () => {
    let was = 0
    for (let y = 0; y <= 2200; y += 7) {
      const t = progressAt(y, centres)
      expect(t).toBeGreaterThanOrEqual(was)
      was = t
    }
  })

  it('copes with no stops, one stop, and two stops in the same place', () => {
    expect(progressAt(100, [])).toBe(0)
    expect(progressAt(100, [50])).toBe(0)
    expect(progressAt(400, [100, 300, 300, 600])).toBeCloseTo(2 + 100 / 300, 9)
    expect(Number.isFinite(progressAt(300, [100, 300, 300, 600]))).toBe(true)
    expect(progressAt(NaN, centres)).toBe(0)
  })
})

describe('the gold round what is being raised for', () => {
  it('is quiet until the story comes to "Your part", at its liveliest there, and stays so to the end', () => {
    const give = STOPS.indexOf('give')
    for (let t = 0; t <= give - 1; t += 0.25) expect(cheerAt(t)).toBe(0)
    expect(cheerAt(give)).toBe(1)
    expect(cheerAt(STOPS.length - 1)).toBe(1)
    let was = 0
    for (let t = give - 1; t <= give; t += 0.02) {
      expect(cheerAt(t)).toBeGreaterThanOrEqual(was)
      was = cheerAt(t)
    }
  })
})

describe('the words on the stage', () => {
  it('name the stop the story is nearest', () => {
    expect(stopAt(0)).toBe('hello')
    expect(stopAt(0.49)).toBe('hello')
    expect(stopAt(0.51)).toBe('why')
    expect(stopAt(1.6)).toBe('tables')
    expect(stopAt(5.6)).toBe('covers')
    expect(stopAt(7)).toBe('give')
    expect(stopAt(8)).toBe('games')
    expect(stopAt(40)).toBe('games')
    expect(stopAt(-2)).toBe('hello')
    expect(stopAt(NaN)).toBe('hello')
  })

  it('are the appeal\'s own: its titles, and each thing\'s sum and name as the PSA gives them', () => {
    // Nothing at the start, where the page's heading is just under the picture.
    expect(captionFor('hello', APPEAL)).toEqual({ label: '', amount: '', name: '' })
    expect(captionFor('games', APPEAL)).toEqual({ label: '', amount: '', name: 'The games' })
    expect(THE_GAMES).toBe('The games')
    expect(captionFor('why', APPEAL)).toEqual({ label: '', amount: '', name: APPEAL.why.title })
    expect(captionFor('give', APPEAL)).toEqual({ label: '', amount: '', name: APPEAL.give.title })
    for (const i of APPEAL.funded.items) expect(captionFor(i.key, APPEAL)).toEqual({ label: APPEAL.funded.title, amount: i.amount, name: i.what })
    for (const i of APPEAL.raising.items) expect(captionFor(i.key, APPEAL)).toEqual({ label: APPEAL.raising.title, amount: '', name: i.what })
    expect(captionFor('tables', APPEAL)).toEqual({ label: 'Already funded', amount: '£8,500', name: 'Table tennis tables' })
    expect(captionFor('goals', APPEAL)).toEqual({ label: 'Now raising for', amount: '', name: 'Football box goals' })
    expect(captionFor('something else', APPEAL)).toEqual({ label: '', amount: '', name: '' })
  })
})

// The story on the stall's TV, where nothing is scrolled: one shot of
// the camera each time the appeal has the screen.
describe('the camera\'s shot on the stall\'s TV', () => {
  // Where a point falls on a television, whose picture has its middle
  // to the left of the screen's, between the headline and the list.
  const onTv = (cam, p, w = 1920, h = 1080) => {
    const at = project(cam, p, w, h)
    return { x: at.x - (0.5 - TV_MIDDLE.x) * w, y: at.y - (0.5 - TV_MIDDLE.y) * h, depth: at.depth }
  }
  const far = (v) => Math.hypot(v.pos.x - v.look.x, v.pos.y - v.look.y, v.pos.z - v.look.z)
  // The part of a 1920 by 1080 screen where the picture shows clear:
  // left of the code, under the headline and above the list.
  const clear = (at, low) => at.depth > 0 && at.x > 60 && at.x < 1150 && at.y > 300 && at.y < low

  it('is told in steps, in the order of the turn, from its start to its end', () => {
    expect(TV_SHOT[0][0]).toBe(0)
    expect(TV_SHOT.at(-1)[0]).toBe(1)
    for (let i = 1; i < TV_SHOT.length; i++) expect(TV_SHOT[i][0]).toBeGreaterThan(TV_SHOT[i - 1][0])
    for (const [, name] of TV_SHOT) expect(Boolean(TV_VIEWS[name]) || STOPS.includes(name), name).toBe(true)
  })

  it('opens over what has been funded, comes down to the box goals and rests, and ends on the two things being raised for', () => {
    expect(tvViewAt(0)).toEqual(TV_VIEWS.open)
    for (const u of [0.5, 0.55, 0.6]) expect(tvViewAt(u)).toEqual(viewOf('goals', TV_ASPECT))
    for (const u of [0.86, 0.95, 1]) expect(tvViewAt(u)).toEqual(viewOf('give', TV_ASPECT))
    // Anything that is not a place in the turn is read as its start or its end.
    expect(tvViewAt(NaN)).toEqual(tvViewAt(0))
    expect(tvViewAt(-3)).toEqual(tvViewAt(0))
    expect(tvViewAt(7)).toEqual(tvViewAt(1))
  })

  it('shows the three things already funded in the clear part of the screen while their list is up', () => {
    for (const u of [0, 0.1, 0.2, 0.3]) {
      const cam = tvViewAt(u)
      for (const name of ['tables', 'water', 'posts']) {
        const at = onTv(cam, { x: PLACES[name].x, y: 0.5, z: PLACES[name].z })
        expect(clear(at, 580), `${name} at ${u}: ${Math.round(at.x)}, ${Math.round(at.y)}`).toBe(true)
      }
    }
  })

  it('and both things being raised for at its end, the box goals large on the way', () => {
    const end = tvViewAt(1)
    for (const name of RAISING) {
      const at = onTv(end, { x: PLACES[name].x, y: 1, z: PLACES[name].z })
      expect(clear(at, 660), `${name}: ${Math.round(at.x)}, ${Math.round(at.y)}`).toBe(true)
    }
    const goals = tvViewAt(0.55)
    expect(clear(onTv(goals, { x: PLACES.goals.x, y: 1, z: 0 }), 660)).toBe(true)
    expect(far(goals)).toBeLessThan(far(end))
  })

  it('keeps the camera above the field and on the near side of the row, and never jumps', () => {
    let was = tvViewAt(0)
    for (let u = 0; u <= 1.0001; u += 0.002) {
      const v = tvViewAt(u)
      expect(v.pos.y).toBeGreaterThan(1.5)
      expect(v.pos.z).toBeGreaterThan(8)
      expect(v.fov).toBeGreaterThan(30)
      expect(v.fov).toBeLessThan(60)
      const moved = Math.hypot(v.pos.x - was.pos.x, v.pos.y - was.pos.y, v.pos.z - was.pos.z)
      expect(moved, `at ${u.toFixed(3)}`).toBeLessThan(1.2)
      was = v
    }
  })

  it('drifts along the row from the first moment, so the picture is never still', () => {
    const a = tvViewAt(0)
    const b = tvViewAt(0.1)
    const c = tvViewAt(0.2)
    expect(b.pos.x).toBeGreaterThan(a.pos.x)
    // At one speed: as far in the second tenth of the turn as in the first.
    expect(c.pos.x - b.pos.x).toBeCloseTo(b.pos.x - a.pos.x, 6)
  })

  it('shows the list of what has been funded first, and what is being raised for from when the camera sets off for the goals', () => {
    expect(tvListAt(0)).toBe('funded')
    expect(tvListAt(TV_TURNS_AT - 0.001)).toBe('funded')
    expect(tvListAt(TV_TURNS_AT)).toBe('raising')
    expect(tvListAt(1)).toBe('raising')
    // The list turns while the camera is on its way down to the goals.
    const drift = TV_SHOT.find(s => s[1] === 'drift')[0]
    const goals = TV_SHOT.find(s => s[1] === 'goals')[0]
    expect(TV_TURNS_AT).toBeGreaterThan(drift)
    expect(TV_TURNS_AT).toBeLessThan(goals)
    // What is being raised for has the screen for most of the turn.
    expect(1 - TV_TURNS_AT).toBeGreaterThan(0.6)
  })

  it('the gold is quiet over what has been funded and at its liveliest once the list has turned', () => {
    for (let u = 0; u < TV_TURNS_AT; u += 0.02) expect(cheerAt(tvPlaceAt(u))).toBe(0)
    for (let u = 0.5; u <= 1; u += 0.05) expect(cheerAt(tvPlaceAt(u))).toBe(1)
    let was = 0
    for (let u = TV_TURNS_AT; u <= 0.5; u += 0.005) {
      expect(cheerAt(tvPlaceAt(u))).toBeGreaterThanOrEqual(was)
      was = cheerAt(tvPlaceAt(u))
    }
  })

  it('frames for a television as it is, and stands further back on a squarer screen', () => {
    expect(tvShape(16 / 9)).toBe(TV_ASPECT)
    expect(tvShape(1920 / 1080)).toBe(1)
    expect(tvShape(4 / 3)).toBeCloseTo(0.75, 9)
    expect(tvShape(0.2)).toBe(0.6)
    expect(tvShape(9)).toBe(1.4)
    for (const odd of [NaN, 0, -1, undefined]) expect(tvShape(odd)).toBe(1)
    for (const u of [0, 0.2, 0.55, 1]) expect(far(tvViewAt(u, tvShape(4 / 3))), `at ${u}`).toBeGreaterThan(far(tvViewAt(u, tvShape(16 / 9))))
    // On a squarer screen the things already funded are still in the picture's clear part.
    const cam = tvViewAt(0.15, tvShape(4 / 3))
    for (const name of ['tables', 'water', 'posts']) {
      const at = project(cam, { x: PLACES[name].x, y: 0.5, z: 0 }, 1024, 768)
      const x = at.x - (0.5 - TV_MIDDLE.x) * 1024
      expect(x, name).toBeGreaterThan(20)
      expect(x, name).toBeLessThan(620)
    }
  })
})
