// The twelve challenge screens. Each receives:
//   p        – the challenge payload        round – timing (ms, opensAt, startedAt)
//   elapsed  – () => game ms since start    answer(a) / snap(i) – submit
//   locked   – this player has answered      reveal – the answer (reveal phase), mine – my result
//   watch    – spectating (no input)
import { useEffect, useRef, useState } from 'react';
import { sfx } from './sound.js';
import { useFrame } from './components/ui.jsx';
import { needlePos } from './util.js';

const COLOURS = { red: '#FF4D4D', blue: '#4C8DFF', yellow: '#FFD23F', green: '#3EE0A0' };

function optState(i, picked, reveal, correctKey) {
  if (reveal) {
    if (i === correctKey) return 'right';
    if (i === picked) return 'wrong';
    return 'dim';
  }
  if (picked == null) return '';
  return i === picked ? 'picked' : 'dim';
}

function usePick(answer, locked, watch, reveal) {
  const [picked, setPicked] = useState(null);
  const choose = (value, payload) => {
    if (locked || watch || reveal || picked != null) return;
    setPicked(value);
    sfx.lock();
    answer(payload ?? { choice: value });
  };
  return [picked, choose];
}

function Duel({ p, answer, locked, reveal, watch, mine }) {
  const [picked, choose] = usePick(answer, locked, watch, reveal);
  const my = picked ?? mine?.choice;
  return (
    <div className="ch ch-duel">
      <h2 className="ch-prompt">{p.prompt}</h2>
      <div className="duel">
        {p.options.map((o, i) => (
          <button key={o} type="button" className={`opt opt-tall ${optState(i, my, reveal, reveal?.correct)}`} onClick={() => choose(i)} disabled={watch}>
            <span className="opt-text">{o}</span>
            {reveal?.values && <span className="opt-value num">{reveal.values[i]}</span>}
          </button>
        )).reduce((acc, el, i) => (i ? [...acc, <span key="vs" className="duel-vs" aria-hidden="true">or</span>, el] : [el]), [])}
      </div>
    </div>
  );
}

function ClosestCall({ p, answer, locked, reveal, watch, mine, results, players }) {
  const [v, setV] = useState(p.start);
  const [sent, setSent] = useState(false);
  const done = locked || sent || !!reveal || watch;
  const value = reveal && mine?.value != null ? mine.value : v;
  const pct = (x) => ((x - p.min) / (p.max - p.min)) * 100;
  const nudge = (d) => { if (!done) { setV((x) => +Math.min(p.max, Math.max(p.min, x + d * p.step)).toFixed(2)); sfx.tap(); } };
  const lock = () => { if (done) return; setSent(true); sfx.lock(); answer({ value: v }); };
  return (
    <div className="ch ch-closest">
      <h2 className="ch-prompt">{p.prompt}</h2>
      <output className="closest-value num" aria-live="polite">{Number(value).toLocaleString('en-US')}</output>
      <div className="closest-track">
        <input type="range" min={p.min} max={p.max} step={p.step} value={v} disabled={done} aria-label="Your estimate"
          onChange={(e) => setV(Number(e.target.value))} style={{ '--fill': `${pct(v)}%` }} />
        {reveal && (
          <div className="closest-marks" aria-hidden="true">
            {Object.entries(results || {}).filter(([, r]) => r.value != null).map(([id, r]) => (
              <i key={id} className="mark-player" style={{ left: `${pct(r.value)}%`, background: players.find((x) => x.id === id)?.color }} />
            ))}
            <i className="mark-true" style={{ left: `${pct(reveal.correct)}%` }}><b className="num">{reveal.label}</b></i>
          </div>
        )}
        <div className="closest-scale num" aria-hidden="true"><span>{p.min.toLocaleString('en-US')}</span><span>{p.max.toLocaleString('en-US')}</span></div>
      </div>
      {!reveal && (
        <div className="closest-actions">
          <button type="button" className="btn btn-ghost btn-square" onClick={() => nudge(-1)} disabled={done} aria-label="Lower">−</button>
          <button type="button" className="btn btn-primary btn-grow" onClick={lock} disabled={done}>{done ? 'Locked in' : 'Lock it'}</button>
          <button type="button" className="btn btn-ghost btn-square" onClick={() => nudge(1)} disabled={done} aria-label="Higher">+</button>
        </div>
      )}
    </div>
  );
}

