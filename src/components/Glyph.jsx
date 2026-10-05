// Custom reaction glyphs, drawn in the trace palette so reactions match the rest of the game.
const G = {
  fire: { c: '#FF9A3D', label: 'Fire', d: <path d="M16 3c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-10z" /> },
  haha: { c: '#FFC145', label: 'Haha', d: <g><circle cx="16" cy="16" r="12" /><path d="M10 13q2-2 4 0M18 13q2-2 4 0" stroke="#0E0D0B" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M9.5 18h13q-1 6-6.5 6t-6.5-6z" fill="#0E0D0B" /></g> },
  wow: { c: '#4CC9F0', label: 'Wow', d: <g><circle cx="16" cy="16" r="12" /><circle cx="12" cy="13" r="1.8" fill="#0E0D0B" /><circle cx="20" cy="13" r="1.8" fill="#0E0D0B" /><ellipse cx="16" cy="21" rx="3" ry="3.6" fill="#0E0D0B" /></g> },
  clap: { c: '#3EE0A0', label: 'Applause', d: <path d="m16 2 2.6 8.4L27 8l-5.4 6.8L30 18l-8.6 1.4L24 28l-8-4.6L8 28l2.6-8.6L2 18l8.4-3.2L5 8l8.4 2.4z" /> },
  dead: { c: '#E8E1D4', label: 'Dead', d: <g><path d="M16 4c6.6 0 11 4.4 11 10 0 3.4-1.6 5.6-4 7v4H9v-4c-2.4-1.4-4-3.6-4-7C5 8.4 9.4 4 16 4z" /><path d="m9.5 12.5 4 4m0-4-4 4M18.5 12.5l4 4m0-4-4 4" stroke="#0E0D0B" strokeWidth="2" strokeLinecap="round" /><path d="M13 25v-3m3 3v-3m3 3v-3" stroke="#0E0D0B" strokeWidth="1.6" /></g> },
  love: { c: '#FF7AB6', label: 'Love', d: <path d="M16 27S4 19.5 4 11.5A6 6 0 0 1 16 9a6 6 0 0 1 12 2.5C28 19.5 16 27 16 27z" /> },
};

export const GLYPHS = Object.keys(G);
export const glyphLabel = (k) => G[k]?.label || k;

export function Glyph({ k, size = 26 }) {
  const g = G[k];
  if (!g) return null;
  return <svg width={size} height={size} viewBox="0 0 32 32" fill={g.c} aria-hidden="true">{g.d}</svg>;
}
