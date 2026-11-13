// The players' looks: a skin tone and a hair colour, one list for both
// pitches (3D and 2D), so a player looks the same in either. Each kick's
// taker, and the other team's keeper for the shootout, is given a look at
// random, never by what kind of taker they are: no look goes with a
// trick. The home team's keeper alone has a look of her own (below).

export const LOOKS = [
  { skin: '#f1c7a5', hair: '#2a1d16' },
  { skin: '#d9a07a', hair: '#4a3020' },
  { skin: '#a8714f', hair: '#121212' },
  { skin: '#7a4b32', hair: '#1d1a18' },
  { skin: '#5b3a26', hair: '#121212' },
  { skin: '#e8b48f', hair: '#7a4a22' },
]

// The home team's goalkeeper, the one the visitor plays in goal: always
// the same figure, with dark hair tied back in a ponytail. She is the
// one player whose look is set and not picked at random, and she is not
// in the list above, so no taker or other keeper is ever given her look.
export const HOME_KEEPER = { skin: '#f1c7a5', hair: '#2a1d16', ponytail: true }
export const HOME_KEEPER_LOOK = LOOKS.length

// The skin tones alone, for the crowd.
export const SKINS = [...new Set(LOOKS.map((l) => l.skin))]

// The look at an index, any whole number.
export function lookAt(index = 0) {
  if (index === HOME_KEEPER_LOOK) return HOME_KEEPER
  const n = LOOKS.length
  return LOOKS[((Math.floor(index) % n) + n) % n]
}

// A look for a player, from a random source of its own.
export function pickLook(rng) {
  return Math.floor(rng() * LOOKS.length)
}
