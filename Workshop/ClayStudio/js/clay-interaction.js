/* ==========================================================================
   Clay Studio - pointer interaction
   Unified mouse/touch molding via Pointer Events. A drag only "grabs" the
   clay when it starts on a non-transparent canvas pixel (i.e. directly on
   the clay silhouette, not the surrounding transparent buffer area).
   Mostly-horizontal movement molds width locally (falloff around the
   touched row); mostly-vertical movement adjusts overall height, with much
   lower sensitivity so it takes deliberate dragging to change it.
   ========================================================================== */

const ClayInteraction = (function () {
  let canvas, model, renderer, onChange;
  let dragging = false;
  let lastX = 0, lastY = 0;
  let touchRow = 0;

  const WIDTH_SENSITIVITY = 0.0014;
  const WIDTH_MAX_STEP = 0.010;
  const FALLOFF_RADIUS_ROWS = 62;

  const HEIGHT_SENSITIVITY = 0.00035;
  const HEIGHT_MAX_STEP = 0.004;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  }

  function sampleAlpha(xCss, yCss) {
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(xCss * dpr);
    const py = Math.round(yCss * dpr);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return 0;
    try {
      return ctx2d().getImageData(px, py, 1, 1).data[3];
    } catch (err) {
      return 255; // e.g. tainted canvas in some local-file contexts - assume hit
    }
  }

  function ctx2d() { return canvas.getContext('2d'); }

  function rowFromY(yCss) {
    const L = renderer.layout();
    const actualHeightPx = L.baseHeightPx * model.state.heightScale;
    const topOfClay = L.canvasHeightPx - actualHeightPx;
    const rel = (yCss - topOfClay) / actualHeightPx;
    const row = Math.round(rel * (model.SLICES - 1));
    return Math.max(0, Math.min(model.SLICES - 1, row));
  }

  function onPointerDown(e) {
    const p = pointFromEvent(e);
    if (sampleAlpha(p.x, p.y) < 10) return;
    dragging = true;
    lastX = p.x;
    lastY = p.y;
    touchRow = rowFromY(p.y);
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    lastX = p.x;
    lastY = p.y;

    if (dx === 0 && dy === 0) return;

    const cx = p.rect.width / 2;
    const side = (p.x - cx) >= 0 ? 1 : -1;
    const outward = side * dx;

    if (Math.abs(dy) > Math.abs(dx)) {
      // deliberate vertical drag: upward = grow, downward = compress
      const heightDelta = clamp(-dy * HEIGHT_SENSITIVITY, -HEIGHT_MAX_STEP, HEIGHT_MAX_STEP);
      model.applyHeightDelta(heightDelta);
    } else {
      const widthDelta = clamp(outward * WIDTH_SENSITIVITY, -WIDTH_MAX_STEP, WIDTH_MAX_STEP);
      model.applyWidthDelta(touchRow, widthDelta, FALLOFF_RADIUS_ROWS);
    }

    if (onChange) onChange();
  }

  function onPointerUp() {
    // No post-gesture smoothing/normalization: the shape the player left
    // must stay exactly as it is until they deform it again.
    dragging = false;
  }

  function init(canvasEl, modelRef, rendererRef, changeCb) {
    canvas = canvasEl;
    model = modelRef;
    renderer = rendererRef;
    onChange = changeCb;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
  }

  return { init };
})();
