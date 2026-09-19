/* ==========================================================================
   BAKERY DELIVERY — DELIVERY GAMEPLAY (Stage 1 lifecycle + input)
   Orchestrates deliveryWorld + deliveryMeli behind a small, clean
   lifecycle (start/pause/resume/stop/reset) and owns the single
   requestAnimationFrame loop — guarded so an accidental double
   startDelivery() call can never spin up a second loop.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryGameplay = {

  els: {},

  isRunning: false,
  isPaused: false,
  rafId: null,
  lastFrameTime: 0,

  _listenersBound: false,
  _pointer: null, // { startX, startY, active }
  _lastCollisionTime: 0,

  lives: 4,
  _failureReason: null, // 'timeout' | 'noLives'

  init() {
    this.els.screen = document.getElementById('bd-screen-delivery');
    this.els.game = document.getElementById('bd-delivery-game');
    this.els.debugLayer = document.getElementById('bd-delivery-debug');
    this.els.btnUp = document.getElementById('bd-delivery-btn-up');
    this.els.btnDown = document.getElementById('bd-delivery-btn-down');
    this.els.timeoutPanel = document.getElementById('bd-delivery-timeout-panel');
    this.els.timeoutHeading = document.getElementById('bd-delivery-timeout-heading');
    this.els.timeoutSubtext = document.getElementById('bd-delivery-timeout-subtext');
    this.els.timeoutRetryBtn = document.getElementById('bd-delivery-timeout-retry-btn');
    this.els.livesContainer = document.getElementById('bd-delivery-lives');
    this.els.lifeHearts = Array.from(document.querySelectorAll('#bd-delivery-lives .bd-life-heart'));
    BakeryDelivery.deliveryDestination.init();
    BakeryDelivery.deliveryTimer.init();

    this.els.timeoutRetryBtn.addEventListener('click', () => this._retryAfterTimeout());
  },

  // ------------------------------------------------------------------
  // LIFECYCLE
  // ------------------------------------------------------------------

  startDelivery() {
    if (this.isRunning) return; // guards a duplicate loop
    this.isRunning = true;
    this.isPaused = false;

    BakeryDelivery.audioSystem.playDelivery();

    this.lives = BakeryDelivery.deliveryConfig.DELIVERY_LIVES_START;
    this._failureReason = null;
    this._updateLivesUI();

    BakeryDelivery.deliveryWorld.init();
    BakeryDelivery.deliveryMeli.init();
    BakeryDelivery.deliveryObstacles.init();
    BakeryDelivery.deliveryWorld.measureAndLayout();
    BakeryDelivery.deliveryMeli.measureAndPosition();
    BakeryDelivery.deliveryMeli.reset(BakeryDelivery.deliveryConfig.STARTING_LANE);
    BakeryDelivery.deliveryDestination.reset();
    BakeryDelivery.deliveryObstacles.start();

    // The global Delivery countdown starts here — the moment active
    // driving begins, never during the Delivery instructions screen.
    BakeryDelivery.deliveryTimer.reset();
    BakeryDelivery.deliveryTimer.start();

    if (!this._listenersBound) {
      this._bindInput();
      this._bindResize();
      this._listenersBound = true;
    }

    this._buildDebugOverlay();

    this.lastFrameTime = performance.now();
    this._loop();
  },

  pauseDelivery() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    BakeryDelivery.deliveryObstacles.pause();
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  resumeDelivery() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    BakeryDelivery.deliveryObstacles.resume();
    this.lastFrameTime = performance.now();
    this._loop();
  },

  stopDelivery() {
    this.isRunning = false;
    this.isPaused = false;
    BakeryDelivery.deliveryObstacles.stop();
    BakeryDelivery.deliveryTimer.stop();
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  resetDelivery() {
    this.stopDelivery();
    BakeryDelivery.deliveryWorld.reset();
    BakeryDelivery.deliveryMeli.reset(BakeryDelivery.deliveryConfig.STARTING_LANE);
    BakeryDelivery.deliveryDestination.reset();
    BakeryDelivery.deliveryTimer.reset();
    this.lives = BakeryDelivery.deliveryConfig.DELIVERY_LIVES_START;
    this._failureReason = null;
    this._updateLivesUI();
    this._hideTimeoutPanel();
    this._lastCollisionTime = 0;
  },

  /** Called by deliveryTimer.js the moment the global Delivery countdown
   *  reaches 00:00 before all 4 houses are delivered. Stops driving
   *  cleanly and offers a Delivery-only retry — Packing is never
   *  replayed. Delivery now has TWO failure conditions (timer and
   *  lives) sharing this exact same panel/retry flow — see
   *  handleNoLives() below and _showFailurePanel()'s copy branch. */
  handleDeliveryTimeout() {
    if (!this.isRunning) return;
    this._failureReason = 'timeout';
    this.stopDelivery();
    BakeryDelivery.deliveryMeli.setMoving(false);
    this._showFailurePanel();
  },

  /** Called by onObstacleCollision() below the moment lives reach 0.
   *  Guarded the same way as handleDeliveryTimeout() so whichever
   *  failure condition fires first "wins" cleanly — the other can never
   *  also fire afterwards. */
  handleNoLives() {
    if (!this.isRunning) return;
    this._failureReason = 'noLives';
    this.stopDelivery();
    BakeryDelivery.deliveryMeli.setMoving(false);
    this._showFailurePanel();
  },

  /** Called by deliveryDestination.js once all 4 destinations have been
   *  passed (delivered or missed) but fewer than 4 were actually
   *  delivered. Same shared panel/retry flow as the other two failures. */
  handleRouteIncomplete(delivered, total) {
    if (!this.isRunning) return;
    this._failureReason = 'incomplete';
    this._incompleteDelivered = delivered;
    this._incompleteTotal = total;
    this.stopDelivery();
    BakeryDelivery.deliveryMeli.setMoving(false);
    this._showFailurePanel();
  },

  _showFailurePanel() {
    const reason = this._failureReason;
    let heading;
    let subtext;
    if (reason === 'noLives') {
      heading = 'TE QUEDASTE SIN VIDAS';
      subtext = '¡Cuidado con los obstáculos!';
    } else if (reason === 'incomplete') {
      heading = 'QUEDARON PEDIDOS SIN ENTREGAR';
      subtext = `Entregaste ${this._incompleteDelivered} de ${this._incompleteTotal} pedidos.`;
    } else {
      heading = 'SE ACABÓ EL TIEMPO';
      subtext = 'Todavía quedan pedidos por entregar.';
    }
    this.els.timeoutHeading.textContent = heading;
    this.els.timeoutSubtext.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = subtext;
    this.els.timeoutSubtext.appendChild(p);
    this._showTimeoutPanel();
  },

  _showTimeoutPanel() {
    this.els.timeoutPanel.classList.add('bd-active');
  },

  _hideTimeoutPanel() {
    this.els.timeoutPanel.classList.remove('bd-active');
  },

  /** Restarts Delivery ONLY — timer/route/obstacles/Meli/world/lives all
   *  reset to their very start, but the player stays on the Delivery
   *  screen and never has to replay Packing. Same retry path regardless
   *  of which failure condition (timer or lives) triggered it. */
  _retryAfterTimeout() {
    this._hideTimeoutPanel();
    this.stopDelivery();
    BakeryDelivery.deliveryWorld.reset();
    BakeryDelivery.deliveryMeli.reset(BakeryDelivery.deliveryConfig.STARTING_LANE);
    BakeryDelivery.deliveryDestination.reset();
    BakeryDelivery.deliveryTimer.reset();
    this.startDelivery();
  },

  // ------------------------------------------------------------------
  // LIVES
  // ------------------------------------------------------------------

  _updateLivesUI() {
    this.els.lifeHearts.forEach((heart, i) => {
      heart.classList.toggle('bd-life-lost', i >= this.lives);
    });
  },

  /** A physical obstacle collision costs exactly one life — called only
   *  from onObstacleCollision() below, which is itself only ever called
   *  for PHYSICAL obstacles (deliveryObstacles.js routes Anxi hits to
   *  triggerAnxiEncounter() instead, never here), so Anxi never touches
   *  lives at all. */
  loseLife() {
    if (!this.isRunning || this.lives <= 0) return;

    this.lives -= 1;
    this._updateLivesUI();

    this.els.livesContainer.classList.remove('bd-lives-hit');
    void this.els.livesContainer.offsetWidth; // restart the animation even in quick succession
    this.els.livesContainer.classList.add('bd-lives-hit');

    if (this.lives <= 0) {
      this.handleNoLives();
    }
  },

  /** Called by deliveryObstacles.js the moment an obstacle first
   *  overlaps Meli's hitbox. Mild, temporary consequence only — no
   *  lives, no reset, no permanent speed change. A brief GLOBAL cooldown
   *  (separate from each obstacle's own permanent alreadyHit flag) just
   *  stops two near-simultaneous impacts from stacking animations. */
  onObstacleCollision() {
    const cfg = BakeryDelivery.deliveryConfig;
    const now = performance.now();
    if (this._lastCollisionTime && now - this._lastCollisionTime < cfg.GLOBAL_COLLISION_COOLDOWN_MS) {
      return;
    }
    this._lastCollisionTime = now;

    BakeryDelivery.deliveryMeli.triggerImpact();
    BakeryDelivery.deliveryWorld.triggerSlowdown();
    this._spawnImpactPuff();
    this.loseLife();
  },

  /* TEMPORARY IMPACT EFFECT — CAN BE REPLACED WITH ART LATER */
  _spawnImpactPuff() {
    const meliRect = document.getElementById('bd-delivery-meli-impact').getBoundingClientRect();
    const gameRect = this.els.game.getBoundingClientRect();

    const puff = document.createElement('div');
    puff.className = 'bd-delivery-impact-puff';
    puff.style.left = `${(meliRect.left - gameRect.left) + meliRect.width * 0.62}px`;
    puff.style.top = `${(meliRect.top - gameRect.top) + meliRect.height * 0.68}px`;

    const fxLayer = document.getElementById('bd-delivery-fx-layer');
    fxLayer.appendChild(puff);
    window.setTimeout(() => { if (puff.parentNode) puff.remove(); }, 360);
  },

  // ------------------------------------------------------------------
  // MAIN LOOP
  // ------------------------------------------------------------------

  _loop() {
    this.rafId = window.requestAnimationFrame((t) => this._tick(t));
  },

  _tick(now) {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000); // seconds, clamped
    this.lastFrameTime = now;

    BakeryDelivery.deliveryWorld.update(dt);
    BakeryDelivery.deliveryMeli.update(dt * 1000);
    BakeryDelivery.deliveryObstacles.update(dt);
    BakeryDelivery.deliveryDestination.update(dt);

    if (BakeryDelivery.deliveryConfig.DELIVERY_DEBUG) {
      this._updateDebugOverlay();
    }

    if (this.isRunning && !this.isPaused) {
      this._loop();
    }
  },

  // ------------------------------------------------------------------
  // INPUT — keyboard (desktop primary), swipe (touch primary), tap
  // (secondary/accessibility on both).
  // ------------------------------------------------------------------

  _bindInput() {
    window.addEventListener('keydown', (e) => this._onKeyDown(e));

    this.els.game.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    window.addEventListener('pointercancel', () => { this._pointer = null; });

    // Mobile ↑/↓ buttons — same setLane() as keyboard/swipe/tap, per spec.
    this.els.btnUp.addEventListener('click', () => {
      if (!this.isRunning || this.isPaused || !BakeryDelivery.deliveryDestination.controlsEnabled()) return;
      BakeryDelivery.deliveryMeli.setLane(0);
    });
    this.els.btnDown.addEventListener('click', () => {
      if (!this.isRunning || this.isPaused || !BakeryDelivery.deliveryDestination.controlsEnabled()) return;
      BakeryDelivery.deliveryMeli.setLane(1);
    });
  },

  _bindResize() {
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('orientationchange', () => this._onResize());
  },

  _onResize() {
    if (!this.isRunning) return;
    BakeryDelivery.deliveryWorld.measureAndLayout();
    BakeryDelivery.deliveryMeli.measureAndPosition();
    // Don't leave Meli interpolating across a suddenly-different lane
    // gap — settle her instantly, then let the next frame's normal
    // per-lane positioning take over.
    const meli = BakeryDelivery.deliveryMeli;
    if (meli.isGliding) {
      meli.currentLane = meli.targetLane;
      meli.isGliding = false;
    }
  },

  _onKeyDown(e) {
    if (!this.isRunning || this.isPaused || !BakeryDelivery.deliveryDestination.controlsEnabled()) return;
    if (BakeryDelivery.exitControl.isConfirmOpen()) return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      BakeryDelivery.deliveryMeli.setLane(0);
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      BakeryDelivery.deliveryMeli.setLane(1);
    }
  },

  _onPointerDown(e) {
    if (!this.isRunning || this.isPaused || !BakeryDelivery.deliveryDestination.controlsEnabled()) return;
    // Taps on the dedicated ↑/↓ buttons are handled by their own click
    // listeners — don't also let the container's tap/swipe detection
    // treat that same gesture as a whole-road tap.
    if (e.target.closest('.bd-delivery-lane-btn')) return;
    this._pointer = { startX: e.clientX, startY: e.clientY, active: true };
  },

  _onPointerMove(e) {
    // Prevent the page from scrolling while dragging inside the Delivery
    // area; the actual lane decision happens on release.
    if (this._pointer && this._pointer.active) {
      e.preventDefault();
    }
  },

  _onPointerUp(e) {
    if (!this._pointer || !this._pointer.active) return;
    const dx = e.clientX - this._pointer.startX;
    const dy = e.clientY - this._pointer.startY;
    this._pointer = null;

    if (!this.isRunning || this.isPaused) return;

    const threshold = BakeryDelivery.deliveryConfig.SWIPE_THRESHOLD_PX;
    const isMostlyVertical = Math.abs(dy) > Math.abs(dx);

    if (Math.abs(dy) >= threshold && isMostlyVertical) {
      // Clear swipe intent.
      BakeryDelivery.deliveryMeli.setLane(dy < 0 ? 0 : 1);
    } else if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
      // A simple tap/click — secondary control: pick the lane the tap
      // landed in, relative to the game container's height.
      const rect = this.els.game.getBoundingClientRect();
      const relY = (e.clientY - rect.top) / rect.height;
      BakeryDelivery.deliveryMeli.setLane(relY < 0.5 ? 0 : 1);
    }
    // Otherwise: an ambiguous/mostly-horizontal gesture — ignored.
  },

  // ------------------------------------------------------------------
  // DEBUG OVERLAY — only ever built/shown when DELIVERY_DEBUG is true.
  // /* TEMPORARY DEBUG — REMOVE/DISABLE FOR FINAL */
  // ------------------------------------------------------------------

  _buildDebugOverlay() {
    this.els.debugLayer.innerHTML = '';
    if (!BakeryDelivery.deliveryConfig.DELIVERY_DEBUG) {
      this.els.debugLayer.setAttribute('aria-hidden', 'true');
      return;
    }

    this.els.debugLayer.setAttribute('aria-hidden', 'false');

    const upperLine = document.createElement('div');
    upperLine.className = 'bd-delivery-debug-lane-line';
    const lowerLine = document.createElement('div');
    lowerLine.className = 'bd-delivery-debug-lane-line';

    const hitbox = document.createElement('div');
    hitbox.className = 'bd-delivery-debug-hitbox';

    const obstacleLayer = document.createElement('div');
    obstacleLayer.className = 'bd-delivery-debug-obstacle-layer';

    const readout = document.createElement('div');
    readout.className = 'bd-delivery-debug-readout';

    this.els.debugLayer.appendChild(upperLine);
    this.els.debugLayer.appendChild(lowerLine);
    this.els.debugLayer.appendChild(hitbox);
    this.els.debugLayer.appendChild(obstacleLayer);
    this.els.debugLayer.appendChild(readout);

    this._debugEls = { upperLine, lowerLine, hitbox, obstacleLayer, readout };
  },

  _updateDebugOverlay() {
    if (!this._debugEls) return;
    const world = BakeryDelivery.deliveryWorld;
    const meli = BakeryDelivery.deliveryMeli;
    const gameRect = this.els.game.getBoundingClientRect();

    this._debugEls.upperLine.style.top = `${world.containerHeight * world.laneYFraction.upper}px`;
    this._debugEls.lowerLine.style.top = `${world.containerHeight * world.laneYFraction.lower}px`;

    const hb = meli.getHitboxRect();
    this._debugEls.hitbox.style.left = `${hb.left - gameRect.left}px`;
    this._debugEls.hitbox.style.top = `${hb.top - gameRect.top}px`;
    this._debugEls.hitbox.style.width = `${hb.right - hb.left}px`;
    this._debugEls.hitbox.style.height = `${hb.bottom - hb.top}px`;

    // Obstacle hitboxes + labels — rebuilt each frame (a handful of
    // elements at most, cheap) so the count always matches the pool.
    this._debugEls.obstacleLayer.innerHTML = '';
    BakeryDelivery.deliveryObstacles.pool.forEach((o) => {
      const obsHb = BakeryDelivery.deliveryObstacles._getObstacleHitboxRect(o);
      const box = document.createElement('div');
      box.className = 'bd-delivery-debug-hitbox bd-delivery-debug-hitbox-obstacle';
      box.style.left = `${obsHb.left - gameRect.left}px`;
      box.style.top = `${obsHb.top - gameRect.top}px`;
      box.style.width = `${obsHb.right - obsHb.left}px`;
      box.style.height = `${obsHb.bottom - obsHb.top}px`;

      const label = document.createElement('div');
      label.className = 'bd-delivery-debug-obstacle-label';
      label.textContent = `${o.meta.kind} (${o.meta.type}) / ${o.lane === 0 ? 'upper' : 'lower'}${o.alreadyHit ? ' / hit' : ''}`;
      box.appendChild(label);

      this._debugEls.obstacleLayer.appendChild(box);
    });

    const baseSpeed = BakeryDelivery.deliveryConfig.DELIVERY_WORLD_SPEED;
    const effectiveSpeed = Math.round(world.getCurrentSpeed());
    const slowed = world.speedMultiplier < 0.99 ? ' (slowed)' : '';
    const dest = BakeryDelivery.deliveryDestination;
    const route = BakeryDelivery.deliveryConfig.DELIVERY_ROUTES[dest.currentIndex];
    const obstaclePool = BakeryDelivery.deliveryObstacles.pool;
    const physicalCount = obstaclePool.filter((o) => o.meta.type === 'physical').length;
    const anxiCount = obstaclePool.filter((o) => o.meta.type === 'anxi').length;
    const timer = BakeryDelivery.deliveryTimer;

    this._debugEls.readout.textContent =
      `lane: ${meli.currentLane === 0 ? 'upper' : 'lower'} (target ${meli.targetLane})` +
      ` | gliding: ${meli.isGliding}` +
      ` | speed base:${baseSpeed} eff:${effectiveSpeed}px/s${slowed}` +
      ` | timer: ${timer.els.text ? timer.els.text.textContent : '--:--'}` +
      ` | route #${dest.currentIndex + 1} dist:${Math.round(dest.segmentDistance)}/${route ? route.distance : '?'}` +
      ` | obstacles physical:${physicalCount} anxi:${anxiCount}` +
      ` | delivered: ${dest.completedCount}/${BakeryDelivery.deliveryConfig.DELIVERY_ROUTES.length}`;
  }
};
