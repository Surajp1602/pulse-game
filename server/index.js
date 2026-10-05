// HTTP + Socket.IO server. Serves the built client from dist/ and hosts every room in memory.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Room } from './room.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels: codes never spell words, no O/0 or I/1 confusion
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/info') { // LAN addresses, so a host on localhost can tell phones where to go
    const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ lan }));
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA routes
  if (!fs.existsSync(file)) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('Client not built. Run: npm run build'); }
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

export function createPulseServer({ port = 3000, speed = 1, seed } = {}) {
  const server = http.createServer(serveStatic);
  const io = new Server(server, { cors: { origin: true }, pingInterval: 5000, pingTimeout: 8000, maxHttpBufferSize: 1e4 });
  const rooms = new Map();
  const listeners = new Map(); // code -> Set(socket)

  const newCode = () => {
    for (;;) {
      const c = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
      if (!rooms.has(c)) return c;
    }
  };

  const broadcast = (room) => {
    for (const s of listeners.get(room.code) || []) s.emit('state', room.state(s.data.playerId));
  };

  const createRoom = () => {
    const code = newCode();
    const room = new Room({
      code, speed, seed: seed != null ? seed + rooms.size : undefined,
      onChange: broadcast,
      onEvent: (type, data) => {
        if (type === 'emote') for (const s of listeners.get(code) || []) s.emit('emote', data);
        if (type === 'kicked') for (const s of listeners.get(code) || []) if (data.sockets.includes(s.id)) { s.emit('kicked'); detach(s); }
      },
      onEmpty: () => { rooms.delete(code); listeners.delete(code); },
    });
    rooms.set(code, room);
    listeners.set(code, new Set());
    return room;
  };

  const attach = (socket, room, playerId) => {
    detach(socket);
    socket.data.code = room.code;
    socket.data.playerId = playerId;
    listeners.get(room.code).add(socket);
    if (playerId) room.connect(playerId, socket.id);
    socket.emit('state', room.state(playerId));
  };

  function detach(socket) {
    const { code, playerId } = socket.data;
    if (!code) return;
    listeners.get(code)?.delete(socket);
    if (playerId) rooms.get(code)?.disconnect(playerId, socket.id);
    socket.data.code = null;
    socket.data.playerId = null;
  }

  io.on('connection', (socket) => {
    socket.data = { code: null, playerId: null };
    let budget = 40, last = Date.now();
    const ok = () => { // flood guard: ~40 messages per second per socket
      const now = Date.now();
      budget = Math.min(40, budget + ((now - last) / 1000) * 40);
      last = now;
      if (budget < 1) return false;
      budget -= 1;
      return true;
    };
    const room = () => rooms.get(socket.data.code);
    const me = () => socket.data.playerId;
    const ackFn = (a) => (typeof a === 'function' ? a : () => {});
    const on = (ev, fn) => socket.on(ev, (...args) => { if (ok()) { try { fn(...args); } catch (e) { console.error(ev, e); } } });

    on('time', (t0, ack) => ackFn(ack)({ t0, server: Date.now() }));

    on('room:create', (data = {}, ack) => {
      const r = createRoom();
      const p = r.addHuman({ name: data.name, avatar: data.avatar });
      attach(socket, r, p.id);
      ackFn(ack)({ ok: true, code: r.code, playerId: p.id, token: p.token });
    });

    on('room:join', (data = {}, ack) => {
      const r = rooms.get(String(data.code || '').toUpperCase().trim());
      if (!r) return ackFn(ack)({ ok: false, reason: 'no-room' });
      const p = r.addHuman({ name: data.name, avatar: data.avatar });
      attach(socket, r, p.id);
      ackFn(ack)({ ok: true, code: r.code, playerId: p.id, token: p.token, spectator: p.spectator });
    });

    on('room:rejoin', (data = {}, ack) => {
      const r = rooms.get(String(data.code || '').toUpperCase());
      const p = r?.players.get(data.playerId);
      if (!r || !p || p.token !== data.token) return ackFn(ack)({ ok: false, reason: r ? 'no-seat' : 'no-room' });
      attach(socket, r, p.id);
      ackFn(ack)({ ok: true, code: r.code, playerId: p.id });
    });

    on('room:peek', (data = {}, ack) => {
      const r = rooms.get(String(data.code || '').toUpperCase().trim());
      ackFn(ack)(r ? { ok: true, phase: r.phase, players: r.seated.length } : { ok: false });
    });

    on('room:watch', (data = {}, ack) => {
      const r = rooms.get(String(data.code || '').toUpperCase().trim());
      if (!r) return ackFn(ack)({ ok: false, reason: 'no-room' });
      attach(socket, r, null);
      ackFn(ack)({ ok: true, code: r.code });
    });

    on('profile', (d = {}) => room()?.updateProfile(me(), d));
    on('ready', (v) => room()?.setReady(me(), v));
    on('settings', (s) => room()?.setSettings(me(), s));
    on('bot:add', (d = {}) => room()?.addBot(me(), d));
    on('bot:fill', (n) => room()?.fillBots(me(), Number(n) || 4));
    on('bot:difficulty', (d = {}) => room()?.setBotDifficulty(me(), d.id, d.difficulty));
    on('kick', (id) => room()?.kick(me(), id));
    on('start', (d = {}, ack) => ackFn(ack)(room()?.start(me(), !!d.force) ?? { ok: false }));
    on('answer', (d = {}) => room()?.submit(me(), d.answer, d.elapsed));
    on('snap', (d = {}) => room()?.snap(me(), d.index, d.elapsed));
    on('emote', (e) => room()?.emote(me(), e));
    on('pause', () => room()?.pause(me()));
    on('resume', () => room()?.resume(me()));
    on('skip', () => room()?.skipBreak(me()));
    on('end', () => room()?.endGame(me()));
    on('again', () => room()?.playAgain(me()));
    on('leave', () => { const r = room(), id = me(); detach(socket); r?.leave(id); });
    socket.on('disconnect', () => detach(socket));
  });

  return {
    server, io, rooms,
    listen: () => new Promise((resolve) => server.listen(port, () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { for (const r of rooms.values()) r.destroy(); io.close(); server.close(() => resolve()); }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const speed = Number(process.env.PULSE_SPEED) || 1;
  const app = createPulseServer({ port, speed });
  app.server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`\nPort ${port} is already in use: another PULSE server (npm start or npm run dev) is probably running.\nStop it, or pick another port, e.g. PORT=3001 npm start\n`);
    process.exit(1);
  });
  app.listen().then((p) => console.log(`PULSE server on http://localhost:${p}${speed !== 1 ? ` (speed ×${speed})` : ''}`));
}
