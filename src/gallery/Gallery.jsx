// /gallery — every key screen rendered from mock state with a frozen clock, one per viewport height.
// Used by the jury capture (tools/jury/capture.mjs) and for design review. Not linked from the game.
import { useMemo } from 'react';
import { ClockContext } from '../components/ui.jsx';
import { Home } from '../screens/Home.jsx';
import { Lobby } from '../screens/Lobby.jsx';
import { Game } from '../screens/Game.jsx';
import { Results } from '../screens/Results.jsx';
import { CHALLENGES } from '../../shared/config.js';

const NOW = 1_800_000_000_000;
const act = { send: () => {}, leave: () => {}, start: async () => ({ ok: true }), peek: async () => ({ ok: false }), create: async () => ({ ok: false }), join: async () => ({ ok: false }) };

const P = [
  { id: 'me', name: 'Priya', avatar: 4, color: '#FF5A36', isBot: false, score: 2140, rank: 2, prevRank: 3, streak: 3, history: [180, 360, 512, 700, 1240, 1430, 1600, 1810, 1990, 2140] },
  { id: 'h2', name: 'Tomás', avatar: 9, color: '#4CC9F0', isBot: false, score: 2290, rank: 1, prevRank: 1, streak: 1, history: [200, 390, 600, 790, 1300, 1500, 1720, 1900, 2100, 2290] },
  { id: 'b1', name: 'Byte', avatar: 0, color: '#FFC145', isBot: true, persona: 'byte', tag: 'The Ace', difficulty: 'hard', score: 2080, rank: 3, prevRank: 2, streak: 0, history: [190, 400, 610, 820, 1290, 1480, 1650, 1820, 2000, 2080] },
  { id: 'h3', name: 'Mei', avatar: 2, color: '#3EE0A0', isBot: false, score: 1710, rank: 4, prevRank: 4, streak: 0, history: [120, 240, 410, 590, 980, 1150, 1310, 1450, 1600, 1710] },
  { id: 'b2', name: 'Zip', avatar: 2, color: '#9D8CFF', isBot: true, persona: 'zip', tag: 'Speedster', difficulty: 'normal', score: 1180, rank: 5, prevRank: 6, streak: 0, history: [150, 150, 330, 330, 600, 760, 760, 940, 1000, 1180] },
  { id: 'b3', name: 'Mochi', avatar: 3, color: '#FF7AB6', isBot: true, persona: 'mochi', tag: 'Careful', difficulty: 'easy', score: 1020, rank: 6, prevRank: 5, streak: 2, history: [140, 280, 400, 520, 780, 860, 860, 900, 960, 1020] },
].map((p) => ({ connected: true, ready: true, spectator: false, lateJoin: false, ...p }));

function base(extra = {}) {
  return {
    code: 'KTPV', phase: 'play', phaseEndsAt: NOW + 4000, phaseMs: 6000, now: NOW, speed: 1, hostId: 'me',
    settings: { length: 'standard', families: { trivia: true, reaction: true, word: true }, botDifficulty: 'normal' },
    pauseRequested: false, canStart: null, players: P, results: null, you: { id: 'me', answered: false, snaps: [] }, ...extra,
  };
}

function round(type, elapsed, extra = {}) {
  const c = CHALLENGES[type];
  return { index: 9, total: 15, set: 1, sets: 3, inSet: 4, double: true, type, tiebreak: false, tiedIds: null, startedAt: NOW - elapsed, endsAt: NOW - elapsed + c.ms, ms: c.ms, opensAt: 0, payload: null, locks: [], reveal: null, results: null, fastestId: null, ...extra };
}

const HIST = { me: [180, 360, 512, 700, 1240, 1430, 1600, 1810, 1990, 2140, 2300, 2480, 2660, 2870, 3390],
  h2: [200, 390, 600, 790, 1300, 1500, 1720, 1900, 2100, 2290, 2470, 2650, 2820, 3010, 3280],
  b1: [190, 400, 610, 820, 1290, 1480, 1650, 1820, 2000, 2080, 2260, 2430, 2630, 2800, 3120],
  h3: [120, 240, 410, 590, 980, 1150, 1310, 1450, 1600, 1710, 1860, 1990, 2150, 2300, 2710],
  b2: [150, 150, 330, 330, 600, 760, 760, 940, 1000, 1180, 1180, 1330, 1330, 1500, 1820],
  b3: [140, 280, 400, 520, 780, 860, 860, 900, 960, 1020, 1150, 1290, 1400, 1480, 1700] };
const FINAL_P = P.map((p) => ({ ...p, score: HIST[p.id].at(-1), history: HIST[p.id] }));

