// One room: lobby, ready system, the game loop, scoring, bots, presence and host controls.
// The server is authoritative: clients send intents, the room validates them and broadcasts state.
import { randomUUID } from 'node:crypto';
import {
  MAX_PLAYERS, MIN_PLAYERS, ROUNDS_PER_SET, LENGTHS, PHASE_MS, CHALLENGES, FAMILIES, SCORING, PLAYER_COLORS,
  AVATAR_COUNT, BOT_PERSONAS, DIFFICULTIES, EMOTES, RECONNECT_HOST_MS, EMPTY_ROOM_MS,
} from '../shared/config.js';
import { generate, evaluate, revealOf, validAnswer } from './challenges.js';
import { planBot } from './bots.js';
import { createRng } from './rng.js';

const PLAY_GRACE_MS = 350; // real ms after the buzzer during which in-flight answers still count
const EARLY_END_MS = 450; // when everyone has locked, hold a beat so the last spike lands

export function cleanName(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return s || 'Player';
}

export class Room {
  constructor({ code, speed = 1, seed, onChange = () => {}, onEvent = () => {}, onEmpty = () => {} }) {
    this.code = code;
    this.speed = speed;
    this.rng = createRng(seed);
    this.onChange = onChange;
    this.onEvent = onEvent; // transient events: emotes, kicks
    this.onEmpty = onEmpty;
    this.players = new Map();
    this.order = 0;
    this.hostId = null;
    this.settings = { length: 'standard', families: { trivia: true, reaction: true, word: true }, botDifficulty: 'normal' };
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.phaseMs = 0;
    this.timers = new Set();
    this.roundTimers = new Set();
    this.pauseRequested = false;
    this.schedule = [];
    this.roundIndex = -1;
    this.round = null;
    this.results = null;
    this.usedContent = new Set();
    this.emoteAt = new Map();
    this.hostTimer = null;
    this.emptyTimer = null;
    this.createdAt = Date.now();
    this.dirty = false;
  }

  // ---------- plumbing ----------
  changed() {
    if (this.dirty) return;
    this.dirty = true;
    queueMicrotask(() => { this.dirty = false; this.onChange(this); });
  }
  after(ms, fn, set = this.timers) {
    const t = setTimeout(() => { set.delete(t); fn(); }, ms / this.speed);
    set.add(t);
    return t;
  }
  clearTimers(set = this.timers) { for (const t of set) clearTimeout(t); set.clear(); }
  destroy() { this.clearTimers(); this.clearTimers(this.roundTimers); clearTimeout(this.hostTimer); clearTimeout(this.emptyTimer); }
  setPhase(phase, ms, next) {
    this.clearTimers();
    this.phase = phase;
    this.phaseMs = ms ? ms / this.speed : 0;
    this.phaseEndsAt = ms ? Date.now() + this.phaseMs : 0;
    if (ms && next) this.after(ms, next);
    this.changed();
  }

  get seated() { return [...this.players.values()].filter((p) => !p.spectator); }
  get humans() { return [...this.players.values()].filter((p) => !p.isBot); }
  get inGame() { return !['lobby', 'results'].includes(this.phase); }

