/* ==========================================================================
   BAKERY DELIVERY — REVIEW SYSTEM
   ONE reusable review popup (not reviewPopup1/2/3). Opening it never
   changes the order's contents — the player is looking at the same
   completed state every time. There is no hard limit on how many times
   it can open; BakeryDelivery.state.reviewCount just tracks how many
   times it has, purely so anxiSystem can pick the next doubt phrase. The
   real limiting factor is the global countdown, which keeps running the
   entire time this popup is open.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.reviewSystem = {

  els: {},
  _finishHandled: false,

  init() {
    this.els.title = document.getElementById('bd-review-title');
    this.els.reviewScreen = document.getElementById('bd-review-screen');
    this.els.reviewNoteOverlay = document.getElementById('bd-review-note-overlay');
    this.els.finishReviewBtn = document.getElementById('bd-finish-review-btn');

    this.els.title.textContent = BakeryDelivery.reviewText.reviewTitle;
    this.els.finishReviewBtn.textContent = BakeryDelivery.reviewText.finishReviewBtn;

    this.els.finishReviewBtn.addEventListener('click', () => {
      if (this._finishHandled) return;
      this._finishHandled = true;
      this._handleFinishReview();
    });
  },

  /** Opens the popup showing the CURRENT order exactly as packed. Safe to
   *  call any number of times per order. */
  openReview() {
    if (BakeryDelivery.state.hasTimedOut || BakeryDelivery.state.packingComplete) return;

    BakeryDelivery.state.isReviewOpen = true;
    this._finishHandled = false;

    this.els.reviewNoteOverlay.innerHTML = '';
    BakeryDelivery.state.requiredItems.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'bd-note-thumb-wrap bd-review-thumb-wrap';

      const img = document.createElement('img');
      img.src = BakeryDelivery.getObjectSrc(item.id);
      img.alt = '';
      img.className = 'bd-note-thumb bd-note-thumb-static';
      wrap.appendChild(img);

      if (item.collected) {
        wrap.classList.add('bd-collected');
        const badge = document.createElement('span');
        badge.className = 'bd-note-thumb-check';
        badge.textContent = '✓';
        wrap.appendChild(badge);
      }

      this.els.reviewNoteOverlay.appendChild(wrap);
    });

    this.els.reviewScreen.classList.add('bd-active');
    this.els.reviewScreen.setAttribute('aria-hidden', 'false');
  },

  _handleFinishReview() {
    if (BakeryDelivery.state.hasTimedOut) return;

    this.els.reviewScreen.classList.remove('bd-active');
    this.els.reviewScreen.setAttribute('aria-hidden', 'true');
    BakeryDelivery.state.isReviewOpen = false;
    BakeryDelivery.state.reviewCount += 1;

    window.setTimeout(() => {
      if (BakeryDelivery.state.hasTimedOut) return;
      BakeryDelivery.anxiSystem.showEndOfOrderDoubt();
    }, 260);
  },

  /** Used only by the timeout path: hide instantly, no exit animation,
   *  no follow-up doubt — the game is ending. */
  forceCloseImmediately() {
    this.els.reviewScreen.classList.remove('bd-active');
    this.els.reviewScreen.setAttribute('aria-hidden', 'true');
    BakeryDelivery.state.isReviewOpen = false;
  }
};
