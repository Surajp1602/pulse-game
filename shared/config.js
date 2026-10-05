// Shared between server and client. Durations are in milliseconds at speed 1.

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const SUGGESTED_PLAYERS = 4;
export const ROUNDS_PER_SET = 5;

export const LENGTHS = {
  short: { sets: 2, label: 'Short', minutes: 5 },
  standard: { sets: 3, label: 'Standard', minutes: 8 },
  long: { sets: 4, label: 'Long', minutes: 11 },
};

export const PHASE_MS = {
  intro: 2500,
  countdown: 1500,
  reveal: 3200,
  ticker: 2200,
  setbreak: 6000,
  tiebreakIntro: 3000,
};

export const RECONNECT_HOST_MS = 15000;
export const EMPTY_ROOM_MS = 120000;

export const FAMILIES = {
  trivia: { label: 'Trivia', blurb: 'Facts, years and estimates' },
  reaction: { label: 'Reaction', blurb: 'Reflexes, eyes and memory' },
  word: { label: 'Word', blurb: 'Anagrams and categories' },
};

// kind: 'choice' = 100 + speed; 'precision' = 0-200 by accuracy; 'snap' = hits minus misses.
export const CHALLENGES = {
  higherLower: { family: 'trivia', name: 'Higher / Lower', rule: 'Tap the bigger one.', kind: 'choice', ms: 7000, glyph: '⇅' },
  whichFirst: { family: 'trivia', name: 'Which Came First', rule: 'Tap the one that happened first.', kind: 'choice', ms: 7000, glyph: '⏮' },
  closestCall: { family: 'trivia', name: 'Closest Call', rule: 'Slide to your best guess, then lock it.', kind: 'precision', ms: 10000, glyph: '◎' },
  colorClash: { family: 'reaction', name: 'Colour Clash', rule: 'Tap the INK colour, not the word.', kind: 'choice', ms: 5000, glyph: '◐' },
  needle: { family: 'reaction', name: 'Needle', rule: 'Stop the needle inside the zone.', kind: 'precision', ms: 6000, glyph: '⌖' },
  dotCount: { family: 'reaction', name: 'Dot Count', rule: 'Count the dots before they vanish.', kind: 'choice', ms: 6000, glyph: '⁘' },
  quickDraw: { family: 'reaction', name: 'Quick Draw', rule: 'Wait for GO. Tap early and you foul.', kind: 'precision', ms: 6000, glyph: '⚡' },
  memoryFlash: { family: 'reaction', name: 'Memory Flash', rule: 'Watch the sequence, then repeat it.', kind: 'choice', ms: 8500, glyph: '◇' },
  unscramble: { family: 'word', name: 'Unscramble', rule: 'Tap the letters to spell the word.', kind: 'choice', ms: 10000, glyph: '⇄' },
  oddOneOut: { family: 'word', name: 'Odd One Out', rule: "Tap the word that doesn't belong.", kind: 'choice', ms: 7000, glyph: '◌' },
  missingLetter: { family: 'word', name: 'Missing Letter', rule: 'Fill the gap to make a real word.', kind: 'choice', ms: 6000, glyph: '_' },
  categorySnap: { family: 'word', name: 'Category Snap', rule: 'Tap every word that fits. Misses cost.', kind: 'snap', ms: 9000, glyph: '✳' },
};

export const SCORING = {
  base: 100,
  speedMax: 100,
  precisionMax: 200,
  closestFloor: 150,
  first: 25,
  streak3: 1.25,
  streak5: 1.5,
  double: 2,
  surge: 1.25,
  falseStart: -50,
  snapHit: 50,
  snapMiss: -25,
};

export const PLAYER_COLORS = ['#FF5A36', '#FFC145', '#3EE0A0', '#4CC9F0', '#9D8CFF', '#FF7AB6', '#E8E1D4', '#FF9A3D'];
export const AVATAR_COUNT = 12;

export const DIFFICULTIES = ['easy', 'normal', 'hard'];

export const BOT_PERSONAS = [
  { id: 'byte', name: 'Byte', tag: 'The Ace', line: 'Fast and accurate everywhere.', avatar: 0 },
  { id: 'juno', name: 'Juno', tag: 'Steady', line: 'Middling speed, rarely wrong.', avatar: 1 },
  { id: 'zip', name: 'Zip', tag: 'Speedster', line: 'Blazing fast, error-prone.', avatar: 2 },
  { id: 'mochi', name: 'Mochi', tag: 'Careful', line: 'Slow, but very accurate.', avatar: 3 },
  { id: 'rook', name: 'Rook', tag: 'Trivia Buff', line: 'Knows facts, slow reflexes.', avatar: 4 },
  { id: 'pixel', name: 'Pixel', tag: 'Reflex', line: 'Great reflexes, weak on words.', avatar: 5 },
  { id: 'wren', name: 'Wren', tag: 'Wordsmith', line: 'Strong with words.', avatar: 6 },
  { id: 'dash', name: 'Dash', tag: 'Streaky', line: 'Hot on a streak, tilts after a miss.', avatar: 7 },
];

export const EMOTES = ['fire', 'haha', 'wow', 'clap', 'dead', 'love'];
