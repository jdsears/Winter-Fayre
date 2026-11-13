// What the shootout takes from a team site's record: whether it is on,
// the words of its section, the site's colours, its partners for the
// boards and the line "Shootout presented by", and the name of the side
// the visitor plays. Pure, so the server's template and the page's
// script read a site the same way.
//
// The record, as far as the shootout reads it (the shape Admin, Team
// sites saves):
//   content.site_name, short_name   the site's names
//   theme.colours                   primary, accent and the rest, hex
//   content.partners                { names: [{ name, url }], invite_label }
//   content.shootout                { eyebrow, heading, line }
//   settings.shootout               { enabled, presented_by, opponent_name }
//
// The game is off unless settings.shootout.enabled is true.

import { contrast, isHex, mix } from './colour.js'

export const DEFAULT_OPPONENT = 'The Visitors'
export const BOARD_FALLBACK = 'Winter Fayre'
export const MAX_PARTNERS = 24

const text = (v, max = 160) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function defaultCopy(teamName) {
  return {
    eyebrow: 'Penalty shootout',
    heading: 'Beat the *keeper*',
    line: teamName
      ? `Five penalties each, then sudden death. Take your kicks, make your saves and win it for ${teamName}.`
      : 'Five penalties each, then sudden death. Take your kicks, make your saves and win it.',
  }
}

// The site's colours, as the page has them: the theme's own, with the
// rest worked out from primary and accent as the site's template does.
// A site with none set takes the page's own (its CSS custom properties,
// passed in as fallback), never one club's.
export function themeColours(site, fallback = {}) {
  const given = site?.theme?.colours || {}
  const pick = (key) => [given[key], fallback[key]].find(isHex)
  const primary = pick('primary') || '#1e3a8a'
  const accentGiven = pick('accent') || '#f5b301'
  const deep = pick('primary_deep') || mix(primary, '#000000', 0.32)
  const ink = pick('ink') || mix(primary, '#000000', 0.55)
  // An accent that disappears on the deep colour reads as white instead.
  const accent = contrast(accentGiven, deep) < 2.2 ? '#ffffff' : accentGiven
  return {
    primary,
    deep,
    accent,
    ink,
    kit: pick('kit') || primary,
    kitTrim: pick('kit_trim') || accentGiven,
  }
}

export function partnerList(site) {
  const raw = site?.content?.partners?.names ?? []
  const seen = new Set()
  const out = []
  for (const p of Array.isArray(raw) ? raw : []) {
    const name = text(typeof p === 'string' ? p : p?.name, 40)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const url = p && typeof p === 'object' && /^https:\/\//i.test(p.url || '') ? p.url : null
    out.push({ name, url })
    if (out.length >= MAX_PARTNERS) break
  }
  return out
}

// The names on the advertising boards: the partners, or the invitation.
export function boardNames(partners, invite = BOARD_FALLBACK) {
  return partners.length ? partners.map((p) => p.name) : [text(invite, 40) || BOARD_FALLBACK]
}

// "Shootout presented by": the one partner the settings name, sold as a
// package benefit. Matched to the partners for its proper name and link.
export function presentedBy(setting, partners) {
  const name = text(typeof setting === 'string' ? setting : setting?.name, 40)
  if (!name) return null
  const match = partners.find((p) => p.name.toLowerCase() === name.toLowerCase())
  return match ? { name: match.name, url: match.url } : { name, url: null }
}

// url is the address a result is shared with: the site's public one.
// share false (a draft, whose only address is its secret link) leaves
// Share and Copy link off the results.
export function shootoutConfig(site, { url = null, share = true, fallbackColours = {} } = {}) {
  const settings = site?.settings?.shootout
  if (!settings || settings.enabled !== true) return null
  const content = site?.content || {}
  const siteName = text(content.site_name || site?.name, 60) || 'our team'
  const teamName = text(content.short_name, 30) || siteName
  const partners = partnerList(site)
  const copy = content.shootout || {}
  const defaults = defaultCopy(teamName)
  return {
    siteName,
    teamName,
    url: share ? text(url || '', 300) || null : null,
    share: share !== false,
    opponentName: text(settings.opponent_name, 30) || DEFAULT_OPPONENT,
    presentedBy: presentedBy(settings.presented_by, partners),
    partners,
    boards: boardNames(partners, content.partners?.invite_label),
    copy: {
      eyebrow: text(copy.eyebrow, 40) || defaults.eyebrow,
      heading: text(copy.heading, 80) || defaults.heading,
      line: text(copy.line, 240) || defaults.line,
    },
    colours: themeColours(site, fallbackColours),
    storageKey: `winterfayre-penalties:${text(String(site?.slug || site?.id || 'site'), 80)}`,
  }
}

// The config as the page's script reads it back from the section's
// data-shootout attribute: anything missing or malformed is put right,
// so a hand-edited page cannot break the game.
export function readConfig(raw, fallbackColours = {}) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      data = {}
    }
  }
  data = data && typeof data === 'object' ? data : {}
  const partners = partnerList({ content: { partners: { names: data.partners } } })
  const siteName = text(data.siteName, 60) || 'our team'
  const teamName = text(data.teamName, 30) || siteName
  const defaults = defaultCopy(teamName)
  const colours = themeColours({ theme: { colours: {
    primary: data.colours?.primary,
    accent: data.colours?.accent,
    primary_deep: data.colours?.deep,
    ink: data.colours?.ink,
    kit: data.colours?.kit,
    kit_trim: data.colours?.kitTrim,
  } } }, fallbackColours)
  return {
    siteName,
    teamName,
    url: data.share === false ? null : text(data.url, 300) || null,
    share: data.share !== false,
    opponentName: text(data.opponentName, 30) || DEFAULT_OPPONENT,
    presentedBy: data.presentedBy ? presentedBy(data.presentedBy, partners) : null,
    partners,
    boards: Array.isArray(data.boards) && data.boards.length ? data.boards.map((b) => text(b, 40)).filter(Boolean).slice(0, MAX_PARTNERS) : boardNames(partners),
    copy: {
      eyebrow: text(data.copy?.eyebrow, 40) || defaults.eyebrow,
      heading: text(data.copy?.heading, 80) || defaults.heading,
      line: text(data.copy?.line, 240) || defaults.line,
    },
    colours,
    storageKey: text(data.storageKey, 120) || 'winterfayre-penalties:site',
  }
}
