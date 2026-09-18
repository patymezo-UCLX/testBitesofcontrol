/* ==========================================================================
   BAKERY DELIVERY — ORDER UI
   Renders the current order's required products onto the Note overlay as
   separate DOM image elements (never merged into Note.png), and visually
   marks each one collected as the player catches it — without removing it,
   so the Note always shows the full order plus progress.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.orderUI = {

  els: {},

  init() {
    this.els.noteOverlay = document.getElementById('bd-note-overlay');
    this.els.orderIndicatorText = document.getElementById('bd-order-indicator-text');
  },

  /**
   * @param {string[]} itemIds - e.g. ['object-3', 'object-5']
   */
  renderOrder(itemIds) {
    this.els.noteOverlay.innerHTML = '';
    this.els.noteOverlay.dataset.count = String(itemIds.length);

    itemIds.forEach((id, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'bd-note-thumb-wrap';
      wrap.dataset.itemId = id;

      const img = document.createElement('img');
      img.src = BakeryDelivery.getObjectSrc(id);
      img.alt = '';
      img.className = 'bd-note-thumb';

      wrap.appendChild(img);
      this.els.noteOverlay.appendChild(wrap);

      // Stagger each thumbnail's pop-in by 80ms.
      window.setTimeout(() => {
        img.classList.add('bd-anim-pop');
      }, i * 80);
    });
  },

  /**
   * Visually marks one instance of the given item as collected (check
   * badge + softened opacity). If the same item appears more than once in
   * an order, marks the first not-yet-collected occurrence.
   */
  markCollected(itemId) {
    const wrap = this.els.noteOverlay.querySelector(
      `.bd-note-thumb-wrap[data-item-id="${itemId}"]:not(.bd-collected)`
    );
    if (!wrap) return;

    wrap.classList.add('bd-collected');

    const badge = document.createElement('span');
    badge.className = 'bd-note-thumb-check';
    badge.textContent = '✓';
    wrap.appendChild(badge);
  },

  updateOrderIndicator(current, total) {
    this.els.orderIndicatorText.textContent = `ORDER ${current} / ${total}`;
  }
};
