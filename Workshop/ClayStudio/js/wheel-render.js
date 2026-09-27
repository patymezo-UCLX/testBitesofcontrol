/* ==========================================================================
   Clay Studio - wheel rotation illusion
   The wheel PNG itself never rotates (it's a perspective photo/render, so a
   literal CSS rotation would look wrong). Instead, a soft highlight sweeps
   across the top-disc's surface (approximated as an ellipse inset from the
   asset's own bounding box) on a transparent overlay canvas laid exactly
   over the wheel image. It travels left -> right -> fades out -> resets
   invisibly to the left, in lockstep with the clay's own highlight
   (clay-render.js), so both cues read as the same continuous rotation
   instead of ever appearing to reverse direction.
   ========================================================================== */

const WheelRenderer = (function () {
  let canvas = null;
  let ctx = null;
  let wheelImg = null;
  let stageEl = null;

  // Top-disc ellipse, estimated from the cropped pottery_wheel.png asset
  // (465x168), as a fraction of the image's own box.
  const ELLIPSE_CX = 0.5;
  const ELLIPSE_CY = 0.30;
  const ELLIPSE_RX = 0.40;
  const ELLIPSE_RY = 0.24;

  function init(imageEl, canvasEl, stage) {
    wheelImg = imageEl;
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    stageEl = stage;
  }

  function layout() {
    const rect = wheelImg.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const left = rect.left - stageRect.left;
    const top = rect.top - stageRect.top;

    // This canvas is also a child of the cover-scaled #cs-stage (see
    // clay-render.js's layout() for the full explanation) - divide the
    // visual/on-screen values by the stage's current display scale before
    // writing them to inline style, which lives in the stage's local
    // (pre-transform) coordinate space.
    const displayScale = stageRect.width / 1920;
    canvas.style.left = (left / displayScale) + 'px';
    canvas.style.top = (top / displayScale) + 'px';
    canvas.style.width = (rect.width / displayScale) + 'px';
    canvas.style.height = (rect.height / displayScale) + 'px';

    const dpr = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(rect.width * dpr));
    const bh = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    return { width: rect.width, height: rect.height, dpr };
  }

  // phase must be the SAME accumulating value passed to
  // ClayRenderer.renderFrame() so the two cues never drift out of sync.
  function renderFrame(phase) {
    if (!wheelImg || !wheelImg.complete) return;
    const L = layout();
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.width, L.height);

    const cx = L.width * ELLIPSE_CX;
    const cy = L.height * ELLIPSE_CY;
    const rx = L.width * ELLIPSE_RX;
    const ry = L.height * ELLIPSE_RY;

    const t = window.ClayRenderer ? ClayRenderer.sweepT(phase) : ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    const hx = cx - rx * 0.85 + t * (rx * 1.7);
    const hy = cy;
    const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 1.3);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, rx * 0.5);
    grad.addColorStop(0, `rgba(255,248,232,${0.22 * envelope})`);
    grad.addColorStop(1, 'rgba(255,248,232,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, L.width, L.height);
    ctx.restore();
  }

  return { init, renderFrame };
})();
