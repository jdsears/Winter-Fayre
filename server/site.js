// The site's own names, words and colours, in one place.
//
// The name of the site is "Winter Fayre Sports Arcade". The boards round
// the pitch read "Wymondham College PSA", "Winter Fayre" and "Sports Fund
// Appeal", as John asked (13 November 2026): the games are in aid of the
// PSA's appeal (shared/appeal.js). The crest of the College's Parent Staff
// Association, which John supplied and has permission to use, is the
// one picture the site holds (crest.js).

export const SITE = {
  name: 'Winter Fayre Sports Arcade',
  short: 'Winter Fayre',
  // The line above the name on the arcade page, and the foot of each page.
  host: 'Wymondham College PSA',
  // The words on the boards round the pitch, turn and turn about, and on
  // the big sign across the stand.
  boards: ['Wymondham College PSA', 'Winter Fayre', 'Sports Fund Appeal'],
  sign: { name: 'Winter Fayre', over: 'Wymondham College PSA' },
  description: 'Quick sports games to play on your phone at the Winter Fayre.',
}

// A winter palette, after the fayre's poster: deep navy, ice blue, white
// and a warm gold. The players' kit is a Christmas red with white trim.
export const COLOURS = {
  primary: '#22344f',
  primary_deep: '#141f33',
  primary_light: '#31507a',
  ink: '#0c1626',
  accent: '#f0c05a',
  ice: '#8fd6e8',
  tint: '#eef4fa',
  on_primary_muted: '#c3d0e0',
  on_primary_soft: '#dde6f1',
  on_light_muted: '#4b5b71',
  rule_light: '#d3dde9',
  kit: '#c8102e',
  kit_trim: '#ffffff',
}
