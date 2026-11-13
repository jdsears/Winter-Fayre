// One calm line for grown-ups at the foot of a game's finish panel: what
// the games are in aid of, and a link to the appeal on this site's own
// arcade page, where a parent can read it and choose to donate. It never
// links straight to where money is given: a child with the phone in hand
// is one step further from that.
//
// Built with createElement alone, so it runs against the small stand-in
// document the tests use as well as a real one.

import { APPEAL } from '../../shared/appeal.js'

// Where the appeal is told: on the arcade page, above the games menu.
export const APPEAL_AT = '/#appeal'

// The line and its link: { root, link }.
export function appealLine(doc) {
  const root = doc.createElement('p')
  root.className = 'gs-appeal'
  const words = doc.createElement('span')
  words.textContent = `${APPEAL.line} `
  const link = doc.createElement('a')
  link.setAttribute('href', APPEAL_AT)
  link.textContent = APPEAL.more
  root.appendChild(words)
  root.appendChild(link)
  return { root, link }
}
