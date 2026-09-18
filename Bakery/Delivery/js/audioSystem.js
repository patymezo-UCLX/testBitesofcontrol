/* ==========================================================================
   BAKERY DELIVERY — AUDIO SYSTEM
   Centralized controller for the two background music tracks. Nothing
   else in the project should touch an Audio object directly — every
   phase transition calls into playPacking() / playDelivery() / stopAll()
   (or the fade-aware stopPacking()/stopDelivery()) from here.

   Both tracks are created lazily (only when first actually played), so
   simply loading this script never touches the browser's audio stack —
   avoiding any autoplay-before-interaction issue by construction, per
   the task's requirement. play() is always wrapped so a rejected
   Promise (blocked autoplay, missing file, etc.) can never throw into
   gameplay code.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.audioSystem = {

  // Centralized, easy to change later.
  VOLUME: 0.35,

  // Suggested fade duration for the Packing → Delivery hand-off.
  FADE_MS: 400,

  // Exact paths agreed for this project's final on-disk layout:
  //   testBitesofcontrol/Audio/BakeryPacking.wav
  //   testBitesofcontrol/Audio/BakeryDelivery.wav
  //   testBitesofcontrol/Bakery/Delivery/index.html  (this project)
  PACKING_SRC: '../../Audio/BakeryPacking.wav',
  DELIVERY_SRC: '../../Audio/BakeryDelivery.wav',

  _packingAudio: null,
  _deliveryAudio: null,
  _fadeIntervalId: null,

  // Sound ON/OFF — persists across the Packing↔Delivery transition since
  // this is the SAME object throughout, never reset per phase.
  isMuted: false,
  _currentPhase: null, // 'packing' | 'delivery' | null — which track a later unmute should resume

  _getPackingAudio() {
    if (!this._packingAudio) {
      this._packingAudio = new Audio(this.PACKING_SRC);
      this._packingAudio.loop = true;
      this._packingAudio.volume = this.VOLUME;
    }
    return this._packingAudio;
  },

  _getDeliveryAudio() {
    if (!this._deliveryAudio) {
      this._deliveryAudio = new Audio(this.DELIVERY_SRC);
      this._deliveryAudio.loop = true;
      this._deliveryAudio.volume = this.VOLUME;
    }
    return this._deliveryAudio;
  },

  /** play() can return a rejected Promise (autoplay blocked, file
   *  missing, etc.) — always swallowed here so a blocked/failed track
   *  never breaks gameplay. */
  _safePlay(audio) {
    try {
      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => { /* blocked or failed — ignore, game continues */ });
      }
    } catch (e) {
      // Same intent as above, for browsers that throw synchronously.
    }
  },

  _hardStop(audio) {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = this.VOLUME; // restore for the next play()
    } catch (e) {
      // Never let cleanup throw into a navigation/exit path.
    }
  },

  _clearFade() {
    if (this._fadeIntervalId) {
      window.clearInterval(this._fadeIntervalId);
      this._fadeIntervalId = null;
    }
  },

  /** Fades `audio` to silence over FADE_MS, then pauses/rewinds it.
   *  Safe to call on an already-paused/silent/nonexistent track. */
  _fadeOutAndStop(audio) {
    if (!audio || audio.paused) {
      this._hardStop(audio);
      return;
    }
    this._clearFade();

    const steps = 10;
    const stepMs = this.FADE_MS / steps;
    const startVolume = audio.volume;
    let stepCount = 0;

    this._fadeIntervalId = window.setInterval(() => {
      stepCount += 1;
      try {
        audio.volume = Math.max(0, startVolume * (1 - stepCount / steps));
      } catch (e) {
        this._clearFade();
        return;
      }
      if (stepCount >= steps) {
        this._clearFade();
        this._hardStop(audio);
      }
    }, stepMs);
  },

  // ------------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------------

  /** Starts (or cleanly restarts) BakeryPacking.wav from the beginning.
   *  Always stops Delivery music first — the two can never overlap,
   *  regardless of what was playing before this call. Respects the
   *  current mute state: if muted, the track is prepared/reset silently
   *  so a later unmute resumes correctly with no restart. */
  playPacking() {
    this._clearFade();
    this._hardStop(this._deliveryAudio);
    this._currentPhase = 'packing';

    const audio = this._getPackingAudio();
    this._hardStop(audio);
    if (!this.isMuted) this._safePlay(audio);
  },

  /** Starts (or cleanly restarts) BakeryDelivery.wav from the beginning.
   *  Always stops Packing music first — the two can never overlap. */
  playDelivery() {
    this._clearFade();
    this._hardStop(this._packingAudio);
    this._currentPhase = 'delivery';

    const audio = this._getDeliveryAudio();
    this._hardStop(audio);
    if (!this.isMuted) this._safePlay(audio);
  },

  /** Short fade-out for the Packing → Delivery hand-off specifically
   *  (per the task's suggested 300–500ms). playDelivery()'s own hard
   *  stop of the Packing track is the real overlap guarantee; this is
   *  purely the nicer-sounding transition. Also clears _currentPhase —
   *  during the Delivery instructions screen neither track should be
   *  "the current phase", so an unmute there correctly plays nothing
   *  until playDelivery() is actually called. */
  stopPacking() {
    this._fadeOutAndStop(this._packingAudio);
    this._currentPhase = null;
  },

  stopDelivery() {
    this._fadeOutAndStop(this._deliveryAudio);
    this._currentPhase = null;
  },

  /** Immediate, hard stop of both tracks — used on exit and when the
   *  level is completely finished. */
  stopAll() {
    this._clearFade();
    this._hardStop(this._packingAudio);
    this._hardStop(this._deliveryAudio);
    this._currentPhase = null;
  },

  // ------------------------------------------------------------------
  // SOUND ON/OFF
  // True pause/resume — never resets playback position, so toggling
  // sound off and back on continues where it left off rather than
  // restarting the track (restart-from-zero is reserved for a genuine
  // new Packing/Delivery attempt via playPacking()/playDelivery()).
  // ------------------------------------------------------------------

  /** @param {boolean} muted */
  setMuted(muted) {
    this.isMuted = muted;

    if (muted) {
      if (this._packingAudio && !this._packingAudio.paused) this._packingAudio.pause();
      if (this._deliveryAudio && !this._deliveryAudio.paused) this._deliveryAudio.pause();
      return;
    }

    // Resume ONLY the track for the current phase — never both, and
    // never the wrong one.
    if (this._currentPhase === 'packing' && this._packingAudio) {
      this._safePlay(this._packingAudio);
    } else if (this._currentPhase === 'delivery' && this._deliveryAudio) {
      this._safePlay(this._deliveryAudio);
    }
  },

  /** @returns {boolean} the new muted state */
  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }
};