  freeColor() {
    const used = new Set(this.seated.map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }
  uniqueName(name, exceptId) {
    const taken = new Set([...this.players.values()].filter((p) => p.id !== exceptId).map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) { const n = `${name.slice(0, 12)} ${i}`; if (!taken.has(n.toLowerCase())) return n; }
  }
  basePlayer(extra) {
    return {
      id: randomUUID().slice(0, 8), joinedAt: this.order++, ready: false, connected: true, spectator: false,
      score: 0, streak: 0, maxStreak: 0, correctCount: 0, correctMsSum: 0, firsts: 0, missedLast: false,
      history: [], rank: 1, prevRank: 1, lowestRank: 1, sockets: new Set(), disconnectedAt: 0, ...extra,
    };
  }

  // ---------- lobby ----------
  addHuman({ name, avatar }) {
    const seatedCount = this.seated.length;
    let spectator = this.inGame && this.phase !== 'results';
    if (!spectator && seatedCount >= MAX_PLAYERS) {
      const bot = this.seated.filter((p) => p.isBot).sort((a, b) => b.joinedAt - a.joinedAt)[0];
      if (bot && this.phase === 'lobby') this.players.delete(bot.id);
      else spectator = true;
    }
    if (this.phase === 'results' && this.seated.length >= MAX_PLAYERS) spectator = true;
    const p = this.basePlayer({
      token: randomUUID(), isBot: false, name: this.uniqueName(cleanName(name)),
      avatar: Number.isInteger(avatar) && avatar >= 0 && avatar < AVATAR_COUNT ? avatar : this.rng.int(0, AVATAR_COUNT - 1),
      spectator, color: spectator ? null : this.freeColor(),
    });
    this.players.set(p.id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = p.id;
    this.changed();
    return p;
  }

  updateProfile(id, { name, avatar }) {
    const p = this.players.get(id);
    if (!p || p.isBot) return;
    if (name != null) p.name = this.uniqueName(cleanName(name), id);
    if (Number.isInteger(avatar) && avatar >= 0 && avatar < AVATAR_COUNT) p.avatar = avatar;
    this.changed();
  }

  addBot(byId, { persona, difficulty } = {}) {
    if (!this.isHost(byId) || this.phase !== 'lobby' || this.seated.length >= MAX_PLAYERS) return null;
    const usedPersonas = new Set([...this.players.values()].filter((p) => p.isBot).map((p) => p.persona));
    const def = BOT_PERSONAS.find((b) => b.id === persona && !usedPersonas.has(b.id)) || BOT_PERSONAS.find((b) => !usedPersonas.has(b.id));
    if (!def) return null;
    const p = this.basePlayer({
      isBot: true, persona: def.id, tag: def.tag, name: this.uniqueName(def.name), avatar: def.avatar, ready: true,
      difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : this.settings.botDifficulty === 'mixed' ? this.rng.pick(DIFFICULTIES) : this.settings.botDifficulty,
      color: this.freeColor(),
    });
    this.players.set(p.id, p);
    this.changed();
    return p;
  }

  fillBots(byId, target = 4) {
    const added = [];
    while (this.seated.length < Math.min(target, MAX_PLAYERS)) { const b = this.addBot(byId); if (!b) break; added.push(b); }
    return added;
  }

  setBotDifficulty(byId, botId, difficulty) {
    const b = this.players.get(botId);
    if (!this.isHost(byId) || !b?.isBot || !DIFFICULTIES.includes(difficulty)) return;
    b.difficulty = difficulty;
    this.changed();
  }

  kick(byId, targetId) {
    const t = this.players.get(targetId);
    if (!this.isHost(byId) || !t || targetId === byId) return false;
    if (t.isBot && this.inGame) return false;
    this.players.delete(targetId);
    if (!t.isBot) this.onEvent('kicked', { playerId: targetId, sockets: [...t.sockets] });
    this.checkEarlyEnd();
    this.changed();
    return true;
  }

  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'lobby' || p.spectator) this.players.delete(id);
    else { p.connected = false; p.left = true; p.disconnectedAt = Date.now(); }
    if (this.hostId === id) this.transferHost();
    this.checkEarlyEnd();
    this.checkEmpty();
    this.changed();
  }

  setReady(id, ready) {
    const p = this.players.get(id);
    if (!p || p.isBot || this.phase !== 'lobby') return;
    p.ready = !!ready;
    this.changed();
  }

