// The site's stylesheet, served as one file (/styles/site.<hash>.css)
// so the page's Content-Security-Policy needs no inline styles beyond the
// small block that carries the colours (server/render/layout.js).
//
// The phone comes first: every control at least 44px, body text at least
// 16px, one column of tiles on a phone, nothing wider than the screen,
// and the safe areas kept clear. The games' full-screen stage and its
// panels are here too, with the penalty shootout's section.

import { SECTION_CSS as SHOOTOUT_CSS } from '../../client/shootout/section.js'

const BASE_CSS = `*{box-sizing:border-box}[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--primary-deep);color:#fff;font-family:var(--body);font-size:17px;line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.page{position:relative;overflow-x:clip;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
.page>main{flex:1}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.wrap{max-width:1040px;margin:0 auto;padding:0 max(22px,env(safe-area-inset-right)) 0 max(22px,env(safe-area-inset-left))}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.band{--fg:#fff;--mut:var(--on-primary-muted);--acc:var(--accent);--rule:#ffffff33;background:var(--primary);color:var(--fg);padding:44px 0;position:relative}
.band.deep{background:var(--primary-deep)}
.band.white{--fg:var(--ink);--mut:var(--on-light-muted);--acc:var(--primary);--rule:var(--rule-light);background:#fff}
.band.stripes{background-image:repeating-linear-gradient(100deg,#ffffff08 0 90px,transparent 90px 180px)}
.band a{color:var(--acc)}
h1,h2,h3{font-family:var(--display);font-weight:800;text-transform:uppercase;line-height:.95;margin:0;text-wrap:balance;letter-spacing:.005em;overflow-wrap:normal}
h2{font-size:clamp(38px,9vw,64px);margin-bottom:14px}
h1 em,h2 em{font-style:normal;color:var(--accent)}
.white h1 em,.white h2 em{color:var(--primary);background:linear-gradient(transparent 62%,var(--accent) 62% 92%,transparent 92%);padding:0 .08em}
p{margin:0 0 14px;max-width:60ch}
.lede{font-size:19px;color:var(--mut)}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:var(--display);font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:16px;color:var(--acc);margin-bottom:12px}
.eyebrow::before{content:"";width:28px;height:3px;background:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 26px;border-radius:999px;font-weight:700;text-decoration:none;font-size:17px;font-family:var(--body);cursor:pointer}
.btn.y{background:var(--accent);color:var(--ink)!important;box-shadow:0 8px 24px #0003;border:0}
.btn.o{border:2px solid #ffffff80;color:#fff!important;background:transparent}
.btn.o.dark{border-color:var(--primary);color:var(--primary)!important}
.mail{display:inline-flex;align-items:center;min-height:44px;max-width:100%;overflow-wrap:anywhere;font-weight:700}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.hint{color:var(--mut);font-size:16px;margin:10px auto 0}
.hint.left{text-align:left;margin:12px 0 0}
.bar{position:sticky;top:0;z-index:6;background:var(--bar);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:3px solid var(--accent);padding-top:env(safe-area-inset-top)}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:58px;padding-top:6px;padding-bottom:6px}
.bar .home{display:inline-flex;align-items:center;min-height:44px;color:#fff;text-decoration:none}
.bn{font-family:var(--display);font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:20px;line-height:1}
.bn b{color:var(--accent);font-weight:800}
.bar-play{flex:none;display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;background:var(--accent);color:var(--ink);text-decoration:none;font-family:var(--display);font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:16px;line-height:1;white-space:nowrap;box-shadow:0 4px 14px #0003}
.hero{position:relative;padding:30px 0 0;background:linear-gradient(175deg,var(--primary-light) 0%,var(--primary) 46%,var(--primary-deep) 100%);overflow:hidden}
.hero .wrap{position:relative;z-index:1}
.wm{font-family:var(--display);font-weight:700;letter-spacing:.16em;font-size:17px;color:var(--ice);text-transform:uppercase}
.hero h1{font-size:clamp(46px,13.5vw,104px);line-height:.9;margin:10px 0 14px}
.hero p{font-size:19px;color:var(--on-primary-soft);max-width:44ch;margin-bottom:0}
.snow{display:block;width:100%;height:84px;margin-top:6px}
.snow .sfi{stroke:var(--ice)}.snow .sfg{stroke:var(--accent)}.snow .sfw{stroke:#fff}.snow .sg{fill:var(--accent)}.snow .sw{fill:#fff}
.arcade{padding-top:8px}
footer{background:var(--primary-deep);color:var(--on-primary-muted);padding:28px 0 calc(36px + env(safe-area-inset-bottom));font-size:16px;border-top:6px solid var(--accent)}
footer p{margin-bottom:6px}
footer b{color:#fff;font-family:var(--display);font-size:22px;letter-spacing:.04em;text-transform:uppercase}
footer a{color:var(--accent)}
footer .fl{display:flex;flex-wrap:wrap;gap:0 22px}
.empty{min-height:60vh;display:grid;place-items:center;text-align:center;padding:40px 0}
.empty p{margin-left:auto;margin-right:auto}
.empty .cta{justify-content:center}
.art{font-size:clamp(38px,9vw,64px);margin:4px 0 14px;overflow-wrap:break-word}
.report{padding-top:36px}
.report .wrap{max-width:780px}
.report .art{color:var(--ink)}
.prose{margin-top:18px}
.prose h2{font-size:clamp(28px,7vw,40px);margin:28px 0 10px;color:var(--ink)}
.prose p,.prose li{color:var(--ink);max-width:65ch}
.prose ul{padding-left:1.3em;margin:0 0 14px}
.prose li{margin-bottom:6px}
.updated{color:var(--mut);font-size:16px}
.nums h1{color:var(--ink)}
.nums h2{font-size:clamp(26px,6vw,36px);margin:30px 0 10px;color:var(--ink)}
.nums p{color:var(--ink)}
.numgrid{list-style:none;margin:20px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:12px}
.num{background:var(--tint);border:1px solid var(--rule-light);border-radius:16px;padding:16px 18px;color:var(--ink);font-size:17px;line-height:1.5}
.num .nl{display:block;font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-bottom:4px}
.num b{font-family:var(--display);font-weight:800;font-size:34px;line-height:1;margin-right:4px}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.nums table{border-collapse:collapse;width:100%;max-width:640px;color:var(--ink);font-size:17px}
.nums th,.nums td{text-align:left;padding:9px 12px 9px 0;border-bottom:1px solid var(--rule-light);vertical-align:middle}
.nums thead th{font-size:16px;color:var(--on-light-muted)}
.nums tbody th{font-weight:700}
.nums td.meter{width:38%}
.nums meter{width:100%;height:12px}
.nums .btn{margin-top:26px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`

