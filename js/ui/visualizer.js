// visualizer.js
//
// Animated noise field rendered on a <canvas>. Tied to the engine's
// AnalyserNode — flow speed and grain density follow the live RMS so the
// canvas visibly breathes with the audio.
//
// Design intent: cheap (CPU < 4% on a 2023 MacBook Air), composable
// (drop a `data-svn-visualizer` attribute on any canvas), and tactile (a
// gentle on-mouse-move displacement so the field reacts to the cursor).

export class NoiseFieldVisualizer {
  constructor (canvas, engine, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.engine = engine;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.opts = Object.assign({
      tone: '#ff8a3d',
      grainCount: 220,
      flow: 0.65
    }, opts);
    this.grains = [];
    this.mouse = { x: -1, y: -1, active: false };
    this.running = false;
    this.lastT = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerleave', () => { this.mouse.active = false; });
    this.seedGrains();
  }

  seedGrains () {
    const { width, height } = this.canvas;
    this.grains = [];
    for (let i = 0; i < this.opts.grainCount; i++) {
      this.grains.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.2 + 0.6,
        alpha: Math.random() * 0.6 + 0.15
      });
    }
  }

  resize () {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.seedGrains();
  }

  onPointerMove (e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.active = true;
  }

  start () {
    if (this.running) return;
    this.running = true;
    const loop = (t) => {
      if (!this.running) return;
      this.frame(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop () { this.running = false; }

  frame (t) {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const dt = (t - this.lastT) / 16.7;
    this.lastT = t;

    // Live audio intensity from analyser node
    let intensity = 0.4;
    const analyser = this.engine?.getAnalyser?.();
    if (analyser) {
      const arr = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(arr);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        const v = (arr[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / arr.length);
      intensity = Math.min(1, 0.35 + rms * 6);
    }

    // Trail fade (rather than full clear) for motion blur
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, w, h);

    const flow = this.opts.flow * (0.6 + intensity);
    for (const g of this.grains) {
      g.x += g.vx * flow * dt;
      g.y += g.vy * flow * dt;
      // Mouse displacement
      if (this.mouse.active) {
        const dx = g.x - this.mouse.x;
        const dy = g.y - this.mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const f = (14000 - d2) / 14000;
          g.x += (dx / Math.sqrt(d2 + 1)) * f * 1.6;
          g.y += (dy / Math.sqrt(d2 + 1)) * f * 1.6;
        }
      }
      if (g.x < -10) g.x = w + 10;
      if (g.x > w + 10) g.x = -10;
      if (g.y < -10) g.y = h + 10;
      if (g.y > h + 10) g.y = -10;

      ctx.beginPath();
      ctx.fillStyle = this.opts.tone;
      ctx.globalAlpha = g.alpha * (0.6 + intensity * 0.6);
      ctx.arc(g.x, g.y, g.r * (0.8 + intensity * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
