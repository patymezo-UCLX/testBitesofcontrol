/* ==========================================================================
   BAKERY DELIVERY — CONFIG
   Single source of truth for values likely to be balanced/tuned later.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.config = {
  // The global packing countdown, in seconds. Initial test value — change
  // this ONE number to rebalance the whole 5-order attempt.
  PACKING_TIME_LIMIT: 120
};
