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
//   rugby, netball played on the same stage (./rugby, ./netball); where
//                  the 3D will not run the stage draws the stadium flat,
//                  so there is no second version on the page
//
// and on the stall's TV screen, the leaderboards taking turns and
// refreshing themselves (./tv.js).
//
// No analytics, advertising or tracking of any kind. Built by Vite
// (vite.config.js) into dist/assets.

import { enhanceShootout } from './shootout/index.js'
import { tally } from './games/count.js'
import { createGoBoard } from './games/board.js'

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
}

// The stall's TV screen.
function setupTv() {
  const tv = document.querySelector('[data-tv]')
  if (tv) import('./tv.js').then(m => m.startTv(tv), () => {})
}

setupPenalties()
setupGames()
setupStageGames()
setupTv()
