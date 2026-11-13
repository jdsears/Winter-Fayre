// What the shootout reads from a site's record, and the section it draws:
// off unless the site turns it on, its words with plain defaults, the
// site's own colours (never one club's), the partners on the boards with
// an invitation when there are none, "Shootout presented by" from one
// named partner, and a section that reads the same without JavaScript.
//
// Every site here is invented.
//
// Run with: npx vitest run client/shootout/config.test.js

import { describe, it, expect } from 'vitest'
import { BOARD_FALLBACK, DEFAULT_OPPONENT, readConfig, shootoutConfig, themeColours } from './config.js'
import { emphasis, renderShootoutSection, shootoutData } from './section.js'
import { kits } from './kit.js'
import { contrast, distance } from './colour.js'

const site = (over = {}) => ({
  id: 'demo-site',
  slug: 'wicklewood-u12',
  theme: { colours: { primary: '#1e3a8a', accent: '#f5b700' } },
  settings: { shootout: { enabled: true, presented_by: 'Hartley Bakery' } },
  content: {
    site_name: 'Wicklewood Wanderers Under-12s',
    short_name: 'Wanderers U12s',
    partners: { names: ['Hartley Bakery', { name: 'Oakfield Motors', url: 'https://oakfield.example' }, 'Reed & Sons'], invite_label: 'Your business here' },
  },
  ...over,
})

describe('the settings', () => {
  it('is off unless the site turns it on', () => {
    expect(shootoutConfig({ ...site(), settings: {} })).toBe(null)
    expect(shootoutConfig({ ...site(), settings: { shootout: { enabled: false } } })).toBe(null)
    expect(shootoutConfig({ ...site(), settings: { shootout: { enabled: 'yes' } } })).toBe(null)
    expect(shootoutConfig(site())).not.toBe(null)
  })

  it('plays a generic side unless the site names one', () => {
    expect(shootoutConfig(site()).opponentName).toBe(DEFAULT_OPPONENT)
    expect(DEFAULT_OPPONENT).toBe('The Visitors')
    const named = site({ settings: { shootout: { enabled: true, opponent_name: '  Harbour   Town  ' } } })
    expect(shootoutConfig(named).opponentName).toBe('Harbour Town')
  })

  it('gives the section plain words of its own unless the site writes them', () => {
    const c = shootoutConfig(site())
    expect(c.copy.eyebrow).toBe('Penalty shootout')
    expect(c.copy.heading).toBe('Beat the *keeper*')
    expect(c.copy.line).toContain('win it for Wanderers U12s')
    const written = shootoutConfig(site({ content: { ...site().content, shootout: { eyebrow: 'Half time', heading: 'Can you *score*?', line: 'Five each.' } } }))
    expect(written.copy).toEqual({ eyebrow: 'Half time', heading: 'Can you *score*?', line: 'Five each.' })
  })

  it('names the partner presenting it, from the partners where it can', () => {
    expect(shootoutConfig(site()).presentedBy).toEqual({ name: 'Hartley Bakery', url: null })
    const oak = site({ settings: { shootout: { enabled: true, presented_by: 'oakfield motors' } } })
    expect(shootoutConfig(oak).presentedBy).toEqual({ name: 'Oakfield Motors', url: 'https://oakfield.example' })
    expect(shootoutConfig(site({ settings: { shootout: { enabled: true } } })).presentedBy).toBe(null)
  })

  it('puts the partners on the boards, or the invitation when there are none', () => {
    expect(shootoutConfig(site()).boards).toEqual(['Hartley Bakery', 'Oakfield Motors', 'Reed & Sons'])
    const none = site({ content: { site_name: 'Wicklewood Wanderers Under-12s' } })
    expect(shootoutConfig(none).boards).toEqual([BOARD_FALLBACK])
    expect(BOARD_FALLBACK).toBe('Winter Fayre')
  })

  it('keeps the best result under the site, on this device only', () => {
    expect(shootoutConfig(site()).storageKey).toBe('winterfayre-penalties:wicklewood-u12')
  })
})

