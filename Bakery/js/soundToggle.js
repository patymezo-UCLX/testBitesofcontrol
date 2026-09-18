/* ==========================================================================
   BAKERY DELIVERY — SOUND TOGGLE
   A single persistent button (same pattern as exitControl.js's exit
   button) shown on top of both Packing and Delivery, so the sound
   preference is naturally the same DOM element/state across the
   Packing → Delivery transition — nothing extra needed to keep it
   "consistent while moving between phases".

   This module owns only the ICON/UI state; all actual audio behavior
   lives in audioSystem.js (toggleMute()).
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.soundToggle = {

  els: {},

  init() {
    this.els.btn = document.getElementById('bd-sound-btn');
    this._render(BakeryDelivery.audioSystem.isMuted);

    this.els.btn.addEventListener('click', () => {
      const muted = BakeryDelivery.audioSystem.toggleMute();
      this._render(muted);
    });
  },

  _render(muted) {
    this.els.btn.classList.toggle('bd-sound-btn-muted', muted);
    this.els.btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.els.btn.setAttribute('aria-label', muted ? 'Activar música' : 'Silenciar música');
  }
};
