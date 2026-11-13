// Sharing a result: the phone's own share sheet where there is one, and
// Copy link where there is not. Only the words and the site's link are
// shared; nothing is sent by the game itself.

import { scoreWords } from './rules.js'

export function shareText({ won, us, them, siteName }) {
  const result = won ? `won the penalty shootout ${scoreWords(us, them)}` : `lost the penalty shootout ${scoreWords(us, them)}`
  return `I ${result} on the ${siteName} website. Can you beat the keeper?`
}

// The link to share: the site's address, at the shootout.
export function shareLink(url, win = globalThis.window) {
  let base = url
  if (!base) {
    try {
      base = win.location.href
    } catch {
      base = ''
    }
  }
  try {
    const u = new URL(base, win?.location?.href)
    u.hash = 'shootout'
    return u.toString()
  } catch {
    return base || ''
  }
}

export function canShare(nav = globalThis.navigator) {
  return Boolean(nav && typeof nav.share === 'function')
}

// 'shared', 'cancelled', 'copied' or 'failed' (show the link to copy).
export async function shareResult({ title, text, url }, nav = globalThis.navigator) {
  if (canShare(nav)) {
    const data = { title, text, url }
    let allowed = true
    try {
      if (typeof nav.canShare === 'function') allowed = nav.canShare(data)
    } catch {
      allowed = false
    }
    if (allowed) {
      try {
        await nav.share(data)
        return 'shared'
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled'
      }
    }
  }
  return copyLink(url, nav)
}

export async function copyLink(url, nav = globalThis.navigator) {
  try {
    if (!nav?.clipboard?.writeText) return 'failed'
    await nav.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
