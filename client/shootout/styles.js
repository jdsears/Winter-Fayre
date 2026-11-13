// The overlay's styles, added to the page once when the game opens, so
// the section on the page costs nothing until Play is tapped. Colours
// are the site's (custom properties the game sets from the site's
// record) and the type is the site's display and body faces, Barlow
// Condensed and Barlow unless the site chose others.

const CSS = `
.tso{position:fixed;inset:0;z-index:2147483000;height:100%;height:100dvh;overflow:hidden;background:var(--tso-deep);color:#fff;
  font-family:var(--body,"Barlow","Segoe UI",system-ui,sans-serif);font-size:16px;line-height:1.4;-webkit-font-smoothing:antialiased;
  overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  --tso-display:var(--display,"Barlow Condensed","Arial Narrow",sans-serif);--tso-safe-top:max(10px,env(safe-area-inset-top));
  --tso-safe-bottom:max(12px,env(safe-area-inset-bottom));--tso-safe-left:max(12px,env(safe-area-inset-left));--tso-safe-right:max(12px,env(safe-area-inset-right))}
.tso *,.tso *::before,.tso *::after{box-sizing:border-box}
.tso [hidden]{display:none!important}
.tso :where(p,h2,dl,dd){max-width:none;margin:0}
.tso button{font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.tso :focus-visible{outline:3px solid var(--tso-accent);outline-offset:3px}
.tso-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.tso-stage{position:absolute;inset:0;outline:none;touch-action:none;cursor:grab;background:var(--tso-deep)}
.tso-stage:active{cursor:grabbing}
.tso-stage:focus-visible{outline:none;box-shadow:inset 0 0 0 4px var(--tso-accent)}
.tso-stage canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.tso-stage .tso-view{transition:opacity .28s ease}
.tso[data-fade="out"] .tso-view{opacity:0}
.tso-fx{pointer-events:none;z-index:2}
.tso-wipe{position:absolute;top:-10%;bottom:-10%;left:-60%;width:55%;background:var(--tso-accent);transform:skewX(-14deg) translateX(-120%);z-index:7;pointer-events:none;opacity:0}
.tso-wipe::after{content:"";position:absolute;inset:0 -18% 0 auto;width:22%;background:var(--tso-primary)}
.tso[data-wipe="on"] .tso-wipe{animation:tso-wipe .62s cubic-bezier(.6,0,.3,1) both}
@keyframes tso-wipe{0%{opacity:1;transform:skewX(-14deg) translateX(-30%)}100%{opacity:1;transform:skewX(-14deg) translateX(420%)}}

.tso-top{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:var(--tso-safe-top) var(--tso-safe-right) 0 var(--tso-safe-left);pointer-events:none}
.tso-top>*{pointer-events:auto}
.tso-title{margin:0;min-width:0;font:800 20px/1 var(--tso-display);letter-spacing:.06em;text-transform:uppercase;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 10px rgba(0,0,0,.35)}
.tso-top-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-left:auto}
@media (max-width:439px){.tso-title{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0)}}
@media (max-width:439px){.tso-top-actions{flex-wrap:nowrap}.tso-top-actions .tso-pill{padding:0 9px;gap:4px;white-space:nowrap}.tso-top-actions .tso-switch{min-width:0;padding:1px 6px}}
.tso-pill{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:0 16px;border-radius:999px;border:2px solid rgba(255,255,255,.6);
  background:rgba(4,10,30,.42);color:#fff;font-weight:700;font-size:16px;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.tso-pill:hover{border-color:#fff}
.tso-switch{display:inline-block;min-width:38px;padding:1px 8px;border-radius:999px;background:rgba(255,255,255,.2);font-size:16px;line-height:1.3;text-align:center}
.tso-sound[aria-checked="true"] .tso-switch{background:var(--tso-accent);color:var(--tso-ink)}

.tso-board{position:absolute;z-index:4;top:calc(var(--tso-safe-top) + 56px);left:50%;transform:translateX(-50%);width:min(420px,calc(100% - 24px));
  padding:9px 14px 8px;border-radius:16px;border-bottom:3px solid var(--tso-accent);isolation:isolate;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.tso-board::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--tso-deep);opacity:.86;z-index:-1}
.tso-row{display:grid;grid-template-columns:minmax(0,1fr) auto 30px;align-items:center;gap:10px;min-height:28px}
.tso-name{font:700 17px/1.05 var(--tso-display);letter-spacing:.04em;text-transform:uppercase;overflow-wrap:break-word;padding:2px 0}
.tso-row[data-next="true"] .tso-name{color:var(--tso-accent)}
.tso-dots{display:flex;gap:7px;margin:0;padding:0;list-style:none}
.tso-dot{position:relative;width:17px;height:17px;border-radius:50%;border:2px solid rgba(255,255,255,.55);transition:background-color .25s,border-color .25s,transform .25s}
.tso-dot[data-state="scored"]{background:var(--tso-accent);border-color:var(--tso-accent);transform:scale(1.06)}
.tso-dot[data-state="missed"]{border-color:rgba(255,255,255,.3)}
.tso-dot[data-state="missed"]::before,.tso-dot[data-state="missed"]::after{content:"";position:absolute;left:50%;top:50%;width:15px;height:3px;border-radius:2px;background:#ff6b6b;transform:translate(-50%,-50%) rotate(45deg)}
.tso-dot[data-state="missed"]::after{transform:translate(-50%,-50%) rotate(-45deg)}
.tso-dot[data-state="next"]{border-color:var(--tso-accent);animation:tso-pulse 1.1s ease-in-out infinite}
@keyframes tso-pulse{50%{box-shadow:0 0 0 5px rgba(255,255,255,.18)}}
.tso-score{font:800 24px/1 var(--tso-display);text-align:right;font-variant-numeric:tabular-nums}
.tso-sudden{margin:3px 0 0;text-align:center;font:700 16px/1.2 var(--tso-display);letter-spacing:.2em;text-transform:uppercase;color:var(--tso-accent)}
.tso-presented{position:absolute;z-index:4;left:0;right:0;bottom:var(--tso-safe-bottom);margin:0;padding:0 16px;text-align:center;font-size:16px;color:rgba(255,255,255,.92);pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.6)}
.tso-presented b{color:#fff}

.tso-prompt{position:absolute;z-index:4;left:16px;right:16px;top:56%;transform:translateY(-50%);text-align:center;pointer-events:none}
.tso-prompt-eyebrow{margin:0 0 6px;font:700 16px/1 var(--tso-display);letter-spacing:.22em;text-transform:uppercase;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.tso-prompt-title{margin:0;font:800 clamp(46px,15vw,84px)/.9 var(--tso-display);text-transform:uppercase;color:#fff;text-shadow:0 4px 0 var(--tso-ink),0 12px 34px rgba(0,0,0,.4);animation:tso-rise .4s cubic-bezier(.2,.8,.2,1) both}
.tso-hint{position:absolute;z-index:4;left:50%;bottom:calc(var(--tso-safe-bottom) + 34px);transform:translateX(-50%);width:max-content;max-width:min(34ch,calc(100% - 32px));
  margin:0;padding:10px 16px;border-radius:14px;background:rgba(4,10,30,.66);font-size:16px;line-height:1.35;text-align:center;color:#fff;pointer-events:none;animation:tso-fade-in .35s ease both}
.tso[data-phase="save"] .tso-hint{bottom:calc(var(--tso-safe-bottom) + 104px)}
@keyframes tso-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.tso-banner{position:absolute;z-index:6;left:0;right:0;top:40%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:hidden;padding:20px 0}
.tso-banner-word{display:block;font:800 clamp(58px,calc(132vw / var(--len,5)),168px)/.86 var(--tso-display);letter-spacing:.01em;text-transform:uppercase;color:var(--tso-accent);white-space:nowrap;
  text-shadow:0 6px 0 var(--tso-ink),0 16px 44px rgba(0,0,0,.45)}
.tso-banner[data-good="false"] .tso-banner-word{color:#fff}
.tso-banner-sub{margin-top:12px;padding:6px 14px;border-radius:999px;background:var(--tso-accent);color:var(--tso-ink);font:700 17px/1.1 var(--tso-display);letter-spacing:.12em;text-transform:uppercase}
.tso-banner-sub:empty{display:none}
.tso-banner.is-in .tso-banner-word{animation:tso-sweep-in .5s cubic-bezier(.2,.8,.2,1) both}
.tso-banner.is-in .tso-banner-sub{animation:tso-rise .4s .18s cubic-bezier(.2,.8,.2,1) both}
.tso-banner.is-out .tso-banner-word,.tso-banner.is-out .tso-banner-sub{animation:tso-sweep-out .32s ease-in both}
@keyframes tso-sweep-in{0%{opacity:0;transform:translateX(-70vw) skewX(-16deg)}60%{opacity:1;transform:translateX(3vw) skewX(-5deg)}100%{transform:none}}
@keyframes tso-sweep-out{to{opacity:0;transform:translateX(70vw) skewX(-16deg)}}
@keyframes tso-fade-in{from{opacity:0}to{opacity:1}}
@keyframes tso-fade-out{to{opacity:0}}

.tso-power{position:absolute;z-index:4;right:var(--tso-safe-right);top:52%;width:20px;height:28%;border-radius:12px;background:rgba(4,10,30,.5);border:2px solid rgba(255,255,255,.75);overflow:hidden}
.tso-power-zone{position:absolute;left:0;right:0;top:0;height:22%;background:rgba(255,107,107,.5)}
.tso-power-fill{position:absolute;left:0;right:0;bottom:0;height:0;background:var(--tso-accent)}
.tso-power[data-hot="true"] .tso-power-fill{background:#ff6b6b}

.tso-zones{position:absolute;z-index:5;left:var(--tso-safe-left);right:var(--tso-safe-right);bottom:calc(var(--tso-safe-bottom) + 24px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.tso-zone{min-height:62px;padding:0 4px;border-radius:16px;border:2px solid rgba(255,255,255,.75);background:rgba(4,10,30,.45);color:#fff;
  font:800 18px/1.05 var(--tso-display);letter-spacing:.02em;white-space:nowrap;text-transform:uppercase;cursor:pointer;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tso-zone:hover{border-color:#fff}
.tso-zone[data-picked="true"]{background:var(--tso-accent);border-color:var(--tso-accent);color:var(--tso-ink)}

.tso-loading{position:absolute;inset:0;z-index:3;display:grid;place-items:center;margin:0;font:700 18px var(--tso-display);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9)}
.tso:not([data-phase="loading"]) .tso-loading{display:none}
.tso-error{position:absolute;inset:auto 16px 30% 16px;z-index:9;margin:0;text-align:center;font-size:16px}

.tso-results{position:absolute;inset:0;z-index:8;display:grid;place-items:center;overflow-y:auto;touch-action:pan-y;-webkit-user-select:text;user-select:text;
  padding:calc(var(--tso-safe-top) + 54px) 16px var(--tso-safe-bottom);background:rgba(2,6,20,.45)}
.tso-results-card{position:relative;width:min(440px,100%);padding:24px 20px 20px;border-radius:22px;text-align:center;background-color:var(--tso-deep);
  background-image:repeating-linear-gradient(100deg,rgba(255,255,255,.045) 0 60px,transparent 60px 120px);border-bottom:6px solid var(--tso-accent);box-shadow:0 30px 80px rgba(0,0,0,.45);animation:tso-rise .45s cubic-bezier(.2,.8,.2,1) both}
.tso-eyebrow{display:inline-flex;align-items:center;gap:10px;margin:0;font:700 16px/1 var(--tso-display);letter-spacing:.18em;text-transform:uppercase;color:var(--tso-accent)}
.tso-eyebrow::before{content:"";width:26px;height:3px;background:var(--tso-accent)}
.tso-results-title{margin:10px 0 18px;font:800 clamp(36px,11vw,54px)/.95 var(--tso-display);text-transform:uppercase;text-wrap:balance}
.tso-results-title:focus{outline:none}
.tso-stats{display:grid;gap:8px;margin:0 0 14px;text-align:left}
.tso-stats>div{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:8px 16px;border-radius:14px;background:rgba(255,255,255,.08)}
.tso-stats dt{font-size:16px;line-height:1.25;color:rgba(255,255,255,.9)}
.tso-stats dd{margin:0;font:800 26px/1.05 var(--tso-display);color:var(--tso-accent);text-align:right;white-space:nowrap}
.tso-newbest{display:inline-block;margin:0 0 14px;padding:5px 14px;border-radius:999px;background:var(--tso-accent);color:var(--tso-ink);font-weight:700;font-size:16px}
.tso-extra{margin:0 0 14px;text-align:center}
.tso-actions{display:grid;gap:10px}
.tso-btn{min-height:50px;padding:0 20px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:transparent;color:#fff;font-weight:700;font-size:17px;cursor:pointer}
.tso-btn:hover{border-color:#fff}
.tso-btn-main{background:var(--tso-accent);border-color:var(--tso-accent);color:var(--tso-ink);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.tso-btn-quiet{border-color:transparent;text-decoration:underline;text-underline-offset:3px}
.tso-share-note{min-height:1.4em;margin:10px 0 0;font-size:16px}
.tso-share-link{width:100%;min-height:44px;margin-top:8px;padding:0 12px;border-radius:12px;border:2px solid rgba(255,255,255,.6);background:rgba(255,255,255,.08);color:#fff;font:inherit}

.tso[data-reduced="true"] .tso-banner.is-in .tso-banner-word,.tso[data-reduced="true"] .tso-banner.is-in .tso-banner-sub{animation:tso-fade-in .3s ease both}
.tso[data-reduced="true"] .tso-banner.is-out .tso-banner-word,.tso[data-reduced="true"] .tso-banner.is-out .tso-banner-sub{animation:tso-fade-out .3s ease both}
.tso[data-reduced="true"] .tso-prompt-title,.tso[data-reduced="true"] .tso-results-card{animation:tso-fade-in .3s ease both}
.tso[data-reduced="true"] .tso-dot{transition:none;animation:none}
.tso[data-reduced="true"] .tso-wipe{display:none}
@media (prefers-reduced-motion:reduce){.tso-dot{animation:none}}
/* A phone on its side: the board top left, clear of Sound and Leave game;
   the words smaller and clear of the ball; the hint docked under the
   board; the partner line under the top actions; the dive buttons a row
   along the bottom. */
@media (orientation:landscape) and (max-height:500px){
  .tso-title{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0)}
  .tso-board{top:var(--tso-safe-top);left:var(--tso-safe-left);transform:none;width:min(330px,calc(100% - var(--tso-safe-left) - var(--tso-safe-right) - 300px));padding:6px 12px 6px}
  .tso-row{min-height:24px;gap:8px}
  .tso-dot{width:15px;height:15px}
  .tso-dots{gap:5px}
  .tso-score{font-size:22px}
  .tso-prompt{top:auto;bottom:calc(var(--tso-safe-bottom) + 14px);transform:none;left:var(--tso-safe-left);right:auto;text-align:left}
  .tso-prompt-title{font-size:clamp(34px,11vh,52px)}
  .tso-prompt-eyebrow{margin-bottom:4px}
  .tso-hint{left:auto;right:var(--tso-safe-right);top:auto;bottom:calc(var(--tso-safe-bottom) + 14px);transform:none;max-width:min(30ch,34%);text-align:left}
  .tso[data-phase="save"] .tso-hint{bottom:calc(var(--tso-safe-bottom) + 64px)}
  .tso-presented{left:auto;right:var(--tso-safe-right);bottom:auto;top:calc(var(--tso-safe-top) + 54px);max-width:40%;padding:0;text-align:right}
  .tso-zones{left:auto;right:var(--tso-safe-right);bottom:var(--tso-safe-bottom);width:min(420px,52%);gap:8px}
  .tso-zone{min-height:48px}
  .tso-banner{top:46%}
  .tso-power{top:30%;height:46%}
  .tso-results{padding:calc(var(--tso-safe-top) + 46px) var(--tso-safe-right) var(--tso-safe-bottom) var(--tso-safe-left)}
  .tso-results-card{width:min(720px,100%);display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);column-gap:20px;align-items:center;padding:14px 18px 12px;text-align:left}
  .tso-results-card>.tso-eyebrow{grid-column:1;grid-row:1;justify-self:start}
  .tso-results-title{grid-column:1;grid-row:2;margin:6px 0 10px;font-size:clamp(28px,9vh,40px)}
  .tso-stats{grid-column:1;grid-row:3;gap:6px;margin:0}
  .tso-stats>div{min-height:40px;padding:4px 14px}
  .tso-newbest{grid-column:1;grid-row:4;justify-self:start;margin:8px 0 0}
  .tso-actions{grid-column:2;grid-row:1 / span 3;align-self:center}
  .tso-share-note{grid-column:2;grid-row:4}
  .tso-share-link{grid-column:1 / span 2;grid-row:5}
  .tso-extra{grid-column:1 / span 2;grid-row:6;margin:10px 0 0}
}
/* A small phone on its side: the switches say on or off by how they look,
   not in words, so the board has room beside them. */
@media (orientation:landscape) and (max-height:500px) and (max-width:659px){
  .tso-top-actions{flex-wrap:nowrap}
  .tso-top-actions .tso-pill{padding:0 10px;white-space:nowrap}
  .tso-top-actions .tso-switch{display:none}
  .tso-sound[aria-checked="true"]{background:var(--tso-accent);border-color:var(--tso-accent);color:var(--tso-ink)}
  .tso-sound[aria-checked="false"]{text-decoration:line-through}
  .tso-board{width:calc(100% - var(--tso-safe-left) - var(--tso-safe-right) - 262px)}
}
`

export function injectStyles(doc = globalThis.document) {
  if (!doc || doc.getElementById?.('tso-styles')) return
  const style = doc.createElement('style')
  style.id = 'tso-styles'
  // The page's Content-Security-Policy lets in only the styles that carry
  // its nonce, so the game's styles carry the same one as the page's.
  const nonce = doc.querySelector?.('style[nonce]')?.nonce
  if (nonce) style.nonce = nonce
  style.textContent = CSS
  doc.head.appendChild(style)
}

export { CSS }
