/* ==========================================================================
   BAKERY DELIVERY — DELIVERY WORLD (background scroll + sun)
   Two fondo-parallax.png tiles, chained end-to-end and continuously
   recycled, create the illusion of an endless route. Each tile is sized
   by HEIGHT (matching the game container), so the road's vertical
   position stays a consistent fraction of the container regardless of
   viewport width — that's also what lets deliveryMeli.js compute lane Y
   positions as simple fractions.

   The sun is a separate, nearly-fixed layer — see the note in
   deliverySystem's report about why it isn't also re-derived from the
   background art (which already bakes in its own sun).
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryWorld = {

  els: {},
  tiles: [],
  tileWidth: 0,
  containerHeight: 0,

  // Matches the CSS mask's fade width on .bd-delivery-bg-tile — the
  // overlap must be at least as wide as the fade so the back tile's
  // fully-opaque content is already in place under the fading front
  // tile, turning fondo-parallax.png's non-matching edges into a soft
  // cross-fade instead of a hard seam.
  TILE_OVERLAP_PX: 120,

  // Fractions of the FULL source image's height where the two lanes sit,
  // measured directly from fondo-parallax.png's road. These are fixed
  // (image-space) reference points; laneYFraction below is derived from
  // them each layout pass, adjusted for whatever crop is currently
  // applied so it always describes a position within the VISIBLE window.
  IMAGE_LANE_Y_FRACTION: {
    upper: 0.789,
    lower: 0.861
  },

  // Recomputed every measureAndLayout() — position within the visible
  // (possibly cropped) window, which is what deliveryMeli.js actually
  // multiplies by containerHeight.
  laneYFraction: {
    upper: 0.789,
    lower: 0.861
  },

  cropTopFraction: 0,

  // Shared by every world-space mover (background tiles AND obstacles)
  // so a collision slowdown affects them all in lockstep — nothing
  // should ever drift out of sync with the road itself.
  speedMultiplier: 1,
  segmentSpeedMultiplier: 1, // progressive difficulty, set by deliveryDestination.js per segment
  _slowdownActive: false,
  _slowdownStartValue: 1,
  _slowdownStartTime: 0,
  _speedTransition: null,

  init() {
    this.els.layer = document.getElementById('bd-delivery-bg-layer');
    this.els.tileA = document.getElementById('bd-delivery-bg-a');
    this.els.tileB = document.getElementById('bd-delivery-bg-b');
    this.els.sun = document.getElementById('bd-delivery-sun');

    this.tiles = [
      { el: this.els.tileA, x: 0 },
      { el: this.els.tileB, x: 0 }
    ];
  },

  /** Recomputes tile size/position from the container's current
   *  dimensions. On wide (landscape/desktop) viewports this behaves as
   *  before: the full image height maps to the container height. On
   *  narrow (portrait) viewports it crops the excess plain-sky area off
   *  the top first, THEN scales the remainder to fill the container —
   *  so the road/village stay properly sized instead of being squeezed
   *  into a thin strip under a wall of empty sky. Width always follows
   *  the same scale (aspect ratio is never distorted). Safe to call on
   *  resize — never leaves a gap or duplicate offset. */
  measureAndLayout() {
    const rect = this.els.layer.getBoundingClientRect();
    this.containerHeight = rect.height;
    const containerWidth = rect.width;
    const aspectRatio = containerWidth / this.containerHeight;

    const cfg = BakeryDelivery.deliveryConfig;
    this.cropTopFraction = this._computeCropTopFraction(aspectRatio, cfg);

    const img = this.els.tileA.querySelector('.bd-delivery-bg-img');
    const naturalW = img.naturalWidth || 2200;
    const naturalH = img.naturalHeight || 1080;

    const visibleFraction = 1 - this.cropTopFraction;
    const scale = this.containerHeight / (naturalH * visibleFraction);

    const renderedHeight = naturalH * scale;
    this.tileWidth = naturalW * scale;
    const topOffsetPx = -(this.cropTopFraction * naturalH * scale);

    this.tiles.forEach((tile) => {
      tile.el.style.width = `${this.tileWidth}px`;
      tile.el.style.height = `${renderedHeight}px`;
      tile.el.style.top = `${topOffsetPx}px`;
    });

    // Lane Y, re-derived for the current visible window.
    this.laneYFraction.upper =
      (this.IMAGE_LANE_Y_FRACTION.upper - this.cropTopFraction) / visibleFraction;
    this.laneYFraction.lower =
      (this.IMAGE_LANE_Y_FRACTION.lower - this.cropTopFraction) / visibleFraction;

    // Preserve relative spacing on resize instead of resetting to 0/W —
    // keep tile A wherever its scroll progress currently is, modulo the
    // new tile width, and place B immediately after it (minus the
    // overlap, to stay seam-free).
    const prevWidth = this._lastTileWidth || this.tileWidth;
    const progress = prevWidth ? (this.tiles[0].x % prevWidth) : 0;
    this.tiles[0].x = progress;
    this.tiles[1].x = this.tiles[0].x + this.tileWidth - this.TILE_OVERLAP_PX;
    this._lastTileWidth = this.tileWidth;

    this._applyTransforms();
  },

  _computeCropTopFraction(aspectRatio, cfg) {
    const wide = cfg.WORLD_CROP_WIDE_ASPECT;
    const narrow = cfg.WORLD_CROP_NARROW_ASPECT;
    if (aspectRatio >= wide) return 0;
    if (aspectRatio <= narrow) return cfg.WORLD_CROP_MAX;
    const t = (wide - aspectRatio) / (wide - narrow);
    return cfg.WORLD_CROP_MAX * t;
  },

  /** @param {number} dt seconds since last frame */
  update(dt) {
    if (this._slowdownActive) {
      // A collision always takes priority — cancel any pending general
      // transition (e.g. arrival deceleration) cleanly rather than
      // fighting it frame to frame. deliveryDestination.js re-checks its
      // own trigger condition every frame, so it simply re-requests a
      // deceleration later if still needed — see its guard against
      // obstacles/collisions during arrival for why this rarely matters.
      this._speedTransition = null;
      this._updateSlowdownRecovery();
    } else {
      this._updateSpeedTransition();
    }

    const speed = this.getCurrentSpeed();
    const dx = speed * dt;

    this.tiles.forEach((tile) => { tile.x -= dx; });

    // Whichever tile has fully exited to the left gets chained back in
    // immediately after the other (minus the overlap) — a standard
    // two-tile infinite loop. Comparing against the OTHER tile's
    // position (not a fixed multiple) keeps this correct even after a
    // mid-scroll resize.
    const [t0, t1] = this.tiles;
    if (t0.x <= -this.tileWidth) {
      t0.x = t1.x + this.tileWidth - this.TILE_OVERLAP_PX;
    } else if (t1.x <= -this.tileWidth) {
      t1.x = t0.x + this.tileWidth - this.TILE_OVERLAP_PX;
    }

    this._applyTransforms();
  },

  /** Deterministic, smoothstep-eased recovery — reaches exactly 1.0 at
   *  COLLISION_SLOWDOWN_RECOVER_MS rather than asymptotically approaching
   *  it, so the "regains momentum" feel has a predictable, tunable shape
   *  (slow→faster→settle) instead of a generic exponential decay. */
  _updateSlowdownRecovery() {
    if (!this._slowdownActive) return;

    const cfg = BakeryDelivery.deliveryConfig;
    const elapsed = performance.now() - this._slowdownStartTime;
    const t = Math.min(1, elapsed / cfg.COLLISION_SLOWDOWN_RECOVER_MS);
    const eased = t * t * (3 - 2 * t); // smoothstep

    this.speedMultiplier = this._slowdownStartValue + (1 - this._slowdownStartValue) * eased;

    if (t >= 1) {
      this.speedMultiplier = 1;
      this._slowdownActive = false;
    }
  },

  /** General-purpose smoothstep-eased transition toward any target
   *  multiplier over any duration — used by deliveryDestination.js for
   *  the arrival deceleration (target 0). Collision slowdown does NOT
   *  use this (kept as its own untouched, already-approved mechanism
   *  above) so Stage 2's collision feel is guaranteed unchanged. */
  setSpeedTarget(targetMultiplier, durationMs) {
    this._speedTransition = {
      fromValue: this.speedMultiplier,
      toValue: targetMultiplier,
      startTime: performance.now(),
      durationMs
    };
  },

  _updateSpeedTransition() {
    if (!this._speedTransition) return;
    const { fromValue, toValue, startTime, durationMs } = this._speedTransition;
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const eased = t * t * (3 - 2 * t);

    this.speedMultiplier = fromValue + (toValue - fromValue) * eased;

    if (t >= 1) {
      this.speedMultiplier = toValue;
      this._speedTransition = null;
    }
  },

  /** True while a general (non-collision) speed transition is still in
   *  flight — deliveryDestination.js uses this to know when its
   *  requested deceleration has actually finished. */
  isTransitioning() {
    return !!this._speedTransition;
  },

  /** The actual current world speed (px/s), after any collision
   *  slowdown — this is what obstacles.js moves by too, so they never
   *  drift out of sync with the scrolling road. */
  getCurrentSpeed() {
    return BakeryDelivery.deliveryConfig.DELIVERY_WORLD_SPEED * this.speedMultiplier * this.segmentSpeedMultiplier;
  },

  /** Progressive difficulty — applied on top of (never replacing) the
   *  collision/arrival speedMultiplier above, so a collision slowdown
   *  during a later, faster segment still works exactly the same way. */
  setSegmentMultiplier(m) {
    this.segmentSpeedMultiplier = m;
  },

  /** Called by deliveryGameplay.js on a collision. Never touches the
   *  base DELIVERY_WORLD_SPEED constant — only this temporary multiplier.
   *  Re-triggering mid-recovery restarts cleanly from the CURRENT speed,
   *  not a jarring jump back to the full slowdown value. */
  triggerSlowdown() {
    const cfg = BakeryDelivery.deliveryConfig;
    this._slowdownStartValue = Math.min(this.speedMultiplier, cfg.COLLISION_SLOWDOWN_MULTIPLIER);
    this.speedMultiplier = this._slowdownStartValue;
    this._slowdownStartTime = performance.now();
    this._slowdownActive = true;
  },

  _applyTransforms() {
    // The tile further left (smaller x) is the one currently fading out
    // at the seam, and must render ON TOP of the tile further right
    // (larger x), which sits fully opaque underneath — that's what makes
    // the fade a cross-fade into real content rather than into empty
    // background-layer space.
    const [t0, t1] = this.tiles;
    if (t0.x <= t1.x) {
      t0.el.style.zIndex = '2';
      t1.el.style.zIndex = '1';
    } else {
      t0.el.style.zIndex = '1';
      t1.el.style.zIndex = '2';
    }

    this.tiles.forEach((tile) => {
      // Rounding to whole pixels avoids the hairline seam sub-pixel
      // positioning can produce between two independently rendered tiles.
      tile.el.style.transform = `translateX(${Math.round(tile.x)}px)`;
    });
  },

  reset() {
    this.tiles[0].x = 0;
    this.tiles[1].x = this.tileWidth - this.TILE_OVERLAP_PX;
    this.speedMultiplier = 1;
    this.segmentSpeedMultiplier = 1;
    this._slowdownActive = false;
    this._speedTransition = null;
    this._applyTransforms();
  }
};
