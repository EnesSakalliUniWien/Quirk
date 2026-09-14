/** Redraw timing and detail limits for circuit rendering. */
const Rendering = Object.freeze({
    // Rate-limit redraws; long draws pad this limit.
    REDRAW_COOLDOWN_MILLIS: 10,
    SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD: 14,
});

export {Rendering};
