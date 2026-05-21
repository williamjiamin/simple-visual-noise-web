// noise-processor.js
//
// AudioWorklet processor that runs on the audio render thread and generates
// procedurally colored noise. Loaded by `engine.js` via
// `audioContext.audioWorklet.addModule()`. Communicates via the port for
// parameter updates the worklet can't take as AudioParams (string colour).
//
// Colors:
//   - white:  uniform spectrum, hard top end
//   - pink:   1/f rolloff, Paul Kellet's filter (cheap, sounds excellent)
//   - brown:  1/f² rolloff, leaky integrator over white
//   - custom: variable spectral tilt α, mixed pink+brown per α
//
// Why an AudioWorklet (vs the deprecated ScriptProcessorNode):
//   - Runs off the main thread, immune to UI jank
//   - Stable sample-rate processing
//   - Future-proofed; Safari, Firefox, Chrome all support it.

class NoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return [
      // Output gain (0..1). Smoothed on the audio thread so slider drags
      // don't click.
      { name: 'gain', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      // Spectral tilt α: -2 (very dark, deeper than brown) ... 2 (bright,
      // brighter than white). Only used when color = 'custom'.
      { name: 'tilt', defaultValue: 1.0, minValue: -2, maxValue: 2, automationRate: 'k-rate' }
    ];
  }

  constructor () {
    super();
    this.color = 'pink';
    // Paul Kellet pink filter state
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.b3 = 0;
    this.b4 = 0; this.b5 = 0; this.b6 = 0;
    // Brown integrator state
    this.lastBrown = 0;
    // Custom-tilt mix: pre-computed mix of pink + brown + white weights
    this.recomputeCustomMix(1.0);

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg && msg.type === 'setColor') {
        this.color = msg.value;
      }
    };
  }

  /**
   * Map a tilt α into a 3-way mix of (white, pink, brown). α≈0 → mostly
   * white, α≈1 → pink, α≈2 → brown. Negative α boosts the white side. The
   * coefficients are a smooth, monotonic remap chosen by ear; the result
   * is close to what spectral filtering would give but at ~10× the speed.
   */
  recomputeCustomMix (alpha) {
    // Clamp & remap to 0..1 weights for each colour.
    const a = Math.max(-2, Math.min(2, alpha));
    if (a <= 0) {
      // -2..0: mix between super-bright (extra white) and white
      const t = (a + 2) / 2; // 0..1
      this.wW = 1.0 - 0.4 * t;
      this.wP = 0.4 * t;
      this.wB = 0;
    } else if (a <= 1) {
      // 0..1: white → pink
      const t = a;
      this.wW = 1 - t;
      this.wP = t;
      this.wB = 0;
    } else {
      // 1..2: pink → brown
      const t = a - 1;
      this.wW = 0;
      this.wP = 1 - t;
      this.wB = t;
    }
  }

  process (inputs, outputs, parameters) {
    const output = outputs[0];
    const channelCount = output.length;
    const frames = output[0].length;
    const gainArr = parameters.gain;
    const tilt = parameters.tilt[0];

    if (this.color === 'custom') {
      this.recomputeCustomMix(tilt);
    }

    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1;

      // Pink (Paul Kellet) — only compute if needed by the active color
      let pink = 0;
      if (this.color === 'pink' || this.color === 'custom') {
        this.b0 = 0.99886 * this.b0 + white * 0.0555179;
        this.b1 = 0.99332 * this.b1 + white * 0.0750759;
        this.b2 = 0.96900 * this.b2 + white * 0.1538520;
        this.b3 = 0.86650 * this.b3 + white * 0.3104856;
        this.b4 = 0.55000 * this.b4 + white * 0.5329522;
        this.b5 = -0.7616 * this.b5 - white * 0.0168980;
        pink = (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 +
                this.b6 + white * 0.5362) * 0.11;
        this.b6 = white * 0.115926;
      }

      // Brown noise
      let brown = 0;
      if (this.color === 'brown' || this.color === 'custom') {
        brown = (this.lastBrown + 0.02 * white) / 1.02;
        this.lastBrown = brown;
        brown *= 3.5;
      }

      let sample;
      switch (this.color) {
        case 'white': sample = white * 0.6; break;
        case 'brown': sample = brown; break;
        case 'custom': sample = white * this.wW + pink * this.wP + brown * this.wB; break;
        default:      sample = pink;        // pink default
      }

      const g = gainArr.length > 1 ? gainArr[i] : gainArr[0];
      const out = sample * g;
      for (let ch = 0; ch < channelCount; ch++) {
        output[ch][i] = out;
      }
    }
    return true;
  }
}

registerProcessor('svn-noise', NoiseProcessor);
