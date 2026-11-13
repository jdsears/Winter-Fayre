// The Sports Fund Appeal of the Wymondham College Parent Staff
// Association: what the stall and its games are in aid of. One place for
// its words, read by the server's pages, the stall's TV and the games'
// finish panels.
//
// The words and the figures are the PSA's own, from its page on
// JustGiving and the slide John supplied (13 November 2026), put more
// briefly. Nothing here is invented: if the appeal changes, change it
// here from the PSA's page, and nowhere else.

export const APPEAL = {
  name: 'Sports Fund Appeal',
  // The headline, in two parts: the second is shown in gold.
  headline: ['Help us fund the next chapter', 'of school sport'],
  lede: 'The Parent Staff Association raises funds to enhance the sporting experience of every pupil at the College.',

  // Where a gift is made: the PSA's page on JustGiving. The site's own
  // /donate counts the tap and sends the visitor on to it.
  url: 'https://www.justgiving.com/page/wymcol-psa-sports',
  shown: 'justgiving.com/page/wymcol-psa-sports',
  path: '/donate',
  button: 'Donate on JustGiving',

  why: {
    title: 'Why it matters',
    text: 'The College\'s sports budgets cover day to day teaching. They cannot stretch to larger purchases like full-size goals or pitch covers.',
    key: 'That is where the PSA steps in.',
  },

  funded: {
    title: 'Already funded',
    lede: 'Recent PSA-funded projects:',
    items: [
      { key: 'tables', amount: '£8,500', what: 'Table tennis tables', text: 'A full set of table tennis tables.' },
      { key: 'water', amount: '£5,000', what: 'Cricket irrigation', text: 'Towards the new cricket pitch irrigation system, which keeps the square in excellent condition all year round.' },
      { key: 'posts', amount: '£5,000', what: 'Rugby post protectors', text: 'Towards new rugby post protectors, improving safety on the rugby pitches.' },
    ],
    more: 'And sports kit, equipment and training resources across many sports.',
  },

  raising: {
    title: 'Now raising for',
    items: [
      { key: 'goals', what: 'Football box goals', text: 'Full-sized box goals and a pair of wheeled 9-a-side box goals: for 1st XI matchdays, the growing girls\' football programme and a community partnership with Morley Youth Football Club.' },
      { key: 'covers', what: 'Cricket pitch covers', text: 'New pitch covers, to protect the cricket squares from the British weather and extend the playing season.' },
    ],
  },

  give: {
    title: 'Your part',
    text: 'Every donation, large or small, goes straight to sports equipment for the College.',
    ways: 'A single donation or a monthly contribution: both help.',
    giftAid: 'If you are a UK taxpayer, please tick the Gift Aid box when you donate. It adds 25 percent to your gift at no extra cost to you.',
    thanks: 'Thank you for supporting Wymondham College sport.',
  },

  charity: 'Wymondham College Parent Staff Association',
  number: '273057',

  // One calm line for grown-ups on a game's finish panel, and the words
  // of its link to the appeal on this site.
  line: 'Grown-ups: these games are in aid of the PSA\'s Sports Fund Appeal, which buys sports equipment for the College.',
  more: 'See the appeal',

  // The appeal in a line each, for the stall's TV.
  short: {
    raising: 'Now raising for football box goals and cricket covers',
    funded: 'Already funded: rugby post protectors, table tennis tables, cricket irrigation',
  },
}

// The charity's line, as it is written out.
export const charityLine = () => `${APPEAL.charity}. Registered charity ${APPEAL.number}.`
