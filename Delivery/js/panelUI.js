/* ==========================================================================
   BAKERY DELIVERY — PANEL UI (shared helper)
   A tiny reusable wrapper around the single order-complete-style panel so
   gameplay.js and any system that needs a short centered message (send
   confirmation, final success, timeout) doesn't duplicate the same
   heading/subtext/button-building code.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.panelUI = {

  els: {},

  init() {
    this.els.panel = document.getElementById('bd-order-complete-panel');
    this.els.heading = document.getElementById('bd-order-complete-heading');
    this.els.subtext = document.getElementById('bd-order-complete-subtext');
    this.els.actions = document.getElementById('bd-order-complete-actions');
  },

  setHeading(text) {
    this.els.heading.textContent = text;
  },

  /**
   * @param {string|string[]|null} content - a single line, multiple lines
   *        (rendered as separate short paragraphs), or falsy to hide it.
   */
  setSubtext(content) {
    this.els.subtext.innerHTML = '';

    const lines = Array.isArray(content) ? content : (content ? [content] : []);
    if (!lines.length) {
      this.els.subtext.hidden = true;
      return;
    }

    lines.forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      this.els.subtext.appendChild(p);
    });
    this.els.subtext.hidden = false;
  },

  clearActions() {
    this.els.actions.innerHTML = '';
  },

  /**
   * Adds a button, guarded against double-activation (a second click/tap
   * on the same button instance is ignored once it's been pressed once).
   */
  addButton(label, onClick, primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bd-start-btn bd-order-complete-btn' + (primary ? '' : ' bd-order-complete-btn-secondary');
    btn.textContent = label;

    let handled = false;
    btn.addEventListener('click', () => {
      if (handled) return;
      handled = true;
      onClick();
    });

    this.els.actions.appendChild(btn);
    return btn;
  },

  open() {
    this.els.panel.classList.add('bd-active');
    this.els.panel.setAttribute('aria-hidden', 'false');
  },

  close() {
    this.els.panel.classList.remove('bd-active');
    this.els.panel.setAttribute('aria-hidden', 'true');
  }
};
