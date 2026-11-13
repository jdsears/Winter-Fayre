// The best result on this device, and nothing else: no name, no list,
// nothing sent anywhere. Kept in localStorage when the browser allows it;
// every read and write is wrapped, so the game plays the same without it.

const EMPTY = { played: 0, won: 0, best: null }

function store(win) {
  try {
    return win?.localStorage || null
  } catch {
    return null
  }
}

function clean(raw) {
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  if (!raw || typeof raw !== 'object') return { ...EMPTY }
  const best = raw.best && typeof raw.best === 'object'
    ? { us: n(raw.best.us), them: n(raw.best.them), won: raw.best.won === true, saves: n(raw.best.saves) }
    : null
  return { played: n(raw.played), won: n(raw.won), best }
}

export function loadRecord(key, win = globalThis.window) {
  try {
    const s = store(win)
    const text = s ? s.getItem(key) : null
    return text ? clean(JSON.parse(text)) : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

// Which of two results is better: a win, then the bigger winning (or
// smaller losing) margin, then more goals, then more saves.
export function better(a, b) {
  if (!b) return true
  if (!a) return false
  if (a.won !== b.won) return a.won
  const ma = a.us - a.them
  const mb = b.us - b.them
  if (ma !== mb) return ma > mb
  if (a.us !== b.us) return a.us > b.us
  return (a.saves || 0) > (b.saves || 0)
}

// Adds a finished shootout; returns the record and whether it was a new
// best on this device.
export function saveResult(key, result, win = globalThis.window) {
  const record = loadRecord(key, win)
  const newBest = better(result, record.best)
  const next = {
    played: record.played + 1,
    won: record.won + (result.won ? 1 : 0),
    best: newBest ? { us: result.us, them: result.them, won: result.won, saves: result.saves || 0 } : record.best,
  }
  try {
    store(win)?.setItem(key, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the game goes on without it.
  }
  return { record: next, newBest }
}
