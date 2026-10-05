// End-to-end over real sockets, with the game clock sped up 25x.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createPulseServer } from '../server/index.js';
import { Room } from '../server/room.js';

const SPEED = 25;
let app, url;

test.before(async () => {
  app = createPulseServer({ port: 0, speed: SPEED, seed: 11 });
  const port = await app.listen();
  url = `http://localhost:${port}`;
});
test.after(() => app.close());

function client() {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  const c = {
    socket, state: null, emotes: [], waiters: [],
    emit: (ev, data) => new Promise((resolve) => socket.emit(ev, data, resolve)),
    send: (ev, data) => socket.emit(ev, data),
    waitFor(pred, ms = 15000) {
      if (c.state && pred(c.state)) return Promise.resolve(c.state);
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        c.waiters.push(w);
        setTimeout(() => { c.waiters = c.waiters.filter((x) => x !== w); reject(new Error(`timeout waiting; phase=${c.state?.phase}`)); }, ms);
      });
    },
    close: () => socket.close(),
  };
  socket.on('state', (s) => {
    c.state = s;
    for (const w of [...c.waiters]) if (w.pred(s)) { c.waiters = c.waiters.filter((x) => x !== w); w.resolve(s); }
  });
  socket.on('emote', (e) => c.emotes.push(e));
  return c;
}

const roomOf = (code) => app.rooms.get(code);

// Answers the live challenge correctly using the server-side secret (a perfect player).
function perfect(c, code) {
  const r = roomOf(code).round;
  const ch = r.ch, s = ch.secret;
  const elapsed = (Date.now() - r.startReal) * SPEED;
  if (ch.type === 'categorySnap') { for (const i of s.targets) c.send('snap', { index: i, elapsed: s.at[i] + 100 }); return; }
  const answer = ch.type === 'memoryFlash' ? { seq: s.seq } : ch.type === 'unscramble' ? { word: s.word } : ch.type === 'closestCall' ? { value: s.answer }
    : ['needle', 'quickDraw'].includes(ch.type) ? {} : { choice: s.correct };
  const t = ch.type === 'quickDraw' ? s.goAt + 120 : ch.type === 'needle' ? s.period * s.center / 2 : Math.max(ch.opensAt, Math.min(elapsed, ch.opensAt + 50));
  // Never claim a moment that has not happened yet: the server refuses answers from the future.
  const wait = Math.max(0, (t - elapsed) / SPEED + 5);
  setTimeout(() => c.send('answer', { answer, elapsed: t }), wait);
}

async function playThrough(clients, code, { answer = () => true } = {}) {
  const host = clients[0];
  const seen = new Set();
  for (;;) {
    const s = await host.waitFor((st) => st.phase === 'results' || (st.phase === 'play' && !seen.has(st.round.index)), 30000);
    if (s.phase === 'results') return s;
    seen.add(s.round.index);
    await new Promise((r) => setTimeout(r, 5));
    clients.forEach((c, i) => { if (answer(i, s.round.index)) perfect(c, code); });
  }
}

test('2-player game: create, join, ready, play a short game to the results', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'Asha', avatar: 3 });
  assert.ok(ra.ok && /^[A-Z]{4}$/.test(ra.code));
  const rb = await b.emit('room:join', { code: ra.code.toLowerCase(), name: 'Ben', avatar: 5 });
  assert.ok(rb.ok);
  await a.waitFor((s) => s.players.length === 2);
  a.send('settings', { length: 'short' });
  let res = await a.emit('start', {});
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not-ready');
  a.send('ready', true); b.send('ready', true);
  await a.waitFor((s) => s.players.every((p) => p.ready));
  res = await a.emit('start', {});
  assert.ok(res.ok);
  const intro = await b.waitFor((s) => s.phase === 'intro');
  assert.equal(intro.round.total, 10);
  assert.equal(intro.round.payload, null, 'challenge content is not revealed during the intro');
  const final = await playThrough([a, b], ra.code, { answer: (i) => i === 0 });
  const asha = final.players.find((p) => p.name === 'Asha');
  const ben = final.players.find((p) => p.name === 'Ben');
  assert.ok(asha.score > ben.score, 'the perfect player wins');
  assert.equal(final.results.order[0].id, asha.id);
  assert.equal(asha.history.filter((x) => x != null).length, 10);
  assert.ok(asha.score > 10 * 150, `perfect play scores well (${asha.score})`);
  a.close(); b.close();
});

