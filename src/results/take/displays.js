import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { decode } from "./values.js";

const SAMPLE_TOLERANCE = 1e-6;
const isMatrix = (value, width, height) =>
  value instanceof Matrix && value.width() === width && value.height() === height;

function validateDisplay(gate, data) {
  const id = gate.serializedId;
  const size = 2 ** gate.height;
  if (/^(Sample|Chance)\d+$/.test(id)) {
    if (!isMatrix(data, 1, size)) throw new Error("Invalid probability display");
    return /^Sample\d+$/.test(id) ? data : undefined;
  }
  if (/^Density\d+$/.test(id)) {
    if (!isMatrix(data, size, size)) throw new Error("Invalid density display");
    return undefined;
  }
  if (/^Amps\d+$/.test(id)) {
    // Match processOutputs and AmplitudeView, including the 2-by-1 single-qubit case.
    const width = gate.height === 1 ? 2 : 2 ** Math.floor(gate.height / 2);
    const height = size / width;
    if (!data || typeof data.quality !== "number" ||
        !isMatrix(data.ket, width, height) ||
        !isMatrix(data.incoherentKet, width, height) ||
        (data.phaseLockIndex !== undefined &&
          (!Number.isInteger(data.phaseLockIndex) ||
           data.phaseLockIndex < 0 || data.phaseLockIndex >= size))) {
      throw new Error("Invalid amplitude display");
    }
    return undefined;
  }
  if (/^[XYZ](Detector|DetectControlReset)$/.test(id)) {
    if (typeof data !== "boolean") throw new Error("Invalid detector outcome");
    return undefined;
  }
  throw new Error("Unsupported display result");
}

function validateSamples(samples, distributions) {
  for (const [key, data] of distributions) {
    if (!data.hasNaN() && !Object.hasOwn(samples, key)) {
      throw new Error(`Missing Sample outcome at ${key}`);
    }
  }
  for (const [key, sample] of Object.entries(samples)) {
    const data = distributions.get(key);
    if (data === undefined || data.hasNaN() || sample.i >= data.height()) {
      throw new Error(`Invalid Sample outcome at ${key}`);
    }
    const probability = data.rawBuffer()[sample.i * 2];
    if (!Number.isFinite(probability) ||
        Math.abs(sample.p - probability) > SAMPLE_TOLERANCE) {
      throw new Error(`Sample probability does not match its distribution at ${key}`);
    }
  }
}

function validateDisplays(stored, circuit, step) {
  const expected = new Set();
  if (stored.available) {
    for (let col = 0; col < step; col++) {
      for (const row of circuit.customStatRowsInCol(col)) expected.add(`${col}:${row}`);
    }
  }
  const seen = new Set();
  const distributions = new Map();
  for (const [key, encoded] of stored.custom) {
    // Require exact membership: this rejects disabled gates and noncanonical key spellings.
    if (!expected.has(key)) throw new Error(`Invalid display location at ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate display location at ${key}`);
    seen.add(key);
    const [col, row] = key.split(":").map(Number);
    let distribution;
    try {
      distribution = validateDisplay(circuit.gateInSlot(col, row), decode(encoded));
    } catch (cause) {
      throw new Error(`Invalid display at ${key}: ${cause.message}`, { cause });
    }
    if (distribution !== undefined) distributions.set(key, distribution);
  }
  for (const key of expected) {
    if (!seen.has(key)) {
      const [col, row] = key.split(":").map(Number);
      throw new Error(`Missing ${circuit.gateInSlot(col, row).serializedId} result at ${key}`);
    }
  }
  validateSamples(stored.samples, distributions);
}

export { validateDisplays };
