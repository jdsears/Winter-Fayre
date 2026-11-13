// The boards round the pitch and the big sign across the stand.
//
// A board carries words (the page lists them: data-boards). It can also
// carry a picture in place of its words (data-board-logos): one served
// by this site, never another. A board with a picture is white with the
// picture fitted on it; one without is its words in the site's colours.
// A picture that will not load leaves the words in its place. The arcade
// uses words only.

const PATH = /^\/media\/partners\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/

// { name: path } from the page, checked: only this site's own logo paths.
export function boardLogosFrom(doc = globalThis.document) {
  const out = {}
  try {
    const raw = JSON.parse(doc.querySelector('[data-board-logos]')?.getAttribute('data-board-logos') || '{}')
    for (const [name, path] of Object.entries(raw || {})) {
      if (typeof path === 'string' && PATH.test(path)) out[String(name).toLowerCase()] = path
    }
  } catch { /* no list: every board is a name */ }
  return out
}

// The pictures, loading: a Map from a partner's name (lower case) to its
// image. onLoad is called as each arrives.
export function loadBoardLogos(logos = {}, { win = globalThis.window, onLoad = () => {} } = {}) {
  const images = new Map()
  for (const [name, path] of Object.entries(logos)) {
    try {
      const img = new win.Image()
      img.decoding = 'async'
      img.onload = () => onLoad(name)
      img.src = path
      images.set(name, img)
    } catch { /* no images here: the name stands */ }
  }
  return images
}

export const logoReady = (img) => Boolean(img && img.complete && img.naturalWidth > 0)

// Where a logo sits on a board of w by h: as large as fits, with room
// round it, in the middle.
export function logoBox(img, w, h, { across = 0.86, up = 0.66 } = {}) {
  const k = Math.min((w * across) / img.naturalWidth, (h * up) / img.naturalHeight)
  const dw = img.naturalWidth * k
  const dh = img.naturalHeight * k
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh }
}

// The boards round the pitch: fifteen of them, four metres wide, the
// middle one behind the middle of the goal. More partners than boards
// in view still each have a board; a partner's name comes round again
// when there are fewer partners than boards.
export const BOARD_W = 4
export const BOARD_COUNT = 15
export const boardCentre = (i) => (i - (BOARD_COUNT - 1) / 2) * BOARD_W

// The big sign across the stand: a name, with a smaller line over it
// if the page gives one, and a badge beside them or a logo in their
// place if the site has one. From the page (data-top-sign), checked:
// words, and only this site's own picture paths.
const BADGE = /^\/media\/badge\/[a-f0-9]{8,64}\.(?:webp|png)$/
export function topSignFrom(doc = globalThis.document) {
  try {
    const raw = JSON.parse(doc.querySelector('[data-top-sign]')?.getAttribute('data-top-sign') || 'null')
    if (!raw || typeof raw !== 'object') return null
    const words = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '')
    const name = words(raw.name)
    const over = words(raw.over)
    const logo = typeof raw.logo === 'string' && PATH.test(raw.logo) ? raw.logo : null
    const badge = typeof raw.badge === 'string' && BADGE.test(raw.badge) ? raw.badge : null
    return name || logo ? { name, logo, badge, ...(over ? { over } : {}) } : null
  } catch {
    return null
  }
}

// How tall the badge stands on the sign, as a share of the sign's height:
// as tall as the gold edges allow, with a little room above and below.
export const BADGE_TALL = 0.78

// Draws the sign on a canvas of w by h: the logo on white, or the badge
// beside the name on the site's deep colour. With a line over the name,
// that line is drawn smaller above it, in white, and the name below it
// in the site's accent.
export function drawTopSign(g, w, h, sign, { logo = null, badge = null, colours, font = '"Barlow Condensed", "Arial Narrow", sans-serif' } = {}) {
  const edge = Math.round(h * 0.06)
  if (logoReady(logo)) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    g.fillStyle = colours.accent
    g.fillRect(0, h - edge, w, edge)
    const b = logoBox(logo, w, h - edge, { across: 0.8, up: 0.7 })
    g.drawImage(logo, b.x, b.y, b.w, b.h)
    return
  }
  g.fillStyle = colours.deep
  g.fillRect(0, 0, w, h)
  g.fillStyle = colours.accent
  g.fillRect(0, 0, w, edge)
  g.fillRect(0, h - edge, w, edge)
  const word = (sign.name || '').toUpperCase()
  const mark = logoReady(badge) ? h * BADGE_TALL : 0
  const gap = mark ? h * 0.12 : 0
  if (sign.over) {
    const over = sign.over.toUpperCase()
    const room = w * 0.92 - mark - gap
    const fit = (text, start) => {
      let size = Math.round(start)
      g.font = `800 ${size}px ${font}`
      while (g.measureText(text).width > room && size > 8) {
        size -= 1
        g.font = `800 ${size}px ${font}`
      }
      return { size, width: g.measureText(text).width }
    }
    const top = fit(over, h * 0.27)
    const main = fit(word, h * 0.5)
    const wide = Math.max(top.width, main.width)
    const x = (w - (wide + mark + gap)) / 2
    if (mark) g.drawImage(badge, x, (h - mark) / 2, (mark * badge.naturalWidth) / badge.naturalHeight, mark)
    const mid = x + mark + gap + wide / 2
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#ffffff'
    g.font = `800 ${top.size}px ${font}`
    g.fillText(over, mid, h * 0.27)
    g.fillStyle = colours.accent
    g.font = `800 ${main.size}px ${font}`
    g.fillText(word, mid, h * 0.64)
    return
  }
  let size = Math.round(h * 0.56)
  g.font = `800 ${size}px ${font}`
  while (g.measureText(word).width + mark + gap > w * 0.9 && size > 12) {
    size -= 2
    g.font = `800 ${size}px ${font}`
  }
  const total = g.measureText(word).width + mark + gap
  const x = (w - total) / 2
  if (mark) g.drawImage(badge, x, (h - mark) / 2, (mark * badge.naturalWidth) / badge.naturalHeight, mark)
  g.fillStyle = '#ffffff'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(word, x + mark + gap, h / 2 + size * 0.04)
}

// The sign's pictures, loading: { logo, badge }, each an image or null.
export function loadTopSign(sign, { win = globalThis.window, onLoad = () => {} } = {}) {
  const load = (path) => {
    if (!path) return null
    try {
      const img = new win.Image()
      img.decoding = 'async'
      img.onload = () => onLoad()
      img.src = path
      return img
    } catch {
      return null
    }
  }
  return { logo: load(sign?.logo), badge: load(sign?.badge) }
}
