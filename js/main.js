// main.js — wires the homepage demo.
//
// Lifecycle: the AudioContext can only be created on a user gesture, so
// nothing audible happens until the user clicks "Play". The visualizer
// starts cheap (no engine reads) and upgrades to live data once playback
// begins.

import { SVNAudioEngine } from './audio/engine.js';
import { GenerativeComposer } from './audio/generative-composer.js';
import { PatternList, Patterns } from './audio/patterns.js';
import { NoiseFieldVisualizer } from './ui/visualizer.js';

const moods = [
  { slug: 'mood-forest-dawn',     label: 'Forest Dawn',     mode: 'focus',      tone: '#7fbf76' },
  { slug: 'mood-rainy-night',     label: 'Rainy Night',     mode: 'sleep',      tone: '#5b9fc7' },
  { slug: 'mood-ocean-dusk',      label: 'Ocean Dusk',      mode: 'relaxation', tone: '#c98ad5' },
  { slug: 'mood-mountain-mist',   label: 'Mountain Mist',   mode: 'meditation', tone: '#8aa6c7' },
  { slug: 'mood-aurora',          label: 'Aurora',          mode: 'dreamCue',   tone: '#9bd7a8' },
  { slug: 'mood-cabin-fireplace', label: 'Cabin Fireplace', mode: 'ambience',   tone: '#ff8a3d' },
  { slug: 'mood-starfield',       label: 'Starfield',       mode: 'dreamCue',   tone: '#a98fd6' },
  { slug: 'mood-bamboo-grove',    label: 'Bamboo Grove',    mode: 'meditation', tone: '#9bbf64' },
  { slug: 'mood-meadow-summer',   label: 'Summer Meadow',   mode: 'relaxation', tone: '#dbc760' },
  { slug: 'mood-desert-wind',     label: 'Desert Wind',     mode: 'meditation', tone: '#e2a565' }
];

const modeToPattern = {
  focus: Patterns.focusFlow,
  sleep: Patterns.sleepTide,
  relaxation: Patterns.relaxPulse,
  meditation: Patterns.meditationBreath,
  dreamCue: Patterns.dreamShift,
  ambience: Patterns.ambienceShimmer
};

const state = {
  mood: moods[0],
  engine: null,
  composer: null,
  visualizer: null,
  playing: false,
  composerOn: false
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener('DOMContentLoaded', () => {
  buildMoodPicker();
  setBackdrop(state.mood);
  setupVisualizer();
  bindControls();
});

function buildMoodPicker () {
  const host = $('#mood-picker');
  if (!host) return;
  for (const m of moods) {
    const btn = document.createElement('button');
    btn.className = 'mood-pill';
    btn.dataset.slug = m.slug;
    btn.innerHTML = `<span class="mood-pill-dot" style="background:${m.tone}"></span><span>${m.label}</span>`;
    btn.addEventListener('click', () => {
      state.mood = m;
      setBackdrop(m);
      $$('.mood-pill').forEach(p => p.classList.toggle('is-active', p.dataset.slug === m.slug));
      if (state.composerOn && state.composer) {
        state.composer.start(modeToPattern[m.mode] ?? Patterns.focusFlow);
      }
    });
    if (m.slug === state.mood.slug) btn.classList.add('is-active');
    host.appendChild(btn);
  }
}

function setBackdrop (mood) {
  const el = $('#hero-backdrop');
  if (!el) return;
  el.style.backgroundImage = `url(./assets/moods/${mood.slug}.png)`;
  document.documentElement.style.setProperty('--accent', mood.tone);
}

function setupVisualizer () {
  const canvas = $('#noise-canvas');
  if (!canvas) return;
  state.visualizer = new NoiseFieldVisualizer(canvas, /* engine pre-init */ null, {
    tone: state.mood.tone
  });
  state.visualizer.start();
  // Update tone on mood change
  const obs = new MutationObserver(() => {
    state.visualizer.opts.tone = state.mood.tone;
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
}

function bindControls () {
  $('#play-btn')?.addEventListener('click', togglePlayback);
  $('#composer-btn')?.addEventListener('click', toggleComposer);
  $('#color-select')?.addEventListener('change', (e) => {
    state.engine?.setNoiseColor(e.target.value);
  });
  $('#tilt-slider')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $('#tilt-readout').textContent = v.toFixed(2);
    state.engine?.setNoiseTilt(v);
  });
  $('#gain-slider')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $('#gain-readout').textContent = Math.round(v * 100) + '%';
    state.engine?.setMasterGain(v);
  });
}

async function ensureEngine () {
  if (state.engine) return state.engine;
  const engine = new SVNAudioEngine();
  await engine.init();
  state.engine = engine;
  // Apply current UI values
  engine.setNoiseColor($('#color-select')?.value ?? 'pink');
  const tilt = parseFloat($('#tilt-slider')?.value ?? 1);
  engine.setNoiseTilt(tilt);
  engine.setMasterGain(parseFloat($('#gain-slider')?.value ?? 0.7));
  // Rebind visualizer to engine for live RMS
  if (state.visualizer) state.visualizer.engine = engine;
  state.composer = new GenerativeComposer(engine);
  return engine;
}

async function togglePlayback () {
  const btn = $('#play-btn');
  try {
    const engine = await ensureEngine();
    if (state.playing) {
      engine.stop();
      state.composer?.stop();
      state.composerOn = false;
      $('#composer-btn')?.classList.remove('is-active');
      state.playing = false;
      btn.textContent = 'Play';
      btn.classList.remove('is-playing');
    } else {
      engine.start();
      state.playing = true;
      btn.textContent = 'Pause';
      btn.classList.add('is-playing');
    }
  } catch (e) {
    console.error(e);
    alert('Web Audio failed to start. Try Safari/Chrome on desktop.');
  }
}

async function toggleComposer () {
  await ensureEngine();
  const btn = $('#composer-btn');
  if (!state.playing) await togglePlayback();
  if (state.composerOn) {
    state.composer.stop();
    state.composerOn = false;
    btn.classList.remove('is-active');
    btn.textContent = 'Generative';
  } else {
    const pattern = modeToPattern[state.mood.mode] ?? Patterns.focusFlow;
    state.composer.start(pattern);
    state.composerOn = true;
    btn.classList.add('is-active');
    btn.textContent = pattern.displayName + ' · live';
  }
}
