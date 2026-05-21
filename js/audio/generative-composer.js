// generative-composer.js
//
// JS port of the iOS GenerativeComposer. Drives the SVNAudioEngine's
// noise gain (and optional ambient layers) over time using the same
// per-layer "modulator recipes" pattern as the Swift original.
//
// API:
//   const composer = new GenerativeComposer(engine);
//   composer.start(pattern);   // pattern object — see patterns.js
//   composer.setIntensity(0.7);
//   composer.stop();

export const Modulator = {
  sinusoid: (periodSec) => ({ type: 'sinusoid', periodSec }),
  triangle: (periodSec) => ({ type: 'triangle', periodSec }),
  beating:  (a, b)      => ({ type: 'beating', a, b }),
  walk:     (stepSec)   => ({ type: 'walk', stepSec }),
  hold:     ()          => ({ type: 'hold' })
};

/**
 * @param {SVNAudioEngine} engine
 */
export class GenerativeComposer {
  constructor (engine) {
    this.engine = engine;
    this.intensity = 1.0;
    this.pattern = null;
    this.timer = null;
    this.startedAt = 0;
    this.baselineNoiseGain = 0.45;
    this.baselineLayerGains = new Map(); // id -> { gain, pan }
    this.walkStates = new Map(); // slot -> { last, target, lastStepAt }
    this.onTick = null;          // optional UI callback({ elapsed, value })
  }

  setIntensity (v) {
    this.intensity = Math.max(0, Math.min(1, +v || 0));
  }

  start (pattern) {
    this.stop();
    this.pattern = pattern;
    this.startedAt = performance.now() / 1000;
    this.walkStates.clear();
    this.baselineNoiseGain = this.engine.noiseGain?.gain.value ?? 0.45;
    for (const [id, layer] of this.engine.layers) {
      this.baselineLayerGains.set(id, {
        gain: layer.gain.gain.value,
        pan: layer.panner.pan.value
      });
    }

    const tickMs = (pattern.preferredTickSec ?? 1.0) * 1000;
    this.tick();
    this.timer = setInterval(() => this.tick(), tickMs);
  }

  stop () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.pattern = null;
  }

  isRunning () { return this.timer !== null; }

  tick () {
    if (!this.pattern) return;
    const now = performance.now() / 1000;
    const elapsed = now - this.startedAt;

    // Base noise
    if (this.pattern.baseNoiseRecipe) {
      const v = this.evaluate(this.pattern.baseNoiseRecipe, elapsed, -1);
      const gain = this.clamp01(this.baselineNoiseGain + v * this.pattern.baseNoiseRecipe.depth * this.intensity);
      this.engine.setNoiseGain(gain);
    }

    // Layers (in insertion order)
    let i = 0;
    for (const [id] of this.engine.layers) {
      const recipe = this.pattern.layerRecipes[i % this.pattern.layerRecipes.length];
      const value = this.evaluate(recipe, elapsed, i);
      const base = this.baselineLayerGains.get(id) ?? { gain: 0.3, pan: 0 };
      const gain = this.clamp01(base.gain + value * recipe.depth * this.intensity);
      const pan = Math.max(-1, Math.min(1, base.pan + value * (recipe.panDepth || 0) * this.intensity));
      this.engine.setLayerGain(id, gain);
      this.engine.setLayerPan(id, pan);
      i++;
    }

    if (this.onTick) this.onTick({ elapsed });
  }

  evaluate (recipe, elapsed, slot) {
    const m = recipe.modulator;
    const phase = recipe.phaseOffset ?? 0;
    switch (m.type) {
      case 'hold':
        return 0;
      case 'sinusoid': {
        const p = (elapsed / m.periodSec + phase) * 2 * Math.PI;
        return Math.sin(p);
      }
      case 'triangle': {
        const t = ((elapsed / m.periodSec + phase) % 1 + 1) % 1;
        return t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
      }
      case 'beating': {
        const a = Math.sin((elapsed / m.a + phase) * 2 * Math.PI);
        const b = Math.sin((elapsed / m.b + phase) * 2 * Math.PI);
        return (a + b) / 2;
      }
      case 'walk': {
        let state = this.walkStates.get(slot) ?? { last: 0, target: Math.random() * 2 - 1, lastStepAt: 0 };
        if (elapsed - state.lastStepAt >= m.stepSec) {
          state.lastStepAt = elapsed;
          state.last = state.target;
          state.target = Math.random() * 2 - 1;
        }
        const prog = Math.min(1, (elapsed - state.lastStepAt) / m.stepSec);
        const v = state.last + (state.target - state.last) * prog;
        this.walkStates.set(slot, state);
        return v;
      }
      default:
        return 0;
    }
  }

  clamp01 (v) { return Math.max(0, Math.min(1, v)); }
}
