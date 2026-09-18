/* ==========================================================================
   BAKERY DELIVERY — DEV MODE — TEMPORARY DEVELOPMENT TOOL, DISABLE FOR
   FINAL GAME
   A small, deliberately unstyled-effort panel + a keyboard shortcut for
   testing Delivery without replaying Packing every time. Everything here
   calls into the REAL flow (deliverySystem.showDeliveryIntro's sibling
   entry points, deliveryGameplay.startDelivery) — there is no second
   copy of Delivery anywhere in this file.

   Setting DEV_MODE to false removes the panel, the shortcut, and this
   module's only other effect (none) — the normal player flow is
   entirely untouched either way.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

/* TEMPORARY DEVELOPMENT TOOL — DISABLE FOR FINAL GAME */
BakeryDelivery.DEV_MODE = true;

BakeryDelivery.devMode = {

  els: {},

  init() {
    if (!BakeryDelivery.DEV_MODE) return;

    this._buildPanel();

    window.addEventListener('keydown', (e) => {
      if (!BakeryDelivery.DEV_MODE) return;
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        BakeryDelivery.startDeliveryTest();
      }
    });
  },

  _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'bd-dev-panel';
    panel.className = 'bd-dev-panel';
    panel.innerHTML = `
      <p class="bd-dev-panel-label">DEV</p>
      <button type="button" class="bd-dev-panel-btn" id="bd-dev-full-game">JUEGO COMPLETO</button>
      <button type="button" class="bd-dev-panel-btn" id="bd-dev-part2">PROBAR PARTE 2</button>
    `;
    document.getElementById('bd-root').appendChild(panel);
    this.els.panel = panel;

    document.getElementById('bd-dev-full-game').addEventListener('click', () => {
      // Normal game already starts on its own underneath — this just
      // gets the panel out of the way.
      panel.classList.add('bd-dev-panel-hidden');
    });

    document.getElementById('bd-dev-part2').addEventListener('click', () => {
      panel.classList.add('bd-dev-panel-hidden');
      BakeryDelivery.deliverySystem.devJumpToDeliveryInstructions();
    });
  }
};
