// engine.js
//
// High-level WebAudio engine: master output graph, base noise node, ambient
// layers, analyser for the visualizer. Mirrors the iOS AudioEngineCoordinator
// API at a much smaller scope.
//
// Public API:
//   const engine = new SVNAudioEngine();
//   await engine.init();             // load worklet, build graph (call from user gesture)
//   engine.setNoiseColor('pink');    // 'white' | 'pink' | 'brown' | 'custom'
//   engine.setNoiseTilt(1.2);        // -2..2, only relevant in 'custom'
//   engine.setNoiseGain(0.5);        // 0..1
//   engine.setMasterGain(0.8);
//   engine.addLayer(id, buffer);     // optional sample-based layers
//   engine.setLayerGain(id, value);
//   engine.setLayerPan(id, value);
//   engine.start(); engine.stop();
//   engine.getAnalyser();            // for visualizer (live time-domain data)
//
// Browsers require AudioContext creation to happen on a user gesture; call
// `await engine.init()` from inside a click handler.

const WORKLET_URL = new URL('./noise-processor.js', import.meta.url).toString();

export class SVNAudioEngine {
  constructor () {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.noiseNode = null;
    this.layers = new Map(); // id -> { source, gain, panner, buffer, started }
    this.running = false;
  }

  async init () {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { await this.ctx.audioWorklet.addModule(WORKLET_URL); }
    catch (e) { console.warn('[SVNAudioEngine] worklet load failed', e); throw e; }

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.master.connect(this.analyser).connect(this.ctx.destination);

    this.noiseNode = new AudioWorkletNode(this.ctx, 'svn-noise', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.45;
    this.noiseNode.connect(this.noiseGain).connect(this.master);
  }

  async resume () {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
    this.running = true;
  }
  suspend () {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    this.running = false;
  }
  isRunning () { return this.running; }

  // Master
  setMasterGain (v) {
    if (!this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(this.clamp01(v), now + 0.05);
  }

  // Noise
  setNoiseColor (c) {
    if (!this.noiseNode) return;
    this.noiseNode.port.postMessage({ type: 'setColor', value: c });
  }
  setNoiseTilt (alpha) {
    if (!this.noiseNode) return;
    const param = this.noiseNode.parameters.get('tilt');
    if (param) param.setValueAtTime(alpha, this.ctx.currentTime);
  }
  setNoiseGain (v) {
    if (!this.noiseGain) return;
    const now = this.ctx.currentTime;
    this.noiseGain.gain.cancelScheduledValues(now);
    this.noiseGain.gain.linearRampToValueAtTime(this.clamp01(v), now + 0.05);
  }

  // Layers — optional sample-based ambient sources.
  addLayer (id, audioBuffer, { loop = true, gain = 0.3, pan = 0 } = {}) {
    if (!this.ctx) return;
    if (this.layers.has(id)) this.removeLayer(id);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = this.clamp01(gain);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(gainNode).connect(this.master);

    this.layers.set(id, { buffer: audioBuffer, gain: gainNode, panner, source: null, loop, started: false });
    if (this.running) this.#startLayer(id);
  }

  removeLayer (id) {
    const layer = this.layers.get(id);
    if (!layer) return;
    try { layer.source?.stop(); } catch (_) {}
    try { layer.panner.disconnect(); layer.gain.disconnect(); } catch (_) {}
    this.layers.delete(id);
  }

  setLayerGain (id, v) {
    const layer = this.layers.get(id);
    if (!layer) return;
    const now = this.ctx.currentTime;
    layer.gain.gain.cancelScheduledValues(now);
    layer.gain.gain.linearRampToValueAtTime(this.clamp01(v), now + 0.05);
  }
  setLayerPan (id, v) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, v)), this.ctx.currentTime);
  }

  start () {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    for (const [id] of this.layers) this.#startLayer(id);
    this.running = true;
  }

  stop () {
    for (const layer of this.layers.values()) {
      try { layer.source?.stop(); } catch (_) {}
      layer.source = null;
      layer.started = false;
    }
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    this.running = false;
  }

  getAnalyser () { return this.analyser; }

  // -- internals --
  #startLayer (id) {
    const layer = this.layers.get(id);
    if (!layer || layer.started) return;
    const src = this.ctx.createBufferSource();
    src.buffer = layer.buffer;
    src.loop = layer.loop;
    src.connect(layer.panner);
    src.start(0);
    layer.source = src;
    layer.started = true;
  }

  clamp01 (v) { return Math.max(0, Math.min(1, +v || 0)); }
}
