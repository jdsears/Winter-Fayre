// The QR code for the stall: the site's own address as a picture a phone
// can scan, drawn here as SVG so it is right whatever address the site
// ends up on.
//
// The one dependency this needs works out which squares are dark; the
// drawing is done here, as plain shapes with no script and no styles,
// so it reads on the TV page with JavaScript off and prints cleanly.

import qrcode from 'qrcode-generator'

// The squares of the code for some words: { size, dark(row, column) }.
// Error correction M: a short address needs few squares, and bigger
// squares scan from further away.
export function qrMatrix(text) {
  const qr = qrcode(0, 'M')
  qr.addData(String(text))
  qr.make()
  const size = qr.getModuleCount()
  return { size, dark: (row, column) => qr.isDark(row, column) }
}

// The code as SVG: dark squares on white, with the quiet border of four
// squares a scanner needs. Each run of dark squares along a row is one
// rectangle in a single path.
//
//   label   said to a screen reader in place of the picture
//   ink     the dark squares' colour: it must stay much darker than white
export function qrSvg(text, { label = 'A QR code', ink = '#0c1626', cls = 'qr' } = {}) {
  const { size, dark } = qrMatrix(text)
  const quiet = 4
  const span = size + quiet * 2
  let d = ''
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!dark(row, column)) continue
      let run = 1
      while (column + run < size && dark(row, column + run)) run++
      d += `M${column + quiet} ${row + quiet}h${run}v1h-${run}z`
      column += run - 1
    }
  }
  const safe = String(label).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${span} ${span}" width="${span * 10}" height="${span * 10}" role="img" aria-label="${safe}" shape-rendering="crispEdges"><rect width="${span}" height="${span}" fill="#fff"/><path d="${d}" fill="${ink}"/></svg>`
}
