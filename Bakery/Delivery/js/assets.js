/* ==========================================================================
   BAKERY DELIVERY — ASSETS / PRELOAD REGISTRY
   All supplied FINAL artwork paths live here in one place. Nothing else in
   this module should hardcode an image path — reference this registry so
   integration into the main project later only requires editing this file.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.assets = {

  backgrounds: {
    desktop: 'assets/BCK-1.png',
    mobile: 'assets/BCK-mobile.png'
  },

  logo: 'assets/Name-BD.png',

  note: 'assets/Note.png',

  boxes: {
    open: 'assets/boxopen-1.png',
    closed: 'assets/boxclose-2.png'
  },

  // Valid bakery products
  products: {
    chocolateCakeSlice: 'assets/object-1.png',
    chocolateCupcake:   'assets/object-2.png',
    twoCookies:         'assets/object-3.png',
    cakeSlice:          'assets/object-4.png',
    vanillaCupcake:     'assets/object-5.png',
    pinkDonut:          'assets/object-6.png'
  },

  // Distractor / unwanted objects
  distractors: {
    sock:            'assets/object-7.png',
    spoon:           'assets/object-8.png',
    broccoli:        'assets/object-9.png',
    appleWithWorm:   'assets/object-10.png'
  },

  // Anxi worried poses — preloaded and organized now; the full interaction
  // system (Stage 2+) will decide when/how each pose is shown.
  anxi: [
    'assets/anxi-worried-1.png',
    'assets/anxi-worried-2.png',
    'assets/anxi-worried-3.png',
    'assets/anxi-worried-4.png'
  ],

  // Delivery section assets. Only meli/deliveryBackground/sun/obstacles-
  // 1-4-5 are actually used by Delivery Stage 0 (the transition +
  // instructions); the rest are preloaded now, organized for Delivery
  // Stage 1+, so there's no future pop-in when that gameplay lands.
  deliveryBackground: 'assets/fondo-parallax.png',
  sun: 'assets/sol.png',

  meli: [
    'assets/meli-side-1.png',
    'assets/meli-side-2.png',
    'assets/meli-side-3.png',
    'assets/meli-side-4.png'
  ],

  obstacles: [
    'assets/obs-1.png',
    'assets/obs-2.png',
    'assets/obs-3.png',
    'assets/obs-4.png',
    'assets/obs-5.png'
  ],

  houses: [
    'assets/casa-1.png',
    'assets/casa-2.png',
    'assets/casa-3.png',
    'assets/casa-4.png',
    'assets/casa-5.png'
  ],

  deliveryMarks: {
    check: 'assets/check1.png',
    uncheck: 'assets/uncheck1.png'
  }
};

/**
 * Flattens the registry above into a single array of URLs for preloading.
 */
BakeryDelivery.assets.getAllUrls = function () {
  const a = BakeryDelivery.assets;
  return [
    a.backgrounds.desktop,
    a.backgrounds.mobile,
    a.logo,
    a.note,
    a.boxes.open,
    a.boxes.closed,
    ...Object.values(a.products),
    ...Object.values(a.distractors),
    ...a.anxi,
    a.deliveryBackground,
    a.sun,
    ...a.meli,
    ...a.obstacles,
    ...a.houses,
    ...Object.values(a.deliveryMarks)
  ];
};