  setSettings(byId, s = {}) {
    if (!this.isHost(byId) || this.phase !== 'lobby') return;
    if (LENGTHS[s.length]) this.settings.length = s.length;
    if (s.families && typeof s.families === 'object') {
      const f = { ...this.settings.families };
      for (const k of Object.keys(FAMILIES)) if (typeof s.families[k] === 'boolean') f[k] = s.families[k];
      if (Object.values(f).some(Boolean)) this.settings.families = f;
    }
    if ([...DIFFICULTIES, 'mixed'].includes(s.botDifficulty)) {
      this.settings.botDifficulty = s.botDifficulty;
      for (const b of this.players.values()) if (b.isBot) b.difficulty = s.botDifficulty === 'mixed' ? this.rng.pick(DIFFICULTIES) : s.botDifficulty;
    }
    this.changed();
  }

  isHost(id) { return id && id === this.hostId; }

  canStart(force = false) {
    const seated = this.seated;
    if (seated.length < MIN_PLAYERS) return { ok: false, reason: 'need-players' };
    // Pressing Start is the host's ready; everyone else must be ready (or the host forces it).
    const unready = seated.filter((p) => !p.isBot && p.connected && !p.ready && p.id !== this.hostId);
    if (unready.length && !force) return { ok: false, reason: 'not-ready', unready: unready.map((p) => p.id) };
    return { ok: true };
  }

  // ---------- presence ----------
  connect(id, socketId) {
    const p = this.players.get(id);
    if (!p) return null;
    p.sockets.add(socketId);
    const wasAway = !p.connected;
    p.connected = true;
    p.left = false;
    p.disconnectedAt = 0;
    clearTimeout(this.emptyTimer); this.emptyTimer = null;
    if (this.hostId === id) { clearTimeout(this.hostTimer); this.hostTimer = null; }
    if (!this.players.has(this.hostId)) this.hostId = id;
    if (wasAway) this.changed();
    return p;
  }

  disconnect(id, socketId) {
    const p = this.players.get(id);
    if (!p) return;
    p.sockets.delete(socketId);
    if (p.sockets.size) return;
    if (this.phase === 'lobby' && !p.isBot) {
      // In the lobby a seat is still held while someone reconnects (a page reload), but they are not ready.
      p.ready = false;
    }
    p.connected = false;
    p.disconnectedAt = Date.now();
    if (this.hostId === id) {
      clearTimeout(this.hostTimer);
      this.hostTimer = setTimeout(() => { if (!this.players.get(id)?.connected) this.transferHost(); }, RECONNECT_HOST_MS / this.speed);
      this.hostTimer.unref?.();
    }
    this.checkEarlyEnd();
    this.checkEmpty();
    this.changed();
  }

