import { useEffect, useState } from 'react';
import { BOT_PERSONAS, LENGTHS, FAMILIES, MAX_PLAYERS, MIN_PLAYERS, SUGGESTED_PLAYERS } from '../../shared/config.js';
import { Avatar } from '../components/Avatar.jsx';
import { PulseLine } from '../components/PulseLine.jsx';
import { Seat, Segmented, Sheet, MuteButton, Toast } from '../components/ui.jsx';
import { sfx } from '../sound.js';

const DIFF_OPTS = [{ value: 'easy', label: 'Easy' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Hard' }];
const PERSONA_COLORS = ['#FF5A36', '#FFC145', '#3EE0A0', '#4CC9F0', '#9D8CFF', '#FF7AB6', '#E8E1D4', '#FF9A3D'];

function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const [host, setHost] = useState(local ? null : location.host);
  useEffect(() => {
    if (!local) return;
    fetch('/info').then((r) => r.json()).then((d) => setHost(d.lan?.[0] ? `${d.lan[0]}${location.port ? `:${location.port}` : ''}` : location.host)).catch(() => setHost(location.host));
  }, [local]);
  const url = `${location.protocol}//${host || location.host}/r/${code}`;
  const share = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Join my PULSE room', text: `Room code ${code}`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* dismissed */ }
  };
  return (
    <div className="room-code">
      <span className="eyebrow">Room code</span>
      <button type="button" className="code-big" onClick={share} aria-label={`Room code ${code.split('').join(' ')}. Share invite link`}>
        {code.split('').map((ch, i) => <span key={i}>{ch}</span>)}
      </button>
      <span className="code-sub">{copied ? 'Invite link copied' : host ? <>Friends open <b>{host}</b> on the same Wi-Fi · tap code to share</> : 'Finding your network address…'}</span>
    </div>
  );
}

function SeatTile({ p, me, hostId, onOpen }) {
  const isMe = p.id === me?.id;
  let status;
  if (p.isBot) status = <><em className="bot-tag">BOT</em>{p.tag} · {p.difficulty}</>;
  else if (!p.connected) status = <span className="muted">Reconnecting…</span>;
  else if (p.id === hostId) status = <span className="host-tag">Host</span>;
  else status = p.ready ? <span className="ready-tag">Ready</span> : <span className="muted">Not ready</span>;
  return (
    <li className={`seat ${isMe ? 'me' : ''} ${p.ready || p.isBot || p.id === hostId ? 'is-ready' : ''}`} style={{ '--c': p.color }}>
      <button type="button" className="seat-btn" onClick={onOpen} disabled={!onOpen} aria-label={`${p.name}${p.isBot ? ', bot' : ''}${isMe ? ', you' : ''}`}>
        <Seat p={p} size={52} mood={p.ready || p.isBot ? 'happy' : undefined} />
        <span className="seat-name">{p.name}{isMe && <small> (you)</small>}</span>
        <span className="seat-status">{status}</span>
      </button>
    </li>
  );
}

