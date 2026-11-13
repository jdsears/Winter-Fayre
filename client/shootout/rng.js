// A small seeded random number generator (mulberry32), so a shootout can
// be replayed exactly in a test and the demo page can take ?seed=.
// Pure: no global state.

export function makeRng(seed = Date.now()) {
  let s = (Number(seed) >>> 0) || 0x9e3779b9
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let r = Math.imul(s ^ (s >>> 15), 1 | s)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const rng = () => next()
  // Between a and b.
  rng.range = (a, b) => a + (b - a) * next()
  // A normal draw (Box and Muller), mean 0, the spread given.
  rng.normal = (spread = 1) => {
    const u = Math.max(next(), 1e-9)
    const v = next()
    return spread * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  // True with probability p.
  rng.chance = (p) => next() < p
  // One of the keys of a { key: weight } object.
  rng.pick = (weights) => {
    const entries = Object.entries(weights)
    const total = entries.reduce((sum, [, w]) => sum + w, 0)
    let at = next() * total
    for (const [key, w] of entries) {
      at -= w
      if (at <= 0) return key
    }
    return entries[entries.length - 1][0]
  }
  return rng
}
