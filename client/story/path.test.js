// The numbers of the appeal's 3D story (path.js): its stops, where the
// camera is for each, and how far through it a scroll is.

import { describe, it, expect } from 'vitest'
import { STOPS, PLACES, RAISING, GAP, THE_GAMES, viewOf, viewAt, progressAt, cheerAt, stopAt, captionFor } from './path.js'
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
