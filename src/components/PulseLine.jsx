// The signature element: one waveform along the bottom of every screen.
// idle  – a slow heartbeat scrolling past (lobby, menus)
// round – the timer: a live trace drawn left to right that beats faster and flattens as time runs out,
//         with a spike in a player's colour at the moment they lock in
// flat  – a still line (reveals, reduced motion)
import { useEffect, useRef } from 'react';

const SIGNAL = '#FF5A36';

export function ecg(p) {
  const g = (c, w, a) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
  return g(0.12, 0.025, 0.12) - g(0.235, 0.008, 0.14) + g(0.27, 0.011, 1) - g(0.305, 0.01, 0.32) + g(0.5, 0.045, 0.24);
}

const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PulseLine({ mode = 'idle', progress, locks = [], color = SIGNAL, height = 72, className = '', bpm = 62 }) {
  const ref = useRef(null);
  const props = useRef({});
  props.current = { mode, progress, locks, color, bpm };
  const seen = useRef(new Map());

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let raf = 0, w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    const still = reduce();
    const t0 = performance.now();
    let visible = true;
    const animated = () => !still || props.current.mode === 'round';
    // Only animate while on screen; always paint at least once after a resize.
    const schedule = (force = false) => { if (!raf && (force || (visible && animated()))) raf = requestAnimationFrame(draw); };
    resize();
    const ro = new ResizeObserver(() => { resize(); schedule(true); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); });
    io.observe(canvas);

    const draw = (now) => {
      raf = 0;
      const { mode: m, progress: prog, locks: lk, color: col, bpm: rate } = props.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const base = h * 0.66;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (m === 'round') {
        const x1 = Math.max(0, Math.min(1, typeof prog === 'function' ? prog() : prog ?? 0));
        // the road ahead: a dotted baseline
        ctx.strokeStyle = 'rgba(244,239,230,0.16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.moveTo(x1 * w, base); ctx.lineTo(w, base); ctx.stroke();
        ctx.setLineDash([]);
        // the trace so far
        ctx.beginPath();
        let phase = 0;
        const step = 1 / Math.max(1, w);
        for (let x = 0; x <= x1; x += step) {
          const per = 0.17 - 0.1 * x; // beats quicken toward the buzzer
          phase += step / per;
          const amp = h * 0.42 * (1 - 0.78 * x);
          const y = base - ecg(phase % 1) * amp;
          if (x === 0) ctx.moveTo(0, y); else ctx.lineTo(x * w, y);
        }
        ctx.shadowColor = col; ctx.shadowBlur = 10;
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.shadowBlur = 0;
        // head of the trace
        if (x1 > 0 && x1 < 1) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x1 * w, base, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now / 90);
          ctx.beginPath(); ctx.arc(x1 * w, base, 9, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        // lock-in spikes
        for (const l of lk || []) {
          if (!seen.current.has(l.id)) seen.current.set(l.id, now);
          const grow = still ? 1 : Math.min(1, (now - seen.current.get(l.id)) / 260);
          const e = 1 - (1 - grow) ** 3;
          const x = Math.max(4, Math.min(w - 4, l.t * w));
          const top = base - (h * 0.58) * e;
          ctx.strokeStyle = l.color; ctx.lineWidth = 2.4;
          ctx.shadowColor = l.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(x - 5, base); ctx.lineTo(x - 1.5, top); ctx.lineTo(x + 2, base + 6 * e); ctx.lineTo(x + 5, base); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = l.color;
          ctx.beginPath(); ctx.arc(x - 1.5, top, 3.2, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        seen.current.clear();
        const speed = m === 'idle' && !still ? (rate / 60) : 0;
        const beatW = Math.max(160, w / 4);
        const shift = ((now - t0) / 1000) * speed * beatW;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 1) {
          const p = (((x + shift) / beatW) % 1 + 1) % 1;
          const fade = Math.min(1, x / (w * 0.18), (w - x) / (w * 0.18));
          const y = base - (m === 'flat' ? 0 : ecg(p) * h * 0.46 * fade);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'rgba(255,90,54,0)');
        grad.addColorStop(0.2, col);
        grad.addColorStop(0.8, col);
        grad.addColorStop(1, 'rgba(255,90,54,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 2;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (visible && animated()) schedule();
    };
    schedule(true);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [mode]);

  return <canvas ref={ref} className={`pulse-line ${className}`} style={{ height }} aria-hidden="true" />;
}
