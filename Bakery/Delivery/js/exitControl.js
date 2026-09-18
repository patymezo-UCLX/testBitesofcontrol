/* ==========================================================================
   BAKERY DELIVERY — EXIT CONTROL
   A single persistent close/exit button shown on top of both screens.
   Stage 1 has no host game to return to, so pressing it:
     1) fires a "bakerydelivery:exit" DOM event other code can listen for
        once this module is wired into Bites of Control's navigation, and
     2) resets this module back to its own intro screen so it stays fully
        testable as a standalone page in the meantime.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.exitControl = {

  els: {},

  init() {
    this.els.btn = document.getElementById('bd-exit-btn');
    this.els.btn.addEventListener('click', () => this.handleExit());
  },

  handleExit() {
    window.dispatchEvent(new CustomEvent('bakerydelivery:exit'));

    // Integrated Bites of Control build: Bakery Delivery is Level 3
    // inside the Bakery, so X always returns to the Bakery level selector.
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

    // Every non-intro screen gets fully hidden, regardless of which one(s)
    // happen to be active — exit must be safe to call from anywhere past
    // the intro, including the Delivery transition screens, which don't
    // track BakeryDelivery.state.screen themselves (only state.phase).
    [gameplayScreen, deliveryIntroScreen, deliveryScreen].forEach((el) => {
      el.classList.remove('bd-active', 'bd-entering', 'bd-leaving');
      el.setAttribute('aria-hidden', 'true');
    });

    // Clear transient gameplay entrance state so it plays fresh next time.
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