function BotPicker({ open, onClose, state, act }) {
  const used = new Set(state.players.filter((p) => p.isBot).map((p) => p.persona));
  const [diff, setDiff] = useState(state.settings.botDifficulty === 'mixed' ? 'normal' : state.settings.botDifficulty);
  const free = MAX_PLAYERS - state.players.filter((p) => !p.spectator).length;
  return (
    <Sheet open={open} onClose={onClose} title="Add a bot">
      <p className="sheet-lede">Bots play by the same rules and see nothing you can't. They fill seats; they never change scoring.</p>
      <Segmented label="Bot difficulty" value={diff} onChange={setDiff} options={DIFF_OPTS} />
      <ul className="persona-list">
        {BOT_PERSONAS.map((b, i) => {
          const taken = used.has(b.id);
          return (
            <li key={b.id}>
              <button type="button" className="persona" disabled={taken || free <= 0} onClick={() => { act.send('bot:add', { persona: b.id, difficulty: diff }); sfx.join(); onClose(); }}>
                <span className="seat-ring bot" style={{ '--c': PERSONA_COLORS[i], '--s': '44px' }}><Avatar index={b.avatar} color={PERSONA_COLORS[i]} bot size={44} /><i /></span>
                <span className="persona-text"><b>{b.name}</b><span className="persona-tag">{b.tag}</span><small>{b.line}</small></span>
                <span className="persona-add" aria-hidden="true">{taken ? 'In room' : '+'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function PlayerSheet({ p, onClose, act }) {
  if (!p) return null;
  return (
    <Sheet open={!!p} onClose={onClose} title={p.name}>
      <div className="player-sheet">
        <Seat p={p} size={72} mood="happy" />
        {p.isBot ? (
          <>
            <p className="sheet-lede"><b>{p.tag}.</b> {BOT_PERSONAS.find((b) => b.id === p.persona)?.line}</p>
            <Segmented label="Difficulty" value={p.difficulty} onChange={(d) => act.send('bot:difficulty', { id: p.id, difficulty: d })} options={DIFF_OPTS} />
            <button type="button" className="btn btn-danger btn-block" onClick={() => { act.send('kick', p.id); onClose(); }}>Remove bot</button>
          </>
        ) : (
          <button type="button" className="btn btn-danger btn-block" onClick={() => { act.send('kick', p.id); onClose(); }}>Remove {p.name} from the room</button>
        )}
      </div>
    </Sheet>
  );
}

export function Lobby({ state, act }) {
  const me = state.players.find((p) => p.id === state.you?.id);
  const isHost = state.hostId === me?.id;
  const seated = state.players.filter((p) => !p.spectator);
  const [picker, setPicker] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [startErr, setStartErr] = useState('');
  const s = state.settings;
  const missing = Math.max(0, SUGGESTED_PLAYERS - seated.length);
  const can = state.canStart || { ok: false };
  const unready = (can.unready || []).length;
  const start = async (force = false) => {
    setStartErr('');
    const r = await act.start(force);
    if (!r.ok && r.reason === 'need-players') setStartErr('You need at least 2 players. Add a bot?');
  };

  const setFam = (k) => {
    const f = { ...s.families, [k]: !s.families[k] };
    if (Object.values(f).some(Boolean)) act.send('settings', { families: f });
  };

  return (
    <div className="screen lobby">
      <header className="lobby-top">
        <button type="button" className="btn btn-text" onClick={act.leave}>← Leave</button>
        <MuteButton />
      </header>
      <div className="lobby-grid">
        <div className="lobby-main">
          <RoomCode code={state.code} />

          {missing > 0 && (
            <div className="suggest panel" role="note">
              <div>
                <b>PULSE is best with 4 or more.</b>
                <span>{isHost ? `Add ${missing} bot${missing > 1 ? 's' : ''} to fill the room, or wait for friends.` : 'Waiting for more players.'}</span>
              </div>
              {isHost && <button type="button" className="btn btn-primary btn-sm" onClick={() => { act.send('bot:fill', SUGGESTED_PLAYERS); sfx.join(); }}>Add {missing} bot{missing > 1 ? 's' : ''}</button>}
            </div>
          )}

          <section aria-label="Players">
            <h2 className="section-head"><span>Players</span><span className="num">{seated.length}/{MAX_PLAYERS}</span></h2>
            <ul className="seats">
              {seated.map((p) => (
                <SeatTile key={p.id} p={p} me={me} hostId={state.hostId}
                  onOpen={isHost && p.id !== me?.id ? () => setOpenId(p.id) : null} />
              ))}
              {seated.length < MAX_PLAYERS && (
                <li className="seat empty">
                  {isHost
                    ? <button type="button" className="seat-btn" onClick={() => setPicker(true)}><span className="seat-plus" aria-hidden="true">+</span><span className="seat-name">Add a bot</span><span className="seat-status muted">{MAX_PLAYERS - seated.length} open seat{MAX_PLAYERS - seated.length > 1 ? 's' : ''}</span></button>
                    : <div className="seat-btn"><span className="seat-plus" aria-hidden="true" /><span className="seat-name muted">{MAX_PLAYERS - seated.length} open seat{MAX_PLAYERS - seated.length > 1 ? 's' : ''}</span></div>}
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className="lobby-side">
          <section className="panel settings" aria-label="Game settings">
            <h2 className="section-head"><span>Game</span>{!isHost && <span className="muted small">Host decides</span>}</h2>
            <div className="setting">
              <span className="field-label">Length</span>
              <Segmented label="Game length" value={s.length} disabled={!isHost} onChange={(v) => act.send('settings', { length: v })}
                options={Object.entries(LENGTHS).map(([k, v]) => ({ value: k, label: v.label, hint: `${v.sets * 5} rounds · ~${v.minutes} min` }))} />
            </div>
            <div className="setting">
              <span className="field-label">Challenges</span>
              <div className="toggles">
                {Object.entries(FAMILIES).map(([k, f]) => (
                  <button key={k} type="button" className={`toggle ${s.families[k] ? 'on' : ''}`} aria-pressed={s.families[k]} disabled={!isHost} onClick={() => setFam(k)}>
                    <b>{f.label}</b><small>{f.blurb}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="field-label">Bot level</span>
              <Segmented label="Bot level" value={s.botDifficulty} disabled={!isHost} onChange={(v) => act.send('settings', { botDifficulty: v })}
                options={[...DIFF_OPTS, { value: 'mixed', label: 'Mixed' }]} />
            </div>
          </section>
        </aside>
      </div>

      <footer className="lobby-bar">
        {startErr && <Toast tone="warn">{startErr}</Toast>}
        {isHost ? (
          seated.length < MIN_PLAYERS ? (
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => { act.send('bot:add', {}); sfx.join(); }}>Add a bot to start</button>
          ) : can.ok ? (
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => start(false)}>Start the game</button>
          ) : (
            <div className="bar-split">
              <button type="button" className="btn btn-ghost btn-big btn-grow" disabled>Waiting on {unready === 1 ? state.players.find((p) => p.id === can.unready[0])?.name : `${unready} players`}</button>
              <button type="button" className="btn btn-primary btn-big" onClick={() => start(true)}>Start anyway</button>
            </div>
          )
        ) : (
          <button type="button" className={`btn btn-big btn-block ${me?.ready ? 'btn-ready' : 'btn-primary'}`} aria-pressed={!!me?.ready}
            onClick={() => { act.send('ready', !me?.ready); sfx.lock(); }}>
            {me?.ready ? 'Ready ✓ · tap to undo' : "I'm ready"}
          </button>
        )}
        <PulseLine mode="idle" height={44} />
      </footer>

      <BotPicker open={picker} onClose={() => setPicker(false)} state={state} act={act} />
      <PlayerSheet p={state.players.find((p) => p.id === openId)} onClose={() => setOpenId(null)} act={act} />
    </div>
  );
}
