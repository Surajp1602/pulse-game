// Bot brains. A bot never reads the screen: it rolls against a skill curve for this persona, difficulty,
// challenge family and item difficulty, then answers through the same submit path as humans, inside the
// same window, never before answers open, never faster than a human can (>= 220 ms reaction) and never
// better than 90% accurate.
import { CHALLENGES, BOT_PERSONAS } from '../shared/config.js';
import { needlePosition } from './challenges.js';

export const MAX_ACCURACY = 0.9;
export const MIN_REACTION_MS = 220;

const SKILL = {
  byte: { trivia: 0.82, reaction: 0.82, word: 0.8, speed: 0.8, foul: 0.02 },
  juno: { trivia: 0.78, reaction: 0.74, word: 0.76, speed: 1.0, foul: 0.01 },
  zip: { trivia: 0.55, reaction: 0.62, word: 0.52, speed: 0.6, foul: 0.15, rush: true },
  mochi: { trivia: 0.82, reaction: 0.7, word: 0.8, speed: 1.45, foul: 0 },
  rook: { trivia: 0.86, reaction: 0.55, word: 0.66, speed: 1.05, foul: 0.02, slow: { reaction: 1.3 } },
  pixel: { trivia: 0.6, reaction: 0.85, word: 0.5, speed: 0.8, foul: 0.05, slow: { word: 1.2 } },
  wren: { trivia: 0.68, reaction: 0.62, word: 0.86, speed: 1.0, foul: 0.02 },
  dash: { trivia: 0.7, reaction: 0.7, word: 0.7, speed: 0.9, foul: 0.04, streaky: true },
};

