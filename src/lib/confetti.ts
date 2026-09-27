// Capsule confetti on a canvas: the same rounded shapes as the timeline, in a given palette.
// "rise" launches streaks up from the bottom of the screen, like the day taking off. "fall"
// bursts from a point and then lets confetti drift down from the top.

export interface Burst {
  colours: string[];
  mode: 'rise' | 'fall';
  /** For "fall": where the burst starts, as fractions of the canvas size. */
  origin?: { x: number; y: number };
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  w: number;
  /** Angle; "rise" bits point along their path instead. */
  a: number;
  va: number;
  /** Phase of the tumble (drawn as a squash across the capsule). */
  f: number;
  vf: number;
  c: string;
  born: number;
  life: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Start the animation. Returns a function that stops it and clears the canvas. */
export function launch(canvas: HTMLCanvasElement, burst: Burst): () => void {
  const got = canvas.getContext('2d');
  if (!got) return () => {};
  const ctx: CanvasRenderingContext2D = got;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.scale(dpr, dpr);

  const bits: Bit[] = [];
  const colour = () => burst.colours[Math.floor(Math.random() * burst.colours.length)];
  const t0 = performance.now();
  let last = t0;
  let raf = 0;
  // Bits still to release: [when (ms after start), how many].
  const waves: [number, number][] =
    burst.mode === 'rise'
      ? [
          [0, 34],
          [120, 30],
          [260, 26],
          [420, 18],
        ]
      : [
          [0, 56],
          [250, 14],
          [500, 14],
          [750, 14],
          [1000, 12],
          [1250, 10],
        ];

  function release(now: number, count: number, first: boolean) {
    for (let k = 0; k < count; k++) {
      if (burst.mode === 'rise') {
        // A wide base across the bottom, fired upwards with a little fan.
        bits.push({
          x: W / 2 + rnd(-0.42, 0.42) * W,
          y: H + 20,
          vx: rnd(-0.18, 0.18) * W,
          vy: -rnd(0.95, 1.55) * H,
          len: rnd(16, 34),
          w: rnd(6, 9),
          a: 0,
          va: 0,
          f: 0,
          vf: 0,
          c: colour(),
          born: now,
          life: rnd(1300, 1800),
        });
      } else if (first) {
        // The pop: out in every direction, a little more upwards.
        const o = burst.origin ?? { x: 0.5, y: 0.4 };
        const ang = rnd(0, Math.PI * 2);
        const sp = rnd(0.35, 0.95) * H;
        bits.push({
          x: o.x * W,
          y: o.y * H,
          vx: Math.cos(ang) * sp * 0.8,
          vy: Math.sin(ang) * sp - 0.25 * H,
          len: rnd(12, 22),
          w: rnd(6, 8),
          a: rnd(0, Math.PI * 2),
          va: rnd(-8, 8),
          f: rnd(0, Math.PI * 2),
          vf: rnd(6, 12),
          c: colour(),
          born: now,
          life: rnd(1800, 2600),
        });
      } else {
        // Then a gentle fall from above.
        bits.push({
          x: rnd(0, W),
          y: -20,
          vx: rnd(-30, 30),
          vy: rnd(0.12, 0.28) * H,
          len: rnd(12, 20),
          w: rnd(6, 8),
          a: rnd(0, Math.PI * 2),
          va: rnd(-3, 3),
          f: rnd(0, Math.PI * 2),
          vf: rnd(4, 9),
          c: colour(),
          born: now,
          life: rnd(2200, 3000),
        });
      }
    }
  }

  function capsule(b: Bit, alpha: number) {
    const angle = burst.mode === 'rise' ? Math.atan2(b.vy, b.vx) : b.a;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    if (burst.mode === 'fall') ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(b.f))));
    ctx.fillStyle = b.c;
    ctx.beginPath();
    // roundRect is missing from older Safari; square ends are fine there.
    if (typeof ctx.roundRect === 'function') ctx.roundRect(-b.len / 2, -b.w / 2, b.len, b.w, b.w / 2);
    else ctx.rect(-b.len / 2, -b.w / 2, b.len, b.w);
    ctx.fill();
    ctx.restore();
  }

  let wave = 0;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now - t0;
    while (wave < waves.length && t >= waves[wave][0]) {
      release(now, waves[wave][1], burst.mode === 'fall' && wave === 0);
      wave++;
    }
    ctx.clearRect(0, 0, W, H);
    const g = burst.mode === 'rise' ? 1.25 * H : 0.9 * H;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      const age = now - b.born;
      if (age > b.life || b.y > H + 60) {
        bits.splice(i, 1);
        continue;
      }
      if (burst.mode === 'fall') {
        // Air holds falling confetti back and sways it.
        b.vx *= 1 - 1.6 * dt;
        b.vy = Math.min(b.vy + g * dt, 0.3 * H);
        b.vx += Math.sin(b.f) * 40 * dt;
      } else {
        b.vy += g * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
      b.f += b.vf * dt;
      capsule(b, Math.min(1, (b.life - age) / 400));
    }
    if (wave < waves.length || bits.length) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W, H);
  };
}
