// The browser rules every response carries.
//
// A page loads only what comes from this site: its own script (and the
// stadium and games it loads), its own stylesheet and fonts, and its own
// drawings. The one inline style block carries a fresh nonce on every
// response, and nothing inline can run as script. No analytics, no
// advertising, no frames, no workers, nothing posted anywhere, and no
// other site may frame a page. A form may be sent only where a page
// says so (the numbers page, to take an entry off a leaderboard), and
// then only to this site.

import crypto from 'node:crypto'

export function newNonce() {
  return crypto.randomBytes(16).toString('base64')
}

export function cspFor({ nonce = null, forms = false, production = false } = {}) {
  const d = {
    'default-src': ["'self'"],
    'base-uri': ["'none'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'none'"],
    'form-action': [forms ? "'self'" : "'none'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': nonce ? ["'self'", `'nonce-${nonce}'`] : ["'self'"],
    'style-src-attr': ["'none'"],
    'img-src': ["'self'"],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'manifest-src': ["'self'"],
  }
  if (production) d['upgrade-insecure-requests'] = []
  return Object.entries(d).map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k)).join('; ')
}

// The rules for anything that is not a page (a script, a font, the
// health check): nothing may run or be framed.
export const RESOURCE_CSP = "default-src 'none'; frame-ancestors 'none'; sandbox"

export function securityHeaders({ production = false } = {}) {
  return (req, res, next) => {
    res.removeHeader('X-Powered-By')
    res.set('Content-Security-Policy', RESOURCE_CSP)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.set('X-Frame-Options', 'DENY')
    res.set('Cross-Origin-Opener-Policy', 'same-origin')
    res.set('Cross-Origin-Resource-Policy', 'same-origin')
    res.set('Origin-Agent-Cluster', '?1')
    res.set('X-DNS-Prefetch-Control', 'off')
    res.set('X-Permitted-Cross-Domain-Policies', 'none')
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()')
    // Every page is kept out of search engines: this is a site for one
    // day at a school fayre.
    res.set('X-Robots-Tag', 'noindex, nofollow')
    // The site's own address, over HTTPS for six months. Not its
    // subdomains, which this service does not answer for.
    if (production) res.set('Strict-Transport-Security', 'max-age=15552000')
    next()
  }
}