test('8 players: bots fill the room, a joining human replaces a bot, everyone plays', async () => {
  const host = client();
  const r = await host.emit('room:create', { name: 'Host' });
  host.send('bot:fill', 8);
  await host.waitFor((s) => s.players.length === 8);
  const st = host.state;
  assert.equal(st.players.filter((p) => p.isBot).length, 7);
  assert.equal(new Set(st.players.map((p) => p.color)).size, 8, 'every seat has its own colour');
  assert.equal(new Set(st.players.map((p) => p.name)).size, 8);
  assert.ok(st.players.filter((p) => p.isBot).every((p) => p.tag && p.persona && p.ready));
  const g = client();
  const rg = await g.emit('room:join', { code: r.code, name: 'Guest' });
  assert.ok(rg.ok && !rg.spectator);
  await host.waitFor((s) => s.players.length === 8 && s.players.filter((p) => p.isBot).length === 6);
  host.send('settings', { length: 'short', botDifficulty: 'hard' });
  host.send('ready', true); g.send('ready', true);
  await host.waitFor((s) => s.canStart?.ok);
  assert.ok((await host.emit('start', {})).ok);
  const final = await playThrough([host, g], r.code);
  assert.equal(final.results.order.length, 8);
  const bots = final.players.filter((p) => p.isBot);
  assert.ok(bots.some((b) => b.score > 0), 'bots score');
  assert.ok(bots.every((b) => b.difficulty === 'hard'));
  host.close(); g.close();
});

test('simultaneous answers: all accepted once, duplicates and late answers refused', async () => {
  const cs = [client(), client(), client(), client()];
  const r = await cs[0].emit('room:create', { name: 'P0' });
  for (let i = 1; i < 4; i++) await cs[i].emit('room:join', { code: r.code, name: `P${i}` });
  cs.forEach((c) => c.send('ready', true));
  await cs[0].waitFor((s) => s.players.length === 4 && s.canStart?.ok);
  await cs[0].emit('start', {});
  await cs[0].waitFor((s) => s.phase === 'play');
  const room = roomOf(r.code);
  cs.forEach((c) => perfect(c, r.code));
  cs.forEach((c) => perfect(c, r.code)); // duplicates
  const s = await cs[0].waitFor((st) => st.phase === 'reveal');
  const res = Object.values(s.round.results);
  assert.equal(res.length, 4);
  if (room.round.type !== 'categorySnap') assert.equal(s.round.locks.length, 4, 'one lock per player');
  assert.ok(res.every((x) => x.correct), JSON.stringify(res));
  assert.equal(Object.values(s.round.results).filter((x) => x.first).length, ['choice'].includes(room.round.ch.kind) || room.round.type === 'quickDraw' ? 1 : 0);
  // An answer after the round closed is ignored.
  cs[1].send('answer', { answer: { choice: 0 }, elapsed: 0 });
  await new Promise((x) => setTimeout(x, 50));
  assert.equal(room.round.answers.size === 0 || room.round.answers.size === 4 || room.round.type === 'categorySnap', true);
  cs[0].send('end');
  await cs[0].waitFor((st) => st.phase === 'results');
  cs.forEach((c) => c.close());
});

test('disconnect mid-game keeps the seat and score; rejoin with token restores it', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'Ana' });
  const rb = await b.emit('room:join', { code: ra.code, name: 'Bo' });
  a.send('ready', true); b.send('ready', true);
  await a.waitFor((s) => s.canStart?.ok);
  a.send('settings', { length: 'short' });
  await a.emit('start', {});
  await a.waitFor((s) => s.phase === 'play');
  perfect(a, ra.code); perfect(b, ra.code);
  await a.waitFor((s) => s.phase === 'ticker');
  const scoreBefore = roomOf(ra.code).players.get(rb.playerId).score;
  b.close();
  const s1 = await a.waitFor((s) => s.players.find((p) => p.id === rb.playerId)?.connected === false);
  assert.ok(s1.players.find((p) => p.id === rb.playerId), 'seat kept');
  // While Bo is away, a round can end early on Ana alone.
  await a.waitFor((s) => s.phase === 'play');
  perfect(a, ra.code);
  await a.waitFor((s) => s.phase === 'reveal');
  const b2 = client();
  const bad = await b2.emit('room:rejoin', { code: ra.code, playerId: rb.playerId, token: 'wrong' });
  assert.equal(bad.ok, false);
  const ok = await b2.emit('room:rejoin', { code: ra.code, playerId: rb.playerId, token: rb.token });
  assert.ok(ok.ok);
  const s2 = await b2.waitFor((s) => s.you?.id === rb.playerId && s.players.find((p) => p.id === rb.playerId).connected);
  assert.ok(s2.players.find((p) => p.id === rb.playerId).score >= scoreBefore);
  a.send('end');
  await b2.waitFor((s) => s.phase === 'results');
  a.close(); b2.close();
});

