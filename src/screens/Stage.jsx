// Optional big-screen view (/stage/CODE): read-only, for a TV or laptop everyone can see.
import { Seat, Wordmark } from '../components/ui.jsx';
import { PulseLine } from '../components/PulseLine.jsx';
import { Game, Standings } from './Game.jsx';
import { Results } from './Results.jsx';

const noop = { send: () => {}, leave: () => { location.href = '/'; }, start: async () => ({ ok: false }) };

export function Stage({ state, emotes }) {
  if (!state) {
    return <div className="screen stage-view center"><Wordmark /><p className="muted">Connecting to the room…</p><PulseLine mode="idle" /></div>;
  }
  if (state.phase === 'lobby') {
    const seated = state.players.filter((p) => !p.spectator);
    return (
      <div className="screen stage-view stage-lobby">
        <Wordmark size="md" />
        <div className="stage-join">
          <span className="eyebrow">Join on your phone at {location.host}</span>
          <div className="code-big code-huge" role="img" aria-label={`Room code ${state.code}`}>{state.code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
        </div>
        <ul className="stage-seats">
          {seated.map((p) => <li key={p.id} style={{ '--c': p.color }}><Seat p={p} size={88} mood="happy" /><b>{p.name}</b>{p.isBot && <em className="bot-tag">BOT</em>}</li>)}
        </ul>
        <PulseLine mode="idle" height={96} />
      </div>
    );
  }
  if (state.phase === 'results') return <div className="stage-view"><Results state={state} act={noop} /></div>;
  return (
    <div className="screen stage-view stage-game">
      <div className="stage-play"><Game state={state} act={noop} emotes={emotes} side={false} /></div>
      <aside className="stage-side">
        <span className="eyebrow">Room {state.code}</span>
        <Standings players={state.players} animate={state.phase === 'ticker'} compact />
      </aside>
    </div>
  );
}
