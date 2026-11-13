// A game's leaderboard in its finish panel: the day's best goes, and a
// place to add this go with three letters.
//
// Nothing is sent unless the visitor presses "Add to leaderboard", and
// then only the three letters, the score and the go's ticket. The three
// letters last used are kept on this device, to fill the box next time.

export const INITIALS_KEY = 'winterfayre:initials'
export const TOP = 10

// Where a game's leaderboard is asked for (server/app.js).
export const boardPath = (game) => `/api/board/${game}`

// Three capital letters from whatever was typed.
export function tidyInitials(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
}

// Whether a score would make the board as it stands.
export function wouldMake(entries, score, size = 50) {
  if (!Number.isInteger(score) || score < 1) return false
  return entries.length < size || score > entries[entries.length - 1].score
}

export function ordinal(n) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

export const SAID = {
  initials: 'Those three letters cannot be used. Try three others.',
  ticket: 'That go could not be added. Your next one can be.',
  score: 'That go could not be added. Your next one can be.',
  low: 'That go did not make the top 50 today.',
  busy: 'The leaderboard is busy. Try again in a moment.',
  unavailable: 'The leaderboard cannot be reached. Try again in a moment.',
}

export async function fetchBoard(win = window, path = boardPath('keepy')) {
  const res = await win.fetch(path, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error('no board')
  return res.json()
}

export async function sendGo({ initials, score, ticket }, win = window, path = boardPath('keepy')) {
  const res = await win.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ initials, score, ticket }),
  })
  let body = null
  try { body = await res.json() } catch { /* no answer to read */ }
  return body && typeof body === 'object' ? body : { ok: false, reason: 'unavailable' }
}

const el = (doc, tag, cls, text) => {
  const node = doc.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

// Draws the board into its place in the finish panel. mine is the place
// of the go just added, if it was.
export function drawBoard(doc, into, board, { mine = 0, all = false, onMore = () => {}, title = null } = {}) {
  const old = into.querySelector('.gs-lbw')
  const wrap = el(doc, 'div', 'gs-lbw')
  wrap.append(el(doc, 'p', 'gs-lbh', title || "Today's leaderboard"))
  if (!board.entries.length) {
    wrap.append(el(doc, 'p', 'gs-lbn', 'No one is on it yet. Be the first.'))
  } else {
    const list = el(doc, 'ol', 'gs-lb')
    const rows = all ? board.entries : board.entries.slice(0, TOP)
    rows.forEach((e, i) => {
      const li = el(doc, 'li', i + 1 === mine ? 'me' : '')
      li.append(el(doc, 'span', 'n', String(i + 1)), el(doc, 'span', 'i', e.initials), el(doc, 'span', 's', String(e.score)))
      list.append(li)
    })
    wrap.append(list)
    if (!all && board.entries.length > TOP) {
      const more = el(doc, 'button', 'gs-lbm', `Show the top ${board.entries.length}`)
      more.type = 'button'
      more.addEventListener('click', onMore)
      wrap.append(more)
    }
  }
  if (old) old.replaceWith(wrap)
  else into.append(wrap)
}

// The box for three letters and its button. onAdd is handed the letters.
export function drawForm(doc, into, { initials = 'AAA', onAdd }) {
  const form = el(doc, 'form', 'gs-lbf')
  const label = el(doc, 'label', '', 'Your initials ')
  const input = el(doc, 'input')
  input.type = 'text'
  input.name = 'initials'
  input.maxLength = 3
  input.value = tidyInitials(initials) || 'AAA'
  input.autocomplete = 'off'
  input.setAttribute('autocapitalize', 'characters')
  input.setAttribute('autocorrect', 'off')
  input.spellcheck = false
  input.setAttribute('inputmode', 'text')
  input.setAttribute('aria-describedby', 'gs-lbs')
  label.append(input)
  const button = el(doc, 'button', 'btn y', 'Add to leaderboard')
  button.type = 'submit'
  const said = el(doc, 'p', 'gs-lbs')
  said.id = 'gs-lbs'
  said.setAttribute('role', 'status')
  input.addEventListener('input', () => { input.value = tidyInitials(input.value) })
  input.addEventListener('focus', () => input.select())
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const v = tidyInitials(input.value)
    if (v.length !== 3) { said.textContent = 'Type three letters.'; return }
    onAdd(v, { button, said, form })
  })
  form.append(label, button, said)
  into.prepend(form)
  return { form, said, button }
}

// A game's goes and its leaderboard, kept in step.
//
// Each go has a ticket of its own, handed out before the go began, so
// the site can tell a made-up score from a played one: the page's ticket
// for the first go, and one from each answer for the next. When a go
// ends, show() draws the day's board into the finish panel and, if the
// score would make it, the box for three letters. When the next go
// starts, next() moves on to the next ticket.
//
//   game    the game's key (shared/games.js)
//   root    the game's place on its page, which carries the first ticket
//   say     says a line to a screen reader
export function createGoBoard({ game, root, win = globalThis.window, say = () => {} }) {
  const doc = win.document
  const path = boardPath(game)
  const store = (() => { try { return win.localStorage } catch { return null } })()
  let ticket = root?.getAttribute?.('data-ticket') || null
  let nextTicket = null
  let spent = false
  let goes = 0
  const on = Boolean(ticket)

  const take = (t) => { if (typeof t === 'string') nextTicket = t }

  return {
    on,

    // A game with a live region of its own hands it over here.
    set say(fn) { if (typeof fn === 'function') say = fn },

    // The next go has begun.
    next() {
      goes += 1
      if (nextTicket) { ticket = nextTicket; nextTicket = null; spent = false }
    },

    // A go has ended with this score: the board, and the box if it makes it.
    show(into, score) {
      if (!on) return
      const go = goes
      let shown = null
      let mine = 0
      let all = false
      const redraw = () => { if (shown && go === goes) drawBoard(doc, into, shown, { mine, all, onMore: () => { all = true; redraw() } }) }
      fetchBoard(win, path).then((b) => {
        take(b.ticket)
        if (go !== goes) return
        shown = b
        redraw()
        if (spent || !wouldMake(b.entries, score)) return
        const last = (() => { try { return store?.getItem(INITIALS_KEY) } catch { return null } })()
        const used = ticket
        drawForm(doc, into, {
          initials: tidyInitials(last) || 'AAA',
          onAdd(initials, { button, said, form }) {
            button.disabled = true
            said.textContent = 'Adding your go.'
            spent = true
            sendGo({ initials, score, ticket: used }, win, path).then((out) => {
              take(out.ticket)
              if (go !== goes) return
              if (out.ok) {
                try { store?.setItem(INITIALS_KEY, initials) } catch { /* not kept: the box starts at AAA */ }
                shown = out
                mine = out.rank
                all = all || out.rank > TOP
                form.remove()
                redraw()
                say(`You are ${ordinal(out.rank)} on today's leaderboard.`)
              } else {
                said.textContent = SAID[out.reason] || SAID.unavailable
                // Other letters can be tried; a refused go cannot be sent again.
                button.disabled = out.reason !== 'initials' && out.reason !== 'busy' && out.reason !== 'unavailable'
                if (out.reason === 'initials' || out.reason === 'busy') spent = false
              }
            }, () => { said.textContent = SAID.unavailable; button.disabled = false; spent = false })
          },
        })
      }, () => {})
    },
  }
}
