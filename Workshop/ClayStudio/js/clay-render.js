/* ==========================================================================
   Clay Studio - clay renderer
   Draws the clay as many thin horizontal slices of the source PNG onto a
   canvas. At rest (all widthProfile = 1, heightScale = 1) this reconstructs
   the original image essentially indistinguishably - the source pixels are
   never repainted or procedurally recreated, only repositioned/rescaled.
   ========================================================================== */

const ClayRenderer = (function () {
  let img = null;
  let canvas = null;
  let ctx = null;
  let stageEl = null;
  let baseCanvas = null;
  let baseCtx = null;
  let lastLayout = null;

  // Cropped clay source asset dimensions (tight content bounding box).
  const SRC_W = 119;
  const SRC_H = 268;

  // Geometry measured against the approved reference composite (Phase 1),
  // expressed as fractions of the stage so the whole scene scales together.
  const WIDTH_BASE_FRAC = 0.125;     // base (100%) clay width / stage width
  const WIDTH_BUFFER = 1.85;         // canvas box width vs base width, headroom for max bulge
  const HEIGHT_BUFFER = 1.20;        // canvas box height vs base height, headroom for max height
  const BOTTOM_FRAC = 0.10185;       // fixed bottom anchor / stage height (moved ~10px lower at 1080p so the clay reads as centered on the wheel's top surface, not toward its back edge)
  const CENTER_X_FRAC = 0.50781;     // fixed horizontal center / stage width

  function init(imageEl, canvasEl, stage) {
    img = imageEl;
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    stageEl = stage;
    baseCanvas = document.createElement('canvas');
    baseCtx = baseCanvas.getContext('2d');
  }

  // Computes the canvas element's on-screen box (CSS px) from the stage's
  // current rendered size, and syncs the canvas backing store to match.
  function layout() {
    const stageRect = stageEl.getBoundingClientRect();
    const baseWidthPx = stageRect.width * WIDTH_BASE_FRAC;
    const baseHeightPx = baseWidthPx * (SRC_H / SRC_W);

    const canvasWidthPx = baseWidthPx * WIDTH_BUFFER;
    const canvasHeightPx = baseHeightPx * HEIGHT_BUFFER;

    const centerXPx = stageRect.width * CENTER_X_FRAC;
    const bottomPx = stageRect.height * BOTTOM_FRAC;
    const leftPx = centerXPx - canvasWidthPx / 2;

    // The canvas is a child of #cs-stage, which is cover-scaled via a CSS
    // transform (see fitStage() in clay-studio.js) - anything we assign to
    // its inline style gets visually scaled a second time by that ancestor
    // transform, so style values are expressed here in the stage's own
    // *local* (pre-transform, 1920x1080) units while every other value in
    // this function stays in visual/on-screen px.
    const displayScale = stageRect.width / 1920;
    canvas.style.width = (canvasWidthPx / displayScale) + 'px';
    canvas.style.height = (canvasHeightPx / displayScale) + 'px';
    canvas.style.left = (leftPx / displayScale) + 'px';
    canvas.style.bottom = (bottomPx / displayScale) + 'px';

    const dpr = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(canvasWidthPx * dpr));
    const bh = Math.max(1, Math.round(canvasHeightPx * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }

    return { baseWidthPx, baseHeightPx, canvasWidthPx, canvasHeightPx, dpr };
  }

  // Expensive pass: redraws all slices into an offscreen buffer. Called only
  // when the model changes (drag) or the layout resizes - never per animation
  // frame, so the continuous rotation illusion (renderFrame) stays cheap.
  function renderBase(model) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const L = layout();
    lastLayout = L;

    const bw = canvas.width, bh = canvas.height;
    if (baseCanvas.width !== bw || baseCanvas.height !== bh) {
      baseCanvas.width = bw;
      baseCanvas.height = bh;
    }
    baseCtx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    baseCtx.clearRect(0, 0, L.canvasWidthPx, L.canvasHeightPx);

    const actualHeightPx = L.baseHeightPx * model.state.heightScale;
    const destSliceH = actualHeightPx / SRC_H;
    const canvasCenterX = L.canvasWidthPx / 2;
    const topOfClay = L.canvasHeightPx - actualHeightPx; // bottom stays fixed at canvas bottom

    const wp = model.state.widthProfile;

    // Extremely subtle contact shadow, drawn once underneath the slices so
    // it only ever peeks out slightly past the clay's own base - just enough
    // to read as physically touching the wheel, never a large drop shadow.
    const bottomDestW = L.baseWidthPx * wp[SRC_H - 1];
    const shadowW = bottomDestW * 1.4;
    const shadowH = Math.max(6, destSliceH * 2.2);
    const shadowCy = L.canvasHeightPx - shadowH * 0.35;
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.ellipse(canvasCenterX, shadowCy, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
    const shadowGrad = baseCtx.createRadialGradient(canvasCenterX, shadowCy, 0, canvasCenterX, shadowCy, shadowW / 2);
    shadowGrad.addColorStop(0, 'rgba(40,20,12,0.20)');
    shadowGrad.addColorStop(1, 'rgba(40,20,12,0)');
    baseCtx.fillStyle = shadowGrad;
    baseCtx.fill();
    baseCtx.restore();

    for (let r = 0; r < SRC_H; r++) {
      const destW = L.baseWidthPx * wp[r];
      const destX = canvasCenterX - destW / 2;
      const destY = topOfClay + r * destSliceH;
      const dh = destSliceH + 0.75; // slight overlap so adjacent slices never leave a seam
      baseCtx.drawImage(img, 0, r, SRC_W, 1, destX, destY, destW, dh);
    }

    renderFrame(0);
  }

  // Turns a continuously-increasing phase into a one-directional 0..1
  // sawtooth: it always counts up, then snaps back to 0 instantly (never
  // decreases in between), so anything driven by it only ever travels one
  // way. Shared (by convention, not by reference) with wheel-render.js so
  // both rotation cues stay in lockstep.
  function sweepT(phase) {
    const t = (phase / (Math.PI * 2)) % 1;
    return t < 0 ? t + 1 : t;
  }

  // Cheap pass: copies the pre-rendered clay bitmap to the visible canvas,
  // then composites a soft moving highlight ("source-atop" so it only
  // tints pixels that are already part of the clay silhouette) to suggest
  // continuous rotation without ever rotating the silhouette itself. The
  // highlight always travels left -> right -> fades out -> resets invisibly
  // to the left; it never appears to move backward.
  function renderFrame(phase) {
    if (!lastLayout) return;
    const L = lastLayout;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseCanvas, 0, 0);

    ctx.save();
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

    const t = sweepT(phase);
    // Travel a little past both edges so the highlight is already fading
    // in/out (via the envelope below) before it reaches the visible silhouette.
    const travel = L.canvasWidthPx * 1.3;
    const sweepX = -L.canvasWidthPx * 0.15 + t * travel;
    // Zero at t=0 and t=1, smooth hump in between - the fade is what makes
    // the instant reset from t=1 back to t=0 invisible to the player.
    const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 1.3);
    const peakAlpha = 0.16 * envelope;

    const grad = ctx.createLinearGradient(sweepX - L.baseWidthPx * 0.6, 0, sweepX + L.baseWidthPx * 0.6, 0);
    grad.addColorStop(0, 'rgba(255,236,214,0)');
    grad.addColorStop(0.5, `rgba(255,246,232,${peakAlpha})`);
    grad.addColorStop(1, 'rgba(255,236,214,0)');

    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, L.canvasWidthPx, L.canvasHeightPx);
    ctx.restore();
  }

  return {
    init, renderBase, renderFrame, layout, sweepT,
    SRC_W, SRC_H, CENTER_X_FRAC, BOTTOM_FRAC, WIDTH_BASE_FRAC
  };
})();
