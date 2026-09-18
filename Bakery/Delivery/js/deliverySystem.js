/* ==========================================================================
   BAKERY DELIVERY — DELIVERY SYSTEM (Screen/phase transitions)
   Owns the hand-off from Packing's success screen into the Delivery
   introduction/instructions, and from there into actual Delivery
   gameplay. The real driving loop lives in deliveryGameplay.js —
   startDelivery() here handles the SCREEN transition and, once the
   Delivery screen has fully faded in, calls
   BakeryDelivery.deliveryGameplay.startDelivery() to kick off driving.

   Packing's own countdown is already stopped for good by the time this
   runs (gameplay.js stops it the moment the 5th order sends), and this
   module never restarts it — Delivery will get its own timer in a later
   stage, not this one.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliverySystem = {

  els: {},
  _startDeliveryHandled: false,

  init() {
    this.els.gameplayScreen = document.getElementById('bd-screen-gameplay');
    this.els.introScreen = document.getElementById('bd-screen-delivery-intro');
    this.els.deliveryScreen = document.getElementById('bd-screen-delivery');

    this.els.heading = document.getElementById('bd-delivery-heading');
    this.els.panel = document.getElementById('bd-delivery-instructions-panel');
    this.els.laneMeli = document.querySelector('.bd-lane-demo-meli');
    this.els.startDeliveryBtn = document.getElementById('bd-start-delivery-btn');

    this.els.startDeliveryBtn.addEventListener('click', () => {
      if (this._startDeliveryHandled) return;
      this._startDeliveryHandled = true;
      this.startDelivery();
    });

    /* TEMPORARY DEVELOPMENT ENTRY — REMOVE/CONNECT LATER
       Lets driving be tested from the browser console without replaying
       Packing every time: window.BakeryDelivery.startDeliveryTest().
       Initializes Delivery in the exact same state ¡A REPARTIR! would —
       no separate/duplicate implementation. */
    BakeryDelivery.startDeliveryTest = () => this._devJumpToDelivery();
  },

  /** Called by exitControl.js so a later attempt can press ¡A REPARTIR!
   *  again — otherwise this button's one-shot guard would stay tripped
   *  forever after a single use. */
  resetGuards() {
    this._startDeliveryHandled = false;
  },

  /** Called by gameplay.js when the player presses CONTINUAR on the
   *  "¡Pedidos preparados!" success panel. */
  showDeliveryIntro() {
    BakeryDelivery.state.phase = 'deliveryInstructions';

    BakeryDelivery.panelUI.close();

    window.setTimeout(() => {
      this.els.gameplayScreen.classList.add('bd-leaving');

      this.els.gameplayScreen.addEventListener('animationend', () => {
        this.els.gameplayScreen.classList.remove('bd-active', 'bd-leaving');
        this.els.gameplayScreen.setAttribute('aria-hidden', 'true');

        this.els.introScreen.classList.add('bd-active', 'bd-entering');
        this.els.introScreen.setAttribute('aria-hidden', 'false');
        this._playIntroEntrance();

        this.els.introScreen.addEventListener('animationend', () => {
          this.els.introScreen.classList.remove('bd-entering');
        }, { once: true });
      }, { once: true });
    }, 250);
  },

  _playIntroEntrance() {
    this.els.heading.classList.add('bd-anim-in');
    this.els.panel.classList.add('bd-anim-in');
  },

  /** Called when the player presses ¡A REPARTIR! Transitions the screen,
   *  then hands off to deliveryGameplay.startDelivery() for the actual
   *  driving loop once the Delivery screen is fully visible. */
  startDelivery() {
    this.els.introScreen.classList.add('bd-leaving');

    this.els.introScreen.addEventListener('animationend', () => {
      this.els.introScreen.classList.remove('bd-active', 'bd-leaving');
      this.els.introScreen.setAttribute('aria-hidden', 'true');

      BakeryDelivery.state.phase = 'delivery';

      this.els.deliveryScreen.classList.add('bd-active', 'bd-entering');
      this.els.deliveryScreen.setAttribute('aria-hidden', 'false');
      BakeryDelivery.deliveryGameplay.startDelivery();

      this.els.deliveryScreen.addEventListener('animationend', () => {
        this.els.deliveryScreen.classList.remove('bd-entering');
      }, { once: true });
    }, { once: true });
  },

/* TEMPORARY DEVELOPMENT ENTRY — REMOVE/CONNECT LATER */
_devJumpToDelivery() {
      // Hide every other screen, show Delivery directly — same end state
      // as the normal flow, just skipping Packing + the transition.
      ['bd-screen-intro', 'bd-screen-gameplay', 'bd-screen-delivery-intro'].forEach((id) => {
        const el = document.getElementById(id);
        el.classList.remove('bd-active', 'bd-entering', 'bd-leaving');
        el.setAttribute('aria-hidden', 'true');
      });

      BakeryDelivery.state.phase = 'delivery';
      this.els.deliveryScreen.classList.add('bd-active');
      this.els.deliveryScreen.setAttribute('aria-hidden', 'false');
      BakeryDelivery.deliveryGameplay.startDelivery();
      BakeryDelivery.setScreen('delivery-dev');
    },

    /* TEMPORARY DEVELOPMENT ENTRY — REMOVE/CONNECT LATER
       Used by the dev panel's "PROBAR PARTE 2" button. Opens the SAME
       Delivery instructions screen (and from there the SAME ¡A REPARTIR!
       → startDelivery()) the real Packing→Delivery flow uses — nothing
       here is a duplicate implementation. */
    devJumpToDeliveryInstructions() {
      ['bd-screen-intro', 'bd-screen-gameplay'].forEach((id) => {
        const el = document.getElementById(id);
        el.classList.remove('bd-active', 'bd-entering', 'bd-leaving');
        el.setAttribute('aria-hidden', 'true');
      });

      BakeryDelivery.state.phase = 'deliveryInstructions';
      this.els.introScreen.classList.add('bd-active');
      this.els.introScreen.setAttribute('aria-hidden', 'false');
      this._playIntroEntrance();
      BakeryDelivery.setScreen('delivery-instructions-dev');
    }
};

