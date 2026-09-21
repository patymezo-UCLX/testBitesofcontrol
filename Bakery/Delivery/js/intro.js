/* ==========================================================================
   BAKERY DELIVERY — INTRO SCREEN
   Handles showing the intro screen, its entrance animations, and the
   START button's micro-interactions + hand-off to gameplay.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.intro = {

  els: {},

  init() {
    this.els.screen = document.getElementById('bd-screen-intro');
    this.els.logo = document.getElementById('bd-logo');
    this.els.logoImg = this.els.logo.querySelector('.bd-logo-img');
    this.els.panel = document.getElementById('bd-instructions-panel');
    this.els.panel2 = document.getElementById('bd-instructions-panel-2');
    this.els.nextBtn = document.getElementById('bd-instructions-next-btn');
    this.els.backBtn = document.getElementById('bd-instructions-back-btn');
    this.els.startBtn = document.getElementById('bd-start-btn');

    this.els.nextBtn.addEventListener('click', () => this._showPanel2());
    this.els.backBtn.addEventListener('click', () => this._showPanel1());
    this.els.startBtn.addEventListener('click', () => this.handleStart());
  },

  show() {
    BakeryDelivery.setScreen('intro');
    this.els.screen.classList.add('bd-active');
    this.els.screen.setAttribute('aria-hidden', 'false');
    this._showPanel1(); // always re-enter instructions at screen 1
    this.playEntrance();
  },

  /** Pure content navigation between the two instruction screens — never
   *  touches Packing state, never affects how EMPEZAR starts the game. */
  _showPanel1() {
    this.els.panel2.classList.remove('bd-active');
    this.els.panel.classList.remove('bd-instructions-hidden');
  },

  _showPanel2() {
    this.els.panel.classList.add('bd-instructions-hidden');
    this.els.panel2.classList.remove('bd-anim-in');
    void this.els.panel2.offsetWidth; // restart the entrance animation each time
    this.els.panel2.classList.add('bd-active', 'bd-anim-in');
  },

  playEntrance() {
    // Logo: fade in + scale overshoot, then a very subtle idle float.
    this.els.logo.classList.add('bd-anim-in');
    this.els.logo.addEventListener('animationend', () => {
      this.els.logoImg.classList.add('bd-anim-idle');
    }, { once: true });

    // Instructions panel enters slightly after the logo (staggered via CSS
    // animation-delay), then stays settled — no continuous animation.
    this.els.panel.classList.add('bd-anim-in');

    // START button gets its idle pulse once everything has settled.
    window.setTimeout(() => {
      this.els.startBtn.classList.add('bd-anim-idle');
    }, 900);
  },

  handleStart() {
    // Quick press feedback before transitioning.
    this.els.startBtn.classList.add('bd-pressed');
    this.els.startBtn.classList.remove('bd-anim-idle');

    window.setTimeout(() => {
      this.transitionToGameplay();
    }, 120);
  },

  transitionToGameplay() {
    const introScreen = this.els.screen;
    const gameplayScreen = document.getElementById('bd-screen-gameplay');

    introScreen.classList.add('bd-leaving');

    introScreen.addEventListener('animationend', () => {
      introScreen.classList.remove('bd-active', 'bd-leaving');
      introScreen.setAttribute('aria-hidden', 'true');

      gameplayScreen.classList.add('bd-active', 'bd-entering');
      gameplayScreen.setAttribute('aria-hidden', 'false');
      BakeryDelivery.gameplay.show();

      gameplayScreen.addEventListener('animationend', () => {
        gameplayScreen.classList.remove('bd-entering');
      }, { once: true });
    }, { once: true });
  }
};
