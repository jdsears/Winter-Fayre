// The appeal's story in 3D on the stall's TV (screen.js): how many
// pixels it is drawn with, what is done about a television that draws
// it slowly, and that it is drawn only while the appeal has the screen.

import { describe, it, expect, vi } from 'vitest'
import { startTvStory, wantsPlain, tvRatio, tvPace, TV_WIDE, TV_MIDDLE, TV_WARM_UP, DRAWN_WIDE, LEAST, EASE, STOP_MS, HOPELESS_MS, HOPELESS_SAMPLE } from './screen.js'
import { SLOW_MS, SAMPLE } from './index.js'
import { TV_TURNS_AT } from './path.js'
import { APPEAL_MS } from '../tv.js'

describe('how many pixels the TV\'s picture is drawn with', () => {
  it('is a television\'s own 1920 across, and no more on a screen that has more', () => {
    expect(DRAWN_WIDE).toBe(1920)
    expect(tvRatio(1920, 1)).toBe(1)
    expect(tvRatio(1280, 1)).toBe(1)
    expect(tvRatio(1920, 2)).toBe(1)
    expect(tvRatio(1280, 2)).toBe(1.5)
    expect(tvRatio(3840, 1)).toBe(0.5)
    expect(tvRatio(3840, 2)).toBe(0.5)
  })

  it('is never let below the least, whatever the screen says of itself', () => {
    expect(LEAST).toBeGreaterThanOrEqual(0.4)
    expect(tvRatio(7680, 1)).toBe(LEAST)
    expect(tvRatio(1920, 0)).toBe(1)
    expect(tvRatio(1920, undefined)).toBe(1)
    expect(tvRatio(0, 1)).toBe(1)
  })
})

describe('a television that draws the picture slowly', () => {
  it('is left alone until enough frames have been counted, and while it keeps up', () => {
    expect(tvPace({ average: 400, counted: HOPELESS_SAMPLE - 1, ratio: 1 })).toBe(null)
    expect(tvPace({ average: SLOW_MS + 20, counted: SAMPLE - 1, ratio: 1 })).toBe(null)
    expect(tvPace({ average: 17, counted: 5000, ratio: 1 })).toBe(null)
    expect(tvPace({ average: SLOW_MS, counted: 5000, ratio: 1 })).toBe(null)
  })

  it('is drawn with fewer pixels when it is under twenty frames a second, while there are fewer to draw with', () => {
    expect(tvPace({ average: SLOW_MS + 1, counted: SAMPLE, ratio: 1 })).toBe('ease')
    expect(tvPace({ average: 200, counted: SAMPLE, ratio: 0.7 })).toBe('ease')
    expect(EASE).toBeLessThan(1)
    expect(EASE).toBeGreaterThan(0.5)
  })

  it('goes back to the screen of words when fewer pixels have not been enough, or it is hopeless from the start', () => {
    expect(tvPace({ average: STOP_MS + 1, counted: SAMPLE, ratio: LEAST })).toBe('stop')
    // Between the two it is slow but still worth watching.
    expect(tvPace({ average: STOP_MS - 1, counted: SAMPLE, ratio: LEAST })).toBe(null)
    expect(tvPace({ average: HOPELESS_MS + 1, counted: HOPELESS_SAMPLE, ratio: 1 })).toBe('stop')
    expect(STOP_MS).toBeGreaterThan(SLOW_MS)
    expect(HOPELESS_MS).toBeGreaterThan(STOP_MS)
  })
})

