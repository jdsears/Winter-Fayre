// The "Beat the keeper" section of a team site's page, as HTML: drawn on
// the server with the rest of the page (and by the demo page), in the
// site template's bands, so it reads the same without JavaScript. The
// Play button is hidden until the page's script (index.js) can open the
// game; the game's settings ride along in data-shootout. Pure.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c])

// "Beat the *keeper*": the starred words in the site's highlight, and
// **double stars** bold, as the template's headings have them.
export function emphasis(text) {
  return esc(text)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
}

// What the page's script needs, and no more: no partner links beyond the
// one presenting the game, nothing about anyone.
export function shootoutData(config) {
  return JSON.stringify({
    siteName: config.siteName,
    teamName: config.teamName,
    url: config.url,
    share: config.share !== false,
    opponentName: config.opponentName,
    presentedBy: config.presentedBy ? config.presentedBy.name : null,
    partners: config.partners.map((p) => p.name),
    boards: config.boards,
    copy: config.copy,
    colours: config.colours,
    storageKey: config.storageKey,
  })
}

// A goal, a ball and the tracker's dots, in the site's colours.
export function goalArt() {
  const dots = (y, filled) => filled.map((f, i) => {
    const x = 118 + i * 30
    if (f === 'x') return `<g transform="translate(${x} ${y})"><circle r="10" class="sa-ring"/><path d="M-6-6 6 6M6-6-6 6" class="sa-cross"/></g>`
    return `<circle cx="${x}" cy="${y}" r="10" class="${f ? 'sa-dot' : 'sa-ring'}"/>`
  }).join('')
  let net = ''
  for (let x = 40; x <= 360; x += 20) net += `<path d="M${x} 40V200"/>`
  for (let y = 40; y <= 200; y += 20) net += `<path d="M40 ${y}H360"/>`
  return `<svg viewBox="0 0 400 300" role="presentation" focusable="false">
<g class="sa-net">${net}</g>
<path d="M34 214V34H366V214" class="sa-frame"/>
<path d="M0 214H400" class="sa-line"/>
<g transform="translate(276 120) rotate(-18)"><circle r="26" class="sa-ball"/><path d="M0-12 11-4 7 10H-7L-11-4Z" class="sa-patch"/></g>
<g>${dots(254, [true, true, 'x', true, false])}${dots(284, [true, 'x', true, true, false])}</g>
</svg>`
}

export function renderShootoutSection(config, { id = 'shootout' } = {}) {
  if (!config) return ''
  const presented = config.presentedBy
    ? `<p class="shootout-presented">Shootout presented by ${config.presentedBy.url
      ? `<a href="${esc(config.presentedBy.url)}" rel="noopener" target="_blank">${esc(config.presentedBy.name)}</a>`
      : `<strong>${esc(config.presentedBy.name)}</strong>`}</p>`
    : ''
  return `<section id="${esc(id)}" class="band deep stripes shootout" aria-labelledby="${esc(id)}-title" data-shootout="${esc(shootoutData(config))}">
  <div class="wrap shootout-grid">
    <div class="shootout-copy">
      <div class="eyebrow">${esc(config.copy.eyebrow)}</div>
      <h2 id="${esc(id)}-title" class="rv">${emphasis(config.copy.heading)}</h2>
      <p class="lede rv">${esc(config.copy.line)}</p>
      ${presented}
      <div class="cta"><button type="button" class="btn y shootout-play" data-shootout-play hidden>Play the shootout</button><a class="btn o" href="/">More games</a></div>
      <p class="shootout-status" data-shootout-status role="status"></p>
      <noscript><p class="shootout-status">The shootout needs JavaScript switched on.</p></noscript>
    </div>
    <div class="shootout-art" aria-hidden="true">${goalArt()}</div>
  </div>
</section>`
}

// The section's own styles, for the site template's stylesheet: the
// bands, eyebrow, heading and button are the template's.
export const SECTION_CSS = `
.shootout-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:18px 30px;align-items:center}
.shootout .cta{margin-top:18px}
.shootout-play{border:0;cursor:pointer;font-family:inherit}
.shootout-presented{margin:6px 0 0;font-size:16px;color:var(--mut)}
.shootout-presented a,.shootout-presented strong{color:var(--fg);font-weight:700}
.shootout-status{margin:10px 0 0;min-height:1.2em;font-size:16px;color:var(--mut)}
.shootout-art svg{display:block;width:100%;max-width:420px;height:auto;margin:0 auto}
.sa-net path{stroke:#ffffff;stroke-opacity:.28;stroke-width:1.5;fill:none}
.sa-frame{stroke:#ffffff;stroke-width:10;fill:none;stroke-linejoin:round}
.sa-line{stroke:#ffffff;stroke-opacity:.6;stroke-width:3}
.sa-ball{fill:#ffffff;stroke:var(--ink);stroke-width:2}
.sa-patch{fill:var(--ink)}
.sa-dot{fill:var(--accent)}
.sa-ring{fill:none;stroke:#ffffff;stroke-opacity:.7;stroke-width:3}
.sa-cross{stroke:#ff6b6b;stroke-width:3;stroke-linecap:round}
`
