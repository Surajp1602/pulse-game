// Challenge generators and scorers. Every generator returns:
//   { type, ms, opensAt, payload (sent to clients), secret (server only), difficulty 0..1 }
// All times are game milliseconds from the moment play starts.
import { createRequire } from 'node:module';
import { CHALLENGES, SCORING } from '../shared/config.js';
import {
  MAGNITUDES, EVENTS, ESTIMATES, CATEGORIES, INCOMPATIBLE, UNSCRAMBLE_WORDS, MISSING_WORDS, CLASH_COLOURS, MEMORY_SYMBOLS,
} from './content.js';

const require = createRequire(import.meta.url);
let DICT = null;
export const dictionary = () => (DICT ||= new Set(require('an-array-of-english-words')));
const sortLetters = (w) => w.toLowerCase().split('').sort().join('');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const compatible = (a, b) => a !== b && !INCOMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const yearLabel = (y) => (y < 0 ? `${-y} BCE` : String(y));
const fmt = (n) => (n >= 1000 ? n.toLocaleString('en-US') : String(n));

const make = (type, rest) => ({ type, ms: CHALLENGES[type].ms, opensAt: 0, ...rest });

export const GENERATORS = {
  higherLower(rng) {
    for (;;) {
      const group = rng.pick(MAGNITUDES);
      const [a, b] = rng.sample(group.items, 2);
      const ratio = Math.max(a[1], b[1]) / Math.min(a[1], b[1]);
      if (ratio < 1.3) continue;
      return make('higherLower', {
        payload: { prompt: group.prompt, options: [a[0], b[0]] },
        secret: { correct: a[1] > b[1] ? 0 : 1, reveal: [`${fmt(a[1])} ${group.unit}`, `${fmt(b[1])} ${group.unit}`] },
        difficulty: clamp(1 - Math.log(ratio) / Math.log(8), 0.05, 0.95),
      });
    }
  },

  whichFirst(rng) {
    for (;;) {
      const [a, b] = rng.sample(EVENTS, 2);
      const gap = Math.abs(a[1] - b[1]);
      if (gap < 10) continue;
      return make('whichFirst', {
        payload: { prompt: 'Which happened first?', options: [a[0], b[0]] },
        secret: { correct: a[1] < b[1] ? 0 : 1, reveal: [yearLabel(a[1]), yearLabel(b[1])] },
        difficulty: clamp(1 - Math.log(gap / 10) / Math.log(100), 0.05, 0.95),
      });
    }
  },

  closestCall(rng) {
    const e = rng.pick(ESTIMATES);
    const mid = e.min + Math.round((e.max - e.min) / 2 / e.step) * e.step;
    return make('closestCall', {
      payload: { prompt: e.q, min: e.min, max: e.max, step: e.step, start: +mid.toFixed(2) },
      secret: { answer: e.a, min: e.min, max: e.max },
      difficulty: 0.5,
    });
  },

  colorClash(rng) {
    const [word, ink] = rng.sample(CLASH_COLOURS, 2);
    return make('colorClash', {
      payload: { word: word.label, ink: ink.hex, options: rng.shuffle(CLASH_COLOURS).map((c) => ({ key: c.key, label: c.label })) },
      secret: { correct: ink.key, word: word.key },
      difficulty: 0.3,
    });
  },

  needle(rng) {
    const period = Math.round(rng.float(1700, 2300));
    const center = +rng.float(0.22, 0.78).toFixed(3);
    const half = +rng.float(0.06, 0.085).toFixed(3);
    return make('needle', { payload: { period, center, half }, secret: { period, center, half }, difficulty: 0.5 });
  },

  dotCount(rng) {
    const n = rng.int(9, 17);
    const dots = [];
    for (let tries = 0; dots.length < n && tries < 5000; tries++) {
      const r = rng.float(0.035, 0.06);
      const x = rng.float(r + 0.02, 1 - r - 0.02), y = rng.float(r + 0.02, 1 - r - 0.02);
      if (dots.every(([dx, dy, dr]) => Math.hypot(dx - x, dy - y) > dr + r + 0.025)) dots.push([+x.toFixed(3), +y.toFixed(3), +r.toFixed(3)]);
    }
    const count = dots.length;
    const near = rng.sample([-2, -1, 1, 2].map((d) => count + d), 3);
    return make('dotCount', {
      payload: { dots, showMs: 1400, options: [count, ...near].sort((a, b) => a - b) },
      secret: { correct: count },
      difficulty: clamp((count - 8) / 10, 0.1, 0.9),
    });
  },

  quickDraw(rng) {
    const goAt = Math.round(rng.float(1500, 3800));
    return make('quickDraw', { payload: { goAt }, secret: { goAt }, difficulty: 0.5 });
  },

  memoryFlash(rng) {
    const seq = [];
    while (seq.length < 4) { const s = rng.int(0, MEMORY_SYMBOLS.length - 1); if (s !== seq.at(-1)) seq.push(s); }
    const stepMs = 600;
    return make('memoryFlash', {
      opensAt: seq.length * stepMs + 300,
      payload: { seq, stepMs, symbols: MEMORY_SYMBOLS },
      secret: { seq },
      difficulty: 0.5,
    });
  },

  unscramble(rng) {
    const word = rng.pick(UNSCRAMBLE_WORDS);
    let letters;
    do letters = rng.shuffle(word.toUpperCase().split('')); while (letters.join('') === word.toUpperCase());
    return make('unscramble', {
      payload: { letters },
      secret: { word, key: sortLetters(word) },
      difficulty: word.length >= 6 ? 0.6 : 0.4,
    });
  },

  oddOneOut(rng) {
    const keys = Object.keys(CATEGORIES);
    for (;;) {
      const [a, b] = rng.sample(keys, 2);
      if (!compatible(a, b)) continue;
      const words = rng.sample(CATEGORIES[a].words, 3);
      const odd = rng.pick(CATEGORIES[b].words);
      const all = rng.shuffle([...words, odd]);
      return make('oddOneOut', {
        payload: { words: all },
        secret: { correct: all.indexOf(odd), why: `The others are each ${CATEGORIES[a].label}.` },
        difficulty: 0.4,
      });
    }
  },

  missingLetter(rng) {
    const dict = dictionary();
    for (;;) {
      const word = rng.pick(MISSING_WORDS).toLowerCase();
      const pos = rng.int(1, word.length - 2);
      const letter = word[pos];
      const pool = 'abcdefghijklmnoprstuvwy'.split('').filter((l) => l !== letter && !dict.has(word.slice(0, pos) + l + word.slice(pos + 1)));
      if (pool.length < 3) continue;
      const options = [letter, ...rng.sample(pool, 3)].map((l) => l.toUpperCase()).sort();
      return make('missingLetter', {
        payload: { before: word.slice(0, pos).toUpperCase(), after: word.slice(pos + 1).toUpperCase(), options },
        secret: { correct: letter.toUpperCase(), word: word.toUpperCase() },
        difficulty: 0.45,
      });
    }
  },

  categorySnap(rng) {
    const keys = Object.keys(CATEGORIES);
    const target = rng.pick(keys);
    const others = keys.filter((k) => compatible(k, target));
    const hits = rng.sample(CATEGORIES[target].words, 4);
    const decoyPool = others.flatMap((k) => CATEGORIES[k].words);
    const decoys = rng.sample(decoyPool, 6);
    const order = rng.shuffle([...hits.map((t) => ({ text: t, hit: true })), ...decoys.map((t) => ({ text: t, hit: false }))]);
    const visibleMs = 1600;
    return make('categorySnap', {
      payload: { label: CATEGORIES[target].label, visibleMs, words: order.map((w, i) => ({ text: w.text, at: 500 + i * 750 })) },
      secret: { targets: order.map((w, i) => (w.hit ? i : -1)).filter((i) => i >= 0), visibleMs, at: order.map((_, i) => 500 + i * 750) },
      difficulty: 0.5,
    });
  },
};

