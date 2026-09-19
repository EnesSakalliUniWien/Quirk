/** Redraw timing and detail limits for circuit rendering. */
const Rendering = Object.freeze({
  // Rate-limit redraws; long draws pad this limit.
  REDRAW_COOLDOWN_MILLIS: 10,
  // While the circuit's cell keeps resizing, its canvas grows by this many CSS pixels at a time
  // instead of being reallocated at every size, and is fitted exactly once the size has held still
  // this long.
  RESIZE_SLACK_PIXELS: 256,
  RESIZE_SETTLE_MILLIS: 150,
  MATRIX_DETAIL_MAX_QUBITS: 5,
});

export { Rendering };
