// The four kits on the pitch, from the site's colours: the visitor's side
// in the site's kit (a Christmas red with white trim), its keeper in an
// elf's green, and the computer's side and keeper in colours clear of
// both. Pure.

import { furthest, mix, textOn } from './colour.js'

const KEEPER_COLOURS = ['#b6f23a', '#ff7a1a', '#ff3f8e', '#18191d', '#14c3a8', '#8b5cf6']
export const HOME_KEEPER_KIT = { shirt: '#1e9e57', shorts: '#177a44', socks: '#d7263d' }
const AWAY_COLOURS = ['#8fd6e8', '#f4f4f2']

export function kits(colours) {
  const { primary, deep, accent } = colours
  const shirt = colours.kit || primary
  const home = {
    shirt,
    sleeve: shirt,
    trim: colours.kitTrim || accent,
    shorts: deep,
    socks: shirt,
    number: textOn(shirt, '#ffffff', deep),
  }
  // The home keeper wears an elf's green shirt and shorts with red socks.
  const homeKeeperShirt = HOME_KEEPER_KIT.shirt
  const homeKeeper = {
    shirt: homeKeeperShirt,
    sleeve: homeKeeperShirt,
    trim: mix(homeKeeperShirt, '#000000', 0.35),
    shorts: HOME_KEEPER_KIT.shorts,
    socks: HOME_KEEPER_KIT.socks,
    gloves: '#f6f6f6',
  }
  const awayShirt = furthest(AWAY_COLOURS, [shirt, deep, accent, homeKeeperShirt])
  const away = {
    shirt: awayShirt,
    sleeve: awayShirt,
    trim: textOn(awayShirt, '#ffffff', '#15171c'),
    shorts: textOn(awayShirt, '#ffffff', '#15171c') === '#ffffff' ? mix(awayShirt, '#000000', 0.5) : '#15171c',
    socks: awayShirt,
    number: textOn(awayShirt, '#ffffff', '#15171c'),
  }
  const awayKeeperShirt = furthest(KEEPER_COLOURS, [awayShirt, shirt, homeKeeperShirt])
  const awayKeeper = {
    shirt: awayKeeperShirt,
    sleeve: awayKeeperShirt,
    trim: mix(awayKeeperShirt, '#000000', 0.35),
    shorts: mix(awayKeeperShirt, '#000000', 0.55),
    socks: awayKeeperShirt,
    gloves: '#f6f6f6',
  }
  return { home, homeKeeper, away, awayKeeper }
}
