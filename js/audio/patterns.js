// patterns.js
//
// JS mirror of the iOS GenerativeComposerLibrary. Identical shapes so the
// website demo evolves the same way the app does. Keep in sync if the
// Swift library gains new entries.

import { Modulator } from './generative-composer.js';

const r = (modulator, opts = {}) => ({
  phaseOffset: opts.phaseOffset ?? 0,
  depth: opts.depth ?? 0.1,
  panDepth: opts.panDepth ?? 0,
  modulator
});

export const Patterns = {
  focusFlow: {
    id: 'focus-flow',
    mode: 'focus',
    displayName: 'Flow',
    summary: 'Slow 90-second cycles. Subtle. Won\'t break concentration.',
    layerRecipes: [
      r(Modulator.sinusoid(90),  { depth: 0.10 }),
      r(Modulator.sinusoid(120), { phaseOffset: 0.33, depth: 0.12 }),
      r(Modulator.sinusoid(150), { phaseOffset: 0.66, depth: 0.08 })
    ],
    baseNoiseRecipe: r(Modulator.sinusoid(180), { depth: 0.04 }),
    preferredTickSec: 1.0
  },
  sleepTide: {
    id: 'sleep-tide',
    mode: 'sleep',
    displayName: 'Tide',
    summary: '5-minute swells. Hypnotic, never abrupt.',
    layerRecipes: [
      r(Modulator.sinusoid(300), { depth: 0.08 }),
      r(Modulator.sinusoid(360), { phaseOffset: 0.5, depth: 0.06 })
    ],
    baseNoiseRecipe: r(Modulator.sinusoid(480), { depth: 0.03 }),
    preferredTickSec: 2.0
  },
  relaxPulse: {
    id: 'relax-pulse',
    mode: 'relaxation',
    displayName: 'Gentle Pulse',
    summary: '60-second triangular swells across three layers.',
    layerRecipes: [
      r(Modulator.triangle(60),  { depth: 0.18 }),
      r(Modulator.triangle(75),  { phaseOffset: 0.25, depth: 0.14 }),
      r(Modulator.sinusoid(100), { phaseOffset: 0.5, depth: 0.10 })
    ],
    preferredTickSec: 0.75
  },
  meditationBreath: {
    id: 'meditation-breath',
    mode: 'meditation',
    displayName: 'Breath (6 BPM)',
    summary: 'Bed track breathes at six breaths per minute.',
    layerRecipes: [
      r(Modulator.sinusoid(10), { depth: 0.10 }),
      r(Modulator.hold(), {}),
      r(Modulator.sinusoid(30), { phaseOffset: 0.5, depth: 0.05 })
    ],
    preferredTickSec: 0.5
  },
  dreamShift: {
    id: 'dream-shift',
    mode: 'dreamCue',
    displayName: 'Drift',
    summary: 'Random walk with gentle pan migration — surreal.',
    layerRecipes: [
      r(Modulator.walk(6),  { depth: 0.20, panDepth: 0.6 }),
      r(Modulator.walk(9),  { phaseOffset: 0.33, depth: 0.15, panDepth: 0.5 }),
      r(Modulator.walk(12), { phaseOffset: 0.66, depth: 0.10, panDepth: 0.4 })
    ],
    preferredTickSec: 0.5
  },
  ambienceShimmer: {
    id: 'ambience-shimmer',
    mode: 'ambience',
    displayName: 'Shimmer',
    summary: 'Three layered periods (fast, medium, slow) — never quite the same.',
    layerRecipes: [
      r(Modulator.beating(30, 47),  { depth: 0.14, panDepth: 0.2 }),
      r(Modulator.beating(90, 137), { phaseOffset: 0.33, depth: 0.10 }),
      r(Modulator.beating(180, 251),{ phaseOffset: 0.66, depth: 0.08 })
    ],
    baseNoiseRecipe: r(Modulator.sinusoid(600), { depth: 0.05 }),
    preferredTickSec: 0.5
  }
};

export const PatternList = Object.values(Patterns);
