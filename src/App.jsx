import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { store, connect, actions, onEmote } from './net.js';
import { Home } from './screens/Home.jsx';
import { Lobby } from './screens/Lobby.jsx';
import { Game } from './screens/Game.jsx';
import { Results } from './screens/Results.jsx';
import { Stage } from './screens/Stage.jsx';
import { PulseLine } from './components/PulseLine.jsx';
import { Wordmark } from './components/ui.jsx';

const Gallery = lazy(() => import('./gallery/Gallery.jsx'));

function route() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'gallery') return { name: 'gallery' };
  if (parts[0] === 'stage' && parts[1]) return { name: 'stage', code: parts[1].toUpperCase() };
  if (parts[0] === 'r' && parts[1]) return { name: 'join', code: parts[1].toUpperCase() };
  return { name: 'home' };
}

function useEmotes() {
  const [list, setList] = useState([]);
  useEffect(() => onEmote((e) => {
    const item = { ...e, key: `${e.id}-${performance.now()}`, x: 12 + Math.random() * 76 };
    setList((l) => [...l.slice(-12), item]);
    setTimeout(() => setList((l) => l.filter((x) => x !== item)), 2200);
  }), []);
  return list;
}

function PlayerApp({ initialCode }) {
  const snap = useSyncExternalStore(store.subscribe, store.get);
  const emotes = useEmotes();
  const { state, session } = snap;
  const inRoom = session && state && state.code === session.code;

  useEffect(() => { connect(); }, []);
  useEffect(() => {
    const want = inRoom ? `/r/${state.code}` : session ? location.pathname : initialCode ? `/r/${initialCode}` : '/';
    if (location.pathname !== want) history.replaceState(null, '', want);
  }, [inRoom, state?.code, session, initialCode]);
  useEffect(() => { document.title = inRoom ? `PULSE · ${state.code}` : 'PULSE · party game'; }, [inRoom, state?.code]);

  if (session && !inRoom) {
    return (
      <div className="screen center splash">
        <Wordmark />
        <p className="muted" aria-live="polite">{snap.connected ? 'Rejoining your room…' : 'Reconnecting…'}</p>
        <button type="button" className="btn btn-text" onClick={actions.leave}>Leave and start over</button>
        <footer className="dock"><PulseLine mode="idle" height={64} /></footer>
      </div>
    );
  }
  if (!inRoom) {
    const notice = snap.kicked ? 'The host removed you from that room.' : snap.lost ? 'That room has ended.' : '';
    return <Home initialCode={initialCode || ''} act={actions} notice={notice} />;
  }
  if (state.phase === 'lobby') return <Lobby state={state} act={actions} />;
  if (state.phase === 'results') return <Results state={state} act={actions} />;
  return <Game state={state} act={actions} emotes={emotes} />;
}

function StageApp({ code }) {
  const snap = useSyncExternalStore(store.subscribe, store.get);
  const emotes = useEmotes();
  useEffect(() => { connect(); actions.watch(code); }, [code]);
  return <Stage state={snap.state} emotes={emotes} />;
}

export default function App() {
  const [r] = useState(route);
  useEffect(() => { window.__ready = true; }, []);
  if (r.name === 'gallery') return <Suspense fallback={null}><Gallery /></Suspense>;
  if (r.name === 'stage') return <StageApp code={r.code} />;
  return <PlayerApp initialCode={r.name === 'join' ? r.code : ''} />;
}
