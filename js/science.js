// science.js — interactive widgets for /science.html
//
// Each widget creates its own tiny AudioContext when the user starts it,
// so visiting the page doesn't auto-play audio. The widgets share no
// state — keeping them independent means broken audio in one widget
// doesn't kill the others.

import { SVNAudioEngine } from './audio/engine.js';

// ---------- Widget 1: Spectral Tilt ----------
async function setupTiltWidget () {
  const root = document.getElementById('w-tilt');
  if (!root) return;
  const btn = root.querySelector('.w-play');
  const tiltSlider = root.querySelector('.w-tilt');
  const tiltReadout = root.querySelector('.w-tilt-readout');
  const colorReadout = root.querySelector('.w-color-readout');

  let engine = null, playing = false;

  btn.addEventListener('click', async () => {
    if (!engine) {
      engine = new SVNAudioEngine();
      await engine.init();
      engine.setNoiseColor('custom');
      engine.setNoiseTilt(parseFloat(tiltSlider.value));
      engine.setMasterGain(0.55);
    }
    if (!playing) {
      engine.start(); playing = true;
      btn.textContent = 'Stop'; btn.classList.add('is-active');
    } else {
      engine.stop(); playing = false;
      btn.textContent = 'Play';  btn.classList.remove('is-active');
    }
  });

  tiltSlider.addEventListener('input', () => {
    const v = parseFloat(tiltSlider.value);
    tiltReadout.textContent = v.toFixed(2);
    const label = v <= -0.5 ? 'super-bright'
               : v <= 0.5  ? 'white'
               : v <= 1.5  ? 'pink'
               : 'brown';
    colorReadout.textContent = label.toUpperCase();
    engine?.setNoiseTilt(v);
  });
}

// ---------- Widget 2: Binaural beat builder ----------
// Two oscillators at slightly different frequencies → perceived beat at
// the difference. Carrier slider sets the base; beat slider sets the
// detune.
async function setupBinauralWidget () {
  const root = document.getElementById('w-binaural');
  if (!root) return;
  const btn = root.querySelector('.w-play');
  const carrier = root.querySelector('.w-carrier');
  const beat = root.querySelector('.w-beat');
  const carrierOut = root.querySelector('.w-carrier-readout');
  const beatOut = root.querySelector('.w-beat-readout');
  const stateOut = root.querySelector('.w-band');

  let ctx = null, oscL = null, oscR = null, masterGain = null, playing = false;

  function bandLabel (hz) {
    if (hz < 4) return 'Delta · deep sleep';
    if (hz < 8) return 'Theta · drift / dream';
    if (hz < 13) return 'Alpha · relaxed focus';
    if (hz < 30) return 'Beta · active focus';
    return 'Gamma · peak cognition';
  }

  btn.addEventListener('click', async () => {
    if (!playing) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(ctx.destination);

      oscL = ctx.createOscillator();
      oscR = ctx.createOscillator();
      const merger = ctx.createChannelMerger(2);
      const cf = parseFloat(carrier.value);
      const bf = parseFloat(beat.value);
      oscL.frequency.value = cf;
      oscR.frequency.value = cf + bf;
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(masterGain);
      oscL.start();
      oscR.start();
      playing = true;
      btn.textContent = 'Stop'; btn.classList.add('is-active');
    } else {
      oscL.stop(); oscR.stop(); ctx.close();
      ctx = null;
      playing = false;
      btn.textContent = 'Play'; btn.classList.remove('is-active');
    }
  });

  function update () {
    const cf = parseFloat(carrier.value);
    const bf = parseFloat(beat.value);
    carrierOut.textContent = cf.toFixed(0) + ' Hz';
    beatOut.textContent = bf.toFixed(1) + ' Hz';
    stateOut.textContent = bandLabel(bf);
    if (oscL) oscL.frequency.setValueAtTime(cf, ctx.currentTime);
    if (oscR) oscR.frequency.setValueAtTime(cf + bf, ctx.currentTime);
  }
  carrier.addEventListener('input', update);
  beat.addEventListener('input', update);
  update();
}

// ---------- Widget 3: Generative composer demo ----------
async function setupComposerWidget () {
  const root = document.getElementById('w-composer');
  if (!root) return;
  const btn = root.querySelector('.w-play');
  const select = root.querySelector('.w-pattern');
  const intensity = root.querySelector('.w-intensity');
  const intensityOut = root.querySelector('.w-intensity-readout');
  const summaryOut = root.querySelector('.w-pattern-summary');

  const { Patterns, PatternList } = await import('./audio/patterns.js');
  const { GenerativeComposer } = await import('./audio/generative-composer.js');

  // Populate pattern picker
  for (const p of PatternList) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.displayName} (${p.mode})`;
    select.appendChild(opt);
  }

  let engine = null, composer = null, playing = false;

  function currentPattern () {
    return PatternList.find(p => p.id === select.value) || Patterns.focusFlow;
  }

  function updateSummary () { summaryOut.textContent = currentPattern().summary; }
  updateSummary();
  select.addEventListener('change', () => {
    updateSummary();
    if (composer && playing) composer.start(currentPattern());
  });
  intensity.addEventListener('input', () => {
    const v = parseFloat(intensity.value);
    intensityOut.textContent = Math.round(v * 100) + '%';
    composer?.setIntensity(v);
  });

  btn.addEventListener('click', async () => {
    if (!engine) {
      engine = new SVNAudioEngine();
      await engine.init();
      engine.setNoiseColor('pink');
      engine.setMasterGain(0.55);
      composer = new GenerativeComposer(engine);
    }
    if (!playing) {
      engine.start();
      composer.start(currentPattern());
      composer.setIntensity(parseFloat(intensity.value));
      playing = true;
      btn.textContent = 'Stop'; btn.classList.add('is-active');
    } else {
      composer.stop(); engine.stop();
      playing = false;
      btn.textContent = 'Play'; btn.classList.remove('is-active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTiltWidget();
  setupBinauralWidget();
  setupComposerWidget();
});
