// Colour sums for the site's theme and the kits: read a hex colour, mix
// two, measure how far apart two are and pick text that stands out on a
// fill. Pure.

export function parseHex(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

export function toHex({ r, g, b }) {
  const c = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function isHex(value) {
  return parseHex(value) !== null
}

export function mix(a, b, k) {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return a
  return toHex({ r: x.r + (y.r - x.r) * k, g: x.g + (y.g - x.g) * k, b: x.b + (y.b - x.b) * k })
}

const channel = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex) {
  const c = parseHex(hex)
  if (!c) return 0
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

export function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// How different two colours look: a weighted distance in RGB, 0 to
// about 765.
export function distance(a, b) {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) return 0
  const rm = (x.r + y.r) / 2
  const dr = x.r - y.r
  const dg = x.g - y.g
  const db = x.b - y.b
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

// Text for a fill: whichever of the two given reads better on it.
export function textOn(fill, light = '#ffffff', dark = '#0b1220') {
  return contrast(fill, light) >= contrast(fill, dark) ? light : dark
}

// The candidate furthest from every colour to avoid.
export function furthest(candidates, avoid) {
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    const score = Math.min(...avoid.filter(isHex).map((a) => distance(c, a)))
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}
