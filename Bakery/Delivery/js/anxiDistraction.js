/* ==========================================================================
   BAKERY DELIVERY — ANXI DISTRACTION (non-blocking)
   Shared by TWO call sites that behave identically at the UI level:

     - Packing, DURING active gameplay (Change 5)
     - Delivery, MELI PASSING NEAR (not colliding with) Anxi (Change 3)

   Neither ever pauses anything, freezes anything, or requires input — the
   bubble is purely a short, auto-dismissing distraction. This is the
   architectural opposite of anxiSystem.js's end-of-order overlay and
   deliveryAnxi.js's direct-collision overlay, which both DO pause/require
   a choice at a genuine decision point. Keeping this file separate from
   those is what guarantees the two can never accidentally behave the same
   way — this module has no pause/resume calls in it at all.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.anxiDistraction = {

  _packing: { el: null, img: null, text: null, timer: null, lastIndex: -1 },
  _delivery: { el: null, img: null, text: null, timer: null, lastIndex: -1, activeUid: null },

  init() {
    this._packing.el = document.getElementById('bd-anxi-distraction');
    this._packing.img = document.getElementById('bd-anxi-distraction-img');
    this._packing.text = document.getElementById('bd-anxi-distraction-text');

    this._delivery.el = document.getElementById('bd-delivery-anxi-distraction');
    this._delivery.img = document.getElementById('bd-delivery-anxi-distraction-img');
    this._delivery.text = document.getElementById('bd-delivery-anxi-distraction-text');
  },

  /** Random pose, never the same one twice in a row — matches the pattern
   *  already used for the blocking overlays elsewhere in the project. */
  _pickPose(state) {
    let index = Math.floor(Math.random() * BakeryDelivery.assets.anxi.length);
    if (index === state.lastIndex) {
      index = (index + 1) % BakeryDelivery.assets.anxi.length;
    }
    state.lastIndex = index;
    return BakeryDelivery.assets.anxi[index];
  },

  _pickPhrase(pool, state) {
    let index = Math.floor(Math.random() * pool.length);
    // Reuse the same "never twice in a row" index for phrase variety too
    // when the pool is large enough to make that meaningful.
    if (pool.length > 1 && index === state._lastPhraseIndex) {
      index = (index + 1) % pool.length;
    }
    state._lastPhraseIndex = index;
    return pool[index];
  },

  _show(state, phrasePool, durationMs) {
    if (!state.el) return;

    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }

    state.img.src = this._pickPose(state);
    state.text.textContent = this._pickPhrase(phrasePool, state);

    state.el.classList.remove('bd-active');
    void state.el.offsetWidth; // restart the animation even if one is already fading out
    state.el.classList.add('bd-active');

    state.timer = window.setTimeout(() => {
      state.el.classList.remove('bd-active');
      state.timer = null;
    }, durationMs);
  },

  /** Change 5 — active Packing. Gameplay continues completely untouched
   *  behind/around this; see anxiSystem.js for the caller. */
  showPacking() {
    this._show(this._packing, BakeryDelivery.anxiPackingDistractionPhrases, 2600);
  },

  /** Change 3 — Delivery, Meli passes near Anxi without colliding. The
   *  bubble is attached to THIS specific Anxi instance in the scrolling
   *  world (not a fixed HUD position) — see updateDeliveryNearPosition(),
   *  called every frame from deliveryObstacles.js while this obstacle is
   *  the one currently showing a bubble. */
  showDeliveryNear(o) {
    this._delivery.activeUid = o.uid;
    this._show(this._delivery, BakeryDelivery.anxiDeliveryNearPhrases, 2600);
    this._positionDeliveryBubble(o);
  },

  /** Called every frame (from deliveryObstacles.js's own per-obstacle
   *  update loop) for whichever Anxi obstacle is currently the active
   *  bubble's owner, so the bubble visually travels with him exactly
   *  like the marker travels with its house. */
  updateDeliveryNearPosition(o) {
    if (this._delivery.activeUid !== o.uid) return;
    if (!this._delivery.el.classList.contains('bd-active')) return;
    this._positionDeliveryBubble(o);
  },

  _positionDeliveryBubble(o) {
    const gameEl = document.getElementById('bd-delivery-game');
    if (!gameEl || !o.el) return;
    const gameRect = gameEl.getBoundingClientRect();
    const oRect = o.el.getBoundingClientRect();

    // Clamp horizontally so the bubble (centered on Anxi via CSS
    // translate(-50%, -100%)) can never overflow past the viewport edges
    // — it just shifts to stay fully visible while Anxi is near an edge,
    // rather than getting clipped.
    const halfBubble = 110; // ~ half of the bubble's max-width, generous
    const rawX = (oRect.left - gameRect.left) + oRect.width * 0.5;
    const x = Math.max(halfBubble, Math.min(rawX, gameRect.width - halfBubble));
    const y = oRect.top - gameRect.top;

    this._delivery.el.style.left = `${x}px`;
    this._delivery.el.style.top = `${y}px`;
  },

  /** Called whenever the owning obstacle is removed (scrolled off, or a
   *  direct collision immediately superseding the non-blocking bubble)
   *  — the bubble must never outlive or visually detach from Anxi. */
  hideDeliveryNear(uid) {
    if (uid !== undefined && this._delivery.activeUid !== uid) return;
    if (this._delivery.timer) {
      window.clearTimeout(this._delivery.timer);
      this._delivery.timer = null;
    }
    this._delivery.el.classList.remove('bd-active');
    this._delivery.activeUid = null;
  },

  /** Used only by hard resets (retry, exit) — never part of normal flow. */
  hideAll() {
    [this._packing, this._delivery].forEach((state) => {
      if (!state.el) return;
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = null;
      }
      state.el.classList.remove('bd-active');
    });
    this._delivery.activeUid = null;
  }
};
