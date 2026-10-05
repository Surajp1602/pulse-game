// Synthesized sound and haptics: no audio files, nothing to load, everything under 300 ms.
import { storage } from './net.js';

let ctx = null;
let muted = storage.get('pulse.muted', false);
const subs = new Set();

export const isMuted = () => muted;
export const onMute = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function setMuted(v) { muted = v; storage.set('pulse.muted', v); subs.forEach((f) => f(v)); }

function audio() {
  if (muted) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.18, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

export const sfx = {
  tap: () => { tone(720, { dur: 0.05, type: 'triangle', gain: 0.08 }); buzz(8); },
  lock: () => { tone(520, { dur: 0.07, type: 'triangle', gain: 0.12 }); tone(880, { at: 0.05, dur: 0.09, type: 'triangle', gain: 0.1 }); buzz(14); },
  tick: () => tone(440, { dur: 0.06, type: 'square', gain: 0.05 }),
  go: () => { tone(660, { dur: 0.12, type: 'sawtooth', gain: 0.08 }); tone(990, { at: 0.06, dur: 0.16, type: 'triangle', gain: 0.12 }); buzz(20); },
  beat: () => { tone(70, { dur: 0.14, gain: 0.25, slide: -20 }); tone(64, { at: 0.16, dur: 0.12, gain: 0.18, slide: -16 }); },
  correct: () => { tone(660, { dur: 0.1, type: 'triangle' }); tone(990, { at: 0.08, dur: 0.18, type: 'triangle' }); buzz([18, 40, 18]); },
  miss: () => { tone(180, { dur: 0.22, type: 'sine', gain: 0.16, slide: -60 }); buzz(40); },
  foul: () => { tone(140, { dur: 0.3, type: 'square', gain: 0.07, slide: -40 }); buzz([60, 30, 60]); },
  rankUp: () => [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.06, dur: 0.12, type: 'triangle', gain: 0.1 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.24, type: 'triangle', gain: 0.12 })),
  join: () => tone(600, { dur: 0.08, type: 'sine', gain: 0.08, slide: 200 }),
};