// The arcade's tiles: one column on a phone, two from 560 and three from 900.
const TILES_CSS = `.gts{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
@media (min-width:560px){.gts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:900px){.gts{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}}
.gt a{display:flex;flex-direction:column;height:100%;border-radius:22px;overflow:hidden;background:#fff;color:var(--ink);text-decoration:none;box-shadow:0 14px 34px var(--deep-shadow);transition:transform .15s ease}
.gt a:hover,.gt a:focus-visible{transform:translateY(-4px)}
.gt svg{display:block;width:100%;height:auto;aspect-ratio:16/9;background:var(--primary-deep)}
.gt .gtx{font-family:var(--display);font-weight:800;font-size:44px}
.gt-b{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px 18px 18px;flex:1}
.gt-t{font-family:var(--display);font-weight:800;font-size:34px;line-height:1;text-transform:uppercase}
.gt-p{color:var(--on-light-muted);margin-bottom:10px}
.gt .btn{margin-top:auto;align-self:stretch}
@media (prefers-reduced-motion:reduce){.gt a{transition:none}.gt a:hover,.gt a:focus-visible{transform:none}}`

// The games' full-screen stage (client/games/stage.js), its finish panel
// and the leaderboard in it.
const STAGE_CSS = `.gs-open{overflow:hidden}
.gs{position:fixed;inset:0;z-index:2147483000;height:100%;height:100dvh;overflow:hidden;background:var(--primary-deep);color:#fff;font-size:16px;line-height:1.4;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.gs{touch-action:none;-webkit-touch-callout:none}
.gs-end,.hh-pick{touch-action:pan-y}
.gs-open body{overflow:hidden;overscroll-behavior:none}
.gs [hidden]{display:none!important}
.gs p,.gs h2{margin:0;max-width:none}
.gs-pitch{position:absolute;inset:0;outline:none;touch-action:none;cursor:pointer}
.gs-pitch:focus-visible{box-shadow:inset 0 0 0 4px var(--accent)}
.gs-pitch canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.gs-fx{pointer-events:none}
.gs-top{position:absolute;left:0;right:0;top:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 10px;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left));background:linear-gradient(#0008,#0000);pointer-events:none}
.gs-hud{display:flex;gap:14px;font-size:16px;white-space:nowrap}
.gs-hud b{font-family:var(--display);font-weight:800;font-size:30px;line-height:1;color:var(--accent);margin-right:2px}
.gs-btns{display:flex;gap:6px;margin-left:auto;pointer-events:auto}
.gs-b{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 10px;border-radius:999px;border:2px solid #ffffff73;background:#0e172999;color:#fff;font:700 16px/1 var(--body);text-decoration:none;cursor:pointer;touch-action:manipulation}
.gs-on{padding:2px 7px;border-radius:999px;background:#ffffff26;font-size:16px}
.gs-b[aria-checked=true] .gs-on{background:var(--accent);color:var(--ink)}
.gs :focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.gs-big{position:absolute;left:0;right:0;top:84px;text-align:center;font-family:var(--display);font-weight:800;font-size:120px;line-height:1;color:#fff;text-shadow:0 5px 0 var(--ink),0 8px 24px #0006;pointer-events:none}
.gs-big.pop{animation:gs-pop .22s ease-out}
@keyframes gs-pop{0%{transform:scale(1.28);color:var(--accent)}100%{transform:scale(1)}}
.gs-prompt{position:absolute;left:0;right:0;top:62%;padding:0 12px;text-align:center;font-family:var(--display);font-weight:800;font-size:34px;line-height:1.05;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 3px 0 var(--ink),0 6px 18px #0008;pointer-events:none;animation:gs-beat 1.4s ease-in-out infinite}
@keyframes gs-beat{50%{opacity:.55}}
.gs-banner{position:absolute;left:0;right:0;top:36%;text-align:center;font-family:var(--display);font-weight:800;font-size:110px;line-height:1;color:var(--accent);text-shadow:0 6px 0 var(--ink),0 10px 30px #0008;pointer-events:none}
.gs-banner.in{animation:gs-in .9s cubic-bezier(.2,1.4,.4,1) both}
@keyframes gs-in{0%{transform:scale(.4) rotate(-6deg);opacity:0}25%{opacity:1}80%{transform:scale(1) rotate(-3deg);opacity:1}100%{transform:scale(1.1) rotate(-3deg);opacity:0}}
.gs-end{position:absolute;left:50%;bottom:max(20px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(420px,calc(100% - 24px));padding:20px 18px 18px;border-radius:22px;background:#0e1729e6;border:2px solid var(--accent);box-shadow:0 18px 50px #0008;text-align:center;display:flex;flex-direction:column;gap:12px;animation:gs-up .28s ease-out both}
@keyframes gs-up{0%{transform:translate(-50%,24px);opacity:0}}
.gs-end-t{font-family:var(--display);font-weight:800;font-size:44px;line-height:1;text-transform:uppercase;color:var(--accent)}
.gs-end-l{font-size:18px}
.gs-end .btn{justify-content:center;text-align:center;min-height:50px}
.gs-end>.btn{font-size:20px}
.gs-more{display:flex;gap:10px}
.gs-more .btn{flex:1;padding-left:10px;padding-right:10px}
.gs-extra:empty{display:none}
.gs-end{max-height:calc(100dvh - 76px);overflow-y:auto;overscroll-behavior:contain}
.gs-extra{display:flex;flex-direction:column;gap:10px}
.gs-lbf{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px}
.gs-lbf label{font-weight:700}
.gs-lbf input{width:92px;min-height:50px;margin-left:6px;border-radius:12px;border:2px solid var(--accent);background:#fff;color:var(--ink);font:800 28px/1 var(--display);letter-spacing:.14em;text-align:center;text-transform:uppercase;-webkit-user-select:text;user-select:text}
.gs-lbf .btn{flex:1 1 180px;padding:0 14px;min-height:50px;border:0;font-family:var(--body);cursor:pointer}
.gs-lbf .btn[disabled]{opacity:.6}
.gs-lbs{flex-basis:100%;min-height:0;margin:0;font-size:16px}
.gs-lbs:empty{display:none}
.gs-lbw{display:flex;flex-direction:column;gap:6px}
.gs-lbw p{margin:0;max-width:none}
.gs-lbh{font-family:var(--display);font-weight:800;font-size:22px;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
.gs-lbn{font-size:16px}
.gs-lb{list-style:none;margin:0;padding:0;columns:2;column-gap:18px;text-align:left;font-size:17px}
.gs-lb li{display:flex;gap:8px;align-items:baseline;padding:2px 6px;border-radius:6px;break-inside:avoid}
.gs-lb .n{width:1.6em;text-align:right;color:#ffffffa6}
.gs-lb .i{font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:.1em}
.gs-lb .s{margin-left:auto;font-weight:700}
.gs-lb li.me{background:var(--accent);color:var(--ink)}
.gs-lb li.me .n{color:var(--ink)}
.gs-lbm{min-height:44px;padding:0 14px;border:0;background:none;color:#fff;font:700 16px/1 var(--body);text-decoration:underline;cursor:pointer}
.gs[data-reduced] .gs-prompt,.gs[data-reduced] .gs-banner.in,.gs[data-reduced] .gs-end{animation:none}
@media (max-height:520px){.gs-big{font-size:70px;top:60px}.gs-banner{font-size:70px}}`

