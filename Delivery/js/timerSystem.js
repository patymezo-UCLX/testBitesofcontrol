/* ==========================================================================
   BAKERY DELIVERY — TIMER SYSTEM
   The global 2:00 packing countdown. Tracks a real deadline timestamp
   rather than naively decrementing once per ~1000ms, so it stays accurate
   even under setInterval/rAF drift (per Stage 3 spec §57).

   This is intentionally the ONLY thing that can end a packing attempt —
   wrong catches, Anxi, and repeated review never do.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.timerSystem = {

  els: {},
  deadline: null,      // ms timestamp the countdown reaches 0 at, while running
  remainingMs: 0,       // authoritative remaining time while paused
  running: false,
  intervalId: null,

  init() {
    this.els.timer = document.getElementById('bd-timer');
    this.els.timerText = document.getElementById('bd-timer-text');
    this.reset();
  },

  reset() {
    this.pause();
    this.remainingMs = BakeryDelivery.config.PACKING_TIME_LIMIT * 1000;
    BakeryDelivery.state.timeLimit = BakeryDelivery.config.PACKING_TIME_LIMIT;
    BakeryDelivery.state.timeRemaining = BakeryDelivery.config.PACKING_TIME_LIMIT;
    BakeryDelivery.state.timerRunning = false;
    this._render();
  },

  /** (Re)starts the countdown from the current remaining value. Safe to
   *  call repeatedly — a no-op while already running, and refuses to
   *  start once the attempt has ended (timeout or success). */
  start() {
    if (this.running) return;
    if (BakeryDelivery.state.hasTimedOut || BakeryDelivery.state.packingComplete) return;

    this.running = true;
    BakeryDelivery.state.timerRunning = true;
    this.deadline = performance.now() + this.remainingMs;

    this._tick();
    this.intervalId = window.setInterval(() => this._tick(), 200);
  },

  /** Freezes the countdown at its current remaining value — used only for
   *  the brief, mandatory, no-choice transitions the spec allows (an
   *  order's automatic close/open animation), never for Anxi or review. */
  pause() {
    if (this.running) {
      this.remainingMs = Math.max(0, this.deadline - performance.now());
    }
    this.running = false;
    BakeryDelivery.state.timerRunning = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  /** Permanently stops the countdown (5th order sent, or timeout already
   *  handled) — distinct from pause() only in that nothing should ever
   *  call start() again afterwards while packingComplete/hasTimedOut hold. */
  stop() {
    this.pause();
  },

  _tick() {
    if (this.running) {
      this.remainingMs = Math.max(0, this.deadline - performance.now());
    }
    BakeryDelivery.state.timeRemaining = Math.ceil(this.remainingMs / 1000);
    this._render();

    if (this.remainingMs <= 0 && this.running) {
      this.pause();
      BakeryDelivery.gameplay.handleTimeout();
    }
  },

  _render() {
    const total = Math.max(0, BakeryDelivery.state.timeRemaining);
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    this.els.timerText.textContent = `${minutes}:${seconds}`;

    // Subtle low-time emphasis only — never a full-screen flash.
    this.els.timer.classList.toggle('bd-timer-warn', total <= 30 && total > 10);
    this.els.timer.classList.toggle('bd-timer-critical', total <= 10);
  }
};
