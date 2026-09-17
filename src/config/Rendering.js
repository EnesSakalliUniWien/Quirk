/** Redraw timing and detail limits for circuit rendering. */
const Rendering = Object.freeze({
  // Rate-limit redraws; long draws pad this limit.
  REDRAW_COOLDOWN_MILLIS: 10,
  MATRIX_DETAIL_MAX_QUBITS: 5,
});

export { Rendering };
