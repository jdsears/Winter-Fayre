// The "Beat the keeper" section's Play button, for the site's one script
// (client/main.js). Small on purpose: the game (game.js, and the 3D scene
// with three.js) is fetched only when Play is tapped, and three.js comes
// from the chunk the site's own scene shares when that has loaded.
//
// The server draws the section with its Play button hidden and the game's
// settings in data-shootout (section.js); without this script the section
// reads the same, with no button to press.
//
// Where it is wired in:
//   client/main.js             enhanceShootout() once the page is drawn
//   server/render/games.js     renderShootoutSection(penaltiesConfig())
//                              on the penalties page

import { readConfig } from './config.js'

// The site's colours as the page has them (its custom properties), for a
// section drawn without its own.
export function pageColours(doc = globalThis.document) {
  const out = {}
  try {
    const style = doc.defaultView.getComputedStyle(doc.documentElement)
    const read = (name) => {
      const v = style.getPropertyValue(name).trim()
      return /^#[0-9a-f]{6}$/i.test(v) ? v : undefined
    }
    out.primary = read('--primary')
    out.primary_deep = read('--primary-deep')
    out.accent = read('--accent')
    out.ink = read('--ink')
    out.kit = read('--kit')
    out.kit_trim = read('--kit-trim')
  } catch { /* no styles to read: the config's own colours stand */ }
  return out
}

// The page is told when the game opens and closes, as the game itself
// tells it (arcade:game).
function tell(doc, open) {
  try {
    const win = doc.defaultView
    win?.dispatchEvent(new win.CustomEvent('arcade:game', { detail: { open } }))
  } catch { /* an old browser: the game says so itself */ }
}

// The section's Play button, and two more ways in by the same path: the
// top bar's pinned Play (data-shootout-open, a link to the section until
// now) and a link to the page ending #play, which opens the game as the
// page is ready. Focus goes back to what opened it when the game closes.
export function enhanceShootout({ root = globalThis.document, load = () => import('./game.js'), options = {}, onOpen = null } = {}) {
  const doc = root.ownerDocument || root
  const sections = [...root.querySelectorAll('[data-shootout]')]
  let first = null
  for (const section of sections) {
    const button = section.querySelector('[data-shootout-play]')
    if (!button || button.dataset.ready) continue
    button.dataset.ready = 'true'
    button.hidden = false
    const status = section.querySelector('[data-shootout-status]')
    const label = button.textContent
    let opening = false
    // True once the game is open.
    const open = async (from = button) => {
      if (opening) return false
      opening = true
      from.setAttribute('aria-busy', 'true')
      button.textContent = 'Loading the game'
      if (status) status.textContent = ''
      // The page's own 3D stops at once, while the game loads (the game
      // says so again when it opens, and when it closes).
      tell(doc, true)
      try {
        const { openShootout } = await load()
        const config = readConfig(section.getAttribute('data-shootout'), pageColours(doc))
        const game = openShootout(config, { returnFocus: from, ...options })
        onOpen?.(game)
        return true
      } catch {
        tell(doc, false)
        if (status) status.textContent = 'The game could not load. Check your connection and try again.'
        return false
      } finally {
        button.textContent = label
        from.removeAttribute('aria-busy')
        opening = false
      }
    }
    button.addEventListener('click', () => open())
    first ||= { section, button, open }
  }
  if (first) {
    for (const link of root.querySelectorAll('[data-shootout-open]')) {
      if (link.dataset.ready) continue
      link.dataset.ready = 'true'
      link.addEventListener('click', (e) => {
        e.preventDefault()
        first.open(link)
      })
    }
    const win = doc.defaultView
    const asked = () => {
      try { return win.location.hash === '#play' } catch { return false }
    }
    if (asked()) playFromLink(first)
    win?.addEventListener?.('hashchange', () => { if (asked()) playFromLink(first) })
  }
  return sections.length
}

// #play: the section comes to the screen and the game opens over it. If
// the game will not open, the section stays with its Play button focused,
// one tap away.
async function playFromLink({ section, button, open }) {
  try {
    section.scrollIntoView({ block: 'start', behavior: 'instant' })
  } catch {
    try { section.scrollIntoView(true) } catch { /* nowhere to scroll */ }
  }
  if (!(await open(button))) button.focus()
}
