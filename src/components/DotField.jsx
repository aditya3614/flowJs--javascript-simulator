import React, { useEffect, useRef } from 'react';

const STEP = 28;                 // grid pitch in CSS pixels — must match `.dotfield` in app.css
const RGB = '217, 119, 87';      // terracotta
const FPS = 30;                  // a twinkle does not need 60; this keeps the cost negligible
const DENSITY = 0.035;           // fraction of grid cells that are twinkling at any moment
const MAX_TWINKLES = 140;

/**
 * The page background: a faint grid of terracotta dots, a few of which flicker.
 *
 * The resting grid is plain CSS (`.dotfield`), so it costs nothing and is there
 * even before scripts run. This canvas only draws the dots that are currently
 * twinkling, snapped to the same grid, each fading in and out on its own clock
 * with a little jitter so it reads as a flicker rather than a pulse.
 *
 * With `prefers-reduced-motion` the canvas stays empty and only the static
 * grid remains.
 */
export default function DotField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0; let height = 0; let cols = 0; let rows = 0;
    let twinkles = [];
    let raf = 0;
    let last = 0;

    const spawn = (now, fresh) => ({
      x: (Math.floor(Math.random() * cols) * STEP) + STEP / 2,
      y: (Math.floor(Math.random() * rows) * STEP) + STEP / 2,
      start: fresh ? now - Math.random() * 3000 : now,   // stagger the first wave
      life: 1600 + Math.random() * 2800,
      peak: 0.4 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      rate: 0.012 + Math.random() * 0.02,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / STEP);
      rows = Math.ceil(height / STEP);
      const count = Math.min(MAX_TWINKLES, Math.round(cols * rows * DENSITY));
      const now = performance.now();
      twinkles = Array.from({ length: count }, () => spawn(now, true));
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      last = now;

      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < twinkles.length; i += 1) {
        const t = twinkles[i];
        const p = (now - t.start) / t.life;
        if (p >= 1) { twinkles[i] = spawn(now, false); continue; }
        if (p < 0) continue;

        const envelope = Math.sin(Math.PI * p) ** 2;                 // fade in, fade out
        const flicker = 0.78 + 0.22 * Math.sin(now * t.rate + t.phase);
        const a = t.peak * envelope * flicker;

        ctx.fillStyle = `rgba(${RGB}, ${a * 0.16})`;                // soft halo
        ctx.beginPath(); ctx.arc(t.x, t.y, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${RGB}, ${a})`;                       // the dot
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.7, 0, Math.PI * 2); ctx.fill();
      }
    };

    const start = () => {
      cancelAnimationFrame(raf);
      resize();
      if (reduce.matches) { ctx.clearRect(0, 0, width, height); return; }
      raf = requestAnimationFrame(frame);
    };

    start();
    window.addEventListener('resize', start);
    reduce.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', start);
      reduce.removeEventListener('change', start);
    };
  }, []);

  return (
    <div className="dotfield" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
