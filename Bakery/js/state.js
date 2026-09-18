/* ==========================================================================
   BAKERY DELIVERY — STATE
   A single, simple state object. Fields marked "reserved" aren't written
   to by the current stage yet but keep the shape stable for what's next.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.state = {
  screen: 'loading',        // 'loading' | 'intro' | 'gameplay'

  // High-level phase, separate from individual Packing order state.
  // 'packing' | 'packingComplete' | 'deliveryInstructions' | 'delivery' | 'deliveryComplete'
  phase: 'packing',

  currentOrder: 0,          // 0-based index of the active order
  totalOrders: 4,
  completedOrders: 0,

  lives: 4,                 // reset from BakeryDelivery.config.PACKING_LIVES_START each attempt
  failureReason: null,      // 'timeout' | 'noLives' — which panel copy to show

  requiredItems: [],        // [{ id, collected }] for the active order
  collectedItems: [],       // ids actually caught so far, in catch order

  // Global 2:00 countdown — belongs to the whole packing phase, not any
  // single order. See timerSystem.js for the actual clock logic.
  timeLimit: 120,
  timeRemaining: 120,
  timerRunning: false,

  isPlaying: false,         // true while an order's spawn/fall loop is live
  isSpawning: false,        // true while new objects are still being spawned
  isPaused: false,          // true while Anxi has paused an active order

  isAnxiActive: false,
  currentAnxiDialogue: null,
  currentAnxiPose: null,
  anxiInterventionsThisOrder: 0,
  anxiInterventions: 0,     // total across the whole attempt (pose/dialogue rotation)

  reviewCount: 0,           // per-order; NOT a hard limit, just a counter
  isReviewOpen: false,

  hasTimedOut: false,
  packingComplete: false
};

/**
 * Small helper so other modules don't reach into the object directly for
 * the one transition that matters in Stage 1 (screen switching).
 */
BakeryDelivery.setScreen = function (screenName) {
  BakeryDelivery.state.screen = screenName;
};
