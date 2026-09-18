/* ==========================================================================
   BAKERY DELIVERY — GAMEPLAY SCREEN (STAGE 3 v2: 5 ORDERS + 2:00 COUNTDOWN)
   Owns the order loop and the global countdown's start/pause points.

   Timer behavior (see timerSystem.js for the actual clock):
   - Starts once, at the very first order (beginPacking).
   - Pauses only for the brief, automatic, no-choice box-close/box-open
     transition between an order finishing and Anxi's end-of-order doubt
     appearing — nowhere else. It explicitly keeps running through Anxi
     questions, review, and the repeated review loop.
   - Locked (paused) the instant ENVIAR PEDIDO is pressed, for any order,
     so the send confirmation's brief animation can never race against a
     00:00 timeout — this also covers the 5th-order "success takes
     priority" edge case for free.
   - Stopped for good once packingComplete is set.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.gameplay = {

  els: {},
  _oopsTimer: null,

  init() {
    this.els.screen = document.getElementById('bd-screen-gameplay');
    this.els.orderNote = document.getElementById('bd-order-note');
    this.els.orderIndicator = document.getElementById('bd-order-indicator');
    this.els.timer = document.getElementById('bd-timer');
    this.els.box = document.getElementById('bd-box');
    this.els.boxImg = this.els.box.querySelector('.bd-box-img');
    this.els.oopsToast = document.getElementById('bd-oops-toast');

    BakeryDelivery.catcher.init();
    BakeryDelivery.fallingObjects.init();
    BakeryDelivery.panelUI.init();
    BakeryDelivery.timerSystem.init();
    BakeryDelivery.anxiSystem.init();
    BakeryDelivery.reviewSystem.init();
  },

  show() {
    BakeryDelivery.setScreen('gameplay');
    this.playEntrance();
  },

  playEntrance() {
    this.els.orderNote.classList.add('bd-anim-in');
    this.els.orderIndicator.classList.add('bd-anim-in');
    this.els.timer.classList.add('bd-anim-in');

    this.els.box.classList.add('bd-anim-in');
    this.els.box.addEventListener('animationend', () => {
      this.els.boxImg.classList.add('bd-anim-idle');
      this.beginPacking();
    }, { once: true });
  },

  /** Entry point for both a fresh attempt and a retry after timeout. */
  beginPacking() {
    BakeryDelivery.state.completedOrders = 0;
    BakeryDelivery.timerSystem.start();
    this.startOrder(0);
  },

  // ------------------------------------------------------------------
  // ORDER FLOW
  // ------------------------------------------------------------------

  startOrder(index) {
    const orderConfig = BakeryDelivery.orders[index];
    if (!orderConfig) return;

    BakeryDelivery.state.currentOrder = index;
    BakeryDelivery.state.requiredItems = orderConfig.items.map((id) => ({ id, collected: false }));
    BakeryDelivery.state.collectedItems = [];
    BakeryDelivery.state.reviewCount = 0;
    BakeryDelivery.state.isReviewOpen = false;
    BakeryDelivery.anxiSystem.resetForOrder();

    BakeryDelivery.orderUI.updateOrderIndicator(index + 1, BakeryDelivery.state.totalOrders);
    BakeryDelivery.orderUI.renderOrder(orderConfig.items);

    // The global countdown resumes here if it had been paused for the
    // automatic transition into this order.
    BakeryDelivery.timerSystem.start();

    BakeryDelivery.catcher.activate(true);
    BakeryDelivery.fallingObjects.start();
  },

  onCorrectCatch(itemId) {
    const item = BakeryDelivery.state.requiredItems.find((it) => it.id === itemId && !it.collected);
    if (!item) return;

    item.collected = true;
    BakeryDelivery.state.collectedItems.push(itemId);
    BakeryDelivery.orderUI.markCollected(itemId);
    BakeryDelivery.catcher.triggerBounce();

    const allCollected = BakeryDelivery.state.requiredItems.every((it) => it.collected);
    if (allCollected) {
      this.completeOrder();
    }
  },

  onWrongCatch() {
    this.showOops();
  },

  showOops() {
    const toast = this.els.oopsToast;
    toast.classList.remove('bd-anim-pop-in');
    void toast.offsetWidth; // restart the animation even in quick succession
    toast.classList.add('bd-anim-pop-in');
    toast.setAttribute('aria-hidden', 'false');

    window.clearTimeout(this._oopsTimer);
    this._oopsTimer = window.setTimeout(() => {
      toast.classList.remove('bd-anim-pop-in');
      toast.setAttribute('aria-hidden', 'true');
    }, 700);
  },

  completeOrder() {
    if (BakeryDelivery.state.hasTimedOut) return;

    BakeryDelivery.state.isPlaying = false; // stop packing-doubt triggers immediately
    BakeryDelivery.fallingObjects.stopSpawning();
    BakeryDelivery.catcher.disable();

    // This box-close moment is exactly the kind of brief, automatic,
    // no-choice transition the spec allows the countdown to pause for.
    BakeryDelivery.timerSystem.pause();

    window.setTimeout(() => {
      if (BakeryDelivery.state.hasTimedOut) return;
      BakeryDelivery.fallingObjects.stop();
      this.setBoxClosed(() => {
        if (BakeryDelivery.state.hasTimedOut) return;
        window.setTimeout(() => {
          if (BakeryDelivery.state.hasTimedOut) return;
          // The countdown resumes the instant the player has a decision
          // to make again.
          BakeryDelivery.timerSystem.start();
          BakeryDelivery.anxiSystem.showEndOfOrderDoubt();
        }, 250);
      });
    }, 500);
  },

  /** Called by anxiSystem the moment ENVIAR PEDIDO is chosen — from the
   *  first end-of-order doubt or after any number of reviews. */
  sendOrder() {
    if (BakeryDelivery.state.hasTimedOut || BakeryDelivery.state.packingComplete) return;

    // Lock the clock immediately so this brief confirmation animation can
    // never race against a 00:00 timeout — this is what makes the Order 5
    // "success takes priority" edge case correct for every order, not
    // just the last one.
    BakeryDelivery.timerSystem.pause();

    BakeryDelivery.panelUI.setHeading(BakeryDelivery.reviewText.sentText);
    BakeryDelivery.panelUI.setSubtext(null);
    BakeryDelivery.panelUI.clearActions();
    BakeryDelivery.panelUI.open();

    window.setTimeout(() => {
      if (BakeryDelivery.state.hasTimedOut) return;
      BakeryDelivery.panelUI.close();
      window.setTimeout(() => {
        if (BakeryDelivery.state.hasTimedOut) return;
        this.proceedAfterSend();
      }, 200);
    }, 900);
  },

  proceedAfterSend() {
    BakeryDelivery.state.completedOrders += 1;
    const isFinalOrder = BakeryDelivery.state.currentOrder >= BakeryDelivery.state.totalOrders - 1;

    if (isFinalOrder) {
      BakeryDelivery.state.packingComplete = true;
      BakeryDelivery.state.phase = 'packingComplete';
      BakeryDelivery.timerSystem.stop();
      this.showFinalCompletion();
    } else {
      this.setBoxOpen(() => {
        if (BakeryDelivery.state.hasTimedOut) return;
        this.startOrder(BakeryDelivery.state.currentOrder + 1);
      });
    }
  },

  showFinalCompletion() {
    BakeryDelivery.panelUI.setHeading(`${BakeryDelivery.reviewText.finalTitle} ${BakeryDelivery.reviewText.finalCount}`);
    BakeryDelivery.panelUI.setSubtext(BakeryDelivery.reviewText.finalSubtext);
    BakeryDelivery.panelUI.clearActions();
    BakeryDelivery.panelUI.addButton(BakeryDelivery.reviewText.continuarBtn, () => {
      BakeryDelivery.deliverySystem.showDeliveryIntro();
    }, true);
    BakeryDelivery.panelUI.open();
  },

  // ------------------------------------------------------------------
  // TIMEOUT
  // ------------------------------------------------------------------

  handleTimeout() {
    const s = BakeryDelivery.state;
    if (s.hasTimedOut || s.packingComplete) return; // guards double-invocation
    s.hasTimedOut = true;

    BakeryDelivery.timerSystem.pause();
    BakeryDelivery.fallingObjects.stop();
    BakeryDelivery.catcher.disable();
    BakeryDelivery.anxiSystem.forceCloseImmediately();
    BakeryDelivery.reviewSystem.forceCloseImmediately();

    this.showTimeoutPanel();
  },

  showTimeoutPanel() {
    BakeryDelivery.panelUI.setHeading(BakeryDelivery.reviewText.timeoutTitle);
    BakeryDelivery.panelUI.setSubtext(BakeryDelivery.reviewText.timeoutLines);
    BakeryDelivery.panelUI.clearActions();
    BakeryDelivery.panelUI.addButton(BakeryDelivery.reviewText.retryBtn, () => {
      BakeryDelivery.retrySystem.retry();
    }, true);
    BakeryDelivery.panelUI.open();
  },

  // ------------------------------------------------------------------
  // BOX OPEN/CLOSE SWAP
  // A small pop on swap, done by briefly taking over the box image's
  // transform directly (its idle-float animation is paused for the
  // duration so the two don't fight over the same CSS property).
  // ------------------------------------------------------------------

  setBoxClosed(onDone) { this._swapBox(BakeryDelivery.assets.boxes.closed, onDone); },
  setBoxOpen(onDone) { this._swapBox(BakeryDelivery.assets.boxes.open, onDone); },

  _swapBox(src, onDone) {
    const img = this.els.boxImg;
    img.classList.remove('bd-anim-idle');
    img.style.transition = 'transform 0.16s ease-in';
    img.style.transform = 'scale(0.85)';

    window.setTimeout(() => {
      img.src = src;
      img.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
      img.style.transform = 'scale(1.08)';

      window.setTimeout(() => {
        img.style.transform = 'scale(1)';
        window.setTimeout(() => {
          img.style.transition = '';
          img.classList.add('bd-anim-idle');
          if (onDone) onDone();
        }, 220);
      }, 160);
    }, 160);
  },

  // ------------------------------------------------------------------
  // PAUSE / RESUME — used by Anxi's active-packing interruption only.
  // Deliberately does NOT touch the global countdown: per spec, the
  // clock keeps running while the player is reading/deciding.
  // ------------------------------------------------------------------

  pausePackingGame() {
    BakeryDelivery.fallingObjects.pause();
    BakeryDelivery.catcher.disable();
  },

  resumePackingGame() {
    BakeryDelivery.catcher.enable();
    BakeryDelivery.fallingObjects.resume();
  }
};
