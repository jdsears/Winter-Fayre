// The ways into the game from a team site's page (index.js), in a
// stand-in browser (testing/fakeDom.js): the top bar's pinned Play opens
// it by the section's own path, with focus back on the pin; a link to the
// page ending #play scrolls to the section and opens it once the script
// is ready, or leaves the section's Play focused when it will not open;
// and with the game switched off, #play does nothing.
//
// Run with: npx vitest run client/shootout/index.test.js

import { describe, it, expect } from 'vitest'
import { createFakeBrowser } from './testing/fakeDom.js'
import { enhanceShootout } from './index.js'
import { shootoutConfig } from './config.js'
import { shootoutData } from './section.js'

const SITE = {
  slug: 'wicklewood-u12',
  theme: { colours: { primary: '#1e3a8a', accent: '#f5b700' } },
  settings: { shootout: { enabled: true } },
  content: { site_name: 'Wicklewood Wanderers Under-12s', short_name: 'Wanderers U12s' },
}

// A page as the server draws it: the top bar's pinned Play, a link to the
// section, and the section with its hidden Play button.
function page({ hash = '', section = true } = {}) {
  const b = createFakeBrowser()
  b.win.location = { hash }
  const pin = b.doc.createElement('a')
  pin.setAttribute('href', '#shootout')
  pin.setAttribute('data-shootout-open', '')
  b.doc.body.appendChild(pin)
  const out = { ...b, pin, scrolled: [] }
  if (!section) return out
  const el = b.doc.createElement('section')
  el.setAttribute('data-shootout', shootoutData(shootoutConfig(SITE, { url: 'https://wicklewoodwanderers.example/' })))
  el.scrollIntoView = (how) => out.scrolled.push(how)
  const button = b.doc.createElement('button')
  button.setAttribute('data-shootout-play', '')
  button.setAttribute('hidden', '')
  button.textContent = 'Play the shootout'
  const status = b.doc.createElement('p')
  status.setAttribute('data-shootout-status', '')
  el.appendChild(button)
  el.appendChild(status)
  b.doc.body.appendChild(el)
  return { ...out, section: el, button, status }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

function loader(fail = false) {
  const calls = { loads: 0, opened: [] }
  const load = async () => {
    calls.loads++
    if (fail) throw new Error('offline')
    return { openShootout: (config, options) => { calls.opened.push({ config, options }); return {} } }
  }
  return { calls, load }
}

describe('the top bar\'s pinned Play', () => {
  it('opens the game by the section\'s own path, focus going back to the pin', async () => {
    const t = page()
    const { calls, load } = loader()
    expect(enhanceShootout({ root: t.doc, load })).toBe(1)
    expect(calls.loads).toBe(0)
    const click = new t.Event('click', { bubbles: true })
    t.pin.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(t.pin.getAttribute('aria-busy')).toBe('true')
    // The page's 3D is told at once, as from the section's Play.
    expect(t.win.events.map((e) => e.detail)).toEqual([{ open: true }])
    await settle()
    expect(calls.loads).toBe(1)
    expect(calls.opened).toHaveLength(1)
    expect(calls.opened[0].options.returnFocus).toBe(t.pin)
    expect(calls.opened[0].config.siteName).toBe('Wicklewood Wanderers Under-12s')
    expect(t.pin.hasAttribute('aria-busy')).toBe(false)
    expect(t.button.textContent).toBe('Play the shootout')
    // A second tap while it opens opens it once.
    t.pin.click()
    t.button.click()
    await settle()
    expect(calls.opened).toHaveLength(2)
  })

  it('stays a plain link when the page has no game to open', () => {
    const t = page({ section: false })
    expect(enhanceShootout({ root: t.doc, load: loader().load })).toBe(0)
    const click = new t.Event('click', { bubbles: true })
    t.pin.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
  })
})

describe('a link ending #play', () => {
  it('scrolls to the section and opens the game once the script is ready', async () => {
    const t = page({ hash: '#play' })
    const { calls, load } = loader()
    enhanceShootout({ root: t.doc, load })
    expect(t.scrolled).toHaveLength(1)
    expect(t.scrolled[0].block).toBe('start')
    await settle()
    expect(calls.opened).toHaveLength(1)
    expect(calls.opened[0].options.returnFocus).toBe(t.button)
  })

  it('leaves the section\'s Play focused when the game will not open', async () => {
    const t = page({ hash: '#play' })
    enhanceShootout({ root: t.doc, load: loader(true).load })
    await settle()
    await settle()
    expect(t.doc.activeElement).toBe(t.button)
    expect(t.status.textContent).toBe('The game could not load. Check your connection and try again.')
    expect(t.win.events.map((e) => e.detail)).toEqual([{ open: true }, { open: false }])
  })

  it('opens the game when the address changes to #play on the page', async () => {
    const t = page()
    const { calls, load } = loader()
    enhanceShootout({ root: t.doc, load })
    await settle()
    expect(calls.loads).toBe(0)
    t.win.location.hash = '#play'
    t.win.dispatchEvent(new t.Event('hashchange'))
    await settle()
    expect(calls.opened).toHaveLength(1)
  })

  it('does nothing on a site with the game switched off', async () => {
    const t = page({ hash: '#play', section: false })
    const { calls, load } = loader()
    expect(enhanceShootout({ root: t.doc, load })).toBe(0)
    await settle()
    expect(calls.loads).toBe(0)
    expect(t.win.events).toEqual([])
    expect(t.win.listenerCount('hashchange')).toBe(0)
  })

  it('opens nothing for any other address', async () => {
    const t = page({ hash: '#shootout' })
    const { calls, load } = loader()
    enhanceShootout({ root: t.doc, load })
    await settle()
    expect(calls.loads).toBe(0)
    expect(t.scrolled).toEqual([])
  })
})
