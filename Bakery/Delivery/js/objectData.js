/* ==========================================================================
   BAKERY DELIVERY — OBJECT CATALOG
   Centralized metadata for every catchable/falling object: which category
   it belongs to (bakery vs distractor) and which subtle fall behavior it
   uses. Keeping this separate from the spawn/fall logic makes it easy to
   extend in later stages.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.objectCatalog = {
  'object-1': { category: 'bakery',     fallStyle: 'gentleTilt' },   // chocolate cake slice
  'object-2': { category: 'bakery',     fallStyle: 'sideDrift' },    // chocolate cupcake
  'object-3': { category: 'bakery',     fallStyle: 'gentleRotate' }, // two cookies
  'object-4': { category: 'bakery',     fallStyle: 'gentleTilt' },   // cake slice
  'object-5': { category: 'bakery',     fallStyle: 'sideDrift' },    // vanilla/pink cupcake
  'object-6': { category: 'bakery',     fallStyle: 'moreRotate' },   // pink donut

  'object-7': { category: 'distractor', fallStyle: 'slowRotate' },   // sock
  'object-8': { category: 'distractor', fallStyle: 'moreRotate' },   // spoon
  'object-9': { category: 'distractor', fallStyle: 'smallWobble' },  // broccoli
  'object-10': { category: 'distractor', fallStyle: 'gentleRock' }   // apple with worm
};

BakeryDelivery.getObjectSrc = function (id) {
  return `assets/${id}.png`;
};
