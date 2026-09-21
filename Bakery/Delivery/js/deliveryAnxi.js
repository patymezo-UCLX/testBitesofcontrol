/* ==========================================================================
   BAKERY DELIVERY — DELIVERY ANXI
   Two entry points, matching Changes 3 and 4 exactly:

     showNear()      — Meli passed near Anxi WITHOUT colliding. Purely
                        delegates to anxiDistraction.js's non-blocking
                        bubble — no pause, no life lost, no input.

     triggerCollision() — Meli actually collided with Anxi. A real
                        decision: REVISAR (a short backward-travel
                        "checking" sequence, world genuinely reverses,
                        timer keeps running) or CONTINUAR (resume
                        immediately). Never removes a life — Anxi is
                        never treated as a physical obstacle.

   Deliberately does NOT touch deliveryDestination.js — the checking
   sequence is achieved purely by reversing deliveryWorld's shared speed
   value, which every world-space mover already reads from.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryAnxi = {

  els: {},

  isOpen: false,      // the decision overlay itself is visible
  isChecking: false,  // the backward-travel sequence is running
  _checkingTimer: null,
  _toastTimer: null,

  init() {
    this.els.overlay = document.getElementById('bd-delivery-anxi-overlay');
    this.els.character = document.getElementById('bd-delivery-anxi-character');
    this.els.img = document.getElementById('bd-delivery-anxi-img');
    this.els.bubble = document.getElementById('bd-delivery-anxi-bubble');
    this.els.text = document.getElementById('bd-delivery-anxi-text');
    this.els.options = document.getElementById('bd-delivery-anxi-options');
    this.els.toast = document.getElementById('bd-delivery-anxi-toast');
  },

  reset() {
    this._clearCheckingTimer();
    this._clearToastTimer();
    this.isOpen = false;
    this.isChecking = false;
    this.els.overlay.classList.remove('bd-active');
    this.els.overlay.setAttribute('aria-hidden', 'true');
    this.els.character.classList.remove('bd-anim-in', 'bd-anim-out');
    this.els.bubble.classList.remove('bd-anim-in', 'bd-anim-out');
    this._hideToast();
    BakeryDelivery.deliveryWorld.setReversed(false);
    BakeryDelivery.anxiDistraction.hideDeliveryNear();
  },

  isActive() {
    return this.isOpen || this.isChecking;
  },

  // ------------------------------------------------------------------
  // CHANGE 3 — PASSING NEAR (non-blocking)
  // ------------------------------------------------------------------

  showNear(o) {
    BakeryDelivery.anxiDistraction.showDeliveryNear(o);
  },

  // ------------------------------------------------------------------
  // CHANGE 4 — DIRECT COLLISION (decision)
  // ------------------------------------------------------------------

  triggerCollision() {
    if (!BakeryDelivery.deliveryGameplay.isRunning) return;
    if (this.isActive()) return; // one encounter at a time

    this.isOpen = true;
    BakeryDelivery.deliveryGameplay.setAnxiBlocking(true);
    BakeryDelivery.deliveryGameplay.pauseDelivery(); // freezes world/Meli/obstacles; the Delivery timer runs on its own independent interval and keeps going

    const poseIndex = Math.floor(Math.random() * BakeryDelivery.assets.anxi.length);
    this.els.img.src = BakeryDelivery.assets.anxi[poseIndex];
    this.els.text.textContent = BakeryDelivery.anxiDeliveryCollisionDoubt;
    this.els.options.innerHTML = '';
    this.els.options.appendChild(this._makeButton('REVISAR', () => this._handleRevisar()));
    this.els.options.appendChild(this._makeButton('CONTINUAR', () => this._handleContinuar()));

    this._show();
  },

  _handleContinuar() {
    this._closeDialogue(() => {
      if (!BakeryDelivery.deliveryGameplay.isRunning) return; // timeout beat us to it
      BakeryDelivery.deliveryGameplay.setAnxiBlocking(false);
      BakeryDelivery.deliveryGameplay.resumeDelivery();
    });
  },

  _handleRevisar() {
    this._closeDialogue(() => this._startChecking());
  },

  _closeDialogue(after) {
    this.els.character.classList.remove('bd-anim-in');
    this.els.bubble.classList.remove('bd-anim-in');
    this.els.character.classList.add('bd-anim-out');
    this.els.bubble.classList.add('bd-anim-out');

    window.setTimeout(() => {
      this.els.overlay.classList.remove('bd-active');
      this.els.overlay.setAttribute('aria-hidden', 'true');
      this.els.character.classList.remove('bd-anim-out');
      this.els.bubble.classList.remove('bd-anim-out');
      this.isOpen = false;
      if (after) after();
    }, 320);
  },

  // ------------------------------------------------------------------
  // TEMPORARY BACKWARD-TRAVEL "CHECKING" SEQUENCE
  // ------------------------------------------------------------------

  _startChecking() {
    if (!BakeryDelivery.deliveryGameplay.isRunning) return; // timeout beat us to it during the close animation

    this.isChecking = true;
    BakeryDelivery.deliveryWorld.setReversed(true);
    BakeryDelivery.deliveryGameplay.resumeDelivery(); // world/obstacles tick again, now moving backward — anxiBlocking stays true throughout

    this._showToast('REGRESANDO A REVISAR...');

    this._clearCheckingTimer();
    this._checkingTimer = window.setTimeout(() => {
      this._endChecking();
    }, BakeryDelivery.deliveryConfig.DELIVERY_ANXI_CHECKING_MS);
  },

  _endChecking() {
    this._checkingTimer = null;
    if (!BakeryDelivery.deliveryGameplay.isRunning) return; // timeout beat us to it

    BakeryDelivery.deliveryWorld.setReversed(false);
    this.isChecking = false;
    BakeryDelivery.deliveryGameplay.setAnxiBlocking(false);

    this._showToast('CONTINÚA TU CAMINO');
  },

  /** Called by deliveryGameplay.js the moment the Delivery timer reaches
   *  0 — timeout ALWAYS takes priority, closing/cancelling this instantly,
   *  no animation. */
  forceCloseImmediately() {
    this._clearCheckingTimer();
    this._clearToastTimer();

    this.els.overlay.classList.remove('bd-active');
    this.els.overlay.setAttribute('aria-hidden', 'true');
    this.els.character.classList.remove('bd-anim-in', 'bd-anim-out');
    this.els.bubble.classList.remove('bd-anim-in', 'bd-anim-out');
    this._hideToast();

    if (this.isChecking) {
      BakeryDelivery.deliveryWorld.setReversed(false);
    }
    this.isOpen = false;
    this.isChecking = false;
  },

  // ------------------------------------------------------------------
  // SHARED RENDER HELPERS
  // ------------------------------------------------------------------

  _makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bd-anxi-option-btn';
    btn.textContent = label;

    let handled = false;
    btn.addEventListener('click', () => {
      if (handled) return;
      handled = true;
      btn.classList.add('bd-pressed');
      onClick();
    });

    return btn;
  },

  _show() {
    this.els.overlay.classList.add('bd-active');
    this.els.overlay.setAttribute('aria-hidden', 'false');

    this.els.character.classList.remove('bd-anim-in', 'bd-anim-out');
    this.els.bubble.classList.remove('bd-anim-in', 'bd-anim-out');
    void this.els.character.offsetWidth;
    this.els.character.classList.add('bd-anim-in');
    this.els.bubble.classList.add('bd-anim-in');
  },

  _showToast(text) {
    this._clearToastTimer();
    this.els.toast.textContent = text;
    this.els.toast.classList.remove('bd-active');
    void this.els.toast.offsetWidth;
    this.els.toast.classList.add('bd-active');
    this._toastTimer = window.setTimeout(() => this._hideToast(), 1800);
  },

  _hideToast() {
    this.els.toast.classList.remove('bd-active');
  },

  _clearCheckingTimer() {
    if (this._checkingTimer) {
      window.clearTimeout(this._checkingTimer);
      this._checkingTimer = null;
    }
  },

  _clearToastTimer() {
    if (this._toastTimer) {
      window.clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
  }
};