describe('the colours', () => {
  it('are the site\'s, with the rest worked out from them', () => {
    const c = themeColours(site())
    expect(c.primary).toBe('#1e3a8a')
    expect(c.accent).toBe('#f5b700')
    expect(c.kit).toBe('#1e3a8a')
    expect(c.kitTrim).toBe('#f5b700')
    expect(contrast(c.deep, '#ffffff')).toBeGreaterThan(contrast(c.primary, '#ffffff'))
  })

  it('follow the site: two sites, two looks', () => {
    const red = themeColours(site({ theme: { colours: { primary: '#b3122e', accent: '#ffffff' } } }))
    const blue = themeColours(site())
    expect(red.primary).not.toBe(blue.primary)
    expect(distance(kits(red).home.shirt, kits(blue).home.shirt)).toBeGreaterThan(100)
  })

  it('take the page\'s own colours when the record has none', () => {
    const c = themeColours({ theme: {} }, { primary: '#14613a', accent: '#f2c230' })
    expect(c.primary).toBe('#14613a')
    expect(c.accent).toBe('#f2c230')
  })

  it('swap an accent that would vanish on the deep band for white', () => {
    const c = themeColours({ theme: { colours: { primary: '#222222', accent: '#111111' } } })
    expect(c.accent).toBe('#ffffff')
  })

  it('dress each keeper apart from their own side', () => {
    for (const t of [site().theme.colours, { primary: '#b6f23a', accent: '#18191d' }, { primary: '#ff3f8e', accent: '#ffffff' }]) {
      const k = kits(themeColours({ theme: { colours: t } }))
      expect(distance(k.homeKeeper.shirt, k.home.shirt)).toBeGreaterThan(150)
      expect(distance(k.away.shirt, k.home.shirt)).toBeGreaterThan(150)
      expect(distance(k.awayKeeper.shirt, k.away.shirt)).toBeGreaterThan(150)
    }
  })
})

describe('the section', () => {
  it('is drawn only when the game is on', () => {
    expect(renderShootoutSection(null)).toBe('')
  })

  it('reads the same without JavaScript: the words, and Play hidden until the script is there', () => {
    const html = renderShootoutSection(shootoutConfig(site()))
    expect(html).toContain('id="shootout"')
    expect(html).toContain('Beat the <em>keeper</em>')
    expect(html).toContain('Shootout presented by <strong>Hartley Bakery</strong>')
    expect(html).toMatch(/<button type="button" class="btn y shootout-play" data-shootout-play hidden>Play the shootout<\/button>/)
    expect(html).toContain('<noscript>')
  })

  it('links the presenting partner when it has a web address', () => {
    const html = renderShootoutSection(shootoutConfig(site({ settings: { shootout: { enabled: true, presented_by: 'Oakfield Motors' } } })))
    expect(html).toContain('<a href="https://oakfield.example" rel="noopener" target="_blank">Oakfield Motors</a>')
  })

  it('escapes what the site wrote', () => {
    const odd = site({ content: { ...site().content, site_name: 'A <b>"Team"</b>', shootout: { heading: 'Score & *win*', line: '<script>x</script>' } } })
    const html = renderShootoutSection(shootoutConfig(odd))
    expect(html).not.toContain('<script>')
    expect(html).toContain('Score &amp; <em>win</em>')
    expect(emphasis('*a* and *b*')).toBe('<em>a</em> and <em>b</em>')
  })

  it('hands the page\'s script the game\'s settings, read back the same', () => {
    const config = shootoutConfig(site(), { url: 'https://wicklewoodwanderers.example/' })
    const html = renderShootoutSection(config)
    const raw = html.match(/data-shootout="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const back = readConfig(raw)
    expect(back.siteName).toBe(config.siteName)
    expect(back.opponentName).toBe('The Visitors')
    expect(back.presentedBy).toEqual({ name: 'Hartley Bakery', url: null })
    expect(back.boards).toEqual(config.boards)
    expect(back.colours).toEqual(config.colours)
    expect(back.url).toBe('https://wicklewoodwanderers.example/')
    // Nothing about anyone: names of partners, the site's words, colours.
    expect(Object.keys(JSON.parse(shootoutData(config))).sort()).toEqual(['boards', 'colours', 'copy', 'opponentName', 'partners', 'presentedBy', 'share', 'siteName', 'storageKey', 'teamName', 'url'])
  })

  it('reads a broken data-shootout as defaults rather than failing', () => {
    const c = readConfig('{not json', { primary: '#14613a', accent: '#f2c230' })
    expect(c.opponentName).toBe('The Visitors')
    expect(c.boards).toEqual(['Winter Fayre'])
    expect(c.colours.primary).toBe('#14613a')
  })
})
