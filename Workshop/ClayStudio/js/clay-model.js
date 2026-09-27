/* ==========================================================================
   Clay Studio - clay model
   Holds the deformable geometry state: a per-row width profile (one scale
   factor per source-image row) plus a single overall height scale.
   No rendering or DOM here - pure state + mutation.
   ========================================================================== */

const ClayModel = (function () {
  const SLICES = 268; // 1:1 with the cropped clay source image's pixel rows

  const WIDTH_MIN = 0.60;
  const WIDTH_MAX = 1.65;
  const HEIGHT_MIN = 0.85;
  const HEIGHT_MAX = 1.15;

  function makeDefaultProfile() {
    return new Array(SLICES).fill(1.0);
  }

  const state = {
    widthProfile: makeDefaultProfile(),
    heightScale: 1.0
  };

  function reset() {
    state.widthProfile = makeDefaultProfile();
    state.heightScale = 1.0;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  // Smooth (cosine) local falloff: 1 at distance 0, eases down to 0 at
  // distance = radiusRows. Never negative, never extends past the radius,
  // so a single drag only ever affects a local neighbourhood of rows.
  function falloffWeight(distanceRows, radiusRows) {
    if (distanceRows >= radiusRows) return 0;
    const t = distanceRows / radiusRows;
    return 0.5 * (1 + Math.cos(Math.PI * t));
  }

  const LIMIT_EPS = 1e-9;

  // The PRIMARY slice (the one directly under the pointer) gates the whole
  // step. If it is already at the limit in the requested direction, the
  // entire deformation step is cancelled before touching anything else -
  // neighbors are not modified, no falloff is computed, nothing is stored.
  // Only when the primary slice can still move does the step proceed, and
  // each neighbor is then clamped to its OWN limit independently (a neighbor
  // reaching its own limit does not cancel or affect other rows either).
  // This is what keeps a capped region's shoulder from creeping outward
  // into a wider and wider cylindrical section on continued dragging.
  function applyWidthDelta(touchRow, deltaScale, radiusRows) {
    if (deltaScale === 0) return;
    const wp = state.widthProfile;
    const primary = wp[touchRow];
    if (deltaScale > 0 && primary >= WIDTH_MAX - LIMIT_EPS) return;
    if (deltaScale < 0 && primary <= WIDTH_MIN + LIMIT_EPS) return;

    for (let r = 0; r < SLICES; r++) {
      const d = Math.abs(r - touchRow);
      const w = falloffWeight(d, radiusRows);
      if (w <= 0) continue;
      wp[r] = clamp(wp[r] + deltaScale * w, WIDTH_MIN, WIDTH_MAX);
    }
  }

  function applyHeightDelta(deltaScale) {
    if (deltaScale === 0) return;
    const h = state.heightScale;
    if (deltaScale > 0 && h >= HEIGHT_MAX - LIMIT_EPS) return;
    if (deltaScale < 0 && h <= HEIGHT_MIN + LIMIT_EPS) return;
    state.heightScale = clamp(h + deltaScale, HEIGHT_MIN, HEIGHT_MAX);
  }

  // IMPORTANT: there is deliberately no passive/whole-profile smoothing here.
  // An earlier version ran a full-array 3-tap blur once per drag gesture
  // (on pointer-up). That looked harmless in isolation, but a real molding
  // session is many gestures, and repeated whole-array averaging is a
  // diffusion process: applied over and over it slowly erodes any sharp
  // width contrast and drags the entire silhouette back toward a flat,
  // cylindrical profile - exactly the "shape keeps normalizing" bug this
  // must never reintroduce. The per-row hard clamp in applyWidthDelta/
  // applyHeightDelta below is the only thing allowed to change state, and
  // only for the row(s) actually under the pointer during an active drag.
  // When the player isn't dragging, the profile must not change at all.

  return {
    SLICES, WIDTH_MIN, WIDTH_MAX, HEIGHT_MIN, HEIGHT_MAX,
    state, reset, applyWidthDelta, applyHeightDelta, falloffWeight
  };
})();