// A television's page, as far as the story looks at it: the appeal with
// its two lists, a screen that is or is not a television's shape, and a
// clock that the test turns by hand.
function classes() {
  const set = new Set()
  return {
    add: (c) => { set.add(c) },
    remove: (c) => { set.delete(c) },
    contains: (c) => set.has(c),
    toggle: (c, on) => { if (on) set.add(c); else set.delete(c); return on },
  }
}
function television({ wide = true, reduce = false, draws = true, on = false } = {}) {
  const lists = ['raising', 'funded'].map(name => ({ name, classList: classes(), getAttribute: (k) => (k === 'data-tv-list' ? name : null) }))
  const kids = []
  const appeal = {
    kids,
    classList: classes(),
    querySelectorAll: (sel) => (sel === '[data-tv-list]' ? lists : []),
    getAttribute: (k) => (k === 'data-boards' ? '["Wymondham College PSA","Winter Fayre","Sports Fund Appeal"]' : null),
    prepend: (node) => { kids.unshift(node) },
  }
  if (on) appeal.classList.add('on')
  const root = { clientWidth: 1920, clientHeight: 1080, querySelector: (sel) => (sel === '[data-tv-appeal]' ? appeal : null) }
  const queue = []
  const state = { ms: 1000, watcher: null }
  const media = {
    matches: wide,
    listeners: [],
    addEventListener(type, fn) { this.listeners.push(fn) },
    removeEventListener(type, fn) { this.listeners = this.listeners.filter(f => f !== fn) },
  }
  const win = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    document: {
      createElement: (tag) => ({
        tag,
        className: '',
        attrs: {},
        setAttribute(k, v) { this.attrs[k] = v },
        getContext: () => (draws ? {} : null),
        addEventListener() {},
        removeEventListener() {},
        remove() { const i = kids.indexOf(this); if (i >= 0) kids.splice(i, 1) },
      }),
    },
    matchMedia: (q) => (q.includes('reduced-motion') ? { matches: reduce } : q === TV_WIDE ? media : { matches: false }),
    MutationObserver: class { constructor(fn) { this.fn = fn } observe() { state.watcher = this.fn } disconnect() { state.watcher = null } },
    requestAnimationFrame: (fn) => { queue.push(fn); return queue.length },
    cancelAnimationFrame: () => { queue.length = 0 },
    performance: { now: () => state.ms },
    addEventListener() {},
    removeEventListener() {},
  }
  const scene = { ratio: 1, least: LEAST, setRatio: vi.fn(function (r) { scene.ratio = Math.max(LEAST, Math.min(1, r)) }), centre: vi.fn(), resize: vi.fn(), render: vi.fn(), dispose: vi.fn() }
  const load = vi.fn(async () => ({ createStoryScene: vi.fn(() => scene) }))
  // The appeal is put on the screen or taken off, as client/tv.js does.
  const put = (shown) => { appeal.classList.toggle('on', shown); state.watcher?.() }
  // The clock is run on by so many milliseconds, a frame at a time.
  const run = (ms, gap = 16) => {
    for (let t = 0; t < ms && queue.length; t += gap) {
      state.ms += gap
      const fn = queue.shift()
      fn(state.ms)
    }
  }
  const now = () => lists.filter(l => l.classList.contains('now')).map(l => l.name)
  return { root, win, appeal, lists, kids, queue, media, scene, load, put, run, now, state }
}

