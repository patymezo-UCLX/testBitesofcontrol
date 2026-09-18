/* ==========================================================================
   BAKERY DELIVERY — CONFIG
   Single source of truth for values likely to be balanced/tuned later.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.config = {
  // The global packing countdown, in seconds. Initial test value — change
  // this ONE number to rebalance the whole attempt.
  PACKING_TIME_LIMIT: 120,

  // Lives the player starts each Packing attempt with. A wrong catch
  // costs exactly one; reaching 0 ends the attempt (separate failure
  // condition from the timer reaching 0).
  PACKING_LIVES_START: 4,

  // Spawn interval range, randomized within it each time — tightened
  // from the original 900–1300ms so ~3–4 objects are typically active
  // on screen at once (fall duration is unchanged, so this is purely a
  // density change, not a speed change).
  PACKING_SPAWN_MIN_MS: 650,
  PACKING_SPAWN_MAX_MS: 950
};
