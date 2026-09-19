/** Ease in, then out: a glide starts and lands gently. @param {number} t in [0, 1] */
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * How everything that moves on screen moves: one entry for each animation, so its pace and its
 * curve are defined here and nowhere else.
 */
const Animation = Object.freeze({
  // The cycle of the time-dependent gates: how long t takes from 0 to 1 while the circuit runs on
  // its own.
  CYCLE_DURATION_MS: 8000,
  // While the circuit is debugged the cycle stands still, and one playhead step moves it this far,
  // as a fraction of the cycle.
  DEBUG_STEP_CYCLE_INCREMENT: 1 / 32,
  // How long Play rests on each operation.
  PLAYHEAD_STEP_DURATION_MS: 600,
  // The Bloch analyzer's arrow gliding to another state - a preset, another step - and its curve.
  GLIDE_DURATION_MS: 300,
  GLIDE_EASING: easeInOut,
  // Panels follow the simulation no faster than this, however fast the canvas redraws.
  PANEL_SAMPLE_COOLDOWN_MS: 100,
});

export { Animation, easeInOut };