test('late join: spectator until the set break, then seated level with last place', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'Ari' });
  await b.emit('room:join', { code: ra.code, name: 'Bea' });
  a.send('settings', { length: 'short' });
  a.send('ready', true); b.send('ready', true);
  await a.waitFor((s) => s.canStart?.ok);
  await a.emit('start', {});
  await a.waitFor((s) => s.phase === 'play');
  const late = client();
  const rl = await late.emit('room:join', { code: ra.code, name: 'Late' });
  assert.ok(rl.spectator);
  const spect = await late.waitFor((s) => s.you?.id === rl.playerId);
  assert.ok(spect.players.find((p) => p.id === rl.playerId).spectator);
  const brk = await playUntil([a, b], ra.code, (s) => s.phase === 'setbreak');
  const me = brk.players.find((p) => p.id === rl.playerId);
  assert.equal(me.spectator, false);
  const others = brk.players.filter((p) => p.id !== rl.playerId);
  assert.equal(me.score, Math.min(...others.map((p) => p.score)));
  assert.ok(me.color && !others.some((p) => p.color === me.color));
  a.send('end');
  await a.waitFor((s) => s.phase === 'results');
  [a, b, late].forEach((c) => c.close());
});

async function playUntil(clients, code, stop) {
  const seen = new Set();
  for (;;) {
    const s = await clients[0].waitFor((st) => stop(st) || (st.phase === 'play' && !seen.has(st.round.index)), 30000);
    if (stop(s)) return s;
    seen.add(s.round.index);
    clients.forEach((c) => perfect(c, code));
  }
}

test('host leaves: host role passes to the next human; kicked players are removed', async () => {
  const a = client(), b = client(), c = client();
  const ra = await a.emit('room:create', { name: 'H' });
  const rb = await b.emit('room:join', { code: ra.code, name: 'B' });
  const rc = await c.emit('room:join', { code: ra.code, name: 'C' });
  await a.waitFor((s) => s.players.length === 3);
  let kicked = false;
  c.socket.on('kicked', () => { kicked = true; });
  b.send('kick', rc.playerId); // not host: ignored
  await new Promise((x) => setTimeout(x, 60));
  assert.equal(roomOf(ra.code).players.size, 3);
  a.send('kick', rc.playerId);
  await a.waitFor((s) => s.players.length === 2);
  await new Promise((x) => setTimeout(x, 60));
  assert.ok(kicked);
  a.send('leave');
  const s = await b.waitFor((st) => st.hostId === rb.playerId);
  assert.equal(s.players.length, 1);
  b.close(); a.close(); c.close();
});

test('host disconnect transfers host after the grace period', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'H' });
  const rb = await b.emit('room:join', { code: ra.code, name: 'B' });
  await b.waitFor((s) => s.players.length === 2);
  a.close();
  const s = await b.waitFor((st) => st.hostId === rb.playerId, 5000);
  assert.ok(s);
  b.close();
});

test('start needs two players; host can force-start past unready players; pause holds between rounds', async () => {
  const a = client();
  const ra = await a.emit('room:create', { name: 'Solo' });
  let res = await a.emit('start', { force: true });
  assert.equal(res.reason, 'need-players');
  const b = client();
  await b.emit('room:join', { code: ra.code, name: 'Idle' });
  await a.waitFor((s) => s.players.length === 2);
  a.send('ready', true);
  res = await a.emit('start', { force: true });
  assert.ok(res.ok);
  a.send('pause');
  await a.waitFor((s) => s.phase === 'play');
  perfect(a, ra.code); perfect(b, ra.code);
  const paused = await a.waitFor((s) => s.phase === 'paused', 8000);
  assert.equal(paused.round.index, 0);
  await new Promise((x) => setTimeout(x, 300));
  assert.equal(a.state.phase, 'paused', 'stays paused');
  a.send('resume');
  const next = await a.waitFor((s) => s.phase === 'intro' && s.round.index === 1);
  assert.ok(next);
  a.send('end');
  await a.waitFor((s) => s.phase === 'results');
  a.send('again');
  const lobby = await a.waitFor((s) => s.phase === 'lobby');
  assert.ok(lobby.players.every((p) => p.score === 0));
  a.close(); b.close();
});