const FRAMES = [
  { name: 'home', render: () => <Home act={act} /> },
  {
    name: 'lobby',
    render: () => <Lobby act={act} state={base({ phase: 'lobby', canStart: { ok: false, reason: 'not-ready', unready: ['h2'] }, players: [
      { ...P[0], ready: false, score: 0 }, { ...P[1], ready: false, score: 0 }, { ...P[2], score: 0 },
    ] })} />,
  },
  { name: 'intro', render: () => <Game act={act} state={base({ phase: 'intro', round: round('colorClash', 0, { inSet: 4, double: true }) })} /> },
  { name: 'countdown', render: () => <Game act={act} state={base({ phase: 'countdown', phaseEndsAt: NOW + 900, phaseMs: 1500, round: round('higherLower', 0, { double: false, inSet: 1, index: 6 }) })} /> },
  {
    name: 'higher-lower',
    render: () => <Game act={act} state={base({ round: round('higherLower', 2600, { double: false, inSet: 1, index: 6, locks: [{ id: 'b1', t: 0.22 }, { id: 'h2', t: 0.31 }], payload: { prompt: 'Which is taller?', options: ['Taipei 101', 'Eiffel Tower'] } }) })} />,
  },
  {
    name: 'closest-call',
    render: () => <Game act={act} state={base({ round: round('closestCall', 4200, { double: false, inSet: 2, index: 7, locks: [{ id: 'b3', t: 0.3 }], payload: { prompt: 'How many bones in an adult human body?', min: 0, max: 500, step: 1, start: 250 } }) })} />,
  },
  {
    name: 'needle',
    render: () => <Game act={act} state={base({ round: round('needle', 2300, { double: false, inSet: 3, index: 8, locks: [{ id: 'h2', t: 0.36 }, { id: 'b1', t: 0.38 }, { id: 'b2', t: 0.2 }], payload: { period: 2000, center: 0.62, half: 0.075 } }) })} />,
  },
  {
    name: 'category-snap',
    render: () => <Game act={act} state={base({ round: round('categorySnap', 3150, { double: false, inSet: 0, index: 5, locks: [{ id: 'b1', t: 0.12 }, { id: 'me', t: 0.2 }], payload: { label: 'a fish', visibleMs: 1600, words: ['salmon', 'violin', 'trout', 'tennis', 'cod', 'ankle', 'pike', 'jacket', 'thunder', 'sardine'].map((text, i) => ({ text, at: 500 + i * 750 })) } }), you: { id: 'me', answered: false, snaps: [2] } })} />,
  },
  {
    name: 'memory',
    render: () => <Game act={act} state={base({ round: round('memoryFlash', 3600, { double: false, inSet: 2, index: 2, opensAt: 2700, locks: [], payload: { seq: [0, 3, 5, 1], stepMs: 600, symbols: ['diamond', 'circle', 'triangle', 'square', 'cross', 'star'] } }) })} />,
  },
  {
    name: 'reveal',
    render: () => (
      <Game act={act} state={base({
        phase: 'reveal', you: { id: 'me', answered: true, snaps: [] },
        round: round('colorClash', 5200, {
          locks: [{ id: 'b2', t: 0.12 }, { id: 'me', t: 0.24 }, { id: 'b1', t: 0.3 }, { id: 'h2', t: 0.4 }, { id: 'h3', t: 0.55 }, { id: 'b3', t: 0.7 }],
          payload: { word: 'GREEN', ink: '#FFD23F', options: [{ key: 'red', label: 'RED' }, { key: 'yellow', label: 'YELLOW' }, { key: 'green', label: 'GREEN' }, { key: 'blue', label: 'BLUE' }] },
          reveal: { correct: 'yellow', label: 'YELLOW' }, fastestId: 'me',
          results: {
            me: { correct: true, summary: 'YELLOW', points: 532, first: true, streakMult: 1.25, double: true, surge: false, choice: 'yellow', elapsed: 1200 },
            h2: { correct: true, summary: 'YELLOW', points: 340, double: true, streakMult: 1 },
            b1: { correct: true, summary: 'YELLOW', points: 362, double: true, streakMult: 1 },
            h3: { correct: true, summary: 'YELLOW', points: 304, double: true, streakMult: 1, surge: true },
            b2: { correct: false, summary: 'GREEN', points: 0 },
            b3: { correct: false, summary: 'No answer', points: 0, none: true },
          },
        }),
      })} />
    ),
  },
  { name: 'ticker', render: () => <Game act={act} state={base({ phase: 'ticker', round: round('colorClash', 6000) })} /> },
  {
    name: 'results',
    render: () => <Results act={act} state={base({
      phase: 'results', players: FINAL_P, round: round('colorClash', 6000, { index: 14 }),
      results: {
        order: [...FINAL_P].sort((a, b) => b.score - a.score).map((p, i) => ({ id: p.id, place: i + 1, score: p.score })),
        awards: [
          { key: 'fastest', label: 'Fastest Finger', id: 'me', detail: '4× first' },
          { key: 'streak', label: 'Longest Streak', id: 'h2', detail: '6 in a row' },
          { key: 'sharp', label: 'Sharpshooter', id: 'b1', detail: '80% correct' },
          { key: 'comeback', label: 'Comeback', id: 'h3', detail: '#6 → #4' },
        ],
      },
    })} />,
  },
];

export default function Gallery() {
  const clock = useMemo(() => ({ now: () => NOW, frozen: true }), []);
  return (
    <ClockContext.Provider value={clock}>
      <div className="gallery">
        {FRAMES.map((f) => <section key={f.name} className="g-frame" data-frame={f.name} aria-label={`Screen: ${f.name}`}>{f.render()}</section>)}
      </div>
    </ClockContext.Provider>
  );
}
