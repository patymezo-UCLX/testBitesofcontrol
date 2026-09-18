/* ==========================================================================
   BAKERY DELIVERY — ANXI SYSTEM
   Two distinct kinds of interruption:

   1. PACKING DOUBT — fires during active falling-object gameplay (progress-
      based trigger, not timer-based). Short: one doubt line + a single
      CONTINUAR button, occasionally followed by one brief second doubt.
      Pauses falling objects + box control. Does NOT pause the global
      countdown — the clock keeps running.

   2. END-OF-ORDER DOUBT — fires after the box closes, and loops for as
      long as the player keeps choosing to review: doubt → REVISAR/ENVIAR
      PEDIDO → (review popup) → doubt again with a new phrase, or ENVIAR
      PEDIDO to leave the loop at any point. There is no hard review
      limit; the countdown is what naturally bounds this.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.anxiSystem = {

  els: {},

  _activityCount: 0,
  _nextThreshold: 0,

  init() {
    this.els.overlay = document.getElementById('bd-anxi-overlay');
    this.els.characterImg = document.getElementById('bd-anxi-img');
    this.els.character = document.getElementById('bd-anxi-character');
    this.els.bubble = document.getElementById('bd-anxi-bubble');
    this.els.text = document.getElementById('bd-anxi-text');
    this.els.options = document.getElementById('bd-anxi-options');

    this._rollNextThreshold();
  },

  /** Called by gameplay.js at the start of every order. */
  resetForOrder() {
    BakeryDelivery.state.anxiInterventionsThisOrder = 0;
    this._activityCount = 0;
    this._rollNextThreshold();
  },

  _rollNextThreshold() {
    // "Approximately one per order" with occasional variation — randomized
    // so the interruption never lands on the same Nth object every time.
    this._nextThreshold = 4 + Math.floor(Math.random() * 4); // 4–7
  },

  _nextPose() {
    const pose = BakeryDelivery.state.anxiInterventions % 4;
    BakeryDelivery.state.currentAnxiPose = pose;
    BakeryDelivery.state.anxiInterventions += 1;
    return pose;
  },

  // ----------------------------------------------------------------------
  // 1. PACKING DOUBT (active gameplay)
  // ----------------------------------------------------------------------

  /** Called by fallingObjects.js whenever an object is resolved (caught,
   *  rejected, or missed) — deliberately not tied to correct catches only,
   *  so the trigger still works even if the player misses everything. */
  notifyActivity() {
    if (!this._canTriggerPackingDoubt()) return;

    this._activityCount += 1;
    if (this._activityCount >= this._nextThreshold) {
      this._activityCount = 0;
      this._rollNextThreshold();
      this.triggerPackingDoubt();
    }
  },

  _canTriggerPackingDoubt() {
    const s = BakeryDelivery.state;
    if (s.hasTimedOut || s.packingComplete) return false;
    if (s.isAnxiActive || s.isReviewOpen) return false;
    if (s.screen !== 'gameplay') return false;
    if (!s.isPlaying || s.isPaused) return false;
    if (s.anxiInterventionsThisOrder >= 2) return false;
    if (s.requiredItems.length && s.requiredItems.every((it) => it.collected)) return false;
    return true;
  },

  triggerPackingDoubt() {
    if (!this._canTriggerPackingDoubt()) return;

    BakeryDelivery.state.isAnxiActive = true;
    BakeryDelivery.state.anxiInterventionsThisOrder += 1;
    BakeryDelivery.gameplay.pausePackingGame(); // falling + box only, NOT the clock

    const dialogueIndex = BakeryDelivery.state.anxiInterventions % BakeryDelivery.anxiPackingDialogues.length;
    BakeryDelivery.state.currentAnxiDialogue = dialogueIndex;
    const dialogue = BakeryDelivery.anxiPackingDialogues[dialogueIndex];
    const poseIndex = this._nextPose();

    this._renderSolo(dialogue.text, poseIndex, () => this._handlePackingContinue());
    this._show();
  },

  _handlePackingContinue() {
    // Occasionally add one brief second doubt — never a decision tree,
    // just one more short line before returning to the task.
    if (Math.random() < 0.35) {
      const poseIndex = this._nextPose();
      this._renderSolo(BakeryDelivery.anxiPackingFollowUp, poseIndex, () => this._exitFromPacking());
    } else {
      this._exitFromPacking();
    }
  },

  _exitFromPacking() {
    this._hide(() => {
      BakeryDelivery.state.isAnxiActive = false;
      BakeryDelivery.gameplay.resumePackingGame();
    });
  },

  // ----------------------------------------------------------------------
  // 2. END-OF-ORDER DOUBT LOOP (reusable — no hard review limit)
  // ----------------------------------------------------------------------

  /** Called by gameplay.js right after the box finishes closing, and
   *  again every time the player closes the review popup. */
  showEndOfOrderDoubt() {
    const s = BakeryDelivery.state;
    if (s.hasTimedOut || s.packingComplete) return;
    if (s.isAnxiActive) return; // reentrancy guard

    s.isAnxiActive = true;

    const count = s.reviewCount;
    const entry = count < BakeryDelivery.anxiEndOfOrderDoubts.length
      ? BakeryDelivery.anxiEndOfOrderDoubts[count]
      : BakeryDelivery.anxiRepeatedDoubtPool[(count - BakeryDelivery.anxiEndOfOrderDoubts.length) % BakeryDelivery.anxiRepeatedDoubtPool.length];

    const reviewLabel = entry.reviewLabel || 'REVISAR OTRA VEZ';
    const poseIndex = this._nextPose();

    this.els.characterImg.src = BakeryDelivery.assets.anxi[poseIndex];
    this.els.text.textContent = entry.text;
    this.els.options.innerHTML = '';

    this.els.options.appendChild(
      this._makeOptionButton(reviewLabel, () => this._handleReviewChoice())
    );
    this.els.options.appendChild(
      this._makeOptionButton(BakeryDelivery.reviewText.sendBtn, () => this._handleSendChoice())
    );

    this._show();
  },

  _handleReviewChoice() {
    if (BakeryDelivery.state.hasTimedOut) return;
    this._hide(() => {
      BakeryDelivery.state.isAnxiActive = false;
      if (BakeryDelivery.state.hasTimedOut) return;
      BakeryDelivery.reviewSystem.openReview();
    });
  },

  _handleSendChoice() {
    if (BakeryDelivery.state.hasTimedOut) return;
    this._hide(() => {
      BakeryDelivery.state.isAnxiActive = false;
      if (BakeryDelivery.state.hasTimedOut) return;
      BakeryDelivery.gameplay.sendOrder();
    });
  },

  // ----------------------------------------------------------------------
  // Shared rendering helpers
  // ----------------------------------------------------------------------

  _renderSolo(text, poseIndex, onContinue) {
    this.els.characterImg.src = BakeryDelivery.assets.anxi[poseIndex];
    this.els.text.textContent = text;
    this.els.options.innerHTML = '';

    const btn = this._makeOptionButton(BakeryDelivery.reviewText.continuarBtn, onContinue);
    btn.classList.add('bd-anxi-option-btn-solo');
    this.els.options.appendChild(btn);
  },

  _makeOptionButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bd-anxi-option-btn';
    btn.textContent = label;

    let handled = false; // guards against rapid double-activation
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
    void this.els.character.offsetWidth; // restart the animation on repeat
    this.els.character.classList.add('bd-anim-in');
    this.els.bubble.classList.add('bd-anim-in');
  },

  _hide(onHidden) {
    this.els.character.classList.remove('bd-anim-in');
    this.els.bubble.classList.remove('bd-anim-in');
    this.els.character.classList.add('bd-anim-out');
    this.els.bubble.classList.add('bd-anim-out');

    window.setTimeout(() => {
      this.els.overlay.classList.remove('bd-active');
      this.els.overlay.setAttribute('aria-hidden', 'true');
      this.els.character.classList.remove('bd-anim-out');
      this.els.bubble.classList.remove('bd-anim-out');
      if (onHidden) onHidden();
    }, 320);
  },

  /** Used only by the timeout path: hide instantly, no exit animation,
   *  no callback — the game is ending, not resuming. */
  forceCloseImmediately() {
    this.els.overlay.classList.remove('bd-active');
    this.els.overlay.setAttribute('aria-hidden', 'true');
    this.els.character.classList.remove('bd-anim-in', 'bd-anim-out');
    this.els.bubble.classList.remove('bd-anim-in', 'bd-anim-out');
    BakeryDelivery.state.isAnxiActive = false;
  }
};
