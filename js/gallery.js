// gallery.js — hover-preview mood gallery
//
// Each card has a curated noise recipe (color, tilt, gain). Hovering with
// pointer or focus starts a single shared AudioContext and switches its
// settings to that mood's recipe. Moving away fades to silence.
//
// Why one shared engine: spinning up an AudioContext per card explodes
// the device's audio session count. One engine + parameter automation =
// cheap and smooth.

import { SVNAudioEngine } from './audio/engine.js';

const moods = [
  { slug: 'mood-forest-dawn',     label: 'Forest Dawn',     color: 'custom', tilt: 1.2,  gain: 0.55, tone: '#7fbf76' },
  { slug: 'mood-rainy-night',     label: 'Rainy Night',     color: 'pink',   tilt: 1.0,  gain: 0.6,  tone: '#5b9fc7' },
  { slug: 'mood-ocean-dusk',      label: 'Ocean Dusk',      color: 'custom', tilt: 1.6,  gain: 0.5,  tone: '#c98ad5' },
  { slug: 'mood-mountain-mist',   label: 'Mountain Mist',   color: 'custom', tilt: 1.4,  gain: 0.45, tone: '#8aa6c7' },
  { slug: 'mood-aurora',          label: 'Aurora',          color: 'pink',   tilt: 1.0,  gain: 0.5,  tone: '#9bd7a8' },
  { slug: 'mood-cabin-fireplace', label: 'Cabin Fireplace', color: 'brown',  tilt: 2.0,  gain: 0.55, tone: '#ff8a3d' },
  { slug: 'mood-starfield',       label: 'Starfield',       color: 'custom', tilt: 0.5,  gain: 0.4,  tone: '#a98fd6' },
  { slug: 'mood-bamboo-grove',    label: 'Bamboo Grove',    color: 'custom', tilt: 1.1,  gain: 0.5,  tone: '#9bbf64' },
  { slug: 'mood-meadow-summer',   label: 'Summer Meadow',   color: 'custom', tilt: 0.7,  gain: 0.45, tone: '#dbc760' },
  { slug: 'mood-desert-wind',     label: 'Desert Wind',     color: 'brown',  tilt: 1.9,  gain: 0.45, tone: '#e2a565' }
];

let engine = null;
let activeMood = null;
let muteTimer = null;

async function ensureEngine () {
  if (engine) return engine;
  engine = new SVNAudioEngine();
  await engine.init();
  engine.setMasterGain(0);
  engine.setNoiseColor('pink');
  return engine;
}

async function activate (mood) {
  await ensureEngine();
  if (muteTimer) { clearTimeout(muteTimer); muteTimer = null; }
  engine.setNoiseColor(mood.color);
  engine.setNoiseTilt(mood.tilt);
  engine.setNoiseGain(mood.gain);
  engine.setMasterGain(0.6);
  if (!engine.isRunning()) engine.start();
  activeMood = mood.slug;
}

function deactivate (mood) {
  if (activeMood !== mood.slug) return;
  // small grace period so a fast cursor moving across the grid doesn't
  // bounce the audio in and out
  muteTimer = setTimeout(() => {
    engine?.setMasterGain(0);
    engine?.stop();
    activeMood = null;
  }, 320);
}

function render () {
  const grid = document.getElementById('mood-gallery');
  if (!grid) return;
  for (const m of moods) {
    const card = document.createElement('button');
    card.className = 'mood-card';
    card.dataset.slug = m.slug;
    card.style.setProperty('--card-tone', m.tone);
    card.innerHTML = `
      <img src="./assets/moods/${m.slug}.png" alt="${m.label}" loading="lazy" />
      <div class="mood-card-body">
        <span class="mood-card-label">${m.label}</span>
        <span class="mood-card-mono">${m.color.toUpperCase()} · α=${m.tilt.toFixed(2)}</span>
      </div>
    `;
    card.addEventListener('pointerenter', () => activate(m));
    card.addEventListener('focus',       () => activate(m));
    card.addEventListener('pointerleave',() => deactivate(m));
    card.addEventListener('blur',        () => deactivate(m));
    card.addEventListener('click', () => {
      // Click to "lock" by toggling play state explicitly
      if (activeMood === m.slug && engine?.isRunning()) {
        engine.stop();
        engine.setMasterGain(0);
        activeMood = null;
      } else {
        activate(m);
      }
    });
    grid.appendChild(card);
  }
}

document.addEventListener('DOMContentLoaded', render);