  transferHost() {
    const next = this.humans.filter((p) => p.connected && p.id !== this.hostId).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) { this.hostId = next.id; this.changed(); }
  }

  checkEmpty() {
    if (this.humans.some((p) => p.connected)) return;
    clearTimeout(this.emptyTimer);
    this.emptyTimer = setTimeout(() => { if (!this.humans.some((p) => p.connected)) { this.destroy(); this.onEmpty(this); } }, EMPTY_ROOM_MS / this.speed);
    this.emptyTimer.unref?.();
  }

  emote(id, emoji) {
    const p = this.players.get(id);
    if (!p || !EMOTES.includes(emoji)) return;
    const last = this.emoteAt.get(id) || 0;
    if (Date.now() - last < 700) return;
    this.emoteAt.set(id, Date.now());
    this.onEvent('emote', { id, emoji });
  }

  // ---------- game flow ----------
  start(byId, force = false) {
    if (!this.isHost(byId) || this.phase !== 'lobby') return { ok: false, reason: 'not-allowed' };
    const can = this.canStart(force);
    if (!can.ok) return can;
    this.schedule = this.buildSchedule();
    this.roundIndex = -1;
    this.results = null;
    this.usedContent.clear();
    for (const p of this.players.values()) {
      Object.assign(p, { score: 0, streak: 0, maxStreak: 0, correctCount: 0, correctMsSum: 0, firsts: 0, missedLast: false, history: [], rank: 1, prevRank: 1, lowestRank: 1, ready: false });
    }
    this.nextRound();
    return { ok: true };
  }

  buildSchedule() {
    const sets = LENGTHS[this.settings.length].sets;
    const fams = Object.keys(FAMILIES).filter((f) => this.settings.families[f]);
    const types = Object.keys(CHALLENGES).filter((t) => fams.includes(CHALLENGES[t].family));
    const used = Object.fromEntries(types.map((t) => [t, 0]));
    const schedule = [];
    for (let s = 0; s < sets; s++) {
      const set = [];
      for (const f of this.rng.shuffle(fams)) { // at least one of every enabled family
        const pool = types.filter((t) => CHALLENGES[t].family === f && !set.includes(t));
        const min = Math.min(...pool.map((t) => used[t]));
        set.push(this.rng.pick(pool.filter((t) => used[t] === min)));
        used[set.at(-1)]++;
      }
      while (set.length < ROUNDS_PER_SET) {
        let pool = types.filter((t) => !set.includes(t));
        if (!pool.length) pool = types.filter((t) => t !== set.at(-1));
        const min = Math.min(...pool.map((t) => used[t]));
        const t = this.rng.pick(pool.filter((x) => used[x] === min));
        set.push(t); used[t]++;
      }
      let ordered = this.rng.shuffle(set);
      if (schedule.length && ordered[0] === schedule.at(-1)) ordered = [...ordered.slice(1), ordered[0]];
      schedule.push(...ordered);
    }
    return schedule;
  }

  freshChallenge(type) {
    for (let i = 0; i < 8; i++) {
      const ch = generate(type, this.rng);
      const key = type + JSON.stringify(ch.payload.options || ch.payload.prompt || ch.payload.letters || ch.payload.words || ch.payload.before);
      if (!this.usedContent.has(key) || i === 7) { this.usedContent.add(key); return ch; }
    }
  }

  nextRound() {
    if (this.pauseRequested) { this.pauseRequested = false; this.setPhase('paused', 0); return; }
    this.roundIndex++;
    const total = this.schedule.length;
    if (this.roundIndex >= total) return this.finish();
    const type = this.schedule[this.roundIndex];
    const inSet = this.roundIndex % ROUNDS_PER_SET;
    this.round = {
      index: this.roundIndex, total, type, set: Math.floor(this.roundIndex / ROUNDS_PER_SET), sets: total / ROUNDS_PER_SET,
      inSet, double: inSet === ROUNDS_PER_SET - 1, tiebreak: false, ch: null, answers: new Map(), snaps: new Map(),
      locks: [], startReal: 0, endsAt: 0, results: null,
    };
    this.setPhase('intro', PHASE_MS.intro, () => this.setPhase('countdown', PHASE_MS.countdown, () => this.play()));
  }

  eligible() {
    if (this.round?.tiebreak) return this.seated.filter((p) => this.round.tiedIds.includes(p.id));
    return this.seated;
  }

  play() {
    const r = this.round;
    r.ch = this.freshChallenge(r.type);
    r.startReal = Date.now();
    r.endsAt = r.startReal + r.ch.ms / this.speed;
    this.clearTimers(this.roundTimers);
    for (const bot of this.eligible().filter((p) => p.isBot)) {
      const actions = planBot(bot, r.ch, this.rng, { streak: bot.streak, missedLast: bot.missedLast });
      for (const a of actions) {
        this.after(a.at, () => (a.snap != null ? this.snap(bot.id, a.snap, a.at) : this.submit(bot.id, a.answer, a.at)), this.roundTimers);
      }
    }
    this.setPhase('play', r.ch.ms + PLAY_GRACE_MS * this.speed, () => this.endPlay());
  }

  // Game-ms elapsed since play started, reconciling the client's claim (measured on its own clock from
  // when the challenge appeared) with what the server observed. Claims from the future are refused.
  elapsedFor(claim) {
    const server = (Date.now() - this.round.startReal) * this.speed;
    const c = Number(claim);
    if (Number.isFinite(c) && c >= 0 && c <= server + 50 * this.speed && c >= server - 1500 * this.speed) return c;
    return Math.max(0, server - 120 * this.speed);
  }

  submit(id, answer, claim) {
    const r = this.round;
    const p = this.players.get(id);
    if (this.phase !== 'play' || !r?.ch || !p || p.spectator || r.answers.has(id) || r.ch.type === 'categorySnap') return false;
    if (!this.eligible().some((e) => e.id === id)) return false;
    if (!validAnswer(r.ch, answer)) return false;
    const elapsed = this.elapsedFor(claim);
    if (elapsed > r.ch.ms + 600) return false;
    if (elapsed < r.ch.opensAt && !['quickDraw', 'needle'].includes(r.ch.type)) return false;
    r.answers.set(id, { answer: answer || {}, elapsed });
    r.locks.push({ id, t: Math.min(1, elapsed / r.ch.ms) });
    this.changed();
    this.checkEarlyEnd();
    return true;
  }

  snap(id, index, claim) {
    const r = this.round;
    const p = this.players.get(id);
    if (this.phase !== 'play' || r?.ch?.type !== 'categorySnap' || !p || p.spectator) return false;
    const s = r.ch.secret;
    if (!Number.isInteger(index) || index < 0 || index >= s.at.length) return false;
    const elapsed = this.elapsedFor(claim);
    if (elapsed < s.at[index] - 50 || elapsed > s.at[index] + s.visibleMs + 400) return false;
    const set = r.snaps.get(id) || new Set();
    if (set.has(index)) return false;
    set.add(index);
    r.snaps.set(id, set);
    if (set.size === 1) r.locks.push({ id, t: Math.min(1, elapsed / r.ch.ms) });
    this.changed();
    return true;
  }

  checkEarlyEnd() {
    const r = this.round;
    if (this.phase !== 'play' || !r?.ch || r.ch.type === 'categorySnap' || r.early) return;
    const waiting = this.eligible().filter((p) => p.connected && !r.answers.has(p.id));
    if (waiting.length) return;
    r.early = true;
    this.clearTimers();
    this.after(EARLY_END_MS * this.speed, () => this.endPlay());
  }

  endPlay() {
    const r = this.round;
    this.clearTimers(this.roundTimers);
    const ch = r.ch;
    const list = this.eligible();
    const before = [...this.seated].sort((a, b) => b.score - a.score);
    const cut = before[Math.ceil(before.length / 2) - 1]?.score ?? 0;
    const evals = new Map();
    for (const p of list) {
      let ev;
      if (ch.type === 'categorySnap') {
        const taps = [...(r.snaps.get(p.id) || [])];
        ev = taps.length ? { ...evaluate(ch, { taps }, ch.ms), taps } : { correct: false, points: 0, summary: 'No taps', none: true, taps: [] };
      } else if (r.answers.has(p.id)) {
        const a = r.answers.get(p.id);
        ev = { ...evaluate(ch, a.answer, a.elapsed), elapsed: a.elapsed, answer: a.answer };
      } else ev = { correct: false, points: 0, summary: p.connected ? 'No answer' : 'Away', none: true };
      evals.set(p.id, ev);
    }
    if (ch.type === 'closestCall') {
      const answered = [...evals.entries()].filter(([, e]) => e.error != null);
      const best = Math.min(...answered.map(([, e]) => e.error));
      for (const [, e] of answered) if (e.error === best) { e.points = Math.max(e.points, SCORING.closestFloor); e.correct = true; e.closest = true; }
    }
    let fastestId = null;
    if (ch.kind === 'choice' || ch.type === 'quickDraw') {
      // In a sudden-death tiebreak any clean tap counts; in normal play only correct answers do.
      const winners = [...evals.entries()].filter(([, e]) => (r.tiebreak ? e.rt != null : e.correct) && !e.foul).sort((a, b) => (a[1].rt ?? a[1].elapsed) - (b[1].rt ?? b[1].elapsed));
      if (winners.length) fastestId = winners[0][0];
    }

    const results = {};
    if (r.tiebreak) {
      for (const p of list) results[p.id] = { ...pick(evals.get(p.id)), points: 0, first: p.id === fastestId };
      r.results = { results, fastestId, reveal: revealOf(ch) };
      return this.endTiebreak(fastestId);
    }
    for (const p of this.seated) {
      const e = evals.get(p.id) || { correct: false, points: 0, summary: 'Away', none: true };
      const first = p.id === fastestId;
      p.streak = e.correct ? p.streak + 1 : 0;
      p.maxStreak = Math.max(p.maxStreak, p.streak);
      const streakMult = !e.correct ? 1 : p.streak >= 5 ? SCORING.streak5 : p.streak >= 3 ? SCORING.streak3 : 1;
      const surge = r.double && p.score < cut && e.points > 0;
      let total;
      if (e.points > 0) total = Math.floor((e.points + (first ? SCORING.first : 0)) * streakMult * (r.double ? SCORING.double : 1) * (surge ? SCORING.surge : 1));
      else total = e.points;
      p.score = Math.max(0, p.score + total);
      if (e.correct) { p.correctCount++; p.correctMsSum += e.rt ?? e.elapsed ?? ch.ms; }
      if (first) p.firsts++;
      p.missedLast = !e.correct;
      results[p.id] = { ...pick(e), base: e.points, points: total, first, streak: p.streak, streakMult, surge, double: r.double };
    }
    this.rerank();
    for (const p of this.seated) p.history[this.roundIndex] = p.score;
    r.results = { results, fastestId, reveal: revealOf(ch) };
    this.botReactions(results, fastestId);
    this.setPhase('reveal', PHASE_MS.reveal, () => this.setPhase('ticker', PHASE_MS.ticker, () => this.afterRound()));
  }

  // Bots occasionally react like players do: a flame for a fastest answer, a skull for a foul.
  botReactions(results, fastestId) {
    for (const b of this.seated.filter((p) => p.isBot)) {
      const res = results[b.id];
      if (!res || !this.rng.chance(b.persona === 'dash' || b.persona === 'zip' ? 0.3 : 0.14)) continue;
      const emoji = res.foul ? 'dead' : b.id === fastestId ? 'fire' : res.points > 0 ? this.rng.pick(['clap', 'haha', 'love']) : this.rng.pick(['wow', 'dead']);
      this.after(this.rng.float(500, 1800), () => { if (this.players.has(b.id)) this.onEvent('emote', { id: b.id, emoji }); }, this.roundTimers);
    }
  }

  rerank() {
    const sorted = [...this.seated].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    sorted.forEach((p, i) => {
      p.prevRank = p.rank;
      p.rank = i > 0 && sorted[i - 1].score === p.score ? sorted[i - 1].rank : i + 1;
      if (this.roundIndex >= 2) p.lowestRank = Math.max(p.lowestRank, p.rank);
    });
  }

  afterRound() {
    const r = this.round;
    const endOfSet = r.inSet === ROUNDS_PER_SET - 1;
    if (r.index === r.total - 1) return this.finish();
    if (endOfSet) {
      this.seatSpectators();
      return this.setPhase('setbreak', PHASE_MS.setbreak, () => this.nextRound());
    }
    this.nextRound();
  }

  // Late joiners take a seat at a set break, starting level with last place.
  seatSpectators() {
    const waiting = [...this.players.values()].filter((p) => p.spectator && !p.isBot && p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
    for (const p of waiting) {
      if (this.seated.length >= MAX_PLAYERS) {
        const bot = this.seated.filter((b) => b.isBot).sort((a, b) => a.score - b.score)[0];
        if (!bot) break;
        this.players.delete(bot.id);
      }
      const floor = Math.min(...this.seated.map((s) => s.score));
      p.spectator = false;
      p.color = this.freeColor();
      p.score = Number.isFinite(floor) ? floor : 0;
      p.history = [];
      p.history[this.roundIndex] = p.score;
      p.lateJoin = true;
    }
    this.rerank();
    for (const p of this.seated) if (p.lateJoin && p.history.filter((x) => x != null).length <= 1) p.prevRank = p.rank;
  }

  standings() {
    const avg = (p) => (p.correctCount ? p.correctMsSum / p.correctCount : Infinity);
    return [...this.seated].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || avg(a) - avg(b) || a.joinedAt - b.joinedAt);
  }

  finish() {
    const order = this.standings();
    const avg = (p) => (p.correctCount ? p.correctMsSum / p.correctCount : Infinity);
    const top = order[0];
    const tied = top ? order.filter((p) => p.score === top.score && p.correctCount === top.correctCount && avg(p) === avg(top)) : [];
    if (tied.length > 1 && (this.tiebreakTries || 0) < 3) return this.startTiebreak(tied.map((p) => p.id));
    this.publishResults(order);
  }

  startTiebreak(ids) {
    this.tiebreakTries = (this.tiebreakTries || 0) + 1;
    this.round = {
      index: this.roundIndex, total: this.schedule.length, type: 'quickDraw', set: this.round?.set ?? 0, sets: this.schedule.length / ROUNDS_PER_SET,
      inSet: 0, double: false, tiebreak: true, tiedIds: ids, ch: null, answers: new Map(), snaps: new Map(), locks: [], results: null,
    };
    this.setPhase('tiebreak', PHASE_MS.tiebreakIntro, () => this.setPhase('countdown', PHASE_MS.countdown, () => this.play()));
  }

  endTiebreak(winnerId) {
    this.setPhase('reveal', PHASE_MS.reveal, () => {
      if (!winnerId) return this.finish();
      const order = this.standings();
      const w = order.findIndex((p) => p.id === winnerId);
      if (w > 0) order.unshift(order.splice(w, 1)[0]);
      this.tiebreakWinner = winnerId;
      this.publishResults(order);
    });
  }

  publishResults(order) {
    this.clearTimers(this.roundTimers);
    const best = (fn, min = 1) => { const p = [...this.seated].sort((a, b) => fn(b) - fn(a))[0]; return p && fn(p) >= min ? p.id : null; };
    const accuracy = (p) => p.correctCount / Math.max(1, this.roundIndex + 1);
    this.results = {
      order: order.map((p, i) => ({ id: p.id, place: i > 0 && order[i - 1].score === p.score && !this.tiebreakWinner ? null : i + 1, score: p.score })),
      tiebreakWinner: this.tiebreakWinner || null,
      awards: [
        { key: 'fastest', label: 'Fastest Finger', id: best((p) => p.firsts), detail: (id) => `${this.players.get(id).firsts}× first` },
        { key: 'streak', label: 'Longest Streak', id: best((p) => p.maxStreak, 3), detail: (id) => `${this.players.get(id).maxStreak} in a row` },
        { key: 'sharp', label: 'Sharpshooter', id: best(accuracy, 0.01), detail: (id) => `${Math.round(accuracy(this.players.get(id)) * 100)}% correct` },
        { key: 'comeback', label: 'Comeback', id: best((p) => p.lowestRank - p.rank, 2), detail: (id) => { const p = this.players.get(id); return `#${p.lowestRank} → #${p.rank}`; } },
      ].filter((a) => a.id).map((a) => ({ key: a.key, label: a.label, id: a.id, detail: a.detail(a.id) })),
    };
    this.tiebreakTries = 0;
    this.tiebreakWinner = null;
    this.setPhase('results', 0);
  }

  // ---------- host controls ----------
  pause(byId) { if (this.isHost(byId) && this.inGame && this.phase !== 'paused') { this.pauseRequested = true; this.changed(); } }
  resume(byId) {
    if (!this.isHost(byId)) return;
    if (this.phase === 'paused') { this.seatSpectators(); this.nextRound(); } else { this.pauseRequested = false; this.changed(); }
  }
  skipBreak(byId) { if (this.isHost(byId) && this.phase === 'setbreak') this.nextRound(); }
  endGame(byId) {
    if (!this.isHost(byId) || !this.inGame) return;
    this.clearTimers(this.roundTimers);
    this.publishResults(this.standings());
  }
  playAgain(byId) {
    if (!this.isHost(byId) || this.phase !== 'results') return;
    this.clearTimers();
    for (const p of [...this.players.values()]) {
      if (!p.isBot && !p.connected) { this.players.delete(p.id); continue; }
      if (p.spectator && this.seated.length < MAX_PLAYERS) { p.spectator = false; p.color = this.freeColor(); }
      Object.assign(p, { score: 0, streak: 0, history: [], rank: 1, prevRank: 1, ready: p.isBot, lateJoin: false });
    }
    if (!this.players.has(this.hostId)) this.transferHost();
    this.round = null;
    this.results = null;
    this.setPhase('lobby', 0);
  }

  // ---------- state ----------
  state(viewerId) {
    const r = this.round;
    const showPayload = r?.ch && ['play', 'reveal', 'ticker'].includes(this.phase);
    const showResults = r?.results && ['reveal', 'ticker', 'setbreak', 'results', 'paused'].includes(this.phase);
    const me = this.players.get(viewerId);
    return {
      code: this.code,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      phaseMs: this.phaseMs,
      now: Date.now(),
      speed: this.speed,
      hostId: this.hostId,
      settings: this.settings,
      pauseRequested: this.pauseRequested,
      canStart: this.phase === 'lobby' ? this.canStart(false) : null,
      round: r ? {
        index: r.index, total: r.total, set: r.set, sets: r.sets, inSet: r.inSet, double: r.double, type: r.type,
        tiebreak: r.tiebreak, tiedIds: r.tiedIds || null,
        startedAt: r.startReal, endsAt: r.endsAt,
        ms: r.ch?.ms ?? CHALLENGES[r.type].ms, opensAt: r.ch?.opensAt ?? 0,
        payload: showPayload ? r.ch.payload : null,
        locks: r.locks,
        reveal: showResults ? r.results.reveal : null,
        results: showResults ? r.results.results : null,
        fastestId: showResults ? r.results.fastestId : null,
      } : null,
      players: [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt).map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, isBot: p.isBot, persona: p.persona || null, tag: p.tag || null,
        difficulty: p.difficulty || null, connected: p.connected, ready: p.ready, spectator: p.spectator, score: p.score,
        streak: p.streak, rank: p.rank, prevRank: p.prevRank, history: p.history, lateJoin: !!p.lateJoin,
      })),
      results: this.phase === 'results' ? this.results : null,
      you: me ? {
        id: me.id,
        answered: r?.answers?.has(me.id) || false,
        snaps: r?.snaps?.get(me.id) ? [...r.snaps.get(me.id)] : [],
      } : null,
    };
  }
}

function pick(e) {
  const out = { correct: e.correct, summary: e.summary };
  for (const k of ['foul', 'none', 'closest', 'rt', 'pos', 'hits', 'misses', 'taps']) if (e[k] != null) out[k] = e[k];
  if (e.elapsed != null) out.elapsed = Math.round(e.elapsed);
  if (e.answer && 'value' in e.answer) out.value = e.answer.value;
  if (e.answer && 'choice' in e.answer) out.choice = e.answer.choice;
  return out;
}
