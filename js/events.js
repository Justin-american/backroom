/* ============================================================
   events.js
   Lightweight random event system. Subtle, rare, atmospheric.

   Event types:
     - flicker:  the lights stutter for a moment
     - blackout: the lights cut out completely, then return
     - distant:  a distant / muffled sound from elsewhere
     - ambient:  a faint environmental noise

   The scheduler picks a random event every so often. Light
   effects drive Level0.setLightLevel(); sounds drive AudioEngine.
   ============================================================ */

export class EventSystem {
  /**
   * @param {Level0} level
   * @param {AudioEngine} audio
   */
  constructor(level, audio) {
    this.level = level;
    this.audio = audio;

    this.enabled = false;
    this.timer = this._nextDelay();

    // active light effect state
    this.effect = null;   // { type, t, duration, ... }
    this.lightLevel = 1.0;
  }

  /** Seconds until the next event (rare & varied). */
  _nextDelay() {
    return 14 + Math.random() * 26; // 14s - 40s
  }

  start() { this.enabled = true; this.timer = 6 + Math.random() * 8; }
  stop()  { this.enabled = false; }

  _trigger() {
    const r = Math.random();
    if (r < 0.40) {
      this._startFlicker();
    } else if (r < 0.58) {
      this._startBlackout();
    } else if (r < 0.82) {
      this.audio.distantSound();
    } else {
      // faint ambient noise: a quieter distant sound
      this.audio.distantSound();
    }
  }

  _startFlicker() {
    this.effect = { type: 'flicker', t: 0, duration: 0.6 + Math.random() * 0.8 };
    this.audio.flickerBuzz();
  }

  _startBlackout() {
    this.effect = {
      type: 'blackout', t: 0,
      fadeOut: 0.15,
      hold: 0.8 + Math.random() * 1.6,
      fadeIn: 0.6,
    };
    this.audio.flickerBuzz();
    this.audio.setPowerState(false);
  }

  update(dt) {
    if (!this.enabled) return;

    // advance the active light effect (if any)
    if (this.effect) {
      this.effect.t += dt;
      const e = this.effect;

      if (e.type === 'flicker') {
        // random stutter between dark and full
        if (e.t >= e.duration) {
          this._endEffect();
        } else {
          // mostly on, occasional dips
          this.lightLevel = Math.random() < 0.45 ? 0.15 + Math.random() * 0.25 : 1.0;
        }
      } else if (e.type === 'blackout') {
        const total = e.fadeOut + e.hold + e.fadeIn;
        if (e.t < e.fadeOut) {
          this.lightLevel = 1.0 - (e.t / e.fadeOut);
        } else if (e.t < e.fadeOut + e.hold) {
          this.lightLevel = 0.02;
        } else if (e.t < total) {
          const k = (e.t - e.fadeOut - e.hold) / e.fadeIn;
          this.lightLevel = 0.02 + k * 0.98;
        } else {
          this.audio.setPowerState(true);
          this._endEffect();
        }
      }
      this.level.setLightLevel(this.lightLevel);
    } else {
      // countdown to the next event
      this.timer -= dt;
      if (this.timer <= 0) {
        this._trigger();
        this.timer = this._nextDelay();
      }
    }
  }

  _endEffect() {
    this.effect = null;
    this.lightLevel = 1.0;
    this.level.setLightLevel(1.0);
  }
}
