import { useEffect, useRef, useState } from 'react';
import { AVATAR_COUNT, PLAYER_COLORS } from '../../shared/config.js';
import { Avatar } from '../components/Avatar.jsx';
import { PulseLine } from '../components/PulseLine.jsx';
import { Wordmark, MuteButton, Toast } from '../components/ui.jsx';
import { getProfile, saveProfile } from '../net.js';
import { sfx } from '../sound.js';

const CODE_RE = /[^BCDFGHJKLMNPQRSTVWXZ]/g;

function CodeInput({ value, onChange, onDone }) {
  const ref = useRef(null);
  return (
    <label className="code-input" onClick={() => ref.current?.focus()}>
      <span className="sr-only">Room code</span>
      <input ref={ref} value={value} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck="false" maxLength={4}
        aria-label="Room code" onChange={(e) => { const v = e.target.value.toUpperCase().replace(CODE_RE, '').slice(0, 4); onChange(v); if (v.length === 4) onDone?.(v); }} />
      {[0, 1, 2, 3].map((i) => <span key={i} className={`code-cell ${value[i] ? 'full' : ''} ${i === value.length ? 'caret' : ''}`} aria-hidden="true">{value[i] || ''}</span>)}
    </label>
  );
}

export function Home({ initialCode = '', act, notice }) {
  const [profile, setProfile] = useState(getProfile);
  const [code, setCode] = useState(initialCode.toUpperCase().replace(CODE_RE, '').slice(0, 4));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(notice || '');
  const [room, setRoom] = useState(null);
  const nameRef = useRef(null);
  const color = PLAYER_COLORS[profile.avatar % PLAYER_COLORS.length];

  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => {
    setRoom(null);
    if (code.length === 4) act.peek(code).then((r) => setRoom(r.ok ? r : { missing: true }));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const needName = () => {
    if (profile.name.trim()) return false;
    setError('Add your name first: it is how everyone sees you.');
    nameRef.current?.focus();
    return true;
  };
  const create = async () => {
    if (needName()) return;
    setBusy('create'); setError('');
    const r = await act.create(profile);
    setBusy(null);
    if (!r.ok) setError('Could not reach the game server. Check your connection and try again.');
    else sfx.join();
  };
  const join = async (c = code) => {
    if (needName()) return;
    if (c.length !== 4) { setError('Room codes are four letters.'); return; }
    setBusy('join'); setError('');
    const r = await act.join(c, profile);
    setBusy(null);
    if (!r.ok) setError(r.reason === 'no-room' ? `No room called ${c}. Check the code with your host.` : 'Could not join. Try again.');
    else sfx.join();
  };
  const joining = initialCode.length === 4;

  return (
    <div className="screen home">
      <header className="home-top"><span className="eyebrow">Party game · 2–8 players</span><MuteButton /></header>
      <section className="home-hero">
        <Wordmark />
        <p className="home-lede">Twelve micro-games. Everyone plays the same one at the same moment, on their own phone. Be right, be fast.</p>
      </section>

      <section className="home-card panel" aria-label="Your player">
        <div className="profile">
          <span className="profile-avatar" style={{ '--c': color }}><Avatar index={profile.avatar} color={color} size={72} mood="happy" /></span>
          <label className="field">
            <span className="field-label">Your name</span>
            <input ref={nameRef} value={profile.name} maxLength={14} placeholder="e.g. Priya" autoComplete="nickname"
              onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (joining ? join() : create()); }} />
          </label>
        </div>
        <div className="avatar-picker" role="radiogroup" aria-label="Choose your character">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={profile.avatar === i} aria-label={`Character ${i + 1}`}
              className={profile.avatar === i ? 'on' : ''} style={{ '--c': PLAYER_COLORS[i % PLAYER_COLORS.length] }}
              onClick={() => { setProfile({ ...profile, avatar: i }); sfx.tap(); }}>
              <Avatar index={i} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} size={40} />
            </button>
          ))}
        </div>

        <div className={`home-actions ${joining ? 'joining' : ''}`}>
          <div className="join-row">
            <CodeInput value={code} onChange={setCode} />
            <button type="button" className={`btn ${joining || code.length === 4 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => join()} disabled={busy != null || code.length !== 4}>
              {busy === 'join' ? 'Joining…' : 'Join'}
            </button>
          </div>
          <p className="join-hint" aria-live="polite">
            {room?.missing ? `No room called ${code}.` : room?.ok ? (room.phase === 'lobby' ? `${room.players} in the lobby. Jump in.` : 'Game in progress: you can watch and get a seat at the next set break.') : 'Got a code from a friend? Type it here.'}
          </p>
          <div className="or" aria-hidden="true"><span>or</span></div>
          <button type="button" className={`btn btn-block ${joining || code.length === 4 ? 'btn-ghost' : 'btn-primary btn-big'}`} onClick={create} disabled={busy != null}>
            {busy === 'create' ? 'Opening a room…' : 'Host a new room'}
          </button>
        </div>
        {error && <Toast tone="warn">{error}</Toast>}
      </section>

      <section className="how" aria-label="How to play">
        <ol>
          <li><b className="num">01</b><span>One phone each. The host shares a four-letter code.</span></li>
          <li><b className="num">02</b><span>Every round is a different 5–10 second challenge: trivia, reflexes or words.</span></li>
          <li><b className="num">03</b><span>Right and fast scores most. Streaks multiply. Every fifth round is worth double.</span></li>
        </ol>
      </section>
      <footer className="dock"><PulseLine mode="idle" height={64} /></footer>
    </div>
  );
}
