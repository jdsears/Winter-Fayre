// The parts every page shares: the head (title, description, robots),
// the colours, the top bar, the snow and the footer.
//
// The stylesheet is one file of its own (css.js, served by the app); the
// one inline style block carries only the fonts' addresses and the
// site's colours, and it carries the response's nonce, so the
// Content-Security-Policy lets in nothing else.

import { esc, attr } from './html.js'
import { SITE, COLOURS } from '../site.js'

export const FONT_PATH = '/fonts/'

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

// Barlow Condensed for headings, Barlow for words, served from this site
// (client/fonts, OFL), so no visitor's address goes to a font service.
export const FACES = [
  { family: 'Barlow Condensed', weight: 700, file: 'barlow-condensed-700-latin.woff2' },
  { family: 'Barlow Condensed', weight: 800, file: 'barlow-condensed-800-latin.woff2', preload: true },
  { family: 'Barlow', weight: 400, file: 'barlow-400-latin.woff2', preload: true },
  { family: 'Barlow', weight: 700, file: 'barlow-700-latin.woff2' },
]
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif'
const BODY = '"Barlow", "Segoe UI", system-ui, sans-serif'

const fontCss = () => FACES.map(f => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${FONT_PATH}${f.file}) format("woff2");unicode-range:${LATIN}}`).join('')

// The colours as custom properties, for the stylesheet and for the games,
// which read them from the page (client/shootout/index.js, pageColours).
export function themeCss(c = COLOURS) {
  return fontCss()
    + `:root{--primary:${c.primary};--primary-deep:${c.primary_deep};--primary-light:${c.primary_light};--ink:${c.ink};--accent:${c.accent};--ice:${c.ice};--tint:${c.tint};`
    + `--on-primary-muted:${c.on_primary_muted};--on-primary-soft:${c.on_primary_soft};--on-light-muted:${c.on_light_muted};--rule-light:${c.rule_light};`
    + `--kit:${c.kit};--kit-trim:${c.kit_trim};--bar:${c.primary_deep}f2;--shade:${c.ink}40;--lift:${c.ink}14;--deep-shadow:${c.ink}66;`
    + `--display:${DISPLAY};--body:${BODY};color-scheme:dark}`
}

// ---------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------

// meta: { title, description }. Every page is kept out of search
// engines: the site is for one day at a school fayre.
export function headHtml({ meta, stylesheet, nonce, css = '', refresh = 0 }) {
  const tags = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(meta.title)}</title>`,
    meta.description ? `<meta name="description" content="${attr(meta.description)}">` : '',
    '<meta name="robots" content="noindex, nofollow">',
    `<meta name="theme-color" content="${attr(COLOURS.primary_deep)}">`,
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<link rel="icon" type="image/svg+xml" href="/icon.svg">',
    // A page that looks after itself with no script (the TV): it is
    // asked for again every so often.
    refresh ? `<noscript><meta http-equiv="refresh" content="${Number(refresh)}"></noscript>` : '',
    ...FACES.filter(f => f.preload).map(f => `<link rel="preload" href="${FONT_PATH}${f.file}" as="font" type="font/woff2" crossorigin>`),
    `<link rel="stylesheet" href="${attr(stylesheet)}">`,
    `<style nonce="${attr(nonce)}">${themeCss()}${css}</style>`,
  ].filter(Boolean)
  return tags.join('\n')
}

// ---------------------------------------------------------------------
// The snow
// ---------------------------------------------------------------------

// A snowflake and a sparkle, drawn once and used wherever snow falls on
// a page. Shapes only, drawn here: nothing is fetched.
export const SNOW_DEFS = '<svg class="vh" width="0" height="0" aria-hidden="true" focusable="false"><defs>'
  + '<g id="sfa"><path d="M0 0V-10M0-4.4l-2.7-2.7M0-4.4l2.7-2.7M0-7.6l-1.7-1.7M0-7.6l1.7-1.7"/></g>'
  + '<g id="sf" fill="none" stroke-width="1.25" stroke-linecap="round">'
  + [0, 60, 120, 180, 240, 300].map(a => `<use href="#sfa" transform="rotate(${a})"/>`).join('')
  + '</g>'
  + '<path id="sp" d="M0-9Q.6-.6 9 0Q.6.6 0 9Q-.6.6-9 0Q-.6-.6 0-9Z"/>'
  + '</defs></svg>'

// A small seeded source of numbers, so the snow falls in the same places
// on every request and a page can be cached and compared.
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A band of snowflakes w wide and h high, as on the fayre's poster: ice
// blue and gold flakes of different sizes, and a few sparkles.
export function snowBand({ w = 400, h = 90, count = 26, seed = 14 } = {}) {
  const r = seeded(seed)
  const flakes = []
  for (let i = 0; i < count; i++) {
    const x = Math.round((i + 0.5) * (w / count) + (r() - 0.5) * (w / count) * 0.9)
    const y = Math.round(10 + r() * (h - 20))
    const s = (0.7 + r() * 1.9).toFixed(2)
    const turn = Math.round(r() * 60)
    const kind = r()
    flakes.push(kind < 0.16
      ? `<use href="#sp" class="${r() < 0.5 ? 'sg' : 'sw'}" transform="translate(${x} ${y}) scale(${(Number(s) * 0.7).toFixed(2)})"/>`
      : `<use href="#sf" class="${kind < 0.42 ? 'sfg' : kind < 0.52 ? 'sfw' : 'sfi'}" transform="translate(${x} ${y}) rotate(${turn}) scale(${s})"/>`)
  }
  return `<svg class="snow" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${flakes.join('')}</svg>`
}

// ---------------------------------------------------------------------
// The top bar and the footer
// ---------------------------------------------------------------------

// The site's name, leading back to the arcade from any other page.
export function barHtml({ home = false } = {}) {
  const name = `<span class="bn">${esc(SITE.short)} <b>Sports Arcade</b></span>`
  return `<div class="bar"><div class="wrap">
  ${home ? name : `<a class="home" href="/">${name}<span class="vh">: all the games</span></a>`}
  ${home ? '' : '<a class="bar-play" href="/">All games</a>'}
</div></div>`
}

export function footerHtml() {
  return `<footer><div class="wrap">
  <p><b>${esc(SITE.name)}</b><br>${esc(SITE.host)}</p>
  <p class="fl"><a class="mail" href="/">All games</a><a class="mail" href="/privacy">Privacy</a></p>
</div></footer>`
}

// ---------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------

export function documentHtml({ head, body, script = null }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
${head}
</head>
<body>
${SNOW_DEFS}
<div class="page">
${body}
</div>
${script ? `<script type="module" src="${attr(script)}"></script>` : ''}
</body>
</html>
`
}
