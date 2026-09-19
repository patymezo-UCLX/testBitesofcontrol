/* ==========================================================================
   BAKERY DELIVERY — DELIVERY DESTINATION (Stage 3: 5 houses)
   Owns the route/arrival state machine, completely separate from
   deliveryObstacles.js — the destination house is scenery the player
   arrives AT, never something Meli can collide with. Kept architecturally
   distinct (worldObjects.obstacles vs. worldObjects.destination, in
   spirit) so Stage 4's "return to a previous house" can build on this
   without touching the obstacle system at all.

   mode progression per house:
     driving → arriving → atDestination → delivering → confirming
     → transitioning → (driving again, next house) → … → complete

   Route progress is DISTANCE-based (world px actually travelled, via
   deliveryWorld.getCurrentSpeed()*dt), never a timer — a collision's
   temporary slowdown simply makes that distance accumulate slower, which
   is already exactly correct with no special-casing needed.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryDestination = {

  els: {},

  mode: 'driving',
  currentIndex: 0,          // 0-based into DELIVERY_ROUTES
  segmentDistance: 0,
  completedCount: 0,        // successfully DELIVERED (correct lane)
  lastDeliveredDestination: 0, // 1-based — reserved for Stage 4's "return"
  _laneDecision: null,      // null | 'correct' | 'wrong' — decided once per arrival

  house: null,               // { x, widthPx } while a house exists on screen
  _ctaHandled: false,
  _stateTimer: null,

  deliveryElapsedMs: 0,      // DEV-ONLY stopwatch, never a real countdown

  init() {
    this.els.layer = document.getElementById('bd-delivery-destination-layer');
    this.els.houseImg = document.getElementById('bd-delivery-house-img');
    this.els.marker = document.getElementById('bd-delivery-marker');
    this.els.ctaBtn = document.getElementById('bd-delivery-cta-btn');

    this.els.progressIcons = Array.from(document.querySelectorAll('.bd-delivery-progress-icon'));
    this.els.progressText = document.getElementById('bd-delivery-progress-text');
    this.els.elapsedReadout = document.getElementById('bd-delivery-elapsed');

    this.els.completionPanel = document.getElementById('bd-delivery-completion-panel');
    this.els.completionBtn = document.getElementById('bd-delivery-completion-btn');
    this.els.laneControls = document.querySelector('.bd-delivery-lane-controls');

    this.els.ctaBtn.addEventListener('click', () => this._handleDeliverClick());

    /* TEMPORARY DEVELOPMENT ENTRY — REMOVE/CONNECT LATER
       Console-only: BakeryDelivery.goToDeliveryDestination(1..5) jumps
       straight to that house for testing, without a second gameplay
       implementation — it just fast-forwards this same state machine. */
    if (BakeryDelivery.DEV_MODE) {
      window.goToDeliveryDestination = (n) => this._devGoToDestination(n);
    }
  },

  reset() {
    this.mode = 'driving';
    this.currentIndex = 0;
    this.segmentDistance = 0;
    this.completedCount = 0;
    this.lastDeliveredDestination = 0;
    this._laneDecision = null;
    this.deliveryElapsedMs = 0;
    this._ctaHandled = false;
    this._clearStateTimer();
    this._hideHouse();
    this._updateProgressUI();
    this.els.completionPanel.classList.remove('bd-active');
    if (this.els.laneControls) this.els.laneControls.classList.remove('bd-delivery-lane-controls-disabled');
    BakeryDelivery.deliveryMeli.setMoving(true);
    this._applySegmentSpeedMultiplier();
  },

  /** @param {number} dt seconds since last frame */
  update(dt) {
    this.deliveryElapsedMs += dt * 1000;
    if (BakeryDelivery.deliveryConfig.DELIVERY_DEBUG) this._updateElapsedReadout();

    const cfg = BakeryDelivery.deliveryConfig;
    const route = cfg.DELIVERY_ROUTES[this.currentIndex];
    if (!route) return; // all five delivered — nothing left to drive toward

    if (this.mode === 'driving') {
      this.segmentDistance += BakeryDelivery.deliveryWorld.getCurrentSpeed() * dt;

      const stopSpawnAt = route.distance - cfg.HOUSE_SPAWN_LEAD_DISTANCE - cfg.CLEAR_APPROACH_EXTRA;
      if (this.segmentDistance >= stopSpawnAt) {
        BakeryDelivery.deliveryObstacles.pause(); // stop NEW spawns; existing ones still clear naturally
      }

      if (this.segmentDistance >= route.distance - cfg.HOUSE_SPAWN_LEAD_DISTANCE) {
        this._spawnHouse(route);
        this.mode = 'arriving';
      }
    } else if (this.mode === 'arriving') {
      this._updateHousePosition(dt);

      const world = BakeryDelivery.deliveryWorld;
      const targetStopX = this._computeTargetStopX();

      // Decision point: checked ONCE per arrival, using Meli's ACTUAL
      // rendered/visual lane (rounded — fair even mid-glide, since a
      // glide past the halfway point already reads visually as "in"
      // the target lane).
      if (this._laneDecision === null && this.house.x <= targetStopX + cfg.ARRIVAL_DECEL_LEAD_PX) {
        const route = cfg.DELIVERY_ROUTES[this.currentIndex];
        const meliLane = BakeryDelivery.deliveryMeli.getVisualLaneRounded();
        this._laneDecision = (meliLane === route.lane) ? 'correct' : 'wrong';

        if (this._laneDecision === 'correct') {
          world.setSpeedTarget(0, cfg.ARRIVAL_DECEL_DURATION_MS);
        } else {
          this._showMissedFeedback();
          // World keeps moving at the current segment speed — the house
          // simply scrolls past like a missed opportunity, never
          // stopping the game.
        }
      }

      if (this._laneDecision === 'correct') {
        if (world.speedMultiplier <= 0.01 && !world.isTransitioning()) {
          this._settleAtDestination();
        }
      } else if (this._laneDecision === 'wrong') {
        const width = this.house ? this.house.widthPx : 0;
        if (this.house && this.house.x + width < -120) {
          BakeryDelivery.deliveryObstacles.start(); // fresh queue for the next segment — safe here, nothing is still in flight from this one
          this._beginNextSegment();
        }
      }
    } else if (this.mode === 'transitioning') {
      this._updateHousePosition(dt);
      const width = this.house ? this.house.widthPx : 0;
      if (this.house && this.house.x + width < -120) {
        this._beginNextSegment();
      }
    }
    // atDestination / delivering / confirming: house holds its fixed
    // position (world speed is already 0); those phases advance on
    // their own short timers, not per-frame distance/position logic.
  },

  // ------------------------------------------------------------------
  // HOUSE SPAWN / MOVEMENT
  // ------------------------------------------------------------------

  _spawnHouse(route) {
    this._laneDecision = null;
    this.els.houseImg.src = route.house;
    this.els.layer.classList.add('bd-active');

    const gameRect = document.getElementById('bd-delivery-game').getBoundingClientRect();
    const widthPx = this.els.houseImg.getBoundingClientRect().width || 200;

    this.house = {
      x: gameRect.width + widthPx * 0.6,
      widthPx
    };

    this._showMarker();
    this._updateHousePosition(0);
  },

  _updateHousePosition(dt) {
    if (!this.house) return;
    const world = BakeryDelivery.deliveryWorld;

    if (dt > 0) {
      this.house.x -= world.getCurrentSpeed() * dt;
    }

    const imageFraction = BakeryDelivery.deliveryConfig.HOUSE_IMAGE_Y_FRACTION;
    const groundYFraction = (imageFraction - world.cropTopFraction) / (1 - world.cropTopFraction);
    const groundY = world.containerHeight * groundYFraction;

    const elHeight = this.els.houseImg.getBoundingClientRect().height || 1;
    const anchorRatio = BakeryDelivery.deliveryConfig.HOUSE_GROUND_ANCHOR_RATIO;
    const topPx = groundY - elHeight * anchorRatio;

    this.els.houseImg.style.transform = `translate(${Math.round(this.house.x)}px, ${Math.round(topPx)}px)`;
    this._positionMarkerAndCta();
  },

  /** Where the house's LEFT edge should come to rest — Meli stays
   *  slightly left of the house, never overlapping it. */
  _computeTargetStopX() {
    const meliRect = document.getElementById('bd-delivery-meli').getBoundingClientRect();
    const gameRect = document.getElementById('bd-delivery-game').getBoundingClientRect();
    const meliLocalX = (meliRect.left - gameRect.left) + meliRect.width * 0.75;
    const houseWidth = this.house ? this.house.widthPx : 200;
    return meliLocalX + houseWidth * 0.18;
  },

  _hideHouse() {
    this.house = null;
    this.els.layer.classList.remove('bd-active');
    this._hideMarker();
    this._hideCta();
  },

  // ------------------------------------------------------------------
  // ARRIVAL SETTLE / CTA
  // ------------------------------------------------------------------

  _settleAtDestination() {
    this.mode = 'atDestination';
    BakeryDelivery.deliveryMeli.setMoving(false);
    BakeryDelivery.deliveryObstacles.stop(); // fully clear — no stray obstacle can ever reach this moment
    this._showCta();
    if (this.els.laneControls) this.els.laneControls.classList.add('bd-delivery-lane-controls-disabled');
  },

  controlsEnabled() {
    return this.mode === 'driving' || this.mode === 'arriving' || this.mode === 'transitioning';
  },

  _handleDeliverClick() {
    if (this.mode !== 'atDestination' || this._ctaHandled) return;
    this._ctaHandled = true;
    this.mode = 'delivering';
    this._hideCta();

    this._clearStateTimer();
    this._stateTimer = window.setTimeout(() => {
      this._showConfirmation();
    }, BakeryDelivery.deliveryConfig.DELIVERY_MICRO_ANIM_MS);
  },

  _showConfirmation() {
    this.mode = 'confirming';
    this.completedCount += 1;
    this.lastDeliveredDestination = this.currentIndex + 1;
    this._updateProgressUI();
    this._showConfirmationBanner();

    this._clearStateTimer();
    this._stateTimer = window.setTimeout(() => {
      this._startTransition();
    }, BakeryDelivery.deliveryConfig.DELIVERY_CONFIRM_MS);
  },

  _startTransition() {
    this._hideConfirmationBanner();
    this._hideMarker();

    this.mode = 'transitioning';
    this._ctaHandled = false;

    BakeryDelivery.deliveryMeli.setMoving(true);
    BakeryDelivery.deliveryObstacles.start(); // fresh spawn queue for the next route
    BakeryDelivery.deliveryWorld.setSpeedTarget(1, BakeryDelivery.deliveryConfig.NEXT_ROUTE_TRANSITION_MS);
    if (this.els.laneControls) this.els.laneControls.classList.remove('bd-delivery-lane-controls-disabled');
  },

  /** Called once a house (delivered OR missed) has fully scrolled past.
   *  The single place that decides whether another segment begins or
   *  the whole route is finished — regardless of which path got here.
   *  Does NOT touch obstacle spawning itself: the delivered path already
   *  restarted it back in _startTransition() (restarting it again here
   *  would wipe out anything that already spawned during that window);
   *  the missed path restarts it explicitly just before calling this. */
  _beginNextSegment() {
    this.currentIndex += 1;
    this.segmentDistance = 0;
    this._laneDecision = null;
    this._hideHouse();

    if (this.currentIndex >= BakeryDelivery.deliveryConfig.DELIVERY_ROUTES.length) {
      this._finishRoute();
      return;
    }

    this.mode = 'driving';
    this._applySegmentSpeedMultiplier();
    if (this.els.laneControls) this.els.laneControls.classList.remove('bd-delivery-lane-controls-disabled');
  },

  /** Progressive difficulty — one multiplier per segment, centralized in
   *  deliveryConfig.DELIVERY_SPEED_MULTIPLIERS. Falls back to the last
   *  configured value if the array is ever shorter than the route list. */
  _applySegmentSpeedMultiplier() {
    const mults = BakeryDelivery.deliveryConfig.DELIVERY_SPEED_MULTIPLIERS;
    const m = mults[this.currentIndex] ?? mults[mults.length - 1] ?? 1;
    BakeryDelivery.deliveryWorld.setSegmentMultiplier(m);
  },

  /** All 4 destinations have been passed (delivered or missed) — decide
   *  success vs. the new "incomplete" failure, reusing the SAME shared
   *  failure panel/retry flow as the timer/lives failures. */
  _finishRoute() {
    const total = BakeryDelivery.deliveryConfig.DELIVERY_ROUTES.length;
    if (this.completedCount >= total) {
      this._showCompletion();
    } else {
      BakeryDelivery.deliveryGameplay.handleRouteIncomplete(this.completedCount, total);
    }
  },

  /* TEMPORARY MISSED-DELIVERY TOAST — small, non-blocking, auto-dismiss */
  _showMissedFeedback() {
    const toast = document.createElement('div');
    toast.className = 'bd-delivery-missed-toast';
    toast.textContent = '¡PEDIDO NO ENTREGADO!';
    this.els.layer.parentNode.appendChild(toast);
    window.setTimeout(() => { if (toast.parentNode) toast.remove(); }, 1800);
  },

  // ------------------------------------------------------------------
  // MARKER / CTA POSITIONING — TEMPORARY DELIVERY MARKER — REPLACE WITH
  // FINAL ASSET LATER
  // ------------------------------------------------------------------

  _showMarker() {
    this.els.marker.classList.add('bd-active');
  },
  _hideMarker() {
    this.els.marker.classList.remove('bd-active');
  },
  _showCta() {
    this.els.ctaBtn.classList.add('bd-active');
  },
  _hideCta() {
    this.els.ctaBtn.classList.remove('bd-active');
  },

  _positionMarkerAndCta() {
    if (!this.house) return;
    const gameRect = document.getElementById('bd-delivery-game').getBoundingClientRect();
    const houseRect = this.els.houseImg.getBoundingClientRect();

    const centerX = (houseRect.left - gameRect.left) + houseRect.width / 2;
    const topY = houseRect.top - gameRect.top;

    this.els.marker.style.left = `${centerX}px`;
    this.els.marker.style.top = `${topY}px`;

    this.els.ctaBtn.style.left = `${centerX}px`;
    this.els.ctaBtn.style.top = `${(houseRect.bottom - gameRect.top) + 14}px`;
  },

  // ------------------------------------------------------------------
  // PROGRESS UI (check1.png / uncheck1.png + N / total)
  // ------------------------------------------------------------------

  _updateProgressUI() {
    this.els.progressIcons.forEach((img, i) => {
      img.src = i < this.completedCount
        ? BakeryDelivery.assets.deliveryMarks.check
        : BakeryDelivery.assets.deliveryMarks.uncheck;
    });
    this.els.progressText.textContent =
      `${this.completedCount} / ${BakeryDelivery.deliveryConfig.DELIVERY_ROUTES.length}`;
  },

  _showConfirmationBanner() {
    let banner = this._confirmBannerEl;
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'bd-delivery-confirm-banner';
      banner.innerHTML = '<span class="bd-delivery-confirm-check">✓</span> PEDIDO ENTREGADO';
      this.els.layer.parentNode.appendChild(banner);
      this._confirmBannerEl = banner;
    }
    banner.classList.add('bd-active');
  },

  _hideConfirmationBanner() {
    if (this._confirmBannerEl) this._confirmBannerEl.classList.remove('bd-active');
  },

  // ------------------------------------------------------------------
  // TEMPORARY COMPLETION STATE — Stage 4 replaces this with the real
  // Anxi-doubt-aware ending.
  // ------------------------------------------------------------------

  _showCompletion() {
    this.mode = 'complete';
    BakeryDelivery.audioSystem.stopAll(); // level completely finished
    BakeryDelivery.deliveryTimer.stop(); // success takes priority — no timeout can fire after this
    BakeryDelivery.deliveryGameplay.stopDelivery(); // and no stray collision can fire a lives failure after this either
    this.els.completionPanel.classList.add('bd-active');
    BakeryDelivery.deliveryMeli.setMoving(false);
  },

  // ------------------------------------------------------------------
  // DEV HELPERS
  // ------------------------------------------------------------------

  _clearStateTimer() {
    if (this._stateTimer) {
      window.clearTimeout(this._stateTimer);
      this._stateTimer = null;
    }
  },

  _updateElapsedReadout() {
    const totalSec = Math.floor(this.deliveryElapsedMs / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    this.els.elapsedReadout.textContent = `ELAPSED: ${m}:${s}`;
    this.els.elapsedReadout.style.display = 'block';
  },

  /* TEMPORARY DEVELOPMENT ENTRY — REMOVE/CONNECT LATER */
  _devGoToDestination(n) {
    const idx = Math.max(1, Math.min(BakeryDelivery.deliveryConfig.DELIVERY_ROUTES.length, n)) - 1;
    this._clearStateTimer();
    this._hideHouse();
    this.els.completionPanel.classList.remove('bd-active');
    this._hideConfirmationBanner();
    this.currentIndex = idx;
    this.completedCount = idx;
    this._laneDecision = null;
    this.segmentDistance = BakeryDelivery.deliveryConfig.DELIVERY_ROUTES[idx].distance
      - BakeryDelivery.deliveryConfig.HOUSE_SPAWN_LEAD_DISTANCE - 50;
    this.mode = 'driving';
    this._ctaHandled = false;
    this._applySegmentSpeedMultiplier();
    BakeryDelivery.deliveryMeli.setMoving(true);
    BakeryDelivery.deliveryObstacles.pause();
    this._updateProgressUI();
  }
};
