// The molten gold orb. One canvas, four states:
// idle (slow breathing), listen (surface ripples with your voice), think (light circles the surface), speak (glows with the voice).
const TAU = Math.PI * 2;

export function createOrb(canvas, { size = 250 } = {}) {
  const g = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = 'idle', level = 0, smooth = 0, raf = 0, t = 0, last = performance.now(), levelFn = null, alive = true;

  function fit() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const px = size + 110;
    canvas.width = px * dpr; canvas.height = px * dpr;
    canvas.style.width = px + 'px'; canvas.style.height = px + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();

  function radius(a, R, amp) {
    // A few slow sine waves around the rim make the surface look liquid.
    return R * (1
      + amp * 0.045 * Math.sin(3 * a + t * 1.3)
      + amp * 0.03 * Math.sin(5 * a - t * 1.9 + 1.7)
      + amp * 0.02 * Math.sin(7 * a + t * 2.6 + 0.4)
      + amp * 0.012 * Math.sin(11 * a - t * 3.1));
  }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (levelFn) level = levelFn();
    smooth += (level - smooth) * Math.min(1, dt * 12);
    const speed = state === 'think' ? 1.6 : state === 'idle' ? 0.5 : 1;
    t += dt * speed * (reduce ? 0.25 : 1);

    const W = size + 110, cx = W / 2, cy = W / 2;
    const breathe = state === 'idle' ? 0.012 * Math.sin(t * 1.6) : 0;
    const R = size / 2 * (1 + breathe + (state === 'speak' ? smooth * 0.06 : 0));
    const amp = reduce ? 0.15 : state === 'listen' ? 0.2 + smooth * 1.4 : state === 'speak' ? 0.25 + smooth * 1.1 : state === 'think' ? 0.45 : 0.12;
    g.clearRect(0, 0, W, W);

    // Rings, like the design: they open up while listening and speaking.
    const ringOpen = state === 'listen' || state === 'speak' ? smooth * 10 : 0;
    g.lineWidth = 1;
    g.strokeStyle = `rgba(236,214,160,${0.18 + smooth * 0.15})`;
    g.beginPath(); g.arc(cx, cy, R + 22 + ringOpen, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(236,214,160,${0.08 + smooth * 0.1})`;
    g.beginPath(); g.arc(cx, cy, R + 44 + ringOpen * 1.2, 0, TAU); g.stroke();

    // Body
    const glow = state === 'off' ? 0.12 : 0.42 + (state === 'speak' ? smooth * 0.35 : 0);
    g.save();
    g.shadowColor = `rgba(214,165,70,${glow})`;
    g.shadowBlur = 70;
    g.shadowOffsetY = 30;
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU, r = radius(a, R, amp);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    // The highlight drifts; while thinking it travels around the orb.
    const ha = state === 'think' ? t * 1.2 : -2.2 + Math.sin(t * 0.4) * 0.15;
    const hx = cx + Math.cos(ha) * R * 0.42, hy = cy + Math.sin(ha) * R * 0.5;
    const grad = g.createRadialGradient(hx, hy, R * 0.02, cx, cy, R * 1.05);
    const dim = state === 'off' ? 0.55 : 1;
    grad.addColorStop(0, shade('#FFF4CF', dim));
    grad.addColorStop(0.14, shade('#F2D489', dim));
    grad.addColorStop(0.4, shade('#C9993F', dim));
    grad.addColorStop(0.68, shade('#7A5520', dim));
    grad.addColorStop(1, shade('#3B2A10', dim));
    g.fillStyle = grad;
    g.fill();
    g.restore();

    // Inner shadow at the bottom right gives weight.
    g.save();
    g.clip();
    const sh = g.createRadialGradient(cx + R * 0.35, cy + R * 0.5, R * 0.1, cx + R * 0.2, cy + R * 0.3, R * 1.1);
    sh.addColorStop(0, 'rgba(30,18,4,0.45)'); sh.addColorStop(1, 'rgba(30,18,4,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, W);
    g.restore();

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    set(s, fn = null) { state = s; levelFn = fn; if (!fn) level = 0; },
    get state() { return state; },
    destroy() { alive = false; cancelAnimationFrame(raf); },
  };
}

function shade(hex, k) {
  if (k === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * k + 60 * (1 - k)));
  return `rgb(${c.join(',')})`;
}
