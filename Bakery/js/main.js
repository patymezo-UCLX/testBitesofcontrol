/* ==========================================================================
   BAKERY DELIVERY — MAIN
   Entry point. Preloads assets, then initializes each module and shows the
   intro screen. Nothing outside #bd-root is touched.
   ========================================================================== */

(function () {
  function boot() {
    const BD = window.BakeryDelivery;

    // Initialize modules. gameplay.init() also initializes catcher,
    // fallingObjects, panelUI, timerSystem, anxiSystem and reviewSystem
    // internally (they're tightly coupled to the gameplay screen's DOM);
    // calling anxiSystem/reviewSystem here too is harmless (idempotent
    // DOM lookups) and keeps every module visibly initialized from one
    // place.
    BD.intro.init();
    BD.orderUI.init();
    BD.gameplay.init();
    BD.anxiSystem.init();
    BD.reviewSystem.init();
    BD.retrySystem.init();
    BD.deliverySystem.init();
    BD.deliveryGameplay.init();
    BD.completion.init(); // Stage 4+ placeholder, still a no-op
    BD.exitControl.init();
    BD.soundToggle.init();

    const loadingEl = document.getElementById('bd-loading');

    BD.preloadImages(BD.assets.getAllUrls()).then(() => {
      loadingEl.classList.add('bd-hidden');
      BD.intro.show();
      BD.devMode.init(); // TEMPORARY DEVELOPMENT TOOL — DISABLE FOR FINAL GAME
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
