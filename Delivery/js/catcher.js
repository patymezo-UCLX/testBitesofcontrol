/* ==========================================================================
   BAKERY DELIVERY — CATCHER (player-controlled box)
   Owns boxopen-1.png's horizontal movement.

   PRIMARY CONTROL: pointer/mouse position. No click or hold is required —
   as long as the pointer is over the gameplay area, the box's target
   position tracks it directly. Touch/pen still requires an active press
   (pointerdown -> pointermove -> pointerup) since there's no hover state
   on touch devices. Keyboard (arrows/A-D) remains as an accessibility
   fallback, nudging the same target the pointer drives.

   The box never teleports to that target: every frame it's eased toward
   it (currentX += (targetX - currentX) * smoothing), which is what gives
   the smooth "glide" feel instead of an instant DOM-drag jump.

   Every frame it writes ONE inline transform (translate3d + a small bounce
   offset) to the box wrapper — that's what lets the Stage 1 entrance
   animation (which also targets the wrapper's transform) hand off cleanly
   instead of the two fighting over the same CSS property.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.catcher = {

  el: null,
  screenEl: null,

  enabled: false,
  _listenersBound: false,
  _initialized: false,

  // Horizontal position is stored as an offset from the container's
  // center (the box wrapper is CSS-anchored at left:50%, so offsetX=0
  // means dead center). targetOffsetX is where pointer/keyboard input
  // wants the box; offsetX is the actual, eased, rendered position.
  offsetX: 0,
  targetOffsetX: 0,
  smoothing: 0.18, // 0.15–0.22 feels responsive but soft; tuned mid-range

  bounds: { min: 0, max: 0 },
  boxHalfWidth: 0,

  keys: { left: false, right: false },
  touchActive: false, // true only between pointerdown/pointerup for touch/pen

  bouncing: false,
  bounceStart: 0,
  bounceY: 0,

  init() {
    this.el = document.getElementById('bd-box');
    this.screenEl = document.getElementById('bd-screen-gameplay');
  },

  /**
   * @param {boolean} recenter - reset the box back to horizontal center.
   *        Used at the start of every order for a predictable layout.
   */
  activate(recenter) {
    if (!this._listenersBound) {
      this._bindListeners();
      this._listenersBound = true;
    }

    // Hand the wrapper's transform over to JS control. The idle Stage 1
    // float lives on the child image (see gameplay.js), never on this
    // wrapper, so it can't fight with the position we set here.
    this.el.classList.remove('bd-anim-in');
    this.el.style.opacity = '1';

    this.recalculateBounds();

    if (recenter || !this._initialized) {
      this.offsetX = 0;
      this.targetOffsetX = 0;
      this.bounceY = 0;
      this.bouncing = false;
      this._initialized = true;
    }

    this._applyTransform();
    this.enabled = true;
  },

  disable() {
    this.enabled = false;
    this.keys.left = false;
    this.keys.right = false;
    this.touchActive = false;
  },

  enable() {
    this.enabled = true;
  },

  recalculateBounds() {
    if (!this.el || !this.screenEl) return;
    const screenRect = this.screenEl.getBoundingClientRect();
    const boxRect = this.el.getBoundingClientRect();
    this.boxHalfWidth = boxRect.width / 2;

    // Match the same horizontal lane used for spawning falling objects,
    // so the box can always physically reach anything that falls.
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const laneMarginRatio = isPortrait ? 0.08 : 0.20;
    const laneLeft = screenRect.width * laneMarginRatio;
    const laneRight = screenRect.width * (1 - laneMarginRatio);
    const center = screenRect.width / 2;

    this.bounds.min = laneLeft - center + this.boxHalfWidth;
    this.bounds.max = laneRight - center - this.boxHalfWidth;

    if (this.bounds.min > this.bounds.max) {
      // Extremely narrow viewport fallback — collapse to center.
      this.bounds.min = 0;
      this.bounds.max = 0;
    }

    this.targetOffsetX = Math.min(this.bounds.max, Math.max(this.bounds.min, this.targetOffsetX));
    this.offsetX = Math.min(this.bounds.max, Math.max(this.bounds.min, this.offsetX));
  },

  _bindListeners() {
    // Pointer position, relative to the gameplay area — not the window —
    // so this stays correct across every responsive layout.
    this.screenEl.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.screenEl.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointerup', () => this._onPointerUp());
    window.addEventListener('pointercancel', () => this._onPointerUp());

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));

    window.addEventListener('resize', () => this.recalculateBounds());
    window.addEventListener('orientationchange', () => this.recalculateBounds());
  },

  _onPointerMove(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      // No click/hold required — hovering alone drives the box.
      this._setTargetFromClientX(e.clientX);
    } else if (this.touchActive) {
      // Touch/pen: only while actively pressed and sliding.
      this._setTargetFromClientX(e.clientX);
    }
  },

  _onPointerDown(e) {
    if (!this.enabled) return;
    if (e.pointerType !== 'mouse') {
      this.touchActive = true;
    }
    this._setTargetFromClientX(e.clientX);
  },

  _onPointerUp() {
    this.touchActive = false;
  },

  /**
   * targetBoxLeft = pointerX - boxWidth/2, clamped to the playable lane —
   * expressed here as an offset from center to match how the wrapper's
   * transform is anchored (see _applyTransform).
   */
  _setTargetFromClientX(clientX) {
    const rect = this.screenEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const center = rect.width / 2;
    let target = localX - center;
    target = Math.min(this.bounds.max, Math.max(this.bounds.min, target));
    this.targetOffsetX = target;
  },

  _onKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
  },

  _onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
  },

  triggerBounce() {
    this.bouncing = true;
    this.bounceStart = performance.now();
  },

  /**
   * Called once per animation frame while the game loop is running.
   * @param {number} dt - seconds since the last frame.
   */
  update(dt) {
    if (!this.enabled) {
      this._applyTransform();
      return;
    }

    // Keyboard fallback nudges the SAME target the pointer drives, so
    // both inputs feed one consistent smoothing system.
    const kbSpeed = 640; // px/s
    if (this.keys.left && !this.keys.right) {
      this.targetOffsetX -= kbSpeed * dt;
    } else if (this.keys.right && !this.keys.left) {
      this.targetOffsetX += kbSpeed * dt;
    }
    this.targetOffsetX = Math.min(this.bounds.max, Math.max(this.bounds.min, this.targetOffsetX));

    // Ease toward the target every frame — this is the "glide" instead of
    // an instant jump to the pointer/finger position.
    this.offsetX += (this.targetOffsetX - this.offsetX) * this.smoothing;
    if (Math.abs(this.targetOffsetX - this.offsetX) < 0.05) {
      this.offsetX = this.targetOffsetX;
    }

    if (this.bouncing) {
      const t = (performance.now() - this.bounceStart) / 180;
      if (t >= 1) {
        this.bouncing = false;
        this.bounceY = 0;
      } else {
        this.bounceY = Math.sin(t * Math.PI) * -4;
      }
    }

    this._applyTransform();
  },

  _applyTransform() {
    if (!this.el) return;
    this.el.style.transform =
      `translate3d(calc(-50% + ${this.offsetX}px), ${this.bounceY}px, 0)`;
  },

  /**
   * Returns a viewport-space rect approximating the box's visible opening
   * (tuned to boxopen-1.png's interior), not its full transparent-padded
   * rectangle. Always derived from the box's LIVE rendered position, so
   * it can never drift out of sync with where the box visually is.
   */
  getCatchZone() {
    const rect = this.el.getBoundingClientRect();
    return {
      left: rect.left + rect.width * 0.10,
      right: rect.left + rect.width * 0.80,
      top: rect.top + rect.height * 0.08,
      bottom: rect.top + rect.height * 0.50
    };
  }
};
