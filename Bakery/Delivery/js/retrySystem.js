/* ==========================================================================
   BAKERY DELIVERY — RETRY SYSTEM
   Resets a complete packing attempt back to its exact starting state after
   a timeout, without a page reload and without leaving behind stray
   falling objects, duplicated listeners, or old popup state. Reuses the
   same modules/DOM (all of which already guard their own listener
   binding), so this only needs to reset DATA and call back into the
   normal start-of-attempt flow.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.retrySystem = {

  init() {
    // Nothing to wire up here — the retry BUTTON itself is created fresh
    // each time by panelUI when the timeout panel is shown, and calls
    // retry() directly.
  },

  retry() {
    const s = BakeryDelivery.state;

    BakeryDelivery.panelUI.close();

    // Belt-and-suspenders: these should already be stopped/hidden by
    // handleTimeout(), but retry() must be safe to call from anywhere.
    BakeryDelivery.fallingObjects.stop();
    BakeryDelivery.catcher.disable();
    BakeryDelivery.anxiSystem.forceCloseImmediately();
    BakeryDelivery.reviewSystem.forceCloseImmediately();

    // Reset the box back to its open artwork with no animation — this is
    // a hard reset, not a transition.
    const boxImg = document.querySelector('#bd-box .bd-box-img');
    boxImg.classList.remove('bd-anim-idle');
    boxImg.style.transition = '';
    boxImg.style.transform = '';
    boxImg.src = BakeryDelivery.assets.boxes.open;

    document.getElementById('bd-note-overlay').innerHTML = '';

    // Reset state.
    s.currentOrder = 0;
    s.completedOrders = 0;
    s.requiredItems = [];
    s.collectedItems = [];
    s.isPlaying = false;
    s.isSpawning = false;
    s.isPaused = false;
    s.isAnxiActive = false;
    s.currentAnxiDialogue = null;
    s.currentAnxiPose = null;
    s.anxiInterventionsThisOrder = 0;
    s.reviewCount = 0;
    s.isReviewOpen = false;
    s.hasTimedOut = false;
    s.packingComplete = false;

    BakeryDelivery.timerSystem.reset();

    // Re-enter the packing flow exactly as if the intro's START had just
    // been pressed.
    BakeryDelivery.gameplay.beginPacking();
  }
};
