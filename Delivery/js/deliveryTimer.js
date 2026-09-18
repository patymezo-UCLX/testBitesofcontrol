/* ==========================================================================
   BAKERY DELIVERY — DELIVERY TIMER (this pass)
   ONE global countdown across all 5 houses — starts when active driving
   begins (not during Delivery instructions), keeps running through
   physical collisions/slowdowns and through the ENTREGAR PEDIDO CTA
   window, and pauses ONLY for the very brief automatic Anxi test effect
   (see deliveryObstacles.js's triggerAnxiEncounter()).

   Deadline-timestamp based, same accurate pattern as Packing's
   timerSystem.js — immune to setInterval drift.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryTimer = {

  els: {},
  deadline: null,
  remainingMs: 0,
  running: false,
  intervalId: null,
  hasTimedOut: false,

  _autoResumeTimer: null,

  init() {
    this.els.text = document.getElementById('bd-delivery-timer-text');
    this.els.wrap = document.getElementById('bd-delivery-timer');
  },

  reset() {
    this.pause();
    this._clearAutoResume();
    this.remainingMs = BakeryDelivery.deliveryConfig.DELIVERY_TIME_LIMIT * 1000;
    this.hasTimedOut = false;
    this._render();
  },

  start() {
    if (this.running || this.hasTimedOut) return;
    this.running = true;
    this.deadline = performance.now() + this.remainingMs;
    this._tick();
    this.intervalId = window.setInterval(() => this._tick(), 200);
  },

  pause() {
    if (this.running) {
      this.remainingMs = Math.max(0, this.deadline - performance.now());
    }
    this.running = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  stop() {
    this.pause();
    this._clearAutoResume();
  },

  /** Pauses for exactly ms, then resumes automatically — used ONLY for
   *  the brief automatic Anxi test effect. Any player-facing decision
   *  window (the CTA, a future Anxi dialogue) must keep the timer
   *  running instead, per spec. */
  pauseForAutomaticEffect(ms) {
    if (this.hasTimedOut) return;
    this.pause();
    this._clearAutoResume();
    this._autoResumeTimer = window.setTimeout(() => {
      this._autoResumeTimer = null;
      this.start();
    }, ms);
  },

  _clearAutoResume() {
    if (this._autoResumeTimer) {
      window.clearTimeout(this._autoResumeTimer);
      this._autoResumeTimer = null;
    }
  },

  _tick() {
    if (this.running) {
      this.remainingMs = Math.max(0, this.deadline - performance.now());
    }
    this._render();

    if (this.remainingMs <= 0 && this.running && !this.hasTimedOut) {
      this.hasTimedOut = true;
      this.pause();
      BakeryDelivery.deliveryGameplay.handleDeliveryTimeout();
    }
  },

  _render() {
    const totalSec = Math.ceil(this.remainingMs / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    if (this.els.text) this.els.text.textContent = `${m}:${s}`;

    if (this.els.wrap) {
      this.els.wrap.classList.toggle('bd-delivery-timer-warn', totalSec <= 20 && totalSec > 8);
      this.els.wrap.classList.toggle('bd-delivery-timer-critical', totalSec <= 8);
    }
  }
};
