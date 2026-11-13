// The 3D story of the appeal, on the arcade page (index.js runs it and
// scene.js draws it): where each thing stands, where the camera is for
// each part of the story, and how far through the story a scroll is.
//
// The story is the one the page already tells in words (shared/appeal.js
// and server/render/appeal.js). The picture opens the page, above its
// heading. As a visitor scrolls on through the appeal's words the camera
// flies over a snowy field at night, from a wide view down to each thing
// in turn: what the PSA has funded, then what it is raising for now,
// which stand in a ring of gold with sparks rising round them. At "Your
// part" the two are seen side by side and the sparks are at their
// liveliest, and at the button on to the games the camera lifts to take
// in the whole field.
//
// Nothing here draws: these are the numbers, so they can be tested.

// The stops, in the order the page's words come: each is an element of
// the page marked data-stop with one of these names. The first is the
// page's own heading and the last is the button on to the games.
export const STOPS = ['hello', 'why', 'tables', 'water', 'posts', 'goals', 'covers', 'give', 'games']

// Where each thing stands on the field, in metres: a row from left to
// right, the camera on the near side looking across it.
export const GAP = 12
export const PLACES = {
  tables: { x: -2 * GAP, z: 0 },
  water: { x: -GAP, z: 0 },
  posts: { x: 0, z: 0 },
  goals: { x: GAP, z: 0 },
  covers: { x: 2 * GAP, z: 0 },
}
// The things still being raised for: each stands in a ring of gold.
export const RAISING = ['goals', 'covers']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (k) => k * k * (3 - 2 * k)
const mix3 = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) })

// The camera close to a thing: how far it stands off, what it looks at
// (both measured from the thing) and how wide its lens is.
const NEAR = {
  tables: { off: { x: 4.6, y: 3.3, z: 8.6 }, look: { x: 0, y: 0.9, z: 0 }, fov: 40 },
  water: { off: { x: -4.2, y: 3.1, z: 9.6 }, look: { x: 0, y: 0.7, z: 0 }, fov: 42 },
  posts: { off: { x: 2.4, y: 1.7, z: 8.4 }, look: { x: 0, y: 1.9, z: 0 }, fov: 46 },
  goals: { off: { x: -4.4, y: 2.5, z: 10.8 }, look: { x: 0, y: 1.2, z: 0 }, fov: 42 },
  covers: { off: { x: 5.2, y: 3.5, z: 10.6 }, look: { x: 0, y: 0.9, z: 0 }, fov: 42 },
}

// The camera at a stop: { pos, look, fov }. aspect is the stage's width
// over its height: on a narrow stage the camera stands further back, so
// what it is looking at is still whole.
export function viewOf(stop, aspect = 1.25) {
  const back = aspect < 1.2 ? 1 + (1.2 - Math.max(0.5, aspect)) * 0.9 : 1
  if (stop === 'hello') {
    // The page opens low down beside the tables, looking along the row:
    // the tables close by, and the rest going away to the covers.
    const off = 1 + (back - 1) * 0.5
    return { pos: { x: -24 - 9.4 * off, y: 2.9, z: 8.4 * off }, look: { x: -4, y: 2.1, z: -2.5 }, fov: 50 }
  }
  if (stop === 'games') {
    // And closes on the whole field, from above and in front.
    const half = Math.tan((46 * Math.PI) / 360) * Math.max(0.5, aspect)
    const away = clamp(27 / half, 34, 86)
    return { pos: { x: 0, y: away * 0.42, z: away }, look: { x: 0, y: 0, z: -3 }, fov: 46 }
  }
  if (stop === 'why') {
    // The whole row from one end and a little above: the nearest things
    // large, the furthest small.
    return { pos: { x: -38 * back, y: 11 * back, z: 24 * back }, look: { x: -2, y: 0.5, z: -1 }, fov: 50 }
  }
  if (stop === 'give') {
    // The two things being raised for, side by side, as they become real.
    const mid = (PLACES.goals.x + PLACES.covers.x) / 2
    const half = Math.tan((44 * Math.PI) / 360) * Math.max(0.5, aspect)
    const away = clamp(11.5 / half, 20, 46)
    return { pos: { x: mid, y: 2.2 + away * 0.22, z: away }, look: { x: mid, y: 1.1, z: 0 }, fov: 44 }
  }
  const at = PLACES[stop]
  const near = NEAR[stop]
  return {
    pos: { x: at.x + near.off.x * back, y: near.off.y * (0.6 + 0.4 * back), z: at.z + near.off.z * back },
    look: { x: at.x + near.look.x, y: near.look.y, z: at.z + near.look.z },
    fov: near.fov,
  }
}

// The camera for a place in the story: t runs from 0 at the first stop
// to the last stop's number at the last. Between two stops the camera eases
// out of one and into the next, so it rests at each, and it lifts a
// little on the way, as a camera on a crane would.
export function viewAt(t, aspect = 1.25) {
  const last = STOPS.length - 1
  const at = clamp(Number.isFinite(t) ? t : 0, 0, last)
  const i = Math.min(last - 1, Math.floor(at))
  const k = smooth(at - i)
  const a = viewOf(STOPS[i], aspect)
  const b = viewOf(STOPS[i + 1], aspect)
  const pos = mix3(a.pos, b.pos, k)
  // The lift: most between two things close by, none where the camera is
  // already climbing to a wide view or coming down from one.
  const level = Math.abs(a.pos.y - b.pos.y) < 4
  if (level) pos.y += Math.sin(k * Math.PI) * 1.1
  return { pos, look: mix3(a.look, b.look, k), fov: lerp(a.fov, b.fov, k) }
}

// How far through the story a scroll is. focus is where on the screen
// the words are being read (pixels from the top); centres are the
// middles of the stops' elements on the screen, top to bottom. The
// answer runs from 0 (the first stop, or above it) to the last stop's
// number (one less than there are stops).
export function progressAt(focus, centres) {
  const n = centres.length
  if (!n) return 0
  if (!(focus > centres[0])) return 0
  for (let i = 0; i < n - 1; i++) {
    const a = centres[i]
    const b = centres[i + 1]
    if (focus <= b) return b > a ? i + (focus - a) / (b - a) : i + 1
  }
  return n - 1
}

// How lively the gold round the things being raised for is: quiet (0)
// until the story comes to "Your part", rising to it (to 1), and lively
// from there to the end.
export function cheerAt(t) {
  const from = STOPS.indexOf('give') - 1
  return smooth(clamp((t - from - 0.2) / 0.6, 0, 1))
}

// What the stage says as the story reaches the games menu: the menu's
// own heading.
export const THE_GAMES = 'The games'

// Which stop the story is at, for the words on the stage.
export const stopAt = (t) => STOPS[clamp(Math.round(Number.isFinite(t) ? t : 0), 0, STOPS.length - 1)]

// The words on the stage for a stop, from the appeal's own words
// (shared/appeal.js): { label, amount, name }. label and amount may be
// empty.
export function captionFor(stop, appeal) {
  // The heading under the picture says all there is to say at the start.
  if (stop === 'hello') return { label: '', amount: '', name: '' }
  if (stop === 'games') return { label: '', amount: '', name: THE_GAMES }
  if (stop === 'why') return { label: '', amount: '', name: appeal.why.title }
  if (stop === 'give') return { label: '', amount: '', name: appeal.give.title }
  for (const part of [appeal.funded, appeal.raising]) {
    const item = part.items.find(i => i.key === stop)
    if (item) return { label: part.title, amount: item.amount || '', name: item.what }
  }
  return { label: '', amount: '', name: '' }
}
