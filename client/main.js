// The one script on the site's pages.
//
// Every page is drawn whole on the server (server/render) and reads the
// same without this. What it adds is the games: on a game's page it
// opens that game, fetched only on the page that has it.
//
//   penalties      the section's Play button (./shootout), and a link
//                  ending #play opening the game straight away
//   keepy-uppies   played in the stadium, full screen (./keepy/play3d.js);
//                  where the 3D will not run, the flat version on the
//                  page is played in its place (./keepy/index.js)
//   free kicks     the same (./freekick)
//   head to head   drawn flat, full screen, with the phone held sideways
//                  (./headtohead)
//
//   rugby, netball and cricket
//                  played on the same stage (./rugby, ./netball,
//                  ./cricket); where the 3D will not run the stage draws
//                  the stadium flat, so there is no second version on
//                  the page
//
// on the arcade page, the appeal's story in 3D as it is scrolled through
// (./story), and on the stall's TV screen, the leaderboards taking turns
// and refreshing themselves (./tv.js) and the appeal's story in 3D in
// the appeal's turn (./story/screen.js).
//
// No analytics, advertising or tracking of any kind. Built by Vite
// (vite.config.js) into dist/assets.

import { enhanceShootout } from './shootout/index.js'
import { tally } from './games/count.js'
import { createGoBoard, fetchBoard, boardPath } from './games/board.js'
import { readSweet, drawSweet } from './games/prize.js'
import { readClaims, footballFor } from './games/football.js'
import { FOOTBALL } from '../shared/prizes.js'

document.documentElement.classList.add('js')

// The penalty shootout says when it is ready, when it is played again
// and when it is over, for the site's own count of games started and
// finished. Its results carry the day's leaderboard.
function setupPenalties() {
  const section = document.querySelector('[data-shootout]')
  if (!section) return
  const board = createGoBoard({ game: 'penalties', root: section, win: window })
  enhanceShootout({
    options: {
      board,
      prize: 'penalties',
      onEvent: (type) => {
        if (type === 'ready' || type === 'again') tally('penalties', 'play')
        else if (type === 'results') tally('penalties', 'done')
      },
    },
  })
}

// On the arcade page, above the games menu, what this phone has won:
// a sweet still to be collected, and the football if it leads for it or
// has won it. Read from the phone's own storage; only the football asks
// the site anything, and only for the leaderboard everyone sees.
function setupMine() {
  const sweetAt = document.querySelector('[data-mine]')
  const footballAt = document.querySelector('[data-mine-football]')
  if (!sweetAt && !footballAt) return
  const store = (() => { try { return window.localStorage } catch { return null } })()
  if (sweetAt) {
    const sweet = readSweet(store)
    if (sweet && !sweet.given) drawSweet(document, sweetAt, sweet, { store })
  }
  if (footballAt) {
    fetchBoard(window, boardPath(FOOTBALL.game)).then((b) => {
      const mine = footballFor(b.football, readClaims(store, b.day))
      if (!mine || !mine.mine) return
      footballAt.textContent = mine.words
      footballAt.className = mine.won ? 'gs-fb mine-fb won' : 'gs-fb mine-fb mine'
      footballAt.hidden = false
    }, () => {})
  }
}

// Each game is fetched only on the page that has it.
function setupGames() {
  // Keepy-uppies is played in the stadium, full screen; where the 3D
  // will not run, the flat version on the page is played in its place.
  const keepy = document.querySelector('[data-keepy]')
  if (keepy) {
    const flat = () => import('./keepy/index.js').then(m => m.startKeepy(keepy), () => {})
    import('./keepy/play3d.js').then(m => m.playKeepy3D(keepy)).then((stage) => { if (!stage) flat() }, flat)
  }
  // Head to head is drawn flat, so it needs no 3D; where it cannot be
  // drawn at all the page says so.
  const heads = document.querySelector('[data-headtohead]')
  if (heads) {
    const said = heads.querySelector('[data-hh-said]')
    const failed = () => { if (said) said.textContent = 'The game could not load. Check your connection and try again.' }
    import('./headtohead/play.js').then((m) => { if (!m.playHeadToHead(heads)) failed() }, failed)
  }
  const kicks = document.querySelector('[data-freekick]')
  if (kicks) {
    const flat = () => import('./freekick/index.js').then(m => m.startFreeKicks(kicks), () => {})
    import('./freekick/play3d.js').then(m => m.playFreeKicks3D(kicks)).then((stage) => { if (!stage) flat() }, flat)
  }
}

// A game played only on the stage, in 3D or drawn flat: if the stage
// cannot open at all, the page says so.
function stageGame(root, play) {
  const said = root.querySelector('[data-game-said]')
  const failed = () => { if (said) said.textContent = 'The game could not load. Check your connection and try again.' }
  play().then((stage) => { if (!stage) failed() }, failed)
}

function setupStageGames() {
  const rugby = document.querySelector('[data-rugby]')
  if (rugby) stageGame(rugby, () => import('./rugby/play3d.js').then(m => m.playRugby3D(rugby)))
  const netball = document.querySelector('[data-netball]')
  if (netball) stageGame(netball, () => import('./netball/play3d.js').then(m => m.playNetball3D(netball)))
  const cricket = document.querySelector('[data-cricket]')
  if (cricket) stageGame(cricket, () => import('./cricket/play3d.js').then(m => m.playCricket3D(cricket)))
}

// The appeal's story on the arcade page: its picture, at the top of the
// page, filled with the 3D and pinned there while the page is scrolled
// through, where a phone can draw it.
function setupStory() {
  const story = document.querySelector('[data-story-root]')
  if (story) import('./story/index.js').then(m => m.startStory(story), () => {})
}

// The stall's TV screen: its turns, and the appeal's story in 3D behind
// the appeal's words in its turn, where the television can draw it.
function setupTv() {
  const tv = document.querySelector('[data-tv]')
  if (!tv) return
  import('./tv.js').then(m => m.startTv(tv), () => {})
  import('./story/screen.js').then(m => m.startTvStory(tv), () => {})
}

setupStory()
setupMine()
setupPenalties()
setupGames()
setupStageGames()
setupTv()
