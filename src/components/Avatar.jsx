// Hand-built SVG characters. Humans are soft geometric creatures; bots wear a visor and an antenna.
import { memo } from 'react';

const INK = '#0E0D0B';

const BODIES = [
  (c) => <circle cx="32" cy="34" r="24" fill={c} />,
  (c) => <rect x="9" y="11" width="46" height="46" rx="16" fill={c} />,
  (c) => <path d="M32 6C46 6 56 24 56 38C56 52 45 60 32 60C19 60 8 52 8 38C8 24 18 6 32 6Z" fill={c} />,
  (c) => <g fill={c}><circle cx="32" cy="36" r="20" /><circle cx="17" cy="23" r="10" /><circle cx="32" cy="15" r="10" /><circle cx="47" cy="23" r="10" /><circle cx="52" cy="41" r="9" /><circle cx="12" cy="41" r="9" /></g>,
  (c) => <polygon points="32,9 53,21 53,45 32,57 11,45 11,21" fill={c} stroke={c} strokeWidth="8" strokeLinejoin="round" />,
  (c) => <rect x="14" y="5" width="36" height="56" rx="18" fill={c} />,
  (c) => <path d="M34 6C50 7 58 20 57 35C56 50 46 60 31 59C16 58 6 48 7 33C8 18 19 5 34 6Z" fill={c} />,
  (c) => <polygon points="32,10 56,54 8,54" fill={c} stroke={c} strokeWidth="10" strokeLinejoin="round" />,
  (c) => <path d="M10 30C10 16 20 7 32 7C44 7 54 16 54 30V57L46.5 51.5L39 57L32 51.5L25 57L17.5 51.5L10 57Z" fill={c} />,
  (c) => <path d="M20 10C30 4 46 6 52 18C58 30 54 50 42 56C30 62 14 56 10 44C6 32 10 16 20 10Z" fill={c} />,
  (c) => <g fill={c}><circle cx="15" cy="17" r="8" /><circle cx="49" cy="17" r="8" /><ellipse cx="32" cy="37" rx="26" ry="22" /></g>,
  (c) => <g><rect x="10" y="16" width="44" height="42" rx="15" fill={c} /><path d="M32 17C32 9 37 4 45 4C45 12 40 17 32 17Z" fill={c} /><path d="M32 17C32 11 28 7 21 7C21 13 25 17 32 17Z" fill={c} opacity=".75" /></g>,
];

// [eyeY, eyes, mouth]
const FACES = [
  [31, 'dots', 'smile'], [32, 'big', 'o'], [33, 'ovals', 'grin'], [36, 'happy', 'cat'],
  [31, 'big', 'smile'], [27, 'ovals', 'flat'], [31, 'sleepy', 'smile'], [38, 'dots', 'o'],
  [28, 'cyclops', 'grin'], [31, 'ovals', 'tongue'], [35, 'dots', 'cat'], [35, 'big', 'smile'],
];

function Eyes({ kind, y, mood }) {
  const L = 24, R = 40;
  if (mood === 'sad') return <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none"><path d={`M${L - 4} ${y - 2}l7 3`} /><path d={`M${R + 4} ${y - 2}l-7 3`} /></g>;
  if (mood === 'happy' && kind !== 'cyclops') kind = 'happy';
  switch (kind) {
    case 'big': return <g><circle cx={L} cy={y} r="6" fill="#fff" /><circle cx={R} cy={y} r="6" fill="#fff" /><circle cx={L + 1} cy={y + 1} r="3.2" fill={INK} /><circle cx={R + 1} cy={y + 1} r="3.2" fill={INK} /></g>;
    case 'ovals': return <g fill={INK}><ellipse cx={L} cy={y} rx="3" ry="4.6" /><ellipse cx={R} cy={y} rx="3" ry="4.6" /><circle cx={L + 1} cy={y - 1.6} r="1.1" fill="#fff" /><circle cx={R + 1} cy={y - 1.6} r="1.1" fill="#fff" /></g>;
    case 'happy': return <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none"><path d={`M${L - 4} ${y + 1}q4 -5 8 0`} /><path d={`M${R - 4} ${y + 1}q4 -5 8 0`} /></g>;
    case 'sleepy': return <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none"><path d={`M${L - 4} ${y}q4 4 8 0`} /><path d={`M${R - 4} ${y}q4 4 8 0`} /></g>;
    case 'cyclops': return <g><circle cx="32" cy={y} r="9" fill="#fff" /><circle cx="33" cy={y + 1} r="4.5" fill={INK} /><circle cx="35" cy={y - 1} r="1.4" fill="#fff" /></g>;
    default: return <g fill={INK}><circle cx={L} cy={y} r="3.4" /><circle cx={R} cy={y} r="3.4" /></g>;
  }
}

