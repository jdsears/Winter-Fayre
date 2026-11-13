// A small stand-in for the browser, for the shootout's tests: enough of
// the document for the overlay (elements, attributes, focus, events), a
// clock the test moves on by hand (performance.now, requestAnimationFrame
// and setTimeout), a 2D canvas that draws nothing, and no WebGL, so the
// game runs its 2D version. Nothing here is the game's.

class FakeEvent {
  constructor(type, init = {}) {
    Object.assign(this, init)
    this.type = type
    this.defaultPrevented = false
    this.propagationStopped = false
  }
  preventDefault() { this.defaultPrevented = true }
  stopPropagation() { this.propagationStopped = true }
}

function context2d() {
  const gradient = { addColorStop() {} }
  const target = {
    measureText: (t) => ({ width: String(t).length * 10 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: [] }),
  }
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop]
      return () => {}
    },
    set(t, prop, value) {
      t[prop] = value
      return true
    },
  })
}

class FakeNode {
  constructor(doc) {
    this.ownerDocument = doc
    this.parentNode = null
    this.childNodes = []
    this.listeners = new Map()
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1) }
  get isConnected() {
    let n = this
    while (n.parentNode) n = n.parentNode
    return n === this.ownerDocument
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }
  insertBefore(child, ref) {
    if (!ref) return this.appendChild(child)
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, child)
    return child
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child)
    if (i >= 0) this.childNodes.splice(i, 1)
    child.parentNode = null
    return child
  }
  remove() { this.parentNode?.removeChild(this) }
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true
    return false
  }
  get textContent() { return this.childNodes.map((c) => c.textContent).join('') }
  set textContent(v) {
    for (const c of this.childNodes) c.parentNode = null
    this.childNodes = []
    if (v !== '' && v !== null && v !== undefined) this.appendChild(new FakeText(this.ownerDocument, String(v)))
  }
  addEventListener(type, fn, opts) {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture)
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push({ fn, capture })
  }
  removeEventListener(type, fn, opts) {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture)
    const list = this.listeners.get(type) || []
    const i = list.findIndex((l) => l.fn === fn && l.capture === capture)
    if (i >= 0) list.splice(i, 1)
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length }
  // Capture from the document down, then bubble back up.
  dispatchEvent(event) {
    if (!event.target) event.target = this
    const path = []
    for (let n = this; n; n = n.parentNode) path.unshift(n)
    for (const n of path) {
      for (const l of [...(n.listeners.get(event.type) || [])]) if (l.capture) l.fn.call(n, event)
    }
    for (const n of path.reverse()) {
      if (event.propagationStopped) break
      for (const l of [...(n.listeners.get(event.type) || [])]) if (!l.capture) l.fn.call(n, event)
    }
    return !event.defaultPrevented
  }
}

class FakeText extends FakeNode {
  constructor(doc, text) {
    super(doc)
    this.nodeType = 3
    this.data = text
  }
  get textContent() { return this.data }
  set textContent(v) { this.data = String(v) }
}

class FakeStyle {
  constructor() { this.props = {} }
  setProperty(name, value) { this.props[name] = value }
  getPropertyValue(name) { return this.props[name] ?? '' }
}

class FakeClassList {
  constructor(el) { this.el = el }
  get list() { return (this.el.className || '').split(/\s+/).filter(Boolean) }
  add(...names) { this.el.className = [...new Set([...this.list, ...names])].join(' ') }
  remove(...names) { this.el.className = this.list.filter((n) => !names.includes(n)).join(' ') }
  contains(name) { return this.list.includes(name) }
  toggle(name, on) { if (on ?? !this.contains(name)) this.add(name); else this.remove(name) }
}

