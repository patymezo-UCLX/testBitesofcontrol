/* ==========================================================================
   Clay Studio - bootstrap + screen navigation
   Mirrors Color Break's screen-toggling conventions (cs-screen / cs-active)
   and wires the clay model, renderer and interaction together. The canvas
   pipeline is only started once the studio screen becomes visible, since a
   hidden (display:none) stage has no real layout size yet.
   ========================================================================== */

const ClayStudio = (function () {
  let started = false;
  let rafId = null;
  let lastT = null;
  let phase = 0;

  // Clay and wheel share this single period so their rotation cues are
  // always perfectly in sync (same phase value drives both).
  const ROTATION_PERIOD_MS = 2000;

  function $(id) { return document.getElementById(id); }

  function showScreen(id) {
    document.querySelectorAll('.cs-screen').forEach(function (el) {
      el.classList.remove('cs-active');
    });
    $(id).classList.add('cs-active');
  }

  function showIntro() { showScreen('cs-screen-intro'); }
  function showInstructions() { showScreen('cs-screen-instructions'); }

  // Cover-scales the fixed 1920x1080 stage so it fills its full-viewport
  // frame with no empty margins, exactly like `background-size: cover`
  // would for a plain background image - everything inside the stage
  // (background, wheel, clay) keeps its exact calibrated relative position,
  // only the whole scene is scaled up/down and cropped at the edges.
  function fitStage() {
    const frame = $('cs-screen-studio') && $('cs-screen-studio').querySelector('.cs-stage-frame');
    const stage = $('cs-stage');
    if (!frame || !stage) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scale = Math.max(rect.width / 1920, rect.height / 1080);
    stage.style.setProperty('--cs-stage-scale', scale);
  }

  function showStudio() {
    showScreen('cs-screen-studio');
    ensureStarted();
    // The stage only has real dimensions once its screen is visible/laid
    // out, so (re)compute layout + redraw right after switching to it.
    requestAnimationFrame(function () {
      fitStage();
      ClayRenderer.renderBase(ClayModel);
    });
  }

  function exitToWorkshopMenu() {
    window.location.href = '../menu.html';
  }

  function ensureStarted() {
    if (started) return;
    started = true;

    const stage = $('cs-stage');
    const img = $('cs-clay-source');
    const canvas = $('cs-clay-canvas');
    const wheelImg = $('cs-wheel-image');
    const wheelHighlight = $('cs-wheel-highlight');

    ClayRenderer.init(img, canvas, stage);
    if (window.WheelRenderer) WheelRenderer.init(wheelImg, wheelHighlight, stage);

    function rerenderBase() {
      fitStage();
      ClayRenderer.renderBase(ClayModel);
    }

    function tick(t) {
      if (lastT === null) lastT = t;
      const dt = t - lastT;
      lastT = t;
      phase += (dt / ROTATION_PERIOD_MS) * Math.PI * 2;
      ClayRenderer.renderFrame(phase);
      if (window.WheelRenderer) WheelRenderer.renderFrame(phase);
      rafId = requestAnimationFrame(tick);
    }

    function boot() {
      rerenderBase();
      ClayInteraction.init(canvas, ClayModel, ClayRenderer, rerenderBase);
      window.addEventListener('resize', rerenderBase);
      rafId = requestAnimationFrame(tick);
    }

    if (img.complete && img.naturalWidth !== 0) {
      boot();
    } else {
      img.addEventListener('load', boot);
    }

    // Exposed for automated testing / debugging only.
    window.ClayModel = ClayModel;
    window.ClayRenderer = ClayRenderer;
    window.__csRerender = rerenderBase;
  }

  function resetClay() {
    ClayModel.reset();
    if (started) ClayRenderer.renderBase(ClayModel);
  }

  function finishPiece() {
    $('cs-modal-completion').classList.add('cs-active');
  }

  function keepMolding() {
    $('cs-modal-completion').classList.remove('cs-active');
  }

  function startOver() {
    $('cs-modal-completion').classList.remove('cs-active');
    resetClay();
  }

  return {
    showIntro: showIntro,
    showInstructions: showInstructions,
    showStudio: showStudio,
    exitToWorkshopMenu: exitToWorkshopMenu,
    resetClay: resetClay,
    finishPiece: finishPiece,
    keepMolding: keepMolding,
    startOver: startOver
  };
})();
