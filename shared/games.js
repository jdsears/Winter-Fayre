// The arcade's games, in the order the arcade lists them. One list, read
// by the server (the pages, the leaderboards, the numbers) and by the
// page's script (the links between games), so a game is added in one
// place.
//
//   key     the game's name in the code, in an address and in a file
//   path    its page
//   href    where a tile leads: the page, or the page with the game open
//   title   what the arcade calls it
//   text    a line about it, on its tile
//   play    the words on its Play button
//   scores  what a leaderboard score counts, for the TV and the panels
//   board   how its leaderboard is kept (server/board.js): the highest
//           score it takes, how fast a score can honestly be made (a
//           score over slack + perSecond for each second since the go's
//           ticket is refused) and whether an entry can grow (runs)

export const GAMES = [
  {
    key: 'penalties',
    path: '/penalties',
    href: '/penalties#play',
    title: 'Penalties',
    text: 'Five penalties each. Take your kicks and make your saves.',
    play: 'Play penalties',
    scores: 'goals and saves',
    board: { maxScore: 40, perSecond: 0.25, slack: 1 },
  },
  {
    key: 'keepy',
    path: '/keepy-uppies',
    href: '/keepy-uppies',
    title: 'Keepy-uppies',
    text: 'Tap the ball to keep it off the snow. How many can you do?',
    play: 'Play keepy-uppies',
    scores: 'keepy-uppies in a row',
    board: { maxScore: 1000, perSecond: 2.5, slack: 2 },
  },
  {
    key: 'freekick',
    path: '/free-kicks',
    href: '/free-kicks',
    title: 'Free kick challenge',
    text: 'Ten free kicks. Bend it round the wall or lift it over, and beat the keeper.',
    play: 'Play free kicks',
    scores: 'goals from ten free kicks',
    board: { maxScore: 10, perSecond: 0.4, slack: 1 },
  },
  {
    key: 'headtohead',
    path: '/head-to-head',
    href: '/head-to-head',
    title: 'Head to head',
    text: 'One against one for sixty seconds. Run, jump, head it and kick it. Most goals wins.',
    play: 'Play head to head',
    scores: 'wins in a row',
    board: { maxScore: 200, perSecond: 1 / 58, slack: 2, runs: true },
  },
]

export const GAME_KEYS = GAMES.map(g => g.key)
export const gameByKey = (key) => GAMES.find(g => g.key === key) || null
export const GAME_NAMES = Object.fromEntries(GAMES.map(g => [g.key, g.title]))

// The other games offered when a go ends: the next one in the list, and
// the arcade.
export function othersFor(key) {
  const i = GAME_KEYS.indexOf(key)
  const next = GAMES[(i + 1) % GAMES.length]
  return [{ href: next.href, label: next.title }, { href: '/', label: 'All games' }]
}
