/* ==========================================================================
   BAKERY DELIVERY — DELIVERY CONFIG (Stage 1: driving feel)
   Every tunable driving value lives here. Nothing else should hardcode
   these numbers — change them here to rebalance the whole feel.
   ========================================================================== */

window.BakeryDelivery = window.BakeryDelivery || {};

BakeryDelivery.deliveryConfig = {

  // World scroll speed, in CSS pixels/second of the rendered background.
  // 160 (Stage 1) → 176 (+10%) → 202 (+15%) → 232 (this pass, +15% from 202).
  DELIVERY_WORLD_SPEED: 232,

  // Meli's ride-cycle frame rate (1 → 2 → 3 → 4 → repeat).
  MELI_RIDE_FPS: 8,

  // How long a lane change glide takes.
  LANE_CHANGE_DURATION: 300, // ms

  // Which lane Meli starts in. 0 = upper, 1 = lower.
  STARTING_LANE: 1,

  // Meli's horizontal anchor, as a fraction of the game container's width
  // from the left edge. Spec range: 15%–22% desktop, 20%–25% portrait
  // mobile (a touch narrower world needs her sitting a touch further in).
  MELI_X_RATIO: 0.18,
  MELI_X_RATIO_MOBILE: 0.225,

  // Subtle motorcycle lean during a lane change, in degrees.
  MELI_LEAN_DEGREES: 3,

  // Very small continuous idle bounce, layered on top of the sprite's own
  // (already-baked-in) frame-to-frame wobble.
  MELI_BOUNCE_PX: 1.5,
  MELI_BOUNCE_PERIOD_MS: 900,

  // Subtle scale difference between the back (upper) and front (lower)
  // lane, for a touch of depth. Kept deliberately close to 1.
  MELI_SCALE_UPPER: 0.95,
  MELI_SCALE_LOWER: 1.0,

  // Minimum vertical finger movement, in px, before a swipe counts as a
  // lane-change gesture (ignores taps/jitter/mostly-horizontal swipes).
  SWIPE_THRESHOLD_PX: 40,

  // On portrait/narrow viewports the full image height (sky included)
  // is disproportionate to a tall camera window — most of it ends up
  // being empty sky above a tiny road strip. This crops that excess
  // sky off the top before scaling, so the road/village stay properly
  // sized on-screen. 0 = show the full image (current desktop look,
  // unchanged); higher = zoom in more / crop more sky. Interpolated
  // between WORLD_CROP_WIDE_ASPECT (no crop) and WORLD_CROP_NARROW_ASPECT
  // (max crop) by the viewport's width/height ratio.
  WORLD_CROP_MAX: 0.32,
  WORLD_CROP_WIDE_ASPECT: 1.3,
  WORLD_CROP_NARROW_ASPECT: 0.75,

  // Shows lane anchors, Meli's ground anchor, her future hitbox, and a
  // small readout of current lane/world speed. Never true in the shipped
  // build. /* TEMPORARY DEBUG — REMOVE/DISABLE FOR FINAL */
  DELIVERY_DEBUG: false,

  // ------------------------------------------------------------------
  // OBSTACLES (Stage 2)
  // ------------------------------------------------------------------

  // Obstacles always spawn far enough right that the player has at
  // least this much time to react, regardless of viewport width — a
  // narrow portrait screen alone would otherwise give much less warning
  // than desktop for the same spawn-at-the-edge logic.
  OBSTACLE_MIN_REACTION_TIME_S: 3.5,

  // Gap between one obstacle's spawn and the next, randomized within
  // this range for a natural (not metronomic) rhythm. Was 2200–3400ms;
  // reduced ~27% (within the requested 25–30%) for a noticeably more
  // active road, while still leaving real breathing space.
  OBSTACLE_SPACING_MIN_MS: 1600,
  OBSTACLE_SPACING_MAX_MS: 2500,

  // Same subtle upper/lower depth scale used for Meli, applied to
  // obstacles too for visual consistency.
  OBSTACLE_SCALE_UPPER: 0.95,
  OBSTACLE_SCALE_LOWER: 1.0,

  // Collision response: a brief, mild consequence — never a hard fail.
  // The full sequence (jerk+bounce+tilt → wobble → settle) is driven by
  // these together; see deliveryMeli.js's triggerImpact().
  IMPACT_JERK_PX: 12,           // quick one-shot backward nudge (8–16 range)
  IMPACT_BOUNCE_PX: 6,          // quick one-shot vertical dip (4–8 range)
  IMPACT_TILT_DEG: 7.5,         // peak tilt on first swing (6–9 range)
  IMPACT_PULSE_DURATION_MS: 260,   // duration of the one-shot jerk/bounce
  IMPACT_TOTAL_DURATION_MS: 900,   // full impact→wobble→settle window
  IMPACT_TILT_CYCLES: 2.5,         // wobble oscillations across that window

  COLLISION_SLOWDOWN_MULTIPLIER: 0.55,
  COLLISION_SLOWDOWN_RECOVER_MS: 800,

  // Brief global cooldown after ANY collision, separate from each
  // obstacle's own permanent alreadyHit flag — just enough to stop two
  // impacts landing in the same frame/two from stacking animations.
  GLOBAL_COLLISION_COOLDOWN_MS: 400,

  // ------------------------------------------------------------------
  // ANXI OBSTACLES (this pass)
  // Obs 2/3 — a different gameplay TYPE from the physical obstacles.
  // Colliding with one never uses the physical crash feedback; see
  // triggerAnxiEncounter() in deliveryObstacles.js.
  // ------------------------------------------------------------------

  ANXI_ENCOUNTER_PAUSE_MS: 500, // brief automatic slow/pause — the ONLY
                                 // window where the Delivery timer pauses
  ANXI_ENCOUNTER_LABEL_MS: 700, // how long the temporary "ANXI" indicator shows

  // ------------------------------------------------------------------
  // DELIVERY TIMER (this pass)
  // One global countdown across all 5 houses — see deliveryTimer.js.
  // TEST VALUE — subject to change after playing the full route with
  // the new speed/density; report before silently adjusting.
  // ------------------------------------------------------------------
  DELIVERY_TIME_LIMIT: 120,

  // ------------------------------------------------------------------
  // DESTINATIONS (Stage 3)
  // ------------------------------------------------------------------

  // Distance (world px) driven per segment before reaching each house.
  // Deliberately uneven — short/medium/medium/medium-long/long — not
  // identical, so the route doesn't feel metronomic. Route 1 bumped
  // 1800→2400: at the old value it was shorter than the clear-approach
  // cutoff below, so obstacles (and now Anxi) could never actually spawn
  // on it — a latent bug this pass's Anxi requirement ("Route 1 can have
  // 1 Anxi encounter") exposed. Still clearly the shortest route.
  DELIVERY_ROUTES: [
    { house: 'assets/casa-1.png', distance: 2400 },
    { house: 'assets/casa-2.png', distance: 2800 },
    { house: 'assets/casa-3.png', distance: 2900 },
    { house: 'assets/casa-4.png', distance: 3600 },
    { house: 'assets/casa-5.png', distance: 4400 }
  ],

  // How far (world px) before the segment's total distance the house
  // starts entering from the right, still at full driving speed. Was
  // 1400 — trimmed to 1100 (alongside CLEAR_APPROACH_EXTRA below) so
  // even the shortest route has a real obstacle-spawning window before
  // the clear-approach zone begins.
  HOUSE_SPAWN_LEAD_DISTANCE: 1100,

  // Extra px BEFORE that lead point where obstacle spawning already
  // stopped — gives the last obstacle time to clear before the house
  // is even visible, per the "clean arrival" requirement. Was 500.
  CLEAR_APPROACH_EXTRA: 400,

  // Once the approaching house is within this many px of its target
  // stop position, deceleration begins (world.setSpeedTarget(0, …)).
  ARRIVAL_DECEL_LEAD_PX: 150,
  ARRIVAL_DECEL_DURATION_MS: 1400,

  // Where the house "stands" — a grass/bush band above the road, never
  // inside the driving lanes. This is a fraction of the FULL source
  // image (like IMAGE_LANE_Y_FRACTION in deliveryWorld.js), re-derived
  // for the current crop each layout pass so it stays correct on
  // portrait/cropped viewports too — a flat container-relative fraction
  // would land in the wrong place once cropping shifts the visible
  // window.
  HOUSE_IMAGE_Y_FRACTION: 0.70,
  HOUSE_GROUND_ANCHOR_RATIO: 0.945, // measured from the supplied casa PNGs

  DELIVERY_MARKER_BOB_PX: 5,
  DELIVERY_MARKER_BOB_PERIOD_MS: 1200,

  DELIVERY_MICRO_ANIM_MS: 700,
  DELIVERY_CONFIRM_MS: 1000,
  NEXT_ROUTE_TRANSITION_MS: 600
};
