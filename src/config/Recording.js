/**
 * How the recorder samples and measures, before the user sets otherwise: how many takes a second a
 * started recording makes, and how many times each take measures the displayed wires.
 */
const Recording = Object.freeze({
  SAMPLE_RATE_HZ: 2,
  MEASUREMENT_SHOTS: 1024,
});

export { Recording };