describe('the story on the stall\'s TV', () => {
  it('is laid out round the picture between turns, and drawn only while the appeal has the screen', async () => {
    const tv = television()
    const story = startTvStory(tv.root, tv.win, { load: tv.load })
    await story.made
    // The field is made once and drawn once out of sight; nothing is drawn after that until the appeal's turn.
    expect(tv.load).toHaveBeenCalledTimes(1)
    expect(tv.kids).toHaveLength(1)
    expect(tv.kids[0].className).toBe('tvx-c')
    expect(tv.kids[0].attrs['aria-hidden']).toBe('true')
    expect(tv.appeal.classList.contains('s3')).toBe(true)
    expect(tv.scene.centre).toHaveBeenCalledWith(TV_MIDDLE.x, TV_MIDDLE.y)
    expect(tv.scene.resize).toHaveBeenCalledWith(1920, 1080)
    expect(tv.scene.render).toHaveBeenCalledTimes(1)
    expect(tv.queue).toHaveLength(0)
    expect(tv.now()).toEqual(['funded'])

    // The appeal's turn: the first picture at once, then one a frame.
    tv.put(true)
    expect(tv.scene.render).toHaveBeenCalledTimes(2)
    expect(tv.queue).toHaveLength(1)
    tv.run(1000)
    expect(tv.scene.render.mock.calls.length).toBeGreaterThan(50)
    expect(tv.now()).toEqual(['funded'])
    // Past the turn of the list, what is being raised for is shown, and only that.
    tv.run(APPEAL_MS * TV_TURNS_AT)
    expect(tv.now()).toEqual(['raising'])
    tv.run(APPEAL_MS)
    expect(tv.now()).toEqual(['raising'])

    // The turn ends: nothing more is drawn, and the lists start again for the next.
    tv.put(false)
    const drawn = tv.scene.render.mock.calls.length
    expect(tv.queue).toHaveLength(0)
    tv.run(2000)
    expect(tv.scene.render.mock.calls.length).toBe(drawn)
    tv.put(true)
    expect(tv.now()).toEqual(['funded'])
    expect(tv.scene.render.mock.calls.length).toBe(drawn + 1)
    expect(tv.scene.dispose).not.toHaveBeenCalled()
  })

  it('the camera starts each turn from the start of its shot', async () => {
    const tv = television()
    await startTvStory(tv.root, tv.win, { load: tv.load }).made
    tv.put(true)
    const first = tv.scene.render.mock.calls.at(-1)[2]
    tv.run(APPEAL_MS + 500)
    const last = tv.scene.render.mock.calls.at(-1)[2]
    expect(last.pos).not.toEqual(first.pos)
    tv.put(false)
    tv.state.ms += 27000
    tv.put(true)
    expect(tv.scene.render.mock.calls.at(-1)[2]).toEqual(first)
  })

  it('a turn that is on when the field is ready stays the screen of words, and the next is in 3D', async () => {
    const tv = television({ on: true })
    await startTvStory(tv.root, tv.win, { load: tv.load }).made
    expect(tv.appeal.classList.contains('s3')).toBe(false)
    expect(tv.queue).toHaveLength(0)
    tv.put(false)
    expect(tv.appeal.classList.contains('s3')).toBe(true)
    tv.put(true)
    expect(tv.queue).toHaveLength(1)
  })

  it('a television that draws it far too slowly goes back to the screen of words, for good', async () => {
    const tv = television()
    await startTvStory(tv.root, tv.win, { load: tv.load }).made
    tv.put(true)
    tv.run(300 * (TV_WARM_UP + HOPELESS_SAMPLE + 2), 300)
    expect(tv.appeal.classList.contains('s3')).toBe(false)
    expect(tv.kids).toHaveLength(0)
    expect(tv.now()).toEqual([])
    expect(tv.scene.dispose).toHaveBeenCalledTimes(1)
    expect(tv.queue).toHaveLength(0)
    // The next turn is the screen of words: nothing is drawn.
    const drawn = tv.scene.render.mock.calls.length
    tv.put(false)
    tv.put(true)
    expect(tv.scene.render.mock.calls.length).toBe(drawn)
    expect(tv.appeal.classList.contains('s3')).toBe(false)
  })

  it('one that is only a little slow is drawn with fewer pixels and carries on', async () => {
    const tv = television()
    await startTvStory(tv.root, tv.win, { load: tv.load }).made
    tv.put(true)
    tv.run(70 * (TV_WARM_UP + SAMPLE + 2), 70)
    expect(tv.scene.ratio).toBeCloseTo(EASE, 5)
    expect(tv.appeal.classList.contains('s3')).toBe(true)
    expect(tv.scene.dispose).not.toHaveBeenCalled()
  })

  it('is not made at all for a visitor who has asked for less motion, or where 3D will not run', () => {
    for (const options of [{ reduce: true }, { draws: false }]) {
      const tv = television(options)
      expect(startTvStory(tv.root, tv.win, { load: tv.load })).toBe(null)
      expect(tv.load).not.toHaveBeenCalled()
      expect(tv.kids).toHaveLength(0)
      expect(tv.appeal.classList.contains('s3')).toBe(false)
    }
  })

  it('nor when the stall has opened the page as /tv?plain, to have the screen of words alone', () => {
    expect(wantsPlain('?plain')).toBe(true)
    expect(wantsPlain('?plain=1')).toBe(true)
    expect(wantsPlain('?x=1&plain')).toBe(true)
    for (const search of ['', '?', '?plainly', '?x=plain', undefined, null]) expect(wantsPlain(search)).toBe(false)
    const tv = television()
    tv.win.location = { search: '?plain' }
    expect(startTvStory(tv.root, tv.win, { load: tv.load })).toBe(null)
    expect(tv.load).not.toHaveBeenCalled()
    expect(tv.kids).toHaveLength(0)
    // And is made as usual when the address says nothing of it.
    const usual = television()
    usual.win.location = { search: '' }
    expect(startTvStory(usual.root, usual.win, { load: usual.load })).not.toBe(null)
  })

  it('nor on a page without the appeal, or without its two lists', () => {
    const tv = television()
    expect(startTvStory({ querySelector: () => null }, tv.win, { load: tv.load })).toBe(null)
    tv.lists.pop()
    expect(startTvStory(tv.root, tv.win, { load: tv.load })).toBe(null)
    expect(tv.load).not.toHaveBeenCalled()
  })

  it('nothing is fetched on a screen that is not a television\'s shape, until it is one', async () => {
    const tv = television({ wide: false })
    const story = startTvStory(tv.root, tv.win, { load: tv.load })
    await story.made
    expect(tv.load).not.toHaveBeenCalled()
    expect(tv.kids).toHaveLength(0)
    expect(tv.media.listeners).toHaveLength(1)
    // The screen is turned, or the window made full.
    tv.media.matches = true
    await tv.media.listeners[0]()
    expect(tv.load).toHaveBeenCalledTimes(1)
    expect(tv.appeal.classList.contains('s3')).toBe(true)
  })

  it('if the field cannot be made, the page is left as it was', async () => {
    const tv = television()
    const story = startTvStory(tv.root, tv.win, { load: async () => { throw new Error('no connection') } })
    await story.made
    expect(tv.kids).toHaveLength(0)
    expect(tv.appeal.classList.contains('s3')).toBe(false)
    tv.put(true)
    expect(tv.queue).toHaveLength(0)
  })

  it('a picture that fails as it is drawn is put away, and the turn goes on as the screen of words', async () => {
    const tv = television()
    await startTvStory(tv.root, tv.win, { load: tv.load }).made
    tv.put(true)
    tv.run(500)
    tv.scene.render.mockImplementation(() => { throw new Error('the picture was lost') })
    expect(() => tv.run(100)).not.toThrow()
    expect(tv.appeal.classList.contains('s3')).toBe(false)
    expect(tv.kids).toHaveLength(0)
    expect(tv.queue).toHaveLength(0)
    expect(tv.now()).toEqual([])
  })

  it('stopping it puts the appeal\'s turn back as it was', async () => {
    const tv = television()
    const story = startTvStory(tv.root, tv.win, { load: tv.load })
    await story.made
    tv.put(true)
    story.stop()
    expect(tv.appeal.classList.contains('s3')).toBe(false)
    expect(tv.kids).toHaveLength(0)
    expect(tv.queue).toHaveLength(0)
    expect(tv.media.listeners).toHaveLength(0)
    expect(tv.scene.dispose).toHaveBeenCalledTimes(1)
  })
})
