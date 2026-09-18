/* ==========================================================================
   BAKERY DELIVERY — FALLING OBJECTS
   Spawns bakery products + distractors above the gameplay area, animates
   them falling with subtle per-object drift/rotation, and checks each
   against the catcher's catch zone every frame. Pauseable/resumable so
   Stage 3's Anxi interruptions can freeze gameplay cleanly.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.fallingObjects = {

  pool: [],
  container: null,
  screenEl: null,

  spawnTimer: null,
  rafId: null,
  lastFrameTime: 0,
  pausedAt: 0,

  nextUid: 1,

  init() {
    this.screenEl = document.getElementById('bd-screen-gameplay');
    this.container = this.screenEl;
  },

  start() {
    this.stop();
    BakeryDelivery.state.isPlaying = true;
    BakeryDelivery.state.isSpawning = true;
    BakeryDelivery.state.isPaused = false;
    this._scheduleNextSpawn();
    this.lastFrameTime = performance.now();
    this._loop();
  },

  stopSpawning() {
    BakeryDelivery.state.isSpawning = false;
    if (this.spawnTimer) {
      window.clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
  },

  stop() {
    this.stopSpawning();
    BakeryDelivery.state.isPlaying = false;
    BakeryDelivery.state.isPaused = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearAll();
  },

  /** Removes every active falling object immediately (used on order
   *  completion and on exit) without treating them as caught or missed. */
  clearAll() {
    this.pool.forEach((o) => { if (o.el && o.el.parentNode) o.el.remove(); });
    this.pool = [];
  },

  /** Reserved for Stage 3 (Anxi interruptions): freezes motion & spawning
   *  without discarding in-flight objects. */
  pause() {
    if (!BakeryDelivery.state.isPlaying || BakeryDelivery.state.isPaused) return;
    BakeryDelivery.state.isPaused = true;
    this.pausedAt = performance.now();
    this.stopSpawning();
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  resume() {
    if (!BakeryDelivery.state.isPlaying || !BakeryDelivery.state.isPaused) return;
    const pausedDuration = performance.now() - this.pausedAt;
    this.pool.forEach((o) => { o.startTime += pausedDuration; });

    BakeryDelivery.state.isPaused = false;
    BakeryDelivery.state.isSpawning = true;
    this._scheduleNextSpawn();
    this.lastFrameTime = performance.now();
    this._loop();
  },

  _scheduleNextSpawn() {
    if (!BakeryDelivery.state.isSpawning) return;
    const delay = 900 + Math.random() * 400; // 900–1300ms, slightly randomized
    this.spawnTimer = window.setTimeout(() => {
      this._spawnOne();
      this._scheduleNextSpawn();
    }, delay);
  },

  _pickObjectId() {
    const required = BakeryDelivery.state.requiredItems
      .filter((it) => !it.collected)
      .map((it) => it.id);

    const allBakery = Object.keys(BakeryDelivery.objectCatalog)
      .filter((id) => BakeryDelivery.objectCatalog[id].category === 'bakery');
    const distractors = Object.keys(BakeryDelivery.objectCatalog)
      .filter((id) => BakeryDelivery.objectCatalog[id].category === 'distractor');
    const otherBakery = allBakery.filter((id) => !required.includes(id));

    const roll = Math.random();
    if (required.length && roll < 0.45) {
      return required[Math.floor(Math.random() * required.length)];
    }
    if (roll < 0.70) {
      const pool = otherBakery.length ? otherBakery : allBakery;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return distractors[Math.floor(Math.random() * distractors.length)];
  },

  _rotationAmplitudeFor(fallStyle) {
    switch (fallStyle) {
      case 'moreRotate': return 26;
      case 'slowRotate': return 14;
      case 'gentleRotate': return 10;
      case 'smallWobble': return 8;
      case 'gentleRock': return 12;
      case 'sideDrift': return 6;
      case 'gentleTilt': return 8;
      default: return 10;
    }
  },

  _spawnOne() {
    if (!BakeryDelivery.state.requiredItems.length) return;

    const id = this._pickObjectId();
    if (!id) return;
    const meta = BakeryDelivery.objectCatalog[id];

    const screenRect = this.screenEl.getBoundingClientRect();
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const laneMarginRatio = isPortrait ? 0.10 : 0.22;
    const laneLeft = screenRect.width * laneMarginRatio;
    const laneRight = screenRect.width * (1 - laneMarginRatio);

    const el = document.createElement('img');
    el.src = BakeryDelivery.getObjectSrc(id);
    el.alt = '';
    el.className = 'bd-falling-object';
    el.draggable = false;
    this.container.appendChild(el);

    const spawnX = laneLeft + Math.random() * Math.max(1, laneRight - laneLeft);
    const startY = -100;
    const missY = screenRect.height + 100;

    const duration = 3500 + Math.random() * 1500; // 3.5–5s, same across breakpoints
    const driftAmp = 10 + Math.random() * 12;
    const driftPhase = Math.random() * Math.PI * 2;
    const rotAmp = this._rotationAmplitudeFor(meta.fallStyle);
    const rotSpeed = 0.6 + Math.random() * 0.6;
    const initialRot = (Math.random() - 0.5) * 20;

    this.pool.push({
      uid: this.nextUid++,
      id,
      meta,
      el,
      x: spawnX,
      startY,
      missY,
      startTime: performance.now(),
      duration,
      driftAmp,
      driftPhase,
      rotAmp,
      rotSpeed,
      initialRot,
      state: 'falling'
    });
  },

  _loop() {
    this.rafId = window.requestAnimationFrame((t) => this._tick(t));
  },

  _tick(now) {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (BakeryDelivery.catcher.enabled || BakeryDelivery.state.isPlaying) {
      BakeryDelivery.catcher.update(dt);
    }

    const catchZone = BakeryDelivery.catcher.enabled ? BakeryDelivery.catcher.getCatchZone() : null;

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const o = this.pool[i];
      if (o.state !== 'falling') continue;

      const elapsed = now - o.startTime;
      const progress = Math.min(1, elapsed / o.duration);
      const y = o.startY + (o.missY - o.startY) * progress;

      const driftScale = o.meta.fallStyle === 'sideDrift' ? 1.4 : 0.5;
      const drift = Math.sin(progress * Math.PI * 2 + o.driftPhase) * o.driftAmp * driftScale;
      const rot = o.initialRot + Math.sin(progress * Math.PI * 2 * o.rotSpeed) * o.rotAmp;
      const drawX = o.x + drift;

      o.el.style.transform = `translate(${drawX}px, ${y}px) rotate(${rot}deg)`;
      o.lastTransform = o.el.style.transform;

      if (catchZone) {
        const objRect = o.el.getBoundingClientRect();
        const cx = objRect.left + objRect.width / 2;
        const cy = objRect.top + objRect.height / 2;
        if (cy >= catchZone.top && cy <= catchZone.bottom &&
            cx >= catchZone.left && cx <= catchZone.right) {
          this._handleCatch(o);
          continue;
        }
      }

      if (y >= o.missY) {
        this._handleMiss(o);
      }
    }

    if (BakeryDelivery.state.isPlaying && !BakeryDelivery.state.isPaused) {
      this._loop();
    }
  },

  _handleCatch(obj) {
    const isRequired = BakeryDelivery.state.requiredItems
      .some((it) => it.id === obj.id && !it.collected);

    if (isRequired) {
      obj.state = 'caught';
      obj.el.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
      obj.el.style.transform = `${obj.lastTransform} scale(0.7)`;
      obj.el.style.opacity = '0';
      BakeryDelivery.gameplay.onCorrectCatch(obj.id);
      window.setTimeout(() => {
        this._removeObject(obj);
        BakeryDelivery.anxiSystem.notifyActivity();
      }, 260);
    } else {
      obj.state = 'rejected';
      obj.el.style.transition = 'transform 0.35s ease-out, opacity 0.35s ease-out';
      obj.el.style.transform = `${obj.lastTransform} translateY(-16px) rotate(55deg) scale(0.85)`;
      obj.el.style.opacity = '0';
      BakeryDelivery.gameplay.onWrongCatch();
      window.setTimeout(() => {
        this._removeObject(obj);
        BakeryDelivery.anxiSystem.notifyActivity();
      }, 380);
    }
  },

  _handleMiss(obj) {
    obj.state = 'removed';
    this._removeObject(obj);
    BakeryDelivery.anxiSystem.notifyActivity();
  },

  _removeObject(obj) {
    const idx = this.pool.indexOf(obj);
    if (idx !== -1) this.pool.splice(idx, 1);
    if (obj.el && obj.el.parentNode) obj.el.remove();
  }
};
