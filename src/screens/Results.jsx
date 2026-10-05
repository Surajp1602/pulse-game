import { useEffect } from 'react';
import { Seat, MuteButton, fmt } from '../components/ui.jsx';
import { PulseLine } from '../components/PulseLine.jsx';
import { sfx } from '../sound.js';
import { ordinal } from '../util.js';

// The game's ECG: every player's score trace across every round. Each round a player won (biggest gain)
// beats as a spike on their line; the winner is drawn last, brightest, and ends at their avatar.
function ScoreTrace({ players, winnerId, rounds }) {
  const W = 600, H = 200, padY = 22;
  const max = Math.max(1, ...players.map((p) => p.score));
  const n = Math.max(2, rounds);
  const x = (i) => (i / (n - 1)) * W;
  const y = (v) => H - padY - (v / max) * (H - padY * 2);
  const val = (p, i) => { for (let k = i; k >= 0; k--) if (p.history?.[k] != null) return p.history[k]; return 0; };
  const roundWinner = Array.from({ length: n }, (_, i) => {
    let best = null, gain = 0;
    for (const p of players) { const g = val(p, i) - (i ? val(p, i - 1) : 0); if (g > gain) { gain = g; best = p.id; } }
    return best;
  });
  const ordered = [...players].sort((a, b) => (a.id === winnerId) - (b.id === winnerId));
  let flag = null;
  return (
    <figure className="trace">
      <div className="trace-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Score over the game for every player">
          <line x1="0" x2={W} y1={H - padY} y2={H - padY} className="trace-base" />
          {ordered.map((p) => {
            const first = p.history?.findIndex((v) => v != null) ?? -1;
            if (first < 0) return null;
            const segs = [`M${x(first).toFixed(1)} ${y(val(p, first)).toFixed(1)}`];
            for (let i = first + 1; i < n; i++) {
              const x0 = x(i - 1), x1 = x(i), y0 = y(val(p, i - 1)), y1 = y(val(p, i));
              if (roundWinner[i] === p.id) { // a heartbeat on the way up
                const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
                segs.push(`L${(xm - 6).toFixed(1)} ${ym.toFixed(1)} L${(xm - 2).toFixed(1)} ${(ym - 26).toFixed(1)} L${(xm + 2).toFixed(1)} ${(ym + 9).toFixed(1)} L${(xm + 6).toFixed(1)} ${ym.toFixed(1)}`);
              }
              segs.push(`L${x1.toFixed(1)} ${y1.toFixed(1)}`);
            }
            const win = p.id === winnerId;
            const end = [x(n - 1), y(val(p, n - 1))];
            if (win) flag = { p, left: (end[0] / W) * 100, top: (end[1] / H) * 100 };
            return (
              <g key={p.id} className={win ? 'trace-win' : ''}>
                <path d={segs.join(' ')} pathLength="1" className="trace-line" style={{ stroke: p.color, color: p.color }} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {flag && <span className="trace-flag" style={{ left: `${flag.left}%`, top: `${flag.top}%`, '--c': flag.p.color }}><Seat p={flag.p} size={30} mood="happy" ring={false} /></span>}
      </div>
      <figcaption className="trace-legend"><span>Round 1</span><span>Spikes mark the rounds each player won</span><span>Round {n}</span></figcaption>
    </figure>
  );
}

export function Results({ state, act }) {
  const me = state.players.find((p) => p.id === state.you?.id);
  const isHost = state.hostId === me?.id;
  const res = state.results;
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const order = res?.order || [];
  const placeOf = (i) => { let k = i; while (k > 0 && order[k].place == null) k--; return order[k].place; };
  const winner = byId[order[0]?.id];
  const sharedWin = order[1] && order[1].place == null;
  const myPlace = order.findIndex((o) => o.id === me?.id);
  const rounds = Math.max(...state.players.map((p) => p.history?.length || 0), 1);

  useEffect(() => { if (myPlace === 0) sfx.win(); else sfx.rankUp(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen results">
      <header className="lobby-top">
        <button type="button" className="btn btn-text" onClick={act.leave}>← Leave</button>
        <MuteButton />
      </header>
      <section className="win-hero" aria-label="Winner">
        <span className="eyebrow eyebrow-signal">{sharedWin ? 'Shared win' : res?.tiebreakWinner ? 'Won in sudden death' : 'Winner'}</span>
        {winner && (
          <>
            <div className="win-avatar" style={{ '--c': winner.color }}><Seat p={winner} size={112} mood="happy" /></div>
            <h1 className="win-name">{sharedWin ? order.filter((o, i) => i === 0 || o.place == null).map((o) => byId[o.id]?.name).join(' & ') : winner.name}</h1>
            <p className="win-score num">{fmt(winner.score)} pts</p>
          </>
        )}
        {me && myPlace > 0 && <p className="win-you">You finished <b>{ordinal(placeOf(myPlace))}</b> with <span className="num">{fmt(me.score)}</span></p>}
        <div className="win-actions">
          {isHost
            ? <button type="button" className="btn btn-primary btn-big" onClick={() => act.send('again')}>Play again</button>
            : <p className="waiting">Waiting for the host to start another game…</p>}
        </div>
      </section>

      <div className="results-grid">
        <section className="panel" aria-label="Score trace">
          <h2 className="section-head"><span>The game's pulse</span></h2>
          <ScoreTrace players={state.players.filter((p) => !p.spectator)} winnerId={winner?.id} rounds={rounds} />
        </section>

        {res?.awards?.length > 0 && (
          <section className="awards" aria-label="Awards">
            {res.awards.map((a) => {
              const p = byId[a.id];
              return p ? (
                <div key={a.key} className="award" style={{ '--c': p.color }}>
                  <span className="eyebrow">{a.label}</span>
                  <span className="award-who"><Seat p={p} size={28} ring={false} /><b>{p.name}</b></span>
                  <span className="award-detail num">{a.detail}</span>
                </div>
              ) : null;
            })}
          </section>
        )}

        <section className="panel" aria-label="Final standings">
          <h2 className="section-head"><span>Final standings</span></h2>
          <ol className="final-list">
            {order.map((o, i) => {
              const p = byId[o.id];
              if (!p) return null;
              return (
                <li key={o.id} className={p.id === me?.id ? 'me' : ''} style={{ '--c': p.color }}>
                  <span className="row-rank num">{placeOf(i)}</span>
                  <Seat p={p} size={36} ring={false} mood={i === 0 ? 'happy' : undefined} />
                  <span className="row-name">{p.name}{p.isBot && <em className="bot-tag">BOT</em>}</span>
                  <span className="row-score num">{fmt(o.score)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <footer className="dock"><PulseLine mode="idle" height={56} /></footer>
    </div>
  );
}
