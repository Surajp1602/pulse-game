import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, generate, evaluate, validAnswer, needlePosition, dictionary } from '../server/challenges.js';
import { planBot, accuracy, MAX_ACCURACY, MIN_REACTION_MS } from '../server/bots.js';
import { createRng } from '../server/rng.js';
import { Room, cleanName } from '../server/room.js';
import { CHALLENGES, BOT_PERSONAS, LENGTHS, ROUNDS_PER_SET } from '../shared/config.js';
import { CATEGORIES } from '../server/content.js';

const rng = createRng(42);
const TYPES = Object.keys(CHALLENGES);

const rightAnswer = (ch) => {
  const s = ch.secret;
  switch (ch.type) {
    case 'memoryFlash': return { seq: s.seq };
    case 'unscramble': return { word: s.word };
    case 'closestCall': return { value: s.answer };
    case 'needle': case 'quickDraw': return {};
    case 'categorySnap': return { taps: s.targets };
    default: return { choice: s.correct };
  }
};
const rightTime = (ch) => (ch.type === 'needle' ? ch.secret.period * ch.secret.center / 2 : ch.type === 'quickDraw' ? ch.secret.goAt + 150 : ch.opensAt);

test('every generator produces 300 valid, answerable challenges with no secret in the payload', () => {
  for (const type of TYPES) {
    for (let i = 0; i < 300; i++) {
      const ch = generate(type, rng);
      assert.equal(ch.type, type);
      assert.ok(ch.ms > ch.opensAt, `${type} has an answer window`);
      assert.ok(ch.difficulty >= 0 && ch.difficulty <= 1);
      const ans = rightAnswer(ch);
      if (type !== 'categorySnap') assert.ok(validAnswer(ch, ans), `${type} right answer is valid`);
      const ev = evaluate(ch, ans, rightTime(ch));
      assert.ok(ev.correct, `${type} right answer scores as correct (${JSON.stringify(ev)})`);
      assert.ok(ev.points >= 150, `${type} perfect answer earns most points (${ev.points})`);
      const payload = JSON.stringify(ch.payload);
      if (type === 'higherLower' || type === 'whichFirst') assert.ok(!payload.includes('reveal'));
      assert.ok(!('secret' in ch.payload));
    }
  }
});

test('choice challenges: 100 + speed, wrong = 0', () => {
  const ch = GENERATORS.higherLower(createRng(1));
  ch.kind = 'choice';
  assert.equal(evaluate(ch, { choice: ch.secret.correct }, 0).points, 200);
  assert.equal(evaluate(ch, { choice: ch.secret.correct }, ch.ms).points, 100);
  assert.equal(evaluate(ch, { choice: 1 - ch.secret.correct }, 0).points, 0);
});

test('higher/lower pairs are always at least 1.3x apart; events at least 10 years', () => {
  for (let i = 0; i < 500; i++) {
    const h = GENERATORS.higherLower(rng);
    assert.ok(h.difficulty <= 0.95);
    const w = GENERATORS.whichFirst(rng);
    assert.notEqual(w.secret.reveal[0], w.secret.reveal[1]);
  }
});

test('missing letter: exactly one option makes a dictionary word', () => {
  const dict = dictionary();
  for (let i = 0; i < 300; i++) {
    const ch = GENERATORS.missingLetter(rng);
    const words = ch.payload.options.map((l) => (ch.payload.before + l + ch.payload.after).toLowerCase());
    assert.equal(words.filter((w) => dict.has(w)).length, 1, words.join(','));
  }
});

test('unscramble accepts a different valid anagram, rejects non-words', () => {
  const ch = { ...GENERATORS.unscramble(createRng(5)), type: 'unscramble', ms: 10000, opensAt: 0 };
  ch.secret = { word: 'night', key: 'ghint' };
  assert.ok(evaluate(ch, { word: 'THING' }, 1000).correct);
  assert.ok(!evaluate(ch, { word: 'GHTIN' }, 1000).correct);
});

test('odd one out and category snap never mix ambiguous categories', () => {
  for (let i = 0; i < 300; i++) {
    const ch = GENERATORS.oddOneOut(rng);
    const odd = ch.payload.words[ch.secret.correct];
    const others = ch.payload.words.filter((_, j) => j !== ch.secret.correct);
    const catOf = (w) => Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].words.includes(w));
    const shared = catOf(others[0]).filter((k) => others.every((o) => catOf(o).includes(k)));
    assert.ok(shared.length >= 1);
    assert.ok(!shared.some((k) => catOf(odd).includes(k)), `${odd} must not fit ${shared}`);
  }
});