const DIFF = {
  easy: { acc: -0.2, speed: 1.4 },
  normal: { acc: 0, speed: 1 },
  hard: { acc: 0.1, speed: 0.82 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function skillOf(bot, type) {
  const p = SKILL[bot.persona] || SKILL.juno;
  const d = DIFF[bot.difficulty] || DIFF.normal;
  const fam = CHALLENGES[type].family;
  return { acc: p[fam] + d.acc, speed: p.speed * d.speed * (p.slow?.[fam] || 1), foul: p.foul * (bot.difficulty === 'easy' ? 1.5 : 1), rush: !!p.rush, streaky: !!p.streaky };
}

// Probability this bot gets an item right, given the item's difficulty and its form.
export function accuracy(bot, ch, ctx = {}) {
  const k = skillOf(bot, ch.type);
  let p = k.acc - 0.35 * ((ch.difficulty ?? 0.5) - 0.5);
  if (k.streaky) p += ctx.missedLast ? -0.12 : 0.06 * Math.min(ctx.streak || 0, 3);
  return clamp(p, 0.15, MAX_ACCURACY);
}

// Human-like time to answer a choice challenge, in game ms, from the start of play.
function thinkTime(bot, ch, rng, correct) {
  const k = skillOf(bot, ch.type);
  const p = ch.payload;
  const textLen = JSON.stringify(p).length;
  const base = {
    higherLower: 1500 + textLen * 9, whichFirst: 1800 + textLen * 11, colorClash: 700, dotCount: 1600,
    oddOneOut: 1700 + textLen * 6, missingLetter: 1400, memoryFlash: 4 * 380, unscramble: 1500 + (p.letters?.length || 5) * 420,
  }[ch.type] ?? 1500;
  let t = base * k.speed * Math.exp(rng.normal(0, 0.28));
  if (!correct) t *= k.rush ? 0.75 : 1.15; // rushers are wrong because they were fast; others hesitated
  return clamp(ch.opensAt + Math.max(t, MIN_REACTION_MS + 150), ch.opensAt + MIN_REACTION_MS + 150, ch.ms - 150);
}

const wrongChoice = (ch, rng) => {
  const p = ch.payload, s = ch.secret;
  switch (ch.type) {
    case 'higherLower': case 'whichFirst': return { choice: 1 - s.correct };
    case 'colorClash': // the classic Stroop slip: tapping the word, not the ink
      return { choice: rng.chance(0.7) ? s.word : rng.pick(p.options.filter((o) => o.key !== s.correct)).key };
    case 'dotCount': {
      const near = p.options.filter((o) => o !== s.correct).sort((a, b) => Math.abs(a - s.correct) - Math.abs(b - s.correct));
      return { choice: rng.chance(0.7) ? near[0] : rng.pick(near) };
    }
    case 'oddOneOut': return { choice: rng.pick([0, 1, 2, 3].filter((i) => i !== s.correct)) };
    case 'missingLetter': return { choice: rng.pick(p.options.filter((o) => o !== s.correct)) };
    case 'memoryFlash': {
      const seq = [...s.seq];
      const i = rng.int(0, seq.length - 2);
      if (rng.chance(0.5)) [seq[i], seq[i + 1]] = [seq[i + 1], seq[i]];
      else seq[i] = (seq[i] + rng.int(1, 5)) % 6;
      return { seq };
    }
    case 'unscramble': {
      const letters = rng.shuffle(p.letters);
      return { word: letters.join('') === s.word.toUpperCase() ? [...letters].reverse().join('') : letters.join('') };
    }
    default: return null;
  }
};

const rightChoice = (ch) => {
  const s = ch.secret;
  switch (ch.type) {
    case 'memoryFlash': return { seq: [...s.seq] };
    case 'unscramble': return { word: s.word.toUpperCase() };
    default: return { choice: s.correct };
  }
};

// Returns the bot's actions for one round: [{ at, answer }] or, for Category Snap, [{ at, snap: index }].
export function planBot(bot, ch, rng, ctx = {}) {
  const k = skillOf(bot, ch.type);
  const p = accuracy(bot, ch, ctx);
  switch (ch.type) {
    case 'closestCall': {
      const { answer, min, max } = ch.secret;
      const sd = (1 - p) * 0.2 + 0.015;
      const bias = bot.persona === 'zip' ? 0.04 : 0;
      let v = answer + rng.normal(bias, sd) * (max - min);
      v = clamp(Math.round(v / ch.payload.step) * ch.payload.step, min, max);
      const at = clamp((3200 + rng.float(0, 3000)) * k.speed, 1500, ch.ms - 200);
      return [{ at, answer: { value: +v.toFixed(2) } }];
    }
    case 'needle': {
      const { period, center } = ch.secret;
      const ready = 900 * k.speed + rng.float(0, 600);
      const crossings = [];
      for (let n = 0; n < 6; n++) crossings.push(period * (center / 2) + n * period, period * (1 - center / 2) + n * period);
      const target = crossings.sort((a, b) => a - b).find((t) => t > ready) ?? crossings[0];
      const sigma = 35 + (1 - p) * 260;
      const at = clamp(target + rng.normal(0, sigma), MIN_REACTION_MS, ch.ms - 100);
      return [{ at, answer: {}, pos: needlePosition(ch.secret, at) }];
    }
    case 'quickDraw': {
      const { goAt } = ch.secret;
      if (rng.chance(k.foul)) return [{ at: goAt - rng.float(60, 450), answer: {} }];
      const rt = Math.max(MIN_REACTION_MS, (210 + 140 * k.speed * Math.exp(rng.normal(0, 0.3))) + (1 - p) * 120);
      return [{ at: Math.min(goAt + rt, ch.ms - 50), answer: {} }];
    }
    case 'categorySnap': {
      const { targets, at: times } = ch.secret;
      const actions = [];
      times.forEach((t0, i) => {
        const isHit = targets.includes(i);
        const tap = isHit ? rng.chance(p) : rng.chance((1 - p) * (k.rush ? 0.45 : 0.22));
        if (tap) actions.push({ at: t0 + clamp((380 + rng.float(0, 520)) * k.speed, MIN_REACTION_MS, ch.secret.visibleMs - 100), snap: i });
      });
      return actions;
    }
    default: {
      if (rng.chance(0.03)) return []; // occasionally freezes, like people do
      const correct = rng.chance(p);
      return [{ at: thinkTime(bot, ch, rng, correct), answer: correct ? rightChoice(ch) : wrongChoice(ch, rng) }];
    }
  }
}

export function personaById(id) { return BOT_PERSONAS.find((b) => b.id === id); }
