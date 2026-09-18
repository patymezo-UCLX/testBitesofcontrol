/* ==========================================================================
   BAKERY DELIVERY — DELIVERY MELI (sprite animation + two-lane driving)
   Owns Meli's ride-cycle animation (1→2→3→4→repeat), her lane state
   machine (exactly two lanes, smooth glide between them, never free
   vertical movement), her ground/hitbox anchors, and her collision
   impact feedback.

   TWO nested transform layers, deliberately separated so lane movement
   and collision feedback never fight over the same CSS property:

     #bd-delivery-meli            (outer) — WHERE Meli is: lane Y +
                                    depth scale. Pure position, never
                                    rotated, never jerked.
     #bd-delivery-meli-impact     (inner) — HOW she looks right now:
                                    lane-change lean, idle bounce, and
                                    the collision jerk/bounce/wobble.
                                    Purely cosmetic; never affects
                                    currentLane or collision logic.

   All four sprite frames share one stable container sized to the source
   PNGs' own canvas (450×300) — never resized per-frame — so switching
   frames can't cause any jump. The ~2px vertical wobble already baked
   into the supplied frames (1/3 vs 2/4 sit 2px apart) IS Meli's subtle
   riding bounce; a very small extra sine bob is layered on top, not a
   replacement for it.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryMeli = {

  els: {},

  currentLane: 1,       // 0 = upper, 1 = lower — the actual, settled lane
  targetLane: 1,         // the lane a glide is heading toward
  laneProgress: 1,       // 0 → 1 across the current/last glide
  glideFromLane: 1,
  glideStartTime: 0,
  isGliding: false,

  frameIndex: 0,
  frameTimer: 0,

  bounceTime: 0,

  isMoving: true, // gates the ride-cycle frame animation only; idle bounce keeps running even when stopped

  // Collision impact sequence state — see triggerImpact().
  isImpacting: false,
  impactStartTime: 0,
  impactSign: 1,

  init() {
    this.els.container = document.getElementById('bd-delivery-meli');
    this.els.impact = document.getElementById('bd-delivery-meli-impact');
    this.els.img = document.getElementById('bd-delivery-meli-img');
  },

  /** Positions Meli's horizontal anchor (left edge target, centered via
   *  translateX(-50%) in the OUTER transform) from the game container's
   *  current width. Called at start and on resize. Portrait/narrow
   *  viewports use a slightly further-in anchor (20–25%) than desktop
   *  (15–22%), per spec. */
  measureAndPosition() {
    const gameEl = document.getElementById('bd-delivery-game');
    const rect = gameEl.getBoundingClientRect();
    const isPortrait = rect.height > rect.width;
    const ratio = isPortrait
      ? BakeryDelivery.deliveryConfig.MELI_X_RATIO_MOBILE
      : BakeryDelivery.deliveryConfig.MELI_X_RATIO;
    const leftPx = rect.width * ratio;
    this.els.container.style.left = `${leftPx}px`;
  },

  /** @param {number} startingLane */
  reset(startingLane) {
    this.currentLane = startingLane;
    this.targetLane = startingLane;
    this.glideFromLane = startingLane;
    this.laneProgress = 1;
    this.isGliding = false;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.bounceTime = 0;
    this.isMoving = true;
    this.isImpacting = false;
    this.els.img.src = BakeryDelivery.assets.meli[0];
    this.els.impact.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)';
  },

  /** Called on an obstacle collision — the full impact→wobble→settle
   *  sequence (see update()). Re-triggering mid-sequence simply restarts
   *  the window cleanly rather than stacking. */
  triggerImpact() {
    this.isImpacting = true;
    this.impactStartTime = performance.now();
    this.impactSign = Math.random() < 0.5 ? 1 : -1;
  },

  /** Called when Meli fully stops at a destination (or starts riding
   *  again for the next route). Freezes her ride-cycle frame on whatever
   *  frame it's currently on — never continues full-speed pedaling
   *  animation while she's visibly stationary. The small idle bounce
   *  keeps running regardless; it's subtle enough to read as "waiting",
   *  not "still riding". */
  setMoving(moving) {
    this.isMoving = moving;
  },

  /** @param {number} lane 0 (upper) or 1 (lower) */
  setLane(lane) {
    if (lane !== 0 && lane !== 1) return;
    if (lane === this.targetLane) return; // already heading there

    // A fresh request always wins cleanly from wherever Meli visually is
    // right now — no queueing, no stacking animations, no drift.
    this.glideFromLane = this._currentVisualLane();
    this.targetLane = lane;
    this.laneProgress = 0;
    this.isGliding = true;
    this.glideStartTime = performance.now();
  },

  /** The lane-position value (0..1, 0=upper,1=lower) Meli is visually at
   *  right now, whether mid-glide or settled — used as the start point
   *  for a new glide so direction reversals never jump. */
  _currentVisualLane() {
    if (!this.isGliding) return this.currentLane;
    const eased = this._ease(this.laneProgress);
    return this.glideFromLane + (this.targetLane - this.glideFromLane) * eased;
  },

  _ease(t) {
    // Soft ease-out — matches the rest of Bakery Delivery's feel.
    return 1 - Math.pow(1 - t, 3);
  },

  /** @param {number} dtMs milliseconds since last frame */
  update(dtMs) {
    // Ride-cycle frame animation — frozen while stopped at a destination.
    if (this.isMoving) {
      const frameDuration = 1000 / BakeryDelivery.deliveryConfig.MELI_RIDE_FPS;
      this.frameTimer += dtMs;
      if (this.frameTimer >= frameDuration) {
        this.frameTimer -= frameDuration;
        this.frameIndex = (this.frameIndex + 1) % 4;
        this.els.img.src = BakeryDelivery.assets.meli[this.frameIndex];
      }
    }

    // Lane glide — OUTER wrapper concern (where Meli logically/visually is).
    let visualLane = this.currentLane;
    let leanDeg = 0;

    if (this.isGliding) {
      const elapsed = performance.now() - this.glideStartTime;
      const duration = BakeryDelivery.deliveryConfig.LANE_CHANGE_DURATION;
      this.laneProgress = Math.min(1, elapsed / duration);
      const eased = this._ease(this.laneProgress);
      visualLane = this.glideFromLane + (this.targetLane - this.glideFromLane) * eased;

      // Lean toward the direction of travel, fading out near the end.
      const direction = this.targetLane - this.glideFromLane; // -1, 0, or 1
      const leanEnvelope = Math.sin(Math.min(1, this.laneProgress) * Math.PI); // 0→1→0
      leanDeg = direction * BakeryDelivery.deliveryConfig.MELI_LEAN_DEGREES * leanEnvelope;

      if (this.laneProgress >= 1) {
        this.isGliding = false;
        this.currentLane = this.targetLane;
        visualLane = this.currentLane;
      }
    }

    // Small continuous idle bounce, layered on the frame's own wobble.
    this.bounceTime += dtMs;
    const period = BakeryDelivery.deliveryConfig.MELI_BOUNCE_PERIOD_MS;
    const bounceOffset = Math.sin((this.bounceTime / period) * Math.PI * 2)
      * BakeryDelivery.deliveryConfig.MELI_BOUNCE_PX;

    // Collision impact — INNER wrapper concern only. Never touches
    // currentLane/targetLane/isGliding; purely cosmetic.
    let impactJerkPx = 0;
    let impactBouncePx = 0;
    let impactTiltDeg = 0;

    if (this.isImpacting) {
      const cfg = BakeryDelivery.deliveryConfig;
      const elapsedMs = performance.now() - this.impactStartTime;

      if (elapsedMs >= cfg.IMPACT_TOTAL_DURATION_MS) {
        this.isImpacting = false;
      } else {
        // Jerk + bounce: a single non-oscillating half-sine pulse —
        // out and back, once, not a wobble.
        const pulseT = Math.min(1, elapsedMs / cfg.IMPACT_PULSE_DURATION_MS);
        const pulseShape = Math.sin(Math.PI * pulseT); // 0 → 1 → 0
        impactJerkPx = -cfg.IMPACT_JERK_PX * pulseShape;   // backward
        impactBouncePx = -cfg.IMPACT_BOUNCE_PX * pulseShape; // up

        // Tilt: a decaying oscillation across the whole window — first
        // swing largest (the impact itself), each following swing
        // smaller (the wobble), settling to 0 by the end.
        const decay = Math.exp(-elapsedMs / (cfg.IMPACT_TOTAL_DURATION_MS * 0.35));
        const omega = (cfg.IMPACT_TILT_CYCLES * Math.PI * 2) / cfg.IMPACT_TOTAL_DURATION_MS;
        impactTiltDeg = this.impactSign * cfg.IMPACT_TILT_DEG * decay * Math.cos(omega * elapsedMs);
      }
    }

    this._applyLanePosition(visualLane);
    this._applyImpactTransform(leanDeg + impactTiltDeg, bounceOffset + impactBouncePx, impactJerkPx);
  },

  /** OUTER wrapper: pure lane position + depth scale. No rotation, no
   *  jerk — this is authoritative "where Meli is" and must stay clean
   *  for collision/lane logic to reason about. */
  _applyLanePosition(visualLane) {
    const world = BakeryDelivery.deliveryWorld;
    const groundY = world.containerHeight * (
      world.laneYFraction.upper + (world.laneYFraction.lower - world.laneYFraction.upper) * visualLane
    );

    const scale = BakeryDelivery.deliveryConfig.MELI_SCALE_UPPER +
      (BakeryDelivery.deliveryConfig.MELI_SCALE_LOWER - BakeryDelivery.deliveryConfig.MELI_SCALE_UPPER) * visualLane;

    // Ground/wheel anchor within the sprite's own 450×300 canvas — found
    // by inspecting the supplied frames' actual content, not guessed.
    const groundAnchorRatio = 272 / 300;

    const containerHeight = this.els.container.offsetHeight || 1;
    const topPx = groundY - containerHeight * groundAnchorRatio * scale;

    this.els.container.style.transform =
      `translateX(-50%) translateY(${topPx}px) scale(${scale})`;
  },

  /** INNER wrapper: everything cosmetic (lane-change lean, idle bounce,
   *  collision jerk/bounce/wobble). Never read by collision/lane logic. */
  _applyImpactTransform(leanDeg, bounceOffsetPx, jerkPx) {
    this.els.impact.style.transform =
      `translateX(${jerkPx}px) translateY(${bounceOffsetPx}px) rotate(${leanDeg}deg)`;
  },

  /** Meli's actual gameplay collision hitbox, as fractions of the sprite
   *  container — tightened to focus on the motorcycle body/wheels and
   *  her lower half only. Excludes the helmet top, the exhaust-cloud
   *  puff, and the delivery box's transparent margins, for a forgiving
   *  arcade feel where a "near miss" truly doesn't register. */
  getHitboxRect() {
    const rect = this.els.container.getBoundingClientRect();
    return {
      left: rect.left + rect.width * 0.32,
      right: rect.left + rect.width * 0.78,
      top: rect.top + rect.height * 0.58,
      bottom: rect.top + rect.height * 0.90
    };
  }
};