class FakeElement extends FakeNode {
  constructor(doc, tag) {
    super(doc)
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.attributes = new Map()
    this.style = new FakeStyle()
    this.className = ''
    this.classList = new FakeClassList(this)
    this.value = ''
    this.disabled = false
    this.width = 300
    this.height = 150
    this.offsetWidth = 100
  }
  get id() { return this.getAttribute('id') || '' }
  set id(v) { this.setAttribute('id', v) }
  get hidden() { return this.hasAttribute('hidden') }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden') }
  get dataset() {
    const el = this
    return new Proxy({}, {
      get: (_, k) => el.getAttribute(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`) ?? undefined,
      set: (_, k, v) => { el.setAttribute(`data-${String(k).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v); return true },
    })
  }
  setAttribute(name, value) {
    if (name === 'class') this.className = String(value)
    else this.attributes.set(name, String(value))
  }
  getAttribute(name) {
    if (name === 'class') return this.className
    return this.attributes.has(name) ? this.attributes.get(name) : null
  }
  hasAttribute(name) { return name === 'class' ? Boolean(this.className) : this.attributes.has(name) }
  removeAttribute(name) { if (name === 'class') this.className = ''; else this.attributes.delete(name) }
  focus() {
    if (this.disabled) return
    this.ownerDocument.activeElement = this
  }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body }
  select() {}
  click() { this.dispatchEvent(new FakeEvent('click', { bubbles: true })) }
  closest(selector) {
    const cls = selector.startsWith('.') ? selector.slice(1) : null
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) {
      if (cls && n.classList.contains(cls)) return n
      if (!cls && n.tagName === selector.toUpperCase()) return n
    }
    return null
  }
  matches(selector) { return this.closest(selector) === this }
  // Enough of querySelector for the tests and index.js: [attr], .class, tag.
  querySelectorAll(selector) {
    const out = []
    const test = selector.startsWith('[')
      ? (n) => n.hasAttribute(selector.slice(1, -1))
      : selector.startsWith('.')
        ? (n) => n.classList.contains(selector.slice(1))
        : (n) => n.tagName === selector.toUpperCase()
    const walk = (n) => {
      for (const c of n.children) {
        if (test(c)) out.push(c)
        walk(c)
      }
    }
    walk(this)
    return out
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  getBoundingClientRect() {
    const v = this.ownerDocument.viewport
    return { left: 0, top: 0, right: v.width, bottom: v.height, width: v.width, height: v.height, x: 0, y: 0 }
  }
  getContext(kind) {
    if (kind === '2d') return (this._ctx ||= context2d())
    return null
  }
  setPointerCapture() {}
  releasePointerCapture() {}
}

export function createFakeBrowser({ width = 390, height = 844, reducedMotion = false, coarse = true, storage = true, share = false } = {}) {
  const doc = new FakeNode(null)
  doc.ownerDocument = doc
  doc.nodeType = 9
  doc.viewport = { width, height }
  doc.visibilityState = 'visible'
  doc.createElement = (tag) => new FakeElement(doc, tag)
  doc.createTextNode = (text) => new FakeText(doc, text)
  doc.documentElement = doc.appendChild(new FakeElement(doc, 'html'))
  doc.head = doc.documentElement.appendChild(new FakeElement(doc, 'head'))
  doc.body = doc.documentElement.appendChild(new FakeElement(doc, 'body'))
  doc.activeElement = doc.body
  doc.getElementById = (id) => {
    let found = null
    const walk = (n) => {
      for (const c of n.children) {
        if (!found && c.getAttribute('id') === id) found = c
        walk(c)
      }
    }
    walk(doc)
    return found
  }
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel)
  doc.querySelector = (sel) => doc.documentElement.querySelector(sel)

  let now = 1000
  let frames = []
  let timers = []
  let timerId = 0
  const store = new Map()
  const win = {
    document: doc,
    devicePixelRatio: 3,
    performance: { now: () => now },
    requestAnimationFrame: (fn) => {
      frames.push(fn)
      return frames.length
    },
    cancelAnimationFrame: () => { frames = [] },
    setTimeout: (fn, ms = 0) => {
      timerId += 1
      timers.push({ id: timerId, at: now + ms, fn })
      return timerId
    },
    clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id) },
    matchMedia: (q) => ({ matches: q.includes('reduced-motion') ? reducedMotion : q.includes('coarse') ? coarse : false }),
    navigator: share ? { share: async () => {}, clipboard: null } : { clipboard: { writeText: async () => {} } },
    CustomEvent: class extends FakeEvent { constructor(type, init = {}) { super(type, init); this.detail = init.detail } },
    events: [],
    listeners: new Map(),
    dispatchEvent(e) {
      this.events.push(e)
      for (const fn of [...(this.listeners.get(e.type) || [])]) fn(e)
      return true
    },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) },
    listenerCount(type) { return this.listeners.get(type)?.size || 0 },
    localStorage: storage
      ? { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
      : undefined,
  }
  doc.defaultView = win
  if (!storage) {
    Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked') } })
  }

  // Moves the clock on, running each frame and timer that falls due.
  function advance(ms, step = 16) {
    const end = now + ms
    while (now < end) {
      now = Math.min(end, now + step)
      const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)
      timers = timers.filter((t) => t.at > now)
      for (const t of due) t.fn()
      const run = frames
      frames = []
      for (const fn of run) fn(now)
    }
  }

  const key = (type, k, extra = {}) => {
    const target = doc.activeElement || doc.body
    const e = new FakeEvent(type, { key: k, bubbles: true, repeat: false, ...extra })
    e.target = target
    target.dispatchEvent(e)
    return e
  }

  return { doc, win, advance, key, Event: FakeEvent, store, get now() { return now } }
}
