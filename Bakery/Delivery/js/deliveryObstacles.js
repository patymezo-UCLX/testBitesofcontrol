/* ==========================================================================
   BAKERY DELIVERY — DELIVERY OBSTACLES (Stage 2)
   Spawns Obs 1/4/5 into the world layer, moves them at the SAME current
   world speed the background scrolls at (including any collision
   slowdown, via deliveryWorld.getCurrentSpeed()) so nothing ever drifts
   out of sync with the road, and checks each against Meli's real
   collision hitbox every frame.

   Spawn timing is pattern-driven, not fully random — a small queue of
   the classic A/B/C/D patterns from the brief, generously spaced, with
   never more than one lane blocked at a given moment so there's always
   a way through. Spawn distance is time-based (OBSTACLE_MIN_REACTION_TIME_S
   × current speed), not just "at the viewport edge" — a narrow portrait
   screen alone would otherwise give much less warning than desktop.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryObstacles = {

  els: {},
  pool: [],
  nextUid: 1,

  isRunning: false,
  isSpawning: false,
  spawnTimer: null,

  patternQueue: [],
  patternIndex: 0,

  // Hitboxes/ground-anchors measured directly from each supplied PNG's
  // actual visible content (not the full transparent-padded rectangle),
  // then tightened further inward for a forgiving arcade feel — a near
  // miss should truly not register. `type` distinguishes PHYSICAL
  // obstacles (normal collision → impact/slowdown) from ANXI obstacles
  // (Obs 2/3 — a different gameplay type entirely; see
  // triggerAnxiEncounter() and update()'s collision branch below).
  catalog: {
    'obs-1': {
      type: 'physical',
      kind: 'cone',
      asset: 'assets/obs-1.png',
      // Cone: focus on the solid base/body, not the thin tapered tip.
      hitbox: { left: 0.32, right: 0.68, top: 0.35, bottom: 0.82 },
      groundAnchor: 0.885
    },
    'obs-4': {
      type: 'physical',
      kind: 'puddle',
      asset: 'assets/obs-4.png',
      // Puddle: the central blob only — excludes the small satellite
      // droplets scattered around it, which would otherwise feel unfair.
      hitbox: { left: 0.24, right: 0.76, top: 0.44, bottom: 0.66 },
      groundAnchor: 0.719
    },
    'obs-5': {
      type: 'physical',
      kind: 'crate',
      asset: 'assets/obs-5.png',
      // Crate: slightly inside the visible edges.
      hitbox: { left: 0.30, right: 0.70, top: 0.30, bottom: 0.78 },
      groundAnchor: 0.865
    },
    'obs-2': {
      type: 'anxi',
      kind: 'anxi-a',
      asset: 'assets/obs-2.png',
      hitbox: { left: 0.28, right: 0.72, top: 0.20, bottom: 0.85 },
      groundAnchor: 0.90
    },
    'obs-3': {
      type: 'anxi',
      kind: 'anxi-b',
      asset: 'assets/obs-3.png',
      hitbox: { left: 0.28, right: 0.72, top: 0.20, bottom: 0.85 },
      groundAnchor: 0.90
    }
  },

  init() {
    this.els.worldLayer = document.getElementById('bd-delivery-world-layer');
  },

  start() {
    this.stop();
    this.isRunning = true;
    this.isSpawning = true;
    this.patternIndex = 0;
    this._buildPatternQueue();
    this._scheduleNextSpawn(1400); // a moment to get driving before the first one
  },

  stop() {
    this.isRunning = false;
    this.isSpawning = false;
    if (this.spawnTimer) {
      window.clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
    this.pool.forEach((o) => { if (o.el && o.el.parentNode) o.el.remove(); });
    this.pool = [];
  },

  pause() {
    this.isSpawning = false;
    if (this.spawnTimer) {
      window.clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
  },

  resume() {
    if (!this.isRunning) return;
    this.isSpawning = true;
    this._scheduleNextSpawn();
  },

  /** Route-aware: rebuilt every start() (which deliveryDestination.js
   *  calls once per house), so Anxi frequency and total obstacle count
   *  scale with THIS route's actual spawn window rather than being one
   *  generic queue reused everywhere. Physical obstacles stay the
   *  majority; 1 Anxi encounter on shorter routes, up to 2 on longer
   *  ones, never placed first and never clustered together. Lane
   *  alternates most of the time (making the player actually switch),
   *  with occasional closeFollow pairs (the D pattern: down-then-up or
   *  up-then-down) — still spaced well beyond LANE_CHANGE_DURATION so
   *  there's always real reaction time, and never two obstacles/Anxi
   *  overlapping in time such that both lanes are blocked at once. */
  _buildPatternQueue() {
    const cfg = BakeryDelivery.deliveryConfig;
    const dest = BakeryDelivery.deliveryDestination;
    const route = dest && cfg.DELIVERY_ROUTES[dest.currentIndex];
    const distance = route ? route.distance : 2800;

    const spawnWindowPx = Math.max(700, distance - cfg.HOUSE_SPAWN_LEAD_DISTANCE - cfg.CLEAR_APPROACH_EXTRA);
    const avgSpacingS = (cfg.OBSTACLE_SPACING_MIN_MS + cfg.OBSTACLE_SPACING_MAX_MS) / 2000;
    const avgSpacingPx = avgSpacingS * cfg.DELIVERY_WORLD_SPEED;
    const totalSlots = Math.max(2, Math.round(spawnWindowPx / avgSpacingPx));

    const anxiCount = distance >= 3000 ? 2 : 1;

    const seq = [];
    let lastLane = Math.random() < 0.5 ? 0 : 1;
    for (let i = 0; i < totalSlots; i++) {
      // Alternate lanes most of the time (per spec's "more sequences"
      // request); occasionally repeat so it doesn't feel metronomic.
      const lane = Math.random() < 0.75 ? (1 - lastLane) : lastLane;
      lastLane = lane;
      const closeFollow = i > 0 && Math.random() < 0.25;
      seq.push({ lane, closeFollow, kind: 'physical' });
    }

    // Place Anxi encounters evenly spaced through the sequence, never at
    // index 0 (never the very first thing the player sees) and never
    // adjacent to each other.
    const usedIndices = [];
    for (let a = 0; a < anxiCount; a++) {
      let idx = Math.min(seq.length - 1, Math.max(1, Math.round(((a + 1) / (anxiCount + 1)) * seq.length)));
      while (usedIndices.some((u) => Math.abs(u - idx) < 2) && idx < seq.length - 1) idx += 1;
      usedIndices.push(idx);
      seq[idx].kind = 'anxi';
      seq[idx].closeFollow = false; // Anxi never part of a tight back-to-back pair
    }

    this.patternQueue = seq;
  },

  _scheduleNextSpawn(forceDelayMs) {
    if (!this.isSpawning) return;
    const cfg = BakeryDelivery.deliveryConfig;

    let delay;
    if (typeof forceDelayMs === 'number') {
      delay = forceDelayMs;
    } else {
      const upcoming = this.patternQueue[this.patternIndex % this.patternQueue.length];
      delay = (upcoming && upcoming.closeFollow)
        ? cfg.OBSTACLE_SPACING_MIN_MS * 0.6
        : cfg.OBSTACLE_SPACING_MIN_MS + Math.random() * (cfg.OBSTACLE_SPACING_MAX_MS - cfg.OBSTACLE_SPACING_MIN_MS);
    }

    this.spawnTimer = window.setTimeout(() => {
      this._spawnNext();
      this._scheduleNextSpawn();
    }, delay);
  },

  _spawnNext() {
    if (!this.patternQueue.length) return;
    const entry = this.patternQueue[this.patternIndex % this.patternQueue.length];
    this.patternIndex += 1;
    this._spawnObstacle(entry.lane, entry.kind || 'physical');
  },

  _pickTypeKey(kind) {
    const keys = Object.keys(this.catalog).filter((k) => this.catalog[k].type === kind);
    return keys[Math.floor(Math.random() * keys.length)];
  },

  _spawnObstacle(lane, kind) {
    const gameEl = document.getElementById('bd-delivery-game');
    const rect = gameEl.getBoundingClientRect();
    const meliRect = document.getElementById('bd-delivery-meli').getBoundingClientRect();
    const meliLocalX = (meliRect.left - rect.left) + meliRect.width / 2;

    const cfg = BakeryDelivery.deliveryConfig;
    const currentSpeed = BakeryDelivery.deliveryWorld.getCurrentSpeed() || cfg.DELIVERY_WORLD_SPEED;
    const minReactionPx = cfg.OBSTACLE_MIN_REACTION_TIME_S * currentSpeed;

    // Never closer than the viewport's own right edge, and never closer
    // than the minimum-reaction-time distance from Meli — whichever is
    // further right. On mobile this pushes the spawn point beyond the
    // visible edge so warning time stays fair despite the narrow screen.
    const spawnX = Math.max(rect.width, meliLocalX + minReactionPx);

    const typeKey = this._pickTypeKey(kind || 'physical');
    const meta = this.catalog[typeKey];

    const el = document.createElement('img');
    el.src = meta.asset;
    el.alt = '';
    el.className = 'bd-delivery-obstacle' + (meta.type === 'anxi' ? ' bd-delivery-obstacle-anxi' : '');
    el.draggable = false;
    this.els.worldLayer.appendChild(el);

    this.pool.push({
      uid: this.nextUid++,
      typeKey,
      meta,
      lane,
      el,
      x: spawnX,
      alreadyHit: false
    });
  },

  /** @param {number} dt seconds since last frame */
  update(dt) {
    if (!this.isRunning) return;

    const world = BakeryDelivery.deliveryWorld;
    const meli = BakeryDelivery.deliveryMeli;
    const dx = world.getCurrentSpeed() * dt;
    const meliHitbox = meli.getHitboxRect();

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const o = this.pool[i];
      o.x -= dx;
      this._applyObstaclePosition(o);

      if (!o.alreadyHit) {
        // Lane-authoritative collision: when Meli is settled in a lane,
        // an obstacle in the OTHER lane can never collide, full stop —
        // checked BEFORE any hitbox math, regardless of what the
        // transparent-padded rectangles might visually suggest. While
        // she's mid-glide between lanes her logical lane index is
        // ambiguous by definition, so real rendered-hitbox overlap is
        // the correct (and only) test during that brief window.
        const laneMatches = meli.isGliding || (meli.currentLane === o.lane);

        if (laneMatches) {
          const hb = this._getObstacleHitboxRect(o);
          if (this._rectsOverlap(hb, meliHitbox)) {
            o.alreadyHit = true; // this specific obstacle can never hit again
            if (o.meta.type === 'anxi') {
              this.triggerAnxiEncounter(o);
            } else {
              BakeryDelivery.deliveryGameplay.onObstacleCollision(o);
            }
          }
        }
      }

      const elWidth = o.el.getBoundingClientRect().width || 0;
      if (o.x + elWidth < -40) {
        this._removeObstacle(o);
      }
    }
  },

  _applyObstaclePosition(o) {
    const world = BakeryDelivery.deliveryWorld;
    const laneT = o.lane; // discrete — obstacles don't glide between lanes
    const groundY = world.containerHeight * (
      world.laneYFraction.upper + (world.laneYFraction.lower - world.laneYFraction.upper) * laneT
    );

    const cfg = BakeryDelivery.deliveryConfig;
    const scale = cfg.OBSTACLE_SCALE_UPPER + (cfg.OBSTACLE_SCALE_LOWER - cfg.OBSTACLE_SCALE_UPPER) * laneT;

    const elHeight = o.el.offsetHeight || 1;
    const topPx = groundY - elHeight * o.meta.groundAnchor * scale;

    o.el.style.transform = `translate(${o.x}px, ${topPx}px) scale(${scale})`;
    // Lower/front-lane obstacles paint above upper/back-lane ones.
    o.el.style.zIndex = String(2 + laneT);
  },

  _getObstacleHitboxRect(o) {
    const rect = o.el.getBoundingClientRect();
    const hb = o.meta.hitbox;
    return {
      left: rect.left + rect.width * hb.left,
      right: rect.left + rect.width * hb.right,
      top: rect.top + rect.height * hb.top,
      bottom: rect.top + rect.height * hb.bottom
    };
  },

  _rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  },

  _removeObstacle(o) {
    const idx = this.pool.indexOf(o);
    if (idx !== -1) this.pool.splice(idx, 1);
    if (o.el && o.el.parentNode) o.el.remove();
  },

  // ------------------------------------------------------------------
  // ANXI ENCOUNTER
  // /* TEMPORARY ANXI HIT TEST — REPLACE WITH DIALOGUE NEXT STAGE */
  // Deliberately NOT the physical crash feedback (no triggerImpact(),
  // no wobble/jerk/tilt) — Anxi isn't a road object Meli crashes into.
  // This is the ONE centralized hook; next stage swaps this function's
  // body for the real doubt dialogue without touching the collision
  // loop that calls it.
  // ------------------------------------------------------------------

  triggerAnxiEncounter(o) {
    const cfg = BakeryDelivery.deliveryConfig;
    const world = BakeryDelivery.deliveryWorld;

    // The ONLY place the Delivery timer is allowed to pause — and only
    // for this brief, fully automatic effect. A future player-facing
    // Anxi dialogue must keep the timer running instead.
    BakeryDelivery.deliveryTimer.pauseForAutomaticEffect(cfg.ANXI_ENCOUNTER_PAUSE_MS);

    world._speedTransition = null;
    world.speedMultiplier = 0.1; // brief near-stop, not a physical crash
    o.el.classList.add('bd-delivery-anxi-emphasis');
    this._showAnxiLabel(o);

    window.setTimeout(() => {
      o.el.classList.remove('bd-delivery-anxi-emphasis');
      world.setSpeedTarget(1, cfg.ANXI_ENCOUNTER_PAUSE_MS);
    }, cfg.ANXI_ENCOUNTER_PAUSE_MS);
  },

  _showAnxiLabel(o) {
    const gameRect = document.getElementById('bd-delivery-game').getBoundingClientRect();
    const oRect = o.el.getBoundingClientRect();

    const label = document.createElement('div');
    label.className = 'bd-delivery-anxi-label';
    label.textContent = 'ANXI';
    label.style.left = `${(oRect.left - gameRect.left) + oRect.width / 2}px`;
    label.style.top = `${oRect.top - gameRect.top}px`;

    const fxLayer = document.getElementById('bd-delivery-fx-layer');
    fxLayer.appendChild(label);
    window.setTimeout(() => {
      if (label.parentNode) label.remove();
    }, BakeryDelivery.deliveryConfig.ANXI_ENCOUNTER_LABEL_MS);
  }
};
