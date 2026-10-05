import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHALLENGES, FAMILIES, EMOTES, ROUNDS_PER_SET } from '../../shared/config.js';
import { CHALLENGE_UI } from '../challenges.jsx';
import { PulseLine } from '../components/PulseLine.jsx';
import { Seat, Sheet, MuteButton, useClock, useTicker, fmt } from '../components/ui.jsx';
import { sfx } from '../sound.js';
import { ordinal } from '../util.js';
import { Glyph, glyphLabel } from '../components/Glyph.jsx';

export function Hud({ state, me, onMenu }) {
  const r = state.round;
  const sets = r ? Array.from({ length: r.sets }, (_, i) => i) : [];
  return (
    <header className="hud">
      <div className="hud-round">
        <span className="eyebrow">{r?.tiebreak ? 'Sudden death' : `Round ${String(r ? r.index + 1 : 0).padStart(2, '0')}/${r?.total ?? 0}`}</span>
        <div className="pips" role="img" aria-label={r ? `Set ${r.set + 1} of ${r.sets}, round ${r.inSet + 1} of ${ROUNDS_PER_SET}` : ''}>
          {sets.map((s) => (
            <span key={s} className="pip-set">
              {Array.from({ length: ROUNDS_PER_SET }, (_, k) => {
                const idx = s * ROUNDS_PER_SET + k;
                const cls = idx < r.index ? 'done' : idx === r.index ? 'now' : '';
                return <i key={k} className={`pip ${cls} ${k === ROUNDS_PER_SET - 1 ? 'double' : ''}`} />;
              })}
            </span>
          ))}
        </div>
      </div>
      <div className="hud-me">
        {me && !me.spectator ? (
          <>
            {me.streak >= 2 && <span className="streak-chip" title={`${me.streak} in a row`}>🔥{me.streak}</span>}
            <span className="hud-score num">{fmt(me.score)}</span>
            <span className="rank-chip num">{ordinal(me.rank)}</span>
          </>
        ) : <span className="eyebrow">Watching</span>}
        {onMenu && <button type="button" className="icon-btn" onClick={onMenu} aria-label="Game menu">⋯</button>}
      </div>
    </header>
  );
}

