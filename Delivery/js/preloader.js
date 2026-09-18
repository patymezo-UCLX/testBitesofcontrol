/* ==========================================================================
   BAKERY DELIVERY — PRELOADER
   Loads every supplied asset before the intro screen is shown, to avoid
   pop-in / layout shift. Intentionally minimal loading UI per the brief.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

/**
 * @param {string[]} urls
 * @returns {Promise<void>} resolves once every image has loaded (or failed —
 *          a Stage 1 module should not hang forever on one bad path).
 */
BakeryDelivery.preloadImages = function (urls) {
  const loadOne = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => {
      console.warn('[BakeryDelivery] Failed to preload asset:', src);
      resolve();
    };
    img.src = src;
  });

  return Promise.all(urls.map(loadOne));
};