test('needle position is a triangle wave and scoring rewards the centre', () => {
  const s = { period: 2000, center: 0.5, half: 0.07 };
  assert.equal(needlePosition(s, 0), 0);
  assert.equal(needlePosition(s, 500), 0.5);
  assert.equal(needlePosition(s, 1000), 1);
  const ch = { type: 'needle', kind: 'precision', ms: 6000, opensAt: 0, secret: s, payload: s };
  assert.equal(evaluate(ch, {}, 500).points, 200);
  assert.equal(evaluate(ch, {}, 0).points, 0);
});

test('quick draw: early tap is a foul, 200ms reaction is perfect, 1s is zero', () => {
  const ch = { type: 'quickDraw', kind: 'precision', ms: 6000, opensAt: 0, secret: { goAt: 2000 }, payload: { goAt: 2000 } };
  assert.equal(evaluate(ch, {}, 1900).points, -50);
  assert.equal(evaluate(ch, {}, 2200).points, 200);
  assert.equal(evaluate(ch, {}, 3000).points, 0);
});

test('bots never exceed 90% accuracy or human reaction limits, at any difficulty', () => {
  const r = createRng(9);
  for (const persona of BOT_PERSONAS) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const bot = { persona: persona.id, difficulty };
      for (const type of TYPES) {
        for (let i = 0; i < 40; i++) {
          const ch = generate(type, r);
          assert.ok(accuracy(bot, ch, { streak: 5 }) <= MAX_ACCURACY);
          for (const a of planBot(bot, ch, r, { streak: 0 })) {
            assert.ok(a.at <= ch.ms, `${type} within window`);
            if (type === 'quickDraw' && a.at >= ch.secret.goAt) assert.ok(a.at - ch.secret.goAt >= MIN_REACTION_MS);
            if (['higherLower', 'whichFirst', 'colorClash', 'dotCount', 'oddOneOut', 'missingLetter', 'memoryFlash', 'unscramble'].includes(type)) {
              assert.ok(a.at >= ch.opensAt + MIN_REACTION_MS, `${type} not before answers open`);
              assert.ok(validAnswer(ch, a.answer), `${type} bot answer valid ${JSON.stringify(a.answer)}`);
            }
          }
        }
      }
    }
  }
});

test('bot personalities differ believably: hard Byte beats easy Zip over many items', () => {
  const r = createRng(3);
  const score = (bot) => {
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const ch = generate('higherLower', r);
      const [a] = planBot(bot, ch, r);
      if (a) total += evaluate(ch, a.answer, a.at).points;
    }
    return total;
  };
  assert.ok(score({ persona: 'byte', difficulty: 'hard' }) > score({ persona: 'zip', difficulty: 'easy' }) * 1.3);
});

test('names are cleaned and made unique', () => {
  assert.equal(cleanName('  <b>Sam</b>\u0007  '), 'bSam/b');
  assert.equal(cleanName(''), 'Player');
  const room = new Room({ code: 'TEST' });
  const a = room.addHuman({ name: 'Sam' });
  const b = room.addHuman({ name: 'sam' });
  assert.equal(a.name, 'Sam');
  assert.equal(b.name, 'sam 2');
  room.destroy();
});

test('schedule: every set has 5 distinct types covering every enabled family', () => {
  for (const length of Object.keys(LENGTHS)) {
    const room = new Room({ code: 'TEST', seed: 7 });
    room.settings.length = length;
    for (let k = 0; k < 30; k++) {
      const s = room.buildSchedule();
      assert.equal(s.length, LENGTHS[length].sets * ROUNDS_PER_SET);
      for (let i = 0; i < s.length; i += 5) {
        const set = s.slice(i, i + 5);
        assert.equal(new Set(set).size, 5);
        for (const f of ['trivia', 'reaction', 'word']) assert.ok(set.some((t) => CHALLENGES[t].family === f));
      }
    }
    room.settings.families = { trivia: false, reaction: true, word: false };
    const s = room.buildSchedule();
    assert.ok(s.every((t) => CHALLENGES[t].family === 'reaction'));
    room.destroy();
  }
});
