/* ==========================================================================
   CHALK BOARD — CORE LOGIC
   Free-draw activity: pick a chalk (or the eraser) and draw on the board
   with mouse/touch. No levels, no score, no time limit. Vanilla JS,
   Pointer Events, HTML5 Canvas. The board/chalk/eraser/logo art are the
   provided PNGs, used as-is — nothing here redraws them.
   ========================================================================== */

window.ChalkBoard = (function () {

  // ------------------------------------------------------------------
  // Interior ("writable") rectangle of each board PNG, measured directly
  // against the artwork as fractions of the full image (left/top/width/
  // height, 0..1). This is what keeps the canvas exactly over the black
  // slate and off the wooden/orange frame, for both board assets.
  // ------------------------------------------------------------------
  const BOARD_RECT = {
    desktop: { left: 0.130, top: 0.175, width: 0.765, height: 0.625 },
    mobile:  { left: 0.088, top: 0.070, width: 0.817, height: 0.860 }
  };

  const CHALK_COLORS = {
    white: '#f7f6f2',
    pink:  '#ff5fa8',
    blue:  '#2f8dff',
    green: '#4fe08a'
  };

  const MAX_DPR = 2.5;

  const els = {};
  let stageEl, canvas, ctx;

  const state = {
    mode: null,           // 'desktop' | 'mobile'
    dpr: 1,
    activeTool: 'white',  // chalk color key, or 'eraser'
    drawing: false,
    lastX: 0,
    lastY: 0,
    hasStroke: false,
    pointerId: null
  };

  /* ------------------------------------------------------------------
     SCREEN MANAGEMENT
     ------------------------------------------------------------------ */

  function showScreen(id) {
    document.querySelectorAll('.chb-screen').forEach(function (s) {
      s.classList.remove('chb-active');
    });
    document.getElementById(id).classList.add('chb-active');
  }

  function showIntro() {
    stopAllSounds();
    showScreen('chb-screen-intro');
  }

  function showInstructions() {
    showScreen('chb-screen-instructions');
  }

  function showBoard() {
    showScreen('chb-screen-board');
    selectTool(state.activeTool || 'white');
    applyLayout();
  }

  function exitToWorkshopMenu() {
    stopAllSounds();
    window.location.href = '../menu.html';
  }

  /* ------------------------------------------------------------------
     RESPONSIVE LAYOUT
     Desktop (landscape) uses the horizontal board; mobile (portrait)
     uses the vertical one. Never the same asset stretched/scaled into
     the other's shape — the two PNGs are switched outright, and the
     canvas is repositioned to match whichever board is now showing.
     ------------------------------------------------------------------ */

  function computeMode() {
    return window.innerWidth <= window.innerHeight ? 'mobile' : 'desktop';
  }

  function applyLayout() {
    const boardScreen = document.getElementById('chb-screen-board');
    if (!boardScreen.classList.contains('chb-active')) return;

    const mode = computeMode();
    const modeChanged = mode !== state.mode;
    state.mode = mode;

    stageEl.classList.toggle('chb-mode-desktop', mode === 'desktop');
    stageEl.classList.toggle('chb-mode-mobile', mode === 'mobile');
    els.boardDesktop.classList.toggle('chb-hidden', mode !== 'desktop');
    els.boardMobile.classList.toggle('chb-hidden', mode !== 'mobile');

    // Wait one frame so the CSS aspect-ratio/width change above has been
    // applied before measuring the stage's actual rendered box.
    requestAnimationFrame(function () {
      const rect = stageEl.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const r = BOARD_RECT[mode];
      const cssLeft = rect.width * r.left;
      const cssTop = rect.height * r.top;
      const cssW = rect.width * r.width;
      const cssH = rect.height * r.height;

      canvas.style.left = cssLeft + 'px';
      canvas.style.top = cssTop + 'px';
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';

      resizeBackingStore(cssW, cssH, modeChanged);
    });
  }

  // Keeps the canvas crisp on high-DPI/Retina screens and preserves the
  // player's drawing across an ordinary resize (same board orientation)
  // by scaling the previous bitmap into the new backing store. A change
  // of board orientation (desktop <-> mobile) swaps to a differently
  // shaped writable area, so that case starts the canvas clean instead
  // of stretching old strokes into a distorted shape.
  function resizeBackingStore(cssW, cssH, modeChanged) {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const newW = Math.max(1, Math.round(cssW * dpr));
    const newH = Math.max(1, Math.round(cssH * dpr));

    if (canvas.width === newW && canvas.height === newH) {
      state.dpr = dpr;
      return;
    }

    let snapshot = null;
    if (!modeChanged && state.hasStroke && canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d').drawImage(canvas, 0, 0);
    } else if (modeChanged) {
      state.hasStroke = false;
    }

    canvas.width = newW;
    canvas.height = newH;
    state.dpr = dpr;

    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, newW, newH);
    }
  }

  /* ------------------------------------------------------------------
     POINTER → CANVAS COORDINATES
     ------------------------------------------------------------------ */

  function pointFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x = (evt.clientX - rect.left) * scaleX;
    let y = (evt.clientY - rect.top) * scaleY;
    x = Math.max(0, Math.min(canvas.width, x));
    y = Math.max(0, Math.min(canvas.height, y));
    return { x: x, y: y };
  }

  function brushWidthPx() {
    // Comfortable thickness that scales with the board's own size, not
    // the viewport - proportionally identical on desktop and mobile.
    const w = Math.max(canvas.width, 1);
    return Math.max(9, Math.min(30, w * 0.016)); // already in backing-store px
  }

  /* ------------------------------------------------------------------
     CHALK STROKE RENDERING
     Deliberately imperfect: several thin, jittered, semi-opaque passes
     plus a light dusting of tiny particles - reads as chalk, not as a
     clean digital marker line.
     ------------------------------------------------------------------ */

  function drawChalkSegment(x0, y0, x1, y1, color) {
    const width = brushWidthPx();
    const dist = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
    const steps = Math.max(1, Math.ceil(dist / (width * 0.35)));

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    for (let s = 0; s <= steps; s++) {
      const t0 = s / steps;
      const px = x0 + (x1 - x0) * t0;
      const py = y0 + (y1 - y0) * t0;

      // A handful of short, slightly offset overlapping strokes per dab
      // gives the stroke an irregular, grainy edge instead of one clean
      // outline.
      const passes = 3;
      for (let p = 0; p < passes; p++) {
        const jitter = (Math.random() - 0.5) * width * 0.22;
        const nx = -(y1 - y0) / dist;
        const ny = (x1 - x0) / dist;
        const ox = nx * jitter;
        const oy = ny * jitter;

        ctx.globalAlpha = 0.5 + Math.random() * 0.32;
        ctx.lineWidth = width * (0.62 + Math.random() * 0.4);
        ctx.beginPath();
        ctx.moveTo(x0 + ox, y0 + oy);
        ctx.lineTo(px + ox, py + oy);
        ctx.stroke();
      }

      // Occasional tiny grain specks / small gaps around the stroke.
      const specks = Math.random() < 0.7 ? 1 : 2;
      for (let g = 0; g < specks; g++) {
        if (Math.random() < 0.55) {
          const ang = Math.random() * Math.PI * 2;
          const r = (Math.random() * width) * 0.6;
          ctx.globalAlpha = 0.18 + Math.random() * 0.25;
          ctx.beginPath();
          ctx.arc(px + Math.cos(ang) * r, py + Math.sin(ang) * r, Math.max(0.6, width * 0.05 * Math.random()), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------
     ERASER — destination-out, soft round stamp. Only ever affects this
     transparent drawing canvas; the board PNG underneath is a separate
     element and is never touched.
     ------------------------------------------------------------------ */

  function eraseSegment(x0, y0, x1, y1) {
    const width = brushWidthPx() * 2.3;
    const dist = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
    const steps = Math.max(1, Math.ceil(dist / (width * 0.4)));

    ctx.globalCompositeOperation = 'destination-out';

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, width / 2);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.9)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------
     TOOL SELECTION
     ------------------------------------------------------------------ */

  function selectTool(tool) {
    state.activeTool = tool;
    document.querySelectorAll('.chb-tool').forEach(function (btn) {
      btn.classList.toggle('chb-tool-selected', btn.dataset.tool === tool);
    });
  }

  /* ------------------------------------------------------------------
     AUDIO — one looping instance per action, started only once real
     movement begins and stopped as soon as the gesture ends. Never more
     than one overlapping instance of either sound.
     ------------------------------------------------------------------ */

  const sound = {
    write: null,
    erase: null
  };

  function initAudio() {
    sound.write = new Audio('assets/ChalkWrite_BW.wav');
    sound.write.loop = true;
    sound.write.volume = 0.4;

    sound.erase = new Audio('assets/ChalkboardErase_BW.wav');
    sound.erase.loop = true;
    sound.erase.volume = 0.4;
  }

  function playSound(which) {
    const other = which === 'write' ? sound.erase : sound.write;
    const target = sound[which];
    if (!target) return;
    if (other && !other.paused) {
      other.pause();
    }
    if (target.paused) {
      target.currentTime = 0;
      target.play().catch(function () {
        // Autoplay can be blocked before any user gesture has reached
        // the page yet; harmless, the next gesture will succeed.
      });
    }
  }

  function stopSound(which) {
    const target = sound[which];
    if (target && !target.paused) target.pause();
  }

  function stopAllSounds() {
    stopSound('write');
    stopSound('erase');
  }

  /* ------------------------------------------------------------------
     DRAWING GESTURE
     ------------------------------------------------------------------ */

  function onPointerDown(evt) {
    evt.preventDefault();
    const p = pointFromEvent(evt);
    state.drawing = true;
    state.pointerId = evt.pointerId;
    state.lastX = p.x;
    state.lastY = p.y;
    try { canvas.setPointerCapture(evt.pointerId); } catch (e) { /* noop */ }
  }

  function onPointerMove(evt) {
    if (!state.drawing || evt.pointerId !== state.pointerId) return;
    evt.preventDefault();

    const p = pointFromEvent(evt);
    const moved = Math.hypot(p.x - state.lastX, p.y - state.lastY);
    if (moved < 0.4) return;

    const isEraser = state.activeTool === 'eraser';
    playSound(isEraser ? 'erase' : 'write');

    if (isEraser) {
      eraseSegment(state.lastX, state.lastY, p.x, p.y);
    } else {
      drawChalkSegment(state.lastX, state.lastY, p.x, p.y, CHALK_COLORS[state.activeTool] || CHALK_COLORS.white);
    }
    state.hasStroke = true;

    state.lastX = p.x;
    state.lastY = p.y;
  }

  function endStroke(evt) {
    if (evt && evt.pointerId !== state.pointerId) return;
    state.drawing = false;
    state.pointerId = null;
    stopAllSounds();
  }

  /* ------------------------------------------------------------------
     REINICIAR / TERMINAR
     ------------------------------------------------------------------ */

  function requestReset() {
    document.getElementById('chb-modal-reset').classList.add('chb-active');
  }

  function cancelReset() {
    document.getElementById('chb-modal-reset').classList.remove('chb-active');
  }

  function confirmReset() {
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    state.hasStroke = false;
    document.getElementById('chb-modal-reset').classList.remove('chb-active');
  }

  function finishDrawing() {
    stopAllSounds();
    document.getElementById('chb-modal-completion').classList.add('chb-active');
  }

  function keepDrawing() {
    document.getElementById('chb-modal-completion').classList.remove('chb-active');
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */

  function init() {
    stageEl = document.getElementById('chb-stage');
    canvas = document.getElementById('chb-draw-canvas');
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    els.boardDesktop = document.getElementById('chb-board-desktop');
    els.boardMobile = document.getElementById('chb-board-mobile');

    initAudio();

    document.querySelectorAll('.chb-tool').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectTool(btn.dataset.tool);
      });
    });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    canvas.addEventListener('pointerleave', function (evt) {
      // Only relevant when the browser did not honor pointer capture;
      // with capture in place this rarely fires mid-stroke, but it's a
      // safe fallback so a sound never gets stuck playing.
      if (evt.buttons === 0) endStroke(evt);
    });

    window.addEventListener('resize', applyLayout);
    window.addEventListener('orientationchange', applyLayout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    showIntro: showIntro,
    showInstructions: showInstructions,
    showBoard: showBoard,
    exitToWorkshopMenu: exitToWorkshopMenu,
    requestReset: requestReset,
    cancelReset: cancelReset,
    confirmReset: confirmReset,
    finishDrawing: finishDrawing,
    keepDrawing: keepDrawing
  };

})();