export function generate(type, rng) {
  const ch = GENERATORS[type](rng);
  ch.kind = CHALLENGES[type].kind;
  return ch;
}

export function needlePosition({ period }, t) {
  const phase = ((t % period) + period) % period / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

// Speed points for a correct 'choice' answer: full 100 at the instant answers open, 0 at the buzzer.
const speedPoints = (ch, elapsed) => Math.round(SCORING.speedMax * clamp(1 - (elapsed - ch.opensAt) / (ch.ms - ch.opensAt), 0, 1));

// Returns { correct, points, foul?, summary } where points are base points before multipliers.
export function evaluate(ch, answer, elapsed) {
  const s = ch.secret;
  const choice = (ok, summary) => ({ correct: ok, points: ok ? SCORING.base + speedPoints(ch, elapsed) : 0, summary });
  switch (ch.type) {
    case 'higherLower':
    case 'whichFirst':
      return choice(answer?.choice === s.correct, ch.payload.options[answer?.choice] ?? '—');
    case 'colorClash':
      return choice(answer?.choice === s.correct, ch.payload.options.find((o) => o.key === answer?.choice)?.label ?? '—');
    case 'dotCount':
      return choice(answer?.choice === s.correct, String(answer?.choice ?? '—'));
    case 'oddOneOut':
      return choice(answer?.choice === s.correct, ch.payload.words[answer?.choice] ?? '—');
    case 'missingLetter':
      return choice(answer?.choice === s.correct, String(answer?.choice ?? '—'));
    case 'memoryFlash': {
      const seq = Array.isArray(answer?.seq) ? answer.seq : [];
      return choice(seq.length === s.seq.length && seq.every((v, i) => v === s.seq[i]), `${seq.filter((v, i) => v === s.seq[i]).length}/${s.seq.length}`);
    }
    case 'unscramble': {
      const w = String(answer?.word || '').toLowerCase();
      const ok = w === s.word || (sortLetters(w) === s.key && dictionary().has(w));
      return choice(ok, w.toUpperCase() || '—');
    }
    case 'closestCall': {
      const v = Number(answer?.value);
      if (!Number.isFinite(v)) return { correct: false, points: 0, summary: '—' };
      const e = Math.abs(v - s.answer) / (s.max - s.min);
      const points = Math.round(SCORING.precisionMax * clamp(1 - e / 0.25, 0, 1));
      return { correct: points >= 100, points, summary: fmt(v), error: Math.abs(v - s.answer) };
    }
    case 'needle': {
      const pos = needlePosition(s, elapsed);
      const d = Math.abs(pos - s.center);
      const points = d <= s.half
        ? Math.round(SCORING.precisionMax - 80 * (d / s.half))
        : Math.round(120 * clamp(1 - (d - s.half) / s.half, 0, 1));
      return { correct: points >= 100, points, summary: d <= s.half ? 'In the zone' : 'Outside', pos: +pos.toFixed(3) };
    }
    case 'quickDraw': {
      const rt = elapsed - s.goAt;
      if (rt < 0) return { correct: false, points: SCORING.falseStart, foul: true, summary: 'False start' };
      const points = rt <= 200 ? SCORING.precisionMax : Math.round(SCORING.precisionMax * clamp((1000 - rt) / 800, 0, 1));
      return { correct: points >= 100, points, summary: `${Math.round(rt)} ms`, rt };
    }
    case 'categorySnap': {
      const taps = Array.isArray(answer?.taps) ? answer.taps : [];
      const hits = taps.filter((i) => s.targets.includes(i)).length;
      const misses = taps.length - hits;
      const points = Math.max(SCORING.falseStart, hits * SCORING.snapHit + misses * SCORING.snapMiss);
      return { correct: points >= 100, points, summary: `${hits}/${s.targets.length} hits${misses ? `, ${misses} miss${misses > 1 ? 'es' : ''}` : ''}`, hits, misses };
    }
    default:
      return { correct: false, points: 0, summary: '—' };
  }
}

// What everyone sees at the reveal.
export function revealOf(ch) {
  const s = ch.secret;
  switch (ch.type) {
    case 'higherLower': case 'whichFirst':
      return { correct: s.correct, label: ch.payload.options[s.correct], values: s.reveal };
    case 'colorClash': return { correct: s.correct, label: ch.payload.options.find((o) => o.key === s.correct).label };
    case 'dotCount': return { correct: s.correct, label: `${s.correct} dots` };
    case 'oddOneOut': return { correct: s.correct, label: ch.payload.words[s.correct], why: s.why };
    case 'missingLetter': return { correct: s.correct, label: s.word };
    case 'memoryFlash': return { correct: s.seq, label: 'The sequence' };
    case 'unscramble': return { correct: s.word.toUpperCase(), label: s.word.toUpperCase() };
    case 'closestCall': return { correct: s.answer, label: fmt(s.answer) };
    case 'needle': return { correct: s.center, half: s.half, label: 'Dead centre' };
    case 'quickDraw': return { correct: s.goAt, label: 'Fastest clean tap' };
    case 'categorySnap': return { correct: s.targets, label: `${s.targets.length} fitted` };
    default: return {};
  }
}

// Validates the shape of an answer before it is stored (never trust the client).
export function validAnswer(ch, a) {
  if (a == null || typeof a !== 'object') return ch.type === 'needle' || ch.type === 'quickDraw';
  switch (ch.type) {
    case 'higherLower': case 'whichFirst': return a.choice === 0 || a.choice === 1;
    case 'colorClash': return ch.payload.options.some((o) => o.key === a.choice);
    case 'dotCount': return ch.payload.options.includes(a.choice);
    case 'oddOneOut': return Number.isInteger(a.choice) && a.choice >= 0 && a.choice < 4;
    case 'missingLetter': return ch.payload.options.includes(a.choice);
    case 'memoryFlash': return Array.isArray(a.seq) && a.seq.length <= 8 && a.seq.every((v) => Number.isInteger(v) && v >= 0 && v < 6);
    case 'unscramble': return typeof a.word === 'string' && a.word.length <= 12;
    case 'closestCall': return Number.isFinite(Number(a.value)) && a.value >= ch.payload.min && a.value <= ch.payload.max;
    case 'needle': case 'quickDraw': return true;
    default: return false;
  }
}