function Mouth({ kind, y, mood }) {
  const my = y + 10;
  if (mood === 'sad') return <path d={`M26 ${my + 4}q6 -6 12 0`} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
  if (mood === 'shock') return <ellipse cx="32" cy={my + 2} rx="3.5" ry="4.5" fill={INK} />;
  if (mood === 'happy') kind = 'grin';
  switch (kind) {
    case 'o': return <circle cx="32" cy={my + 1} r="3" fill={INK} />;
    case 'grin': return <g><path d={`M24 ${my - 1}h16q-1.5 9 -8 9q-6.5 0 -8 -9z`} fill={INK} /><rect x="28" y={my - 1} width="8" height="3" rx="1" fill="#fff" /></g>;
    case 'flat': return <path d={`M27 ${my}h10`} stroke={INK} strokeWidth="3" strokeLinecap="round" />;
    case 'cat': return <path d={`M26 ${my - 1}q3 4 6 0q3 4 6 0`} stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />;
    case 'tongue': return <g><path d={`M25 ${my - 1}q7 8 14 0`} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" /><path d={`M30 ${my + 2.5}q2 4 4 0z`} fill="#FF7AB6" /></g>;
    default: return <path d={`M25 ${my - 1}q7 7 14 0`} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
}

// Bot visors differ per persona so each bot is recognisable at a glance.
const VISORS = ['bar', 'split', 'round', 'bar', 'slit', 'split', 'round', 'slit'];

function BotFace({ index, color, mood }) {
  const v = VISORS[index % VISORS.length];
  const ledY = 32;
  const led = mood === 'sad' ? (x) => <rect key={x} x={x - 4} y={ledY} width="8" height="2.6" rx="1.3" fill={color} />
    : mood === 'happy' ? (x) => <path key={x} d={`M${x - 4} ${ledY + 2}q4 -5 8 0`} stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      : (x) => <rect key={x} x={x - 3} y={ledY - 3} width="6" height="6" rx={v === 'round' ? 3 : 1.2} fill={color} />;
  return (
    <g>
      <line x1="32" y1="11" x2="32" y2="3" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="3.5" r="3" fill={color} stroke={INK} strokeWidth="2" />
      {v === 'split'
        ? <g fill={INK}><rect x="13" y="24" width="17" height="16" rx="6" /><rect x="34" y="24" width="17" height="16" rx="6" /></g>
        : <rect x={v === 'slit' ? 12 : 13} y={v === 'slit' ? 27 : 23} width={v === 'slit' ? 40 : 38} height={v === 'slit' ? 11 : 18} rx={v === 'round' ? 9 : 6} fill={INK} />}
      {[23, 41].map(led)}
      <g stroke={INK} strokeWidth="2.2" strokeLinecap="round"><path d="M25 48h14" /><path d="M27 52h10" opacity=".55" /></g>
    </g>
  );
}

export const Avatar = memo(function Avatar({ index = 0, color = '#FF5A36', bot = false, size = 48, mood, title, className = '' }) {
  const i = ((index % 12) + 12) % 12;
  const [eyeY, eyes, mouth] = FACES[i];
  return (
    <svg className={`avatar ${bot ? 'is-bot' : ''} ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title || (bot ? 'Bot avatar' : 'Player avatar')}>
      {bot ? <rect x="8" y="11" width="48" height="48" rx="14" fill={color} /> : BODIES[i](color)}
      {!bot && <ellipse cx="22" cy="20" rx="6" ry="3.4" transform="rotate(-32 22 20)" fill="#fff" opacity=".28" />}
      {bot ? <BotFace index={index} color={color} mood={mood} /> : (
        <g>
          <Eyes kind={eyes} y={eyeY} mood={mood} />
          <Mouth kind={mouth} y={eyeY} mood={mood} />
          <g fill="#FF7AB6" opacity=".35"><ellipse cx="17" cy={eyeY + 7} rx="3.4" ry="2" /><ellipse cx="47" cy={eyeY + 7} rx="3.4" ry="2" /></g>
        </g>
      )}
    </svg>
  );
});
