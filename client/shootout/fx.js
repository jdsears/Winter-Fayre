// The 2D layer over the pitch: the trail a swipe leaves, and confetti in
// the fayre's colours (gold, white, ice blue and Christmas red and
// green) when the visitor wins. Neither is drawn with reduced motion's
// confetti switch off; the trail is a fading line, not motion.

export function createFx(canvas, { accent = '#ffd400', primary = '#1d4fb8', win = globalThis.window } = {}) {
  const ctx = canvas.getContext ? canvas.getContext('2d') : null
  let w = 0
  let hgt = 0
  let ratio = 1
  let trail = []
  let pieces = []
  const colours = [accent, '#ffffff', '#8fd6e8', '#e0263c', '#2fbf6b', accent]
  void primary

  function resize(width, height, dpr) {
    w = width
    hgt = height
    ratio = Math.min(2, dpr || 1)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  function addTrail(x, y, t) {
    trail.push({ x, y, t })
    if (trail.length > 48) trail.shift()
  }

  function clearTrail() {
    trail = []
  }

  function confetti(count = 140) {
    pieces = []
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * w,
        y: -20 - Math.random() * hgt * 0.6,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 140,
        spin: Math.random() * 6,
        vs: (Math.random() - 0.5) * 10,
        size: 6 + Math.random() * 7,
        colour: colours[i % colours.length],
        life: 3.4 + Math.random() * 1.2,
      })
    }
  }

  function draw(dt, now) {
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, w, hgt)
    if (trail.length > 1) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]
        const b = trail[i]
        const age = (now - b.t) / 420
        if (age > 1) continue
        ctx.strokeStyle = accent
        ctx.globalAlpha = Math.max(0, 0.85 * (1 - age))
        ctx.lineWidth = 3 + 9 * (i / trail.length) * (1 - age)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      if (now - trail[trail.length - 1].t > 460) trail = []
    }
    if (pieces.length) {
      for (const p of pieces) {
        p.life -= dt
        p.vy += 30 * dt
        p.x += (p.vx + Math.sin(p.spin) * 30) * dt
        p.y += p.vy * dt
        p.spin += p.vs * dt
        if (p.life <= 0 || p.y > hgt + 30) continue
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.globalAlpha = Math.min(1, p.life)
        ctx.fillStyle = p.colour
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      pieces = pieces.filter((p) => p.life > 0 && p.y <= hgt + 30)
    }
  }

  return {
    resize, addTrail, clearTrail, confetti, draw,
    get busy() { return trail.length > 0 || pieces.length > 0 },
    stopConfetti() { pieces = [] },
    dispose() { trail = []; pieces = []; void win },
  }
}