test('emotes are broadcast and rate limited; invalid emotes are dropped', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'E' });
  await b.emit('room:join', { code: ra.code, name: 'F' });
  a.send('emote', 'fire'); a.send('emote', 'fire'); a.send('emote', '<script>');
  await new Promise((x) => setTimeout(x, 150));
  assert.equal(b.emotes.length, 1);
  a.close(); b.close();
});

test('unknown room and bad input are rejected cleanly', async () => {
  const a = client();
  assert.equal((await a.emit('room:join', { code: 'ZZZZ', name: 'x' })).reason, 'no-room');
  const r = await a.emit('room:create', { name: 'x'.repeat(100) });
  await a.waitFor((s) => s.players.length === 1);
  assert.ok(a.state.players[0].name.length <= 14);
  a.send('answer', { answer: { choice: 99 }, elapsed: -5 });
  a.send('settings', { length: 'forever', families: { trivia: false, reaction: false, word: false } });
  await new Promise((x) => setTimeout(x, 60));
  const room = roomOf(r.code);
  assert.equal(room.settings.length, 'standard');
  assert.ok(Object.values(room.settings.families).some(Boolean), 'cannot disable every family');
  a.close();
});

test('scoring example from the spec: Double Pulse + streak + first = 532', async () => {
  const room = new Room({ code: 'UNIT', speed: 1000, seed: 1 });
  const you = room.addHuman({ name: 'You' });
  const zip = room.addHuman({ name: 'Zip' });
  you.streak = 2; you.score = 1000; zip.score = 900;
  room.phase = 'play';
  room.roundIndex = 4;
  room.round = { index: 4, total: 15, type: 'colorClash', inSet: 4, double: true, answers: new Map(), snaps: new Map(), locks: [], startReal: Date.now() };
  room.round.ch = { type: 'colorClash', kind: 'choice', ms: 5000, opensAt: 0, payload: { options: [{ key: 'red', label: 'RED' }, { key: 'blue', label: 'BLUE' }] }, secret: { correct: 'red', word: 'blue' }, difficulty: 0.3 };
  room.round.answers.set(you.id, { answer: { choice: 'red' }, elapsed: 600 }); // speed 88
  room.round.answers.set(zip.id, { answer: { choice: 'blue' }, elapsed: 300 });
  room.endPlay();
  const res = room.round.results.results;
  assert.equal(res[you.id].points, 532);
  assert.equal(res[zip.id].points, 0);
  assert.equal(zip.streak, 0);
  room.destroy();
});

test('tie for first goes to sudden-death Quick Draw between the tied players only', async () => {
  const room = new Room({ code: 'TIE', speed: 50, seed: 2 });
  const a = room.addHuman({ name: 'A' }), b = room.addHuman({ name: 'B' }), c = room.addHuman({ name: 'C' });
  room.schedule = ['quickDraw'];
  room.roundIndex = 0;
  for (const p of [a, b]) Object.assign(p, { score: 500, correctCount: 3, correctMsSum: 3000 });
  Object.assign(c, { score: 100, correctCount: 1, correctMsSum: 900 });
  room.finish();
  assert.equal(room.phase, 'tiebreak');
  assert.deepEqual(room.round.tiedIds.sort(), [a.id, b.id].sort());
  await new Promise((r) => { const t = setInterval(() => { if (room.phase === 'play') { clearInterval(t); r(); } }, 2); });
  assert.equal(room.submit(c.id, {}, 0), false, 'non-tied player cannot play the tiebreak');
  const goAt = room.round.ch.secret.goAt;
  await new Promise((r) => setTimeout(r, (goAt + 300) / 50));
  assert.ok(room.submit(b.id, {}, goAt + 250));
  assert.ok(room.submit(a.id, {}, goAt + 400));
  await new Promise((r) => { const t = setInterval(() => { if (room.phase === 'results') { clearInterval(t); r(); } }, 2); });
  assert.equal(room.results.order[0].id, b.id);
  assert.equal(room.results.tiebreakWinner, b.id);
  room.destroy();
});
