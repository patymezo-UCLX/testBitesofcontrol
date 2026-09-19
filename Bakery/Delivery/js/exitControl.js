/* ==========================================================================
   BAKERY DELIVERY — EXIT CONTROL
   A single persistent close/exit button shown on top of both screens.
   Pressing it no longer leaves immediately — it opens an in-game
   confirmation modal (reusing the same panel/button visual language as
   the success/failure panels) that pauses whichever phase is currently
   active and blocks gameplay input while open.

   SEGUIR JUGANDO: closes the modal and resumes exactly where the player
   was — no reset, no state loss.

   SALIR: performs the actual cleanup + navigation (unchanged from
   before) — stop all audio, clean up active gameplay loops/listeners,
   then a plain relative-path navigation back to the Bakery level menu.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.exitControl = {

  els: {},
  _pausedPhase: null, // 'packing' | 'delivery' | null — whichever we paused, to resume correctly

  init() {
    this.els.btn = document.getElementById('bd-exit-btn');
    this.els.backdrop = document.getElementById('bd-exit-confirm-backdrop');
    this.els.stayBtn = document.getElementById('bd-exit-confirm-stay-btn');
    this.els.leaveBtn = document.getElementById('bd-exit-confirm-leave-btn');

    this.els.btn.addEventListener('click', () => this.openConfirm());
    this.els.stayBtn.addEventListener('click', () => this.closeConfirm());
    this.els.leaveBtn.addEventListener('click', () => this._confirmLeave());
  },

  isConfirmOpen() {
    return this.els.backdrop.classList.contains('bd-active');
  },

  openConfirm() {
    if (this.isConfirmOpen()) return;

    // Pause whichever phase is currently actually running — both calls
    // are safe no-ops on the phase that isn't active.
    try {
      if (BakeryDelivery.deliveryGameplay.isRunning) {
        this._pausedPhase = 'delivery';
        BakeryDelivery.deliveryGameplay.pauseDelivery();
      } else if (BakeryDelivery.state.isPlaying) {
        this._pausedPhase = 'packing';
        BakeryDelivery.timerSystem.pause();
        BakeryDelivery.fallingObjects.pause();
      } else {
        this._pausedPhase = null;
      }
    } catch (e) {
      this._pausedPhase = null;
    }

    this.els.backdrop.classList.add('bd-active');
  },

  closeConfirm() {
    if (!this.isConfirmOpen()) return;
    this.els.backdrop.classList.remove('bd-active');

    try {
      if (this._pausedPhase === 'delivery') {
        BakeryDelivery.deliveryGameplay.resumeDelivery();
      } else if (this._pausedPhase === 'packing') {
        BakeryDelivery.timerSystem.start();
        BakeryDelivery.fallingObjects.resume();
      }
    } catch (e) {
      // Never let a resume failure trap the player with a stuck modal —
      // the modal is already closed above regardless.
    }
    this._pausedPhase = null;
  },

  _confirmLeave() {
    window.dispatchEvent(new CustomEvent('bakerydelivery:exit'));

    // Integrated Bites of Control build: Bakery Delivery is Level 3
    // inside the Bakery, so X always returns to the Bakery level selector.
    // Relative to Bakery/Delivery/index.html, that's ../levels.html.
    try {
      BakeryDelivery.audioSystem.stopAll();
      BakeryDelivery.timerSystem.reset();
      BakeryDelivery.fallingObjects.stop();
      BakeryDelivery.catcher.disable();
      BakeryDelivery.anxiSystem.forceCloseImmediately();
      BakeryDelivery.reviewSystem.forceCloseImmediately();
      BakeryDelivery.deliveryGameplay.resetDelivery();
    } catch (e) {
      // Navigation must still work even if a gameplay subsystem is not active.
    }

    window.location.href = '../levels.html';
  },

  resetToIntro() {
    const gameplayScreen = document.getElementById('bd-screen-gameplay');
    const introScreen = document.getElementById('bd-screen-intro');
    const deliveryIntroScreen = document.getElementById('bd-screen-delivery-intro');
    const deliveryScreen = document.getElementById('bd-screen-delivery');

    [gameplayScreen, deliveryIntroScreen, deliveryScreen].forEach((el) => {
      el.classList.remove('bd-active', 'bd-entering', 'bd-leaving');
      el.setAttribute('aria-hidden', 'true');
    });

    ['bd-order-note', 'bd-order-indicator', 'bd-timer', 'bd-box'].forEach((id) => {
      document.getElementById(id).classList.remove('bd-anim-in');
    });
    const boxImg = document.querySelector('#bd-box .bd-box-img');
    boxImg.classList.remove('bd-anim-idle');
    boxImg.style.transition = '';
    boxImg.style.transform = '';
    boxImg.src = BakeryDelivery.assets.boxes.open;
    document.getElementById('bd-note-overlay').innerHTML = '';

    const completePanel = document.getElementById('bd-order-complete-panel');
    completePanel.classList.remove('bd-active');
    completePanel.setAttribute('aria-hidden', 'true');

    const reviewScreen = document.getElementById('bd-review-screen');
    reviewScreen.classList.remove('bd-active');
    reviewScreen.setAttribute('aria-hidden', 'true');
    document.getElementById('bd-review-note-overlay').innerHTML = '';

    const anxiOverlay = document.getElementById('bd-anxi-overlay');
    anxiOverlay.classList.remove('bd-active');
    anxiOverlay.setAttribute('aria-hidden', 'true');
    document.getElementById('bd-anxi-character').classList.remove('bd-anim-in', 'bd-anim-out');
    document.getElementById('bd-anxi-bubble').classList.remove('bd-anim-in', 'bd-anim-out');

    const oopsToast = document.getElementById('bd-oops-toast');
    oopsToast.classList.remove('bd-anim-pop-in');
    oopsToast.setAttribute('aria-hidden', 'true');

    document.getElementById('bd-delivery-heading').classList.remove('bd-anim-in');
    document.getElementById('bd-delivery-instructions-panel').classList.remove('bd-anim-in');

    BakeryDelivery.state.currentOrder = 0;
    BakeryDelivery.state.completedOrders = 0;
    BakeryDelivery.state.requiredItems = [];
    BakeryDelivery.state.collectedItems = [];
    BakeryDelivery.state.reviewCount = 0;
    BakeryDelivery.state.isReviewOpen = false;
    BakeryDelivery.state.isAnxiActive = false;
    BakeryDelivery.state.anxiInterventionsThisOrder = 0;
    BakeryDelivery.state.isPlaying = false;
    BakeryDelivery.state.isSpawning = false;
    BakeryDelivery.state.isPaused = false;
    BakeryDelivery.state.hasTimedOut = false;
    BakeryDelivery.state.packingComplete = false;
    BakeryDelivery.state.phase = 'packing';

    BakeryDelivery.deliverySystem.resetGuards();

    introScreen.classList.add('bd-active');
    introScreen.setAttribute('aria-hidden', 'false');
    BakeryDelivery.setScreen('intro');
  }
};