function IntroCard({ state, me }) {
  const r = state.round;
  const c = CHALLENGES[r.type];
  const seated = state.players.filter((p) => !p.spectator).sort((a, b) => b.score - a.score);
  const cut = seated[Math.ceil(seated.length / 2) - 1]?.score ?? 0;
  const surge = r.double && me && !me.spectator && me.score < cut;
  if (state.phase === 'tiebreak') {
    const tied = state.players.filter((p) => r.tiedIds?.includes(p.id));
    return (
      <div className="intro intro-tiebreak">
        <span className="eyebrow eyebrow-signal">Dead heat</span>
        <h1 className="intro-name">Sudden death</h1>
        <div className="tied">{tied.map((p) => <Seat key={p.id} p={p} size={64} />)}</div>
        <p className="intro-rule">{tied.map((p) => p.name).join(' vs ')}. One Quick Draw decides it. Everyone else: watch.</p>
      </div>
    );
  }
  return (
    <div className={`intro ${r.double ? 'intro-double' : ''}`} key={r.index}>
      {r.double && <div className="double-band" role="note"><span>Double Pulse</span><b>×2</b></div>}
      <span className="eyebrow">{FAMILIES[c.family].label}</span>
      <span className="intro-glyph" aria-hidden="true">{c.glyph}</span>
      <h1 className="intro-name">{c.name}</h1>
      <p className="intro-rule">{c.rule}</p>
      {surge && <p className="surge-note">Surge: you're chasing, so points here count ×1.25 more.</p>}
    </div>
  );
}

function Countdown({ state }) {
  const { now } = useClock();
  useTicker(true, 60);
  const left = Math.max(0, state.phaseEndsAt - now());
  const n = Math.min(3, Math.max(1, Math.ceil(left / (state.phaseMs / 3 || 500))));
  const last = useRef(null);
  useEffect(() => { if (last.current !== n) { last.current = n; sfx.tick(); } }, [n]);
  return (
    <div className="countdown" aria-live="assertive">
      <span className="eyebrow">{CHALLENGES[state.round.type].name}</span>
      <span className="count num" key={n}>{n}</span>
    </div>
  );
}

function Breakdown({ res }) {
  if (!res) return null;
  const chips = [];
  if (res.foul) chips.push(['False start', 'bad']);
  else if (res.correct) {
    chips.push([res.closest ? 'Closest!' : 'Correct', 'good']);
    if (res.first) chips.push(['First! +25', 'good']);
    if (res.streakMult > 1) chips.push([`Streak ×${res.streakMult}`, 'hot']);
  }
  if (res.double && res.points > 0) chips.push(['Double ×2', 'hot']);
  if (res.surge) chips.push(['Surge ×1.25', 'hot']);
  return <div className="chips">{chips.map(([t, k]) => <span key={t} className={`chip chip-${k}`}>{t}</span>)}</div>;
}

function RevealBar({ state, me }) {
  const r = state.round;
  const res = me && r.results?.[me.id];
  const others = state.players.filter((p) => !p.spectator && r.results?.[p.id]).sort((a, b) => (r.results[b.id].points ?? 0) - (r.results[a.id].points ?? 0));
  const fastest = state.players.find((p) => p.id === r.fastestId);
  return (
    <section className="reveal" aria-live="polite">
      {res ? (
        <div className={`reveal-me ${res.points > 0 ? 'won' : res.points < 0 ? 'lost' : 'flat'}`}>
          <span className="reveal-points num">{res.points > 0 ? `+${fmt(res.points)}` : res.points < 0 ? fmt(res.points) : res.none ? 'No answer' : 'Miss'}</span>
          <span className="reveal-summary">{res.summary}</span>
          <Breakdown res={res} />
        </div>
      ) : r.tiebreak ? (
        <div className="reveal-me won"><span className="reveal-points">{fastest ? `${fastest.name} takes it` : 'Still tied'}</span></div>
      ) : null}
      <ul className="reveal-others" aria-label="Everyone's result" tabIndex={0}>
        {others.map((p) => {
          const x = r.results[p.id];
          return (
            <li key={p.id} className={x.points > 0 ? 'pos' : x.points < 0 ? 'neg' : ''}>
              <Seat p={p} size={30} mood={x.points > 0 ? 'happy' : x.foul ? 'shock' : 'sad'} ring={false} />
              <span className="num">{x.points > 0 ? `+${x.points}` : x.points}</span>
              {p.id === r.fastestId && <b className="first-tag">1st</b>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Standings({ players, meId, animate = true, compact = false }) {
  const seated = players.filter((p) => !p.spectator);
  const byPrev = [...seated].sort((a, b) => a.prevRank - b.prevRank || b.score - a.score);
  const byNow = [...seated].sort((a, b) => a.rank - b.rank || b.score - a.score);
  const [order, setOrder] = useState(animate ? byPrev : byNow);
  const key = byNow.map((p) => `${p.id}:${p.score}`).join('|');
  useLayoutEffect(() => {
    if (!animate) { setOrder(byNow); return; }
    setOrder(byPrev);
    const t = setTimeout(() => {
      setOrder(byNow);
      const me = seated.find((p) => p.id === meId);
      if (me && me.rank < me.prevRank) sfx.rankUp();
    }, 450);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowH = compact ? 48 : 60;
  const top = seated.length ? Math.max(...seated.map((p) => p.score)) : 0;
  return (
    <ol className={`standings ${compact ? 'compact' : ''}`} style={{ height: seated.length * rowH }} aria-label="Standings">
      {seated.map((p) => {
        const i = order.findIndex((x) => x.id === p.id);
        const delta = p.prevRank - p.rank;
        return (
          <li key={p.id} className={`row ${p.id === meId ? 'me' : ''}`} style={{ transform: `translateY(${i * rowH}px)`, height: rowH - 8, '--c': p.color }}>
            <span className="row-rank num">{p.rank}</span>
            <Seat p={p} size={compact ? 30 : 38} ring={false} />
            <span className="row-name">{p.name}{p.isBot && <em className="bot-tag">BOT</em>}{p.connected === false && !p.isBot && <em className="away-tag">away</em>}</span>
            {delta !== 0 && animate && <span className={`row-delta ${delta > 0 ? 'up' : 'down'}`} aria-label={delta > 0 ? `up ${delta}` : `down ${-delta}`}>{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}</span>}
            <span className="row-bar" aria-hidden="true"><i style={{ width: `${top ? (p.score / top) * 100 : 0}%` }} /></span>
            <span className="row-score num">{fmt(p.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SetBreak({ state, me, act }) {
  const r = state.round;
  const { now } = useClock();
  useTicker(true, 250);
  const left = Math.max(0, Math.ceil((state.phaseEndsAt - now()) / 1000));
  const start = r.set * ROUNDS_PER_SET;
  const mvp = [...state.players].filter((p) => !p.spectator && p.history?.length)
    .map((p) => ({ p, gain: (p.history[r.index] ?? p.score) - (start > 0 ? (p.history[start - 1] ?? 0) : 0) }))
    .sort((a, b) => b.gain - a.gain)[0];
  return (
    <div className="setbreak">
      <span className="eyebrow">Set {r.set + 1} of {r.sets} complete</span>
      <h1 className="display-md">Standings</h1>
      {mvp && mvp.gain > 0 && (
        <div className="mvp"><Seat p={mvp.p} size={40} mood="happy" /><span><b>{mvp.p.name}</b> owned this set</span><span className="num mvp-gain">+{fmt(mvp.gain)}</span></div>
      )}
      <Standings players={state.players} meId={me?.id} />
      <div className="setbreak-foot">
        <span className="num">Next set in {left}s</span>
        {state.hostId === me?.id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => act.send('skip')}>Start now</button>}
      </div>
    </div>
  );
}

function Emotes({ act }) {
  return (
    <div className="emotes" role="group" aria-label="Send a reaction">
      {EMOTES.map((e) => <button key={e} type="button" onClick={() => { act.send('emote', e); sfx.tap(); }} aria-label={`React: ${glyphLabel(e)}`}><Glyph k={e} /></button>)}
    </div>
  );
}

export function EmoteLayer({ emotes, players }) {
  return (
    <div className="emote-layer" aria-hidden="true">
      {emotes.map((e) => {
        const p = players.find((x) => x.id === e.id);
        return <span key={e.key} className="emote-float" style={{ left: `${e.x}%`, '--c': p?.color }}><Glyph k={e.emoji} size={44} /><small>{p?.name}</small></span>;
      })}
    </div>
  );
}

export function Game({ state, act, emotes = [], side = true }) {
  const { now } = useClock();
  const [menu, setMenu] = useState(false);
  const me = state.players.find((p) => p.id === state.you?.id);
  const r = state.round;
  const spectator = !me || me.spectator || (r?.tiebreak && !r.tiedIds?.includes(me.id));
  const isHost = state.hostId === me?.id;
  const phase = state.phase;
  const elapsed = () => (r ? (now() - r.startedAt) * state.speed : 0);
  const UI = r && CHALLENGE_UI[r.type];
  const showChallenge = r?.payload && ['play', 'reveal'].includes(phase);
  const myRes = r?.results?.[me?.id];

  const sounded = useRef('');
  useEffect(() => {
    const k = `${phase}:${r?.index}`;
    if (sounded.current === k) return;
    sounded.current = k;
    if (phase === 'reveal' && myRes) (myRes.foul ? sfx.foul : myRes.points > 0 ? sfx.correct : sfx.miss)();
    if (phase === 'play' && r?.type !== 'quickDraw') sfx.go();
  }, [phase, r?.index, myRes]);

  useTicker(phase === 'play', 250);

  const colorOf = (id) => state.players.find((p) => p.id === id)?.color || '#F4EFE6';
  const progress = () => (r ? Math.min(1, elapsed() / r.ms) : 0);
  const pulseMode = phase === 'play' ? 'round' : phase === 'reveal' ? 'flat' : 'idle';
  const secsLeft = r && phase === 'play' ? Math.max(0, Math.ceil((r.ms - elapsed()) / 1000)) : null;

  const answer = (a, at) => act.send('answer', { answer: a, elapsed: at ?? elapsed() });
  const snap = (i) => act.send('snap', { index: i, elapsed: elapsed() });

  return (
    <div className={`screen game phase-${phase} ${r?.double ? 'is-double' : ''}`}>
      <div className="game-body">
      <div className="game-main">
      <Hud state={state} me={me} onMenu={isHost ? () => setMenu(true) : null} />
      {spectator && !r?.tiebreak && <p className="banner">You're watching. You'll get a seat at the next set break.</p>}
      {state.pauseRequested && phase !== 'paused' && <p className="banner">Pausing after this round</p>}
      <main className="stage">
        {(phase === 'intro' || phase === 'tiebreak') && <IntroCard state={state} me={me} />}
        {phase === 'countdown' && <Countdown state={state} />}
        {showChallenge && UI && (
          <div className="challenge-wrap" key={`${r.index}-${r.tiebreak}`}>
            <div className="challenge-title"><span className="eyebrow">{CHALLENGES[r.type].name}{r.double && <b className="x2">×2</b>}</span></div>
            <UI p={r.payload} round={r} elapsed={elapsed} answer={answer} snap={snap} locked={state.you?.answered}
              mySnaps={state.you?.snaps} reveal={phase === 'reveal' ? r.reveal : null} mine={myRes} watch={spectator}
              results={r.results} players={state.players} color={me?.color} />
          </div>
        )}
        {phase === 'reveal' && <RevealBar state={state} me={spectator ? null : me} />}
        {phase === 'ticker' && (
          <div className="ticker"><span className="eyebrow">After round {r.index + 1}</span><Standings players={state.players} meId={me?.id} /></div>
        )}
        {phase === 'setbreak' && <SetBreak state={state} me={me} act={act} />}
        {phase === 'paused' && (
          <div className="paused">
            <span className="eyebrow">Paused</span>
            <h1 className="display-md">{isHost ? 'Take a breather' : 'The host paused the game'}</h1>
            <Standings players={state.players} meId={me?.id} animate={false} compact />
            {isHost && <button type="button" className="btn btn-primary btn-block" onClick={() => act.send('resume')}>Resume</button>}
          </div>
        )}
      </main>
      {['reveal', 'ticker', 'setbreak'].includes(phase) && <Emotes act={act} />}
      </div>
      {side && (
        <aside className="game-side" aria-label="Live standings">
          <div className="side-head"><span className="eyebrow">Room {state.code}</span><span className="eyebrow">{state.players.filter((p) => !p.spectator).length} players</span></div>
          <Standings players={state.players} meId={me?.id} animate={false} compact />
          <p className="side-note">Every fifth round is a Double Pulse. Streaks of 3 and 5 multiply your points.</p>
        </aside>
      )}
      </div>
      <footer className="dock">
        {phase === 'play' && (
          <div className="dock-meta">
            <span className="num">{secsLeft}s</span>
            <span>{r.locks.length}/{state.players.filter((p) => !p.spectator && (!r.tiebreak || r.tiedIds?.includes(p.id))).length} locked</span>
          </div>
        )}
        <PulseLine mode={pulseMode} progress={progress} locks={(r?.locks || []).map((l) => ({ ...l, color: colorOf(l.id) }))} height={64} />
      </footer>
      <EmoteLayer emotes={emotes} players={state.players} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Host controls">
        <div className="sheet-actions">
          {phase === 'paused'
            ? <button type="button" className="btn btn-primary btn-block" onClick={() => { act.send('resume'); setMenu(false); }}>Resume</button>
            : <button type="button" className="btn btn-ghost btn-block" onClick={() => { act.send(state.pauseRequested ? 'resume' : 'pause'); setMenu(false); }}>{state.pauseRequested ? 'Cancel pause' : 'Pause after this round'}</button>}
          {phase === 'setbreak' && <button type="button" className="btn btn-ghost btn-block" onClick={() => { act.send('skip'); setMenu(false); }}>Skip the break</button>}
          <button type="button" className="btn btn-danger btn-block" onClick={() => { act.send('end'); setMenu(false); }}>End game now</button>
          <div className="sheet-row"><span>Sound</span><MuteButton /></div>
        </div>
      </Sheet>
    </div>
  );
}
