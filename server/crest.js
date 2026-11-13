// The crest of the Wymondham College Parent Staff Association: the one
// picture the site holds. John supplied it and has said he has
// permission to use it (13 November 2026).
//
// It is the picture he sent, whole and unaltered but for two things: it
// is made small (256 pixels square, WebP, about six kilobytes) and its
// corners are rounded. It is shown on its own plum background, as it
// came, and the site's winter colours are left as they are.
//
// It is served from this site under a name made from what is in it, so
// a browser may keep it for good, and it is the only picture the big
// sign in the stadium will take (client/shootout/boards.js). If the file
// is ever missing the site carries on in words alone.

import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attr } from './render/html.js'

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'crest', 'psa.webp')

// What the picture shows, for someone who cannot see it.
export const CREST_ALT = 'Wymondham College Parent Staff Association'

// The crest read from a file: { bytes, path, size, alt }, or null if it
// is not there or is not a WebP picture.
export function readCrest(file = FILE) {
  try {
    const bytes = readFileSync(file)
    if (bytes.subarray(0, 4).toString('latin1') !== 'RIFF' || bytes.subarray(8, 12).toString('latin1') !== 'WEBP') return null
    const name = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    return { bytes, path: `/media/badge/${name}.webp`, size: 256, alt: CREST_ALT }
  } catch {
    return null
  }
}

export const CREST = readCrest()

// The crest on a page, `shown` pixels square (a style sheet may size it
// further by its class). The picture's own size is given so the page
// does not jump as it loads. Nothing at all where there is no crest.
export function crestImg({ shown = 72, cls = 'crest', lazy = false } = {}, crest = CREST) {
  if (!crest) return ''
  return `<img class="${attr(cls)}" src="${attr(crest.path)}" width="${shown}" height="${shown}" alt="${attr(crest.alt)}" decoding="async"${lazy ? ' loading="lazy"' : ''}>`
}