// Head to head (client/headtohead/play.js), played with the phone held
// sideways.
const HEADS_CSS = `.hh .hh-pitch{cursor:default}
.hh-view{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.hh-top{align-items:flex-start;flex-wrap:nowrap;background:none;padding-top:max(6px,env(safe-area-inset-top))}
.hh-score{display:flex;align-items:center;gap:8px;margin:0 auto 0 0;padding:4px 12px;border-radius:999px;background:#0e1729d9;border:2px solid var(--accent);font:700 16px/1 var(--body);white-space:nowrap;pointer-events:none}
.hh-score b{font-family:var(--display);font-weight:800;font-size:30px;line-height:1;color:#fff;min-width:.6em;text-align:center}
.hh-score .hh-clock{color:var(--accent);min-width:1.5em;padding:0 8px;border-left:2px solid #ffffff40;border-right:2px solid #ffffff40}
.hh-pows{display:flex;gap:8px;margin:0 auto;pointer-events:auto}
.hh-pow{width:52px;height:52px;padding:0;border-radius:50%;border:3px solid var(--accent);background:#0e1729e6;cursor:pointer;touch-action:none;box-shadow:0 4px 14px #0006}
.hh-pow canvas{display:block;width:44px;height:44px;margin:auto}
.hh-pow[disabled]{border-color:#ffffff33;opacity:.35;box-shadow:none}
.hh-pow:active{transform:scale(.92)}
.hh-top .hh-score{margin:0}
@media (max-width:899px){.hh-top .gs-on{display:none}.hh-top .gs-b{padding:0 9px}.hh-top .gs-b[role=switch][aria-checked=true]{background:var(--accent);border-color:var(--accent);color:var(--ink)}.hh-top .gs-b[role=switch][aria-checked=false]{text-decoration:line-through;opacity:.75}}
@media (max-width:699px){.hh-score span{display:none}}
.hh-banner{top:22%;font-size:96px}
.hh-banner.sm{top:19%;font-size:44px}
.hh-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.hh-flash.on{animation:hh-flash .5s ease-out}
@keyframes hh-flash{0%{opacity:.75}100%{opacity:0}}
.gs[data-reduced] .hh-flash.on{animation:none}
.hh-prompt{top:44%}
.hh-pad{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));display:flex;gap:12px;touch-action:none}
.hh-pad-l{left:max(14px,env(safe-area-inset-left))}
.hh-pad-r{right:max(14px,env(safe-area-inset-right))}
.hh-key{width:76px;height:76px;border-radius:50%;border:3px solid #ffffffb3;background:#0e172999;color:#fff;font:800 18px/1 var(--display);letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-user-select:none;user-select:none;cursor:pointer}
.hh-key.ar{font-size:26px}
.hh-pad-r{gap:10px;align-items:flex-end}
.hh-pad-r .hh-key{width:64px;height:64px;font-size:17px}
.hh-pad-r .hh-key[data-in=jump]{position:relative;width:88px;height:88px;font-size:22px;border-width:4px}
.hh-pad-r .hh-key[data-in=jump]::after{content:"";position:absolute;inset:-16px -14px -12px -6px;border-radius:50%}
.hh-key.on{background:var(--accent);border-color:var(--accent);color:var(--ink);transform:scale(.94)}
.hh.ended .hh-pad{display:none}
.hh-end{bottom:auto;top:50%;transform:translate(-50%,-50%);width:min(460px,calc(100% - 24px));max-height:calc(100dvh - 16px);padding:14px 16px;gap:8px;animation:none}
.hh-end .gs-end-t{font-size:36px}
.hh-pick{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100% - 24px));max-height:calc(100dvh - 16px);overflow-y:auto;padding:14px 16px 16px;border-radius:22px;background:#0e1729f2;border:2px solid var(--accent);box-shadow:0 18px 50px #0008;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;z-index:2}
.hh-pick .gs-end-t{font-size:32px}
.hh-faces{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;width:100%}
.hh-face{aspect-ratio:1;min-width:44px;min-height:44px;padding:0;border-radius:16px;border:3px solid #ffffff40;background:#ffffff14;cursor:pointer;touch-action:manipulation}
.hh-face canvas{display:block;width:100%;height:100%}
.hh-face[aria-pressed=true]{border-color:var(--accent);background:var(--accent)}
.hh-pick .btn{min-width:200px}
@media (max-width:620px){.hh-faces{grid-template-columns:repeat(4,minmax(0,1fr))}}
.hh-turn{position:absolute;inset:0;z-index:3;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:24px;text-align:center;background:var(--primary-deep)}
.hh-turn p{font-family:var(--display);font-weight:800;font-size:34px;line-height:1.05;text-transform:uppercase}
.hh-phone{width:64px;height:112px;border:5px solid #fff;border-radius:14px;animation:hh-turn 2.4s ease-in-out infinite}
@keyframes hh-turn{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
.gs[data-reduced] .hh-phone{animation:none;transform:rotate(-90deg)}
@media (orientation:portrait){.hh-turn{display:flex}.hh-pad,.hh-top,.hh-prompt,.hh-banner{display:none}}
@media (min-width:900px) and (min-height:560px){.hh-key{width:64px;height:64px}.hh-pad-r .hh-key[data-in=jump]{width:76px;height:76px}}`

