/* ============================================================
   audio.js
   Procedural ambient audio built entirely with the Web Audio
   API - no external sound files, so it works perfectly on
   GitHub Pages.

   Provides:
     - A constant fluorescent-light hum / room tone
     - On-demand "distant sound" stingers (used by events.js)
     - A short buzz used when lights flicker
   ============================================================ */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.hum = null;
    this.started = false;
    this.enabled = true;
  }

  /** Must be called from a user gesture (e.g. the Start button). */
  init() {
    if (this.started) {
      // Resume if the browser auto-suspended the context.
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);

    this._buildHum();
    this.started = true;

    // Gently fade the ambience in.
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0, now);
    this.master.gain.linearRampToValueAtTime(0.5, now + 3.0);
  }

  /** Build the steady fluorescent hum: a low tone + faint 120Hz buzz + filtered noise. */
  _buildHum() {
    const ctx = this.ctx;
    this.hum = ctx.createGain();
    this.hum.gain.value = 0.6;
    this.hum.connect(this.master);

    // Low room drone.
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    drone.connect(droneGain).connect(this.hum);
    drone.start();

    // Mains-style electrical buzz.
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 120;
    const buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = 'lowpass';
    buzzFilter.frequency.value = 320;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.015;
    buzz.connect(buzzFilter).connect(buzzGain).connect(this.hum);
    buzz.start();

    // Airy filtered noise (ventilation / room tone).
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(4);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noise.connect(noiseFilter).connect(noiseGain).connect(this.hum);
    noise.start();

    this._buzzGain = buzzGain;
  }

  /** Create a buffer of white noise. */
  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A short electrical buzz used when lights flicker. */
  flickerBuzz() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 90 + Math.random() * 40;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.3);
  }

  /**
   * A distant, muffled sound stinger - a low thump that fades, panned
   * randomly so it feels like it came from somewhere else in the rooms.
   */
  distantSound() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = 'sine';
    const baseFreq = 70 + Math.random() * 120;
    o.frequency.setValueAtTime(baseFreq, now);
    o.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 1.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380; // muffled / far away

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    let node = o.connect(filter).connect(g);

    // Stereo placement if available.
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      g.connect(pan).connect(this.master);
    } else {
      g.connect(this.master);
    }

    o.start(now);
    o.stop(now + 1.5);
  }

  /**
   * A classic two-tone elevator chime ("ding-dong"): two soft sine tones
   * with a quick attack and gentle decay. Used when the car arrives and
   * the doors are about to open.
   */
  elevatorChime() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const tone = (freq, start, dur) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g).connect(this.master);
      o.start(now + start);
      o.stop(now + start + dur + 0.05);
    };

    tone(988, 0, 0.9);      // B5  ("ding")
    tone(1319, 0.32, 1.0);  // E6  ("dong")
  }

  /** Soften the hum while the lights are off, then restore it. */
  setPowerState(on) {
    if (!this._ready() || !this._buzzGain) return;
    const now = this.ctx.currentTime;
    this._buzzGain.gain.cancelScheduledValues(now);
    this._buzzGain.gain.linearRampToValueAtTime(on ? 0.015 : 0.0, now + 0.2);
  }

  _ready() {
    return this.enabled && this.started && this.ctx && this.ctx.state === 'running';
  }
}
