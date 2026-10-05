import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { serverNow } from '../net.js';
import { Avatar } from './Avatar.jsx';
import { isMuted, onMute, setMuted } from '../sound.js';

// The clock every timed component reads. The gallery (jury stills) swaps it for a frozen one.
export const ClockContext = createContext({ now: serverNow, frozen: false });
export const useClock = () => useContext(ClockContext);

export function useTicker(active = true, ms = 100) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

export function useFrame(active = true) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf;
    const loop = () => { setT((t) => (t + 1) % 1e6); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function Seat({ p, size = 44, mood, ring = true }) {
  return (
    <span className={`seat-ring ${p.isBot ? 'bot' : ''} ${p.connected === false ? 'away' : ''}`} style={{ '--c': p.color || '#A39C8E', '--s': `${size}px` }}>
      <Avatar index={p.avatar} color={p.color || '#A39C8E'} bot={p.isBot} size={size} mood={mood} title={p.name} />
      {!ring ? null : <i aria-hidden="true" />}
    </span>
  );
}

export function Segmented({ value, options, onChange, disabled, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''}
          disabled={disabled} onClick={() => onChange(o.value)}>
          <span>{o.label}</span>{o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    ref.current?.querySelector('button, [href], input')?.focus();
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button></header>
        {children}
      </div>
    </div>
  );
}

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMute(setM), []);
  return (
    <button type="button" className="icon-btn" onClick={() => setMuted(!m)} aria-label={m ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!m}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {m ? <path d="m22 9-6 6M16 9l6 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>}
      </svg>
    </button>
  );
}

export function Wordmark({ size = 'lg' }) {
  return (
    <span className={`wordmark wordmark-${size}`} role="img" aria-label="PULSE">
      <span aria-hidden="true">PUL</span>
      <svg className="wordmark-beat" viewBox="0 0 60 40" aria-hidden="true"><path d="M0 26h14l5-6 6 18 8-36 6 24h21" /></svg>
      <span aria-hidden="true">SE</span>
    </span>
  );
}

export function Toast({ children, tone = 'info' }) {
  return <div className={`toast toast-${tone}`} role="status">{children}</div>;
}
