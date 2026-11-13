// Head to head's players: eight to pick from, girls and boys, with
// different hair and skin. The visitor picks one and the computer is
// given one of the rest at random for each match.
//
// They are drawn shapes, not likenesses of anyone, and have no names: a
// player is known by a short description of their hair, for a screen
// reader. The pick is kept on the visitor's own device and nowhere else.

export const CHARACTERS = [
  { id: 'short', label: 'short dark hair', skin: '#d9a07a', hair: '#2a1d16', style: 'short' },
  { id: 'ponytail', label: 'a dark ponytail', skin: '#f1c7a5', hair: '#2a1d16', style: 'ponytail' },
  { id: 'curls', label: 'black curls', skin: '#7a4b32', hair: '#121212', style: 'curls' },
  { id: 'bob', label: 'a red bob', skin: '#f6d2b8', hair: '#b4532a', style: 'bob' },
  { id: 'braids', label: 'long braids', skin: '#5b3a26', hair: '#141210', style: 'braids' },
  { id: 'fringe', label: 'fair hair with a fringe', skin: '#f1c7a5', hair: '#d8b25e', style: 'fringe' },
  { id: 'bun', label: 'brown hair in a bun', skin: '#a8714f', hair: '#3b2416', style: 'bun' },
  { id: 'buzz', label: 'a close crop', skin: '#e8b48f', hair: '#5a3a22', style: 'buzz' },
]

export const characterById = (id) => CHARACTERS.find(c => c.id === id) || CHARACTERS[0]

// The computer's player: any but the visitor's.
export function pickOpponent(mine, rng = Math.random) {
  const rest = CHARACTERS.filter(c => c.id !== mine)
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))]
}

export const CHARACTER_KEY = 'winterfayre:headtohead:player'
// The visitor's pick, or null when they have not picked on this device.
export function readCharacter(store) {
  try {
    const id = store?.getItem(CHARACTER_KEY)
    return CHARACTERS.some(c => c.id === id) ? id : null
  } catch {
    return null
  }
}
export function keepCharacter(store, id) {
  const pick = characterById(id).id
  try { store?.setItem(CHARACTER_KEY, pick) } catch { /* a browser that keeps nothing still plays */ }
  return pick
}

// Draws a head of radius r with its middle at (x, y), facing f (1 to the
// right, -1 to the left). look moves the eye up or down a little, towards
// the ball. The hair that hangs behind the head is drawn first, then the
// head, then the hair on top of it.
export function drawHead(ctx, c, x, y, r, f, { look = 0, ink = '#0c1626' } = {}) {
  const back = -f
  ctx.save()
  ctx.translate(x, y)
  const k = r / 27
  ctx.scale(k, k)
  const R = 27

  // Behind the head.
  ctx.fillStyle = c.hair
  if (c.style === 'ponytail') {
    ctx.beginPath(); ctx.ellipse(back * 31, 4, 8, 19, back * 0.35, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(back * 25, -12, 6, 0, Math.PI * 2); ctx.fill()
  } else if (c.style === 'braids') {
    for (const [dx, len] of [[20, 6], [27, 5]]) {
      for (let i = 0; i < len; i++) { ctx.beginPath(); ctx.arc(back * dx, -6 + i * 9, 5 - i * 0.3, 0, Math.PI * 2); ctx.fill() }
    }
  } else if (c.style === 'bob') {
    ctx.beginPath(); ctx.roundRect(back > 0 ? 6 : -30, -20, 24, 44, 11); ctx.fill()
  } else if (c.style === 'bun') {
    ctx.beginPath(); ctx.arc(back * 12, -30, 11, 0, Math.PI * 2); ctx.fill()
  } else if (c.style === 'curls') {
    for (let i = 0; i < 9; i++) { const a = Math.PI * (1.02 + i * 0.12); ctx.beginPath(); ctx.arc(Math.cos(a) * (R + 3), Math.sin(a) * (R + 3), 8, 0, Math.PI * 2); ctx.fill() }
  }

  // The head and an ear.
  ctx.fillStyle = c.skin
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(back * (R - 3), 3, 5, 0, Math.PI * 2); ctx.fill()

  // The hair on top.
  ctx.fillStyle = c.hair
  if (c.style === 'buzz') {
    ctx.globalAlpha = 0.85
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.08, Math.PI * 1.92); ctx.quadraticCurveTo(0, -R * 0.62, -R * 0.95, -R * 0.26); ctx.fill()
    ctx.globalAlpha = 1
  } else if (c.style === 'fringe') {
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 0.98, Math.PI * 2.02)
    ctx.quadraticCurveTo(f * 14, -2, f * 4, -8); ctx.quadraticCurveTo(back * 10, -14, back * R, 2); ctx.fill()
  } else if (c.style === 'bob') {
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 0.98, Math.PI * 2.02)
    ctx.quadraticCurveTo(f * 16, -6, 0, -12); ctx.quadraticCurveTo(back * 14, -12, back * R, 4); ctx.fill()
  } else {
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0, -R * 0.35, -R * 0.98, -2); ctx.fill()
    if (c.style === 'curls') for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-18 + i * 7.2, -17 - Math.sin((i / 5) * Math.PI) * 4, 6, 0, Math.PI * 2); ctx.fill() }
  }

  // An eye and a mouth.
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.ellipse(f * 11, 1, 6.5, 7.5, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = ink
  ctx.beginPath(); ctx.arc(f * 13.5, 1 + Math.max(-3, Math.min(3, look)), 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = ink
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(f * 10, 12, 6, f > 0 ? 0.15 : Math.PI - 1.25, f > 0 ? 1.25 : Math.PI - 0.15); ctx.stroke()
  ctx.restore()
}