// A game's own page, with the flat version of the game where the 3D
// will not run.
const GAME_CSS = `.ku{margin:10px 0 0}
.band.game{padding-top:30px}
.band.game h2{margin-bottom:8px}
.band.game .lede{margin-bottom:8px}
.ku-stage{position:relative;width:min(100%,420px,calc(54vh * .75));width:min(100%,420px,calc(54svh * .75))}
.ku-stage .btn{position:absolute;left:50%;top:79%;transform:translate(-50%,-50%);white-space:nowrap;border:0}
.ku-pitch{display:block;width:100%;height:auto;aspect-ratio:3/4;border-radius:18px;border:3px solid var(--accent);touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer}
.ku-count{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 12px;max-width:none;color:var(--on-primary-soft)}
.ku-count b{font-family:var(--display);font-weight:800;font-size:34px;line-height:1;color:var(--accent);font-variant-numeric:tabular-nums;margin-right:6px}
.ku-said{margin:8px 0 12px;max-width:none;color:#fff;font-weight:700}
.ku .btn{border:0}`

// The stall's TV screen (server/render/tv.js). Stacked on a phone; on a
// television the code is on the left and one leaderboard at a time is on
// the right, sized by the screen so it reads from across a hall: at 1920
// by 1080 the code is about 500 pixels square and a leaderboard row's
// letters are 48 pixels high.
const TV_CSS = `.tv{position:relative;min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);gap:28px;align-content:start;padding:28px max(22px,env(safe-area-inset-right)) 112px max(22px,env(safe-area-inset-left));background:linear-gradient(175deg,var(--primary-light) 0%,var(--primary) 40%,var(--primary-deep) 100%);overflow:hidden}
.tv .snow{position:absolute;left:0;right:0;bottom:0;height:84px;margin:0;pointer-events:none}
.tv p{margin:0;max-width:none}
.tvq{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;min-width:0}
.tvh{font-family:var(--display);font-weight:800;text-transform:uppercase;line-height:.9;font-size:clamp(56px,17vw,96px)}
.tvh em{font-style:normal;color:var(--accent)}
.tvcode{width:min(100%,420px);padding:14px;border-radius:26px;background:#fff;box-shadow:0 18px 50px #0006}
.tvcode svg{display:block;width:100%;height:auto}
.tva{font-family:var(--display);font-weight:700;font-size:clamp(20px,5.4vw,30px);line-height:1.15;letter-spacing:.02em;overflow-wrap:anywhere;color:var(--on-primary-soft)}
.tvr{display:flex;flex-direction:column;gap:14px;min-width:0}
.tvd{font-family:var(--display);font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:18px;line-height:1.3;color:var(--ice)}
.tvd b{color:#fff;font-weight:700}
.tvbs{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.tvb{min-width:0;background:#0e1729cc;border:2px solid #ffffff2e;border-radius:22px;padding:18px 18px 14px}
.tvb h2{font-size:clamp(38px,10vw,56px);margin:0 0 2px;color:var(--accent)}
.tvc{color:var(--on-primary-muted);font-size:17px;padding-bottom:10px}
.tvl{list-style:none;margin:0;padding:0}
.tvl li{display:flex;align-items:baseline;gap:14px;padding:5px 8px;border-radius:10px;font-family:var(--display);font-weight:800;font-size:30px;line-height:1.15}
.tvl li:nth-child(odd){background:#ffffff0f}
.tvl .n{width:1.5em;text-align:right;color:var(--ice)}
.tvl li:nth-child(-n+3) .n{color:var(--accent)}
.tvl .i{letter-spacing:.14em}
.tvl .s{margin-left:auto;font-variant-numeric:tabular-nums}
.tve{font-size:19px;color:var(--on-primary-soft)}
.tvp{display:none}
@media (min-width:1000px) and (orientation:landscape){
.tv{grid-template-columns:38fr 62fr;gap:4vw;align-items:center;align-content:center;padding:3.4vh 4vw 9.4vh}
.tv .snow{height:7.6vh}
.js .tv{height:100vh;height:100dvh;min-height:0}
.tvq{gap:1.6vh}
.tvq .wm{font-size:min(1.5vw,2.6vh)}
.tvh{font-size:min(7.4vw,13.5vh)}
.tvcode{width:min(100%,50vh,30vw);padding:1.6vh;border-radius:3vh}
.tva{font-size:min(2.1vw,3.8vh)}
.tvr{gap:1.6vh}
.tvd{font-size:min(1.5vw,2.7vh)}
.tvbs{grid-template-columns:repeat(2,minmax(0,1fr));gap:2vh 1.4vw}
.tvb{padding:2.2vh 2vw 1.8vh;border-radius:3vh}
.tvb h2{font-size:min(3vw,5.4vh)}
.tvc{font-size:min(1.2vw,2.2vh);padding-bottom:1vh}
.tvl li{font-size:min(1.7vw,3vh);padding:.2vh .8vw;gap:1vw}
.tve{font-size:min(1.4vw,2.6vh)}
.js .tvbs{grid-template-columns:minmax(0,1fr)}
.js .tvb{display:none}
.js .tvb.on{display:block;animation:tv-in .6s ease both}
.js .tvb h2{font-size:min(5vw,9vh)}
.js .tvc{font-size:min(1.7vw,3vh);padding-bottom:1.2vh}
.js .tvl li{font-size:min(2.5vw,4.45vh);padding:.35vh 1vw;gap:1.4vw}
.js .tve{font-size:min(2.1vw,3.8vh)}
.js .tvp{display:flex;justify-content:center;gap:1vw}
.tvp i{width:1.1vw;height:1.1vw;border-radius:50%;background:#ffffff40}
.tvp i.on{background:var(--accent)}
}
@keyframes tv-in{from{opacity:0;transform:translateY(1.2vh)}}
@media (prefers-reduced-motion:reduce){.js .tvb.on{animation:none}}`

export const SITE_CSS = [BASE_CSS, TILES_CSS, STAGE_CSS, HEADS_CSS, GAME_CSS, SHOOTOUT_CSS, TV_CSS].join('\n')
