// Socket connection, clock sync, session persistence and a tiny store React subscribes to.
import { io } from 'socket.io-client';

const SESSION_KEY = 'pulse.session';
const PROFILE_KEY = 'pulse.profile';

export const storage = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

let socket = null;
let offset = 0; // serverNow - Date.now()
let bestRtt = Infinity;
const listeners = new Set();
const emoteListeners = new Set();
let snapshot = { state: null, connected: false, session: storage.get(SESSION_KEY), kicked: false, lost: false };

const set = (patch) => { snapshot = { ...snapshot, ...patch }; listeners.forEach((l) => l()); };

export const serverNow = () => Date.now() + offset;
export const store = {
  subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  get: () => snapshot,
};
export const onEmote = (fn) => { emoteListeners.add(fn); return () => emoteListeners.delete(fn); };
export const getProfile = () => storage.get(PROFILE_KEY, { name: '', avatar: Math.floor(Math.random() * 12) });
export const saveProfile = (p) => storage.set(PROFILE_KEY, p);

function syncClock() {
  let n = 0;
  const ping = () => {
    const t0 = Date.now();
    socket.emit('time', t0, ({ server }) => {
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (rtt <= bestRtt) { bestRtt = rtt; offset = server - (t0 + rtt / 2); }
      if (++n < 6) setTimeout(ping, 120);
    });
  };
  bestRtt = Infinity;
  ping();
}

export function connect() {
  if (socket) return socket;
  // VITE_SERVER_URL points the client at a separately hosted game server (e.g. client on Vercel, server on
  // Render). Unset, it connects to the same origin that served the page.
  socket = io(import.meta.env.VITE_SERVER_URL || undefined, { transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });
  socket.on('connect', () => {
    set({ connected: true });
    syncClock();
    const s = snapshot.session;
    if (s?.code && s?.playerId) {
      socket.emit('room:rejoin', s, (res) => {
        if (!res?.ok) { storage.set(SESSION_KEY, null); set({ session: null, state: null, lost: true }); }
      });
    } else if (snapshot.watch) {
      socket.emit('room:watch', { code: snapshot.watch });
    }
  });
  socket.on('disconnect', () => set({ connected: false }));
  socket.on('state', (state) => {
    // Every snapshot carries the server clock; keep the offset honest between pings.
    set({ state });
  });
  socket.on('emote', (e) => emoteListeners.forEach((fn) => fn(e)));
  socket.on('kicked', () => { storage.set(SESSION_KEY, null); set({ session: null, state: null, kicked: true }); });
  return socket;
}

const call = (ev, data) => new Promise((resolve) => {
  connect().emit(ev, data, (res) => resolve(res || { ok: false }));
  setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 8000);
});

function remember(res) {
  if (res?.ok && res.playerId) {
    const session = { code: res.code, playerId: res.playerId, token: res.token };
    storage.set(SESSION_KEY, session);
    set({ session, kicked: false, lost: false });
  }
  return res;
}

export const actions = {
  create: (profile) => call('room:create', profile).then(remember),
  join: (code, profile) => call('room:join', { code, ...profile }).then(remember),
  peek: (code) => call('room:peek', { code }),
  watch: async (code) => { set({ watch: code }); return call('room:watch', { code }); },
  send: (ev, data) => connect().emit(ev, data),
  start: (force = false) => call('start', { force }),
  leave: () => {
    connect().emit('leave');
    storage.set(SESSION_KEY, null);
    set({ session: null, state: null });
  },
  clearNotice: () => set({ kicked: false, lost: false }),
};