function ColorClash({ p, answer, locked, reveal, watch, mine }) {
  const [picked, choose] = usePick(answer, locked, watch, reveal);
  const my = picked ?? mine?.choice;
  return (
    <div className="ch ch-clash">
      <p className="ch-hint">Tap the colour of the ink</p>
      <div className="clash-word" style={{ color: p.ink }}>{p.word}</div>
      <div className="grid-2">
        {p.options.map((o) => (
          <button key={o.key} type="button" className={`opt ${optState(o.key, my, reveal, reveal?.correct)}`} onClick={() => choose(o.key)} disabled={watch}>
            <span className="swatch" style={{ background: COLOURS[o.key] }} aria-hidden="true" />{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Needle({ p, elapsed, answer, locked, reveal, watch, mine }) {
  const [stopAt, setStopAt] = useState(null);
  const done = locked || stopAt != null || !!reveal || watch;
  useFrame(!done);
  const t = stopAt ?? (mine?.elapsed ?? null) ?? elapsed();
  const pos = reveal && mine?.pos != null ? mine.pos : needlePos(p, Math.max(0, t));
  const tap = () => {
    if (done) return;
    const e = elapsed();
    setStopAt(e);
    sfx.lock();
    answer({}, e);
  };
  const inZone = Math.abs(pos - p.center) <= p.half;
  return (
    <div className="ch ch-needle">
      <p className="ch-hint">Stop it inside the zone</p>
      <div className={`needle-track ${stopAt != null || reveal ? (inZone ? 'hit' : 'off') : ''}`}>
        <div className="needle-zone" style={{ left: `${(p.center - p.half) * 100}%`, width: `${p.half * 200}%` }}><i /></div>
        <div className="needle" style={{ left: `${pos * 100}%` }} />
      </div>
      <button type="button" className="pad pad-tap" onPointerDown={tap} disabled={done} aria-label="Stop the needle">
        {stopAt != null || reveal ? (inZone ? 'In the zone' : 'Missed it') : 'TAP'}
      </button>
    </div>
  );
}

function DotCount({ p, elapsed, answer, locked, reveal, watch, mine }) {
  const [picked, choose] = usePick(answer, locked, watch, reveal);
  const visible = reveal || elapsed() < p.showMs;
  useFrame(!reveal && elapsed() < p.showMs + 100);
  const my = picked ?? mine?.choice;
  return (
    <div className="ch ch-dots">
      <p className="ch-hint">{visible && !reveal ? 'Count fast…' : reveal ? `${reveal.correct} dots` : 'How many were there?'}</p>
      <div className={`dot-field ${visible ? '' : 'gone'}`} role="img" aria-label={visible ? 'Dots' : 'Dots hidden'}>
        {visible && p.dots.map(([x, y, r], i) => <i key={i} style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${r * 200}%`, height: `${r * 200}%` }} />)}
        {!visible && <span className="dot-gone">?</span>}
      </div>
      <div className="grid-4">
        {p.options.map((o) => (
          <button key={o} type="button" className={`opt opt-num num ${optState(o, my, reveal, reveal?.correct)}`} onClick={() => choose(o)} disabled={watch}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function QuickDraw({ p, elapsed, answer, locked, reveal, watch, mine }) {
  const [tapAt, setTapAt] = useState(null);
  const done = locked || tapAt != null || !!reveal;
  const e = elapsed();
  const go = e >= p.goAt;
  const fired = useRef(false);
  useFrame(!done);
  useEffect(() => { if (go && !fired.current && !done) { fired.current = true; sfx.go(); } }, [go, done]);
  const t = tapAt ?? mine?.elapsed;
  const foul = t != null && t < p.goAt;
  const tap = () => {
    if (done || watch) return;
    const now = elapsed();
    setTapAt(now);
    now < p.goAt ? sfx.foul() : sfx.lock();
    answer({}, now);
  };
  let label = 'Wait for it…', cls = 'wait';
  if (t != null) { label = foul ? 'Too early!' : `${Math.round(t - p.goAt)} ms`; cls = foul ? 'foul' : 'tapped'; }
  else if (reveal) { label = 'No tap'; cls = 'wait'; }
  else if (go) { label = 'GO!'; cls = 'go'; }
  return (
    <div className="ch ch-draw">
      <button type="button" className={`pad pad-draw ${cls}`} onPointerDown={tap} aria-label="Quick draw pad" aria-live="assertive">
        <span>{label}</span>
        {cls === 'wait' && !reveal && <small>Tap when it turns red</small>}
      </button>
    </div>
  );
}

export function Symbol({ k, size = 40 }) {
  const fills = { diamond: '#FFC145', circle: '#4CC9F0', triangle: '#3EE0A0', square: '#9D8CFF', cross: '#FF7AB6', star: '#FF9A3D' };
  const c = fills[k];
  const shapes = {
    diamond: <path d="M20 3 37 20 20 37 3 20z" />,
    circle: <circle cx="20" cy="20" r="16" />,
    triangle: <path d="M20 4 37 35H3z" />,
    square: <rect x="5" y="5" width="30" height="30" rx="5" />,
    cross: <path d="M14 4h12v10h10v12H26v10H14V26H4V14h10z" />,
    star: <path d="m20 3 5 11 12 1.5-9 8 2.5 12L20 29l-10.5 6.5L12 23.5l-9-8L15 14z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 40 40" fill={c} aria-label={k} role="img">{shapes[k]}</svg>;
}

function MemoryFlash({ p, elapsed, answer, locked, reveal, watch, mine }) {
  const [seq, setSeq] = useState([]);
  const [sent, setSent] = useState(false);
  const e = elapsed();
  const showing = !reveal && e < p.seq.length * p.stepMs + 300;
  useFrame(showing);
  const step = Math.floor(e / p.stepMs);
  const inStep = (e % p.stepMs) < p.stepMs * 0.78;
  const done = locked || sent || !!reveal || watch;
  const press = (i) => {
    if (done || showing) return;
    sfx.tap();
    const next = [...seq, i];
    setSeq(next);
    if (next.length === p.seq.length) { setSent(true); sfx.lock(); answer({ seq: next }); }
  };
  const shown = reveal ? p.seq : seq;
  return (
    <div className="ch ch-memory">
      <div className="memory-stage" aria-live="polite">
        {showing ? (step < p.seq.length && inStep ? <span className="memory-big" key={step}><Symbol k={p.symbols[p.seq[step]]} size={120} /></span> : <span className="memory-big" />)
          : <span className="memory-cue">{reveal ? 'The sequence was' : done ? 'Locked in' : 'Your turn'}</span>}
      </div>
      <div className="memory-slots" role="group" aria-label="Your sequence">
        {p.seq.map((s, i) => {
          const val = shown[i];
          const wrong = reveal && mine && seq.length ? seq[i] !== p.seq[i] : false;
          return <span key={i} className={`slot ${val != null ? 'full' : ''} ${wrong ? 'wrong' : ''}`}>{val != null ? <Symbol k={p.symbols[val]} size={28} /> : <b className="num">{i + 1}</b>}</span>;
        })}
      </div>
      <div className="grid-3">
        {p.symbols.map((k, i) => (
          <button key={k} type="button" className="opt opt-symbol" onClick={() => press(i)} disabled={done || showing} aria-label={k}><Symbol k={k} size={34} /></button>
        ))}
      </div>
      {!done && !showing && seq.length > 0 && <button type="button" className="btn btn-text" onClick={() => setSeq(seq.slice(0, -1))}>Undo</button>}
    </div>
  );
}

function Unscramble({ p, answer, locked, reveal, watch, mine }) {
  const [used, setUsed] = useState([]); // indices into p.letters, in order
  const [sent, setSent] = useState(false);
  const done = locked || sent || !!reveal || watch;
  const add = (i) => {
    if (done || used.includes(i)) return;
    sfx.tap();
    const next = [...used, i];
    setUsed(next);
    if (next.length === p.letters.length) { setSent(true); sfx.lock(); answer({ word: next.map((j) => p.letters[j]).join('') }); }
  };
  const remove = (k) => { if (!done) setUsed(used.filter((_, j) => j !== k)); };
  const word = reveal ? reveal.label.split('') : used.map((j) => p.letters[j]);
  return (
    <div className="ch ch-unscramble">
      <p className="ch-hint">{reveal ? (mine?.correct ? 'Nailed it' : `You had ${mine?.summary || '—'}`) : 'Spell the hidden word'}</p>
      <div className={`slots ${reveal ? (mine?.correct ? 'right' : 'wrong') : ''}`}>
        {p.letters.map((_, k) => (
          <button key={k} type="button" className={`letter slot-letter ${word[k] ? 'full' : ''}`} onClick={() => remove(k)} disabled={done || !word[k]} aria-label={word[k] ? `Remove ${word[k]}` : 'Empty'}>{word[k] || ''}</button>
        ))}
      </div>
      <div className="tiles">
        {p.letters.map((l, i) => (
          <button key={i} type="button" className={`letter tile ${used.includes(i) ? 'spent' : ''}`} onClick={() => add(i)} disabled={done || used.includes(i)}>{l}</button>
        ))}
      </div>
      {!done && used.length > 0 && <button type="button" className="btn btn-text" onClick={() => setUsed([])}>Clear</button>}
    </div>
  );
}

function OddOneOut({ p, answer, locked, reveal, watch, mine }) {
  const [picked, choose] = usePick(answer, locked, watch, reveal);
  const my = picked ?? mine?.choice;
  return (
    <div className="ch ch-odd">
      <p className="ch-hint">{reveal?.why || "Which one doesn't belong?"}</p>
      <div className="grid-2">
        {p.words.map((w, i) => (
          <button key={w} type="button" className={`opt opt-word ${optState(i, my, reveal, reveal?.correct)}`} onClick={() => choose(i)} disabled={watch}>{w}</button>
        ))}
      </div>
    </div>
  );
}

function MissingLetter({ p, answer, locked, reveal, watch, mine }) {
  const [picked, choose] = usePick(answer, locked, watch, reveal);
  const my = picked ?? mine?.choice;
  const gap = reveal ? reveal.correct : my;
  return (
    <div className="ch ch-missing">
      <p className="ch-hint">Fill the gap</p>
      <div className="missing-word" role="img" aria-label={`${p.before} blank ${p.after}`}>
        {p.before.split('').map((l, i) => <span key={`b${i}`}>{l}</span>)}
        <span className={`gap ${gap ? 'full' : ''} ${reveal ? 'right' : ''}`}>{gap || ''}</span>
        {p.after.split('').map((l, i) => <span key={`a${i}`}>{l}</span>)}
      </div>
      <div className="grid-4">
        {p.options.map((o) => (
          <button key={o} type="button" className={`opt opt-letter ${optState(o, my, reveal, reveal?.correct)}`} onClick={() => choose(o)} disabled={watch}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function CategorySnap({ p, elapsed, snap, reveal, watch, mySnaps = [], color }) {
  const [local, setLocal] = useState([]);
  const e = elapsed();
  useFrame(!reveal);
  const tapped = new Set([...mySnaps, ...local]);
  const live = p.words.map((w, i) => ({ ...w, i })).filter((w) => e >= w.at && e < w.at + p.visibleMs);
  const tap = (i) => {
    if (watch || reveal || tapped.has(i)) return;
    setLocal((l) => [...l, i]);
    sfx.tap();
    snap(i);
  };
  if (reveal) {
    return (
      <div className="ch ch-snap">
        <p className="ch-hint">Words that were {p.label}</p>
        <div className="snap-review">
          {p.words.map((w, i) => {
            const hit = reveal.correct.includes(i);
            const mine = tapped.has(i);
            return <span key={i} className={`chip ${hit ? 'hit' : ''} ${mine ? (hit ? 'got' : 'bad') : ''}`}>{w.text}{mine && <b aria-label={hit ? 'you snapped, correct' : 'you snapped, wrong'}>{hit ? '✓' : '✕'}</b>}</span>;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="ch ch-snap">
      <p className="snap-label">Tap only <strong>{p.label}</strong></p>
      <div className="snap-lanes">
        {[0, 1, 2].map((lane) => {
          const w = live.find((x) => x.i % 3 === lane);
          if (!w) return <div key={lane} className="snap-lane" />;
          const life = 1 - (e - w.at) / p.visibleMs;
          return (
            <div key={lane} className="snap-lane">
              <button type="button" key={w.i} className={`snap-word ${tapped.has(w.i) ? 'snapped' : ''}`} style={{ '--life': life, '--c': color }} onPointerDown={() => tap(w.i)} disabled={watch}>
                {w.text}
                <i aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <p className="snap-count num">{tapped.size} snapped</p>
    </div>
  );
}

export const CHALLENGE_UI = {
  higherLower: Duel, whichFirst: Duel, closestCall: ClosestCall, colorClash: ColorClash, needle: Needle, dotCount: DotCount,
  quickDraw: QuickDraw, memoryFlash: MemoryFlash, unscramble: Unscramble, oddOneOut: OddOneOut, missingLetter: MissingLetter,
  categorySnap: CategorySnap,
};
