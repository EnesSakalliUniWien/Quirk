import { CircuitStats } from "../../engine/simulation/CircuitStats.js";
import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { Serializer } from "../../serialization/Serializer.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { paddedState } from "../../engine/simulation/stepAlgebra.js";
import {
  RANDOM_FORMAT,
  freshSeed,
  randomFor,
} from "../../engine/simulation/random.js";
import { Recording } from "../../config/Recording.js";
import { TAKE_FORMAT } from "./schema.js";
import { encode, encodeNumber, decode } from "./values.js";

// What toReadableJson(true) lists as output_amplitudes, encoded. It holds one { r, i } object per
// amplitude, so building it from the buffer saves a Complex per entry and a generic encode of each.
function readableAmplitudes(state) {
  const buffer = state.rawBuffer();
  const listed = [];
  for (let index = 0; index < buffer.length; index += 2) {
    listed.push({
      r: encodeNumber(buffer[index]),
      i: encodeNumber(buffer[index + 1]),
    });
  }
  return listed;
}

function snapshotStats(stats, wires) {
  const data = stats.snapshotData();
  const snapshot = encode({
    circuit: Serializer.toJson(stats.circuitDefinition),
    wires: stats.circuitDefinition.numWires,
    available: data.densities.length > 0,
    amplitudes: paddedState(stats.finalState, wires).rawBuffer(),
    ...data,
    samples: stats.sampleOutcomes,
    readable: stats.toReadableJson(false),
  });
  // Last, where toReadableJson puts it.
  snapshot.readable.output_amplitudes = readableAmplitudes(stats.finalState);
  return snapshot;
}

/**
 * Measures every displayed wire `shots` times in the computational basis, from a stored result's
 * amplitudes, with a generator keyed by `seed`. The same amplitudes, shots and seed always give the
 * same counts, which is how an imported take's measurement is checked. A result the engine could
 * not produce has nothing to measure, and no counts.
 *
 * @param {!Array} amplitudes A stored result's encoded, interleaved amplitudes.
 * @returns {!Array.<!Array.<!int>>} [basis index, count] pairs, in index order, for every outcome seen.
 */
function measuredCounts(amplitudes, shots, seed) {
  const cumulative = new Float64Array(amplitudes.length / 2);
  let total = 0;
  for (let index = 0; index < cumulative.length; index++) {
    const probability =
      decode(amplitudes[2 * index]) ** 2 +
      decode(amplitudes[2 * index + 1]) ** 2;
    if (!Number.isFinite(probability)) return [];
    total += probability;
    cumulative[index] = total;
  }
  if (!(total > 0)) return [];
  const random = randomFor(seed);
  const counts = new Map();
  for (let shot = 0; shot < shots; shot++) {
    const target = random() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] > target) high = middle;
      else low = middle + 1;
    }
    counts.set(low, (counts.get(low) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => a[0] - b[0]);
}

/**
 * Fixes a take's identity, time and inputs now, and returns a function that builds it. The results
 * a take records are immutable, so the encoding, which takes tens of milliseconds at sixteen qubits,
 * can wait without changing what is recorded. The measurement's seed is fixed now too, so the
 * counts built later are the ones the take was planned with.
 *
 * @param {!Object} result What Simulator.evaluate returns: circuit, wireCount, step, phase, seed, stats and fullStats.
 * @param {!string} name
 * @param {!int} colour
 * @param {!{shots: (undefined|!int)}} options How many times the take measures its state.
 * @returns {() => Object} Builds the take; each call encodes it afresh.
 */
function planTake(
  result,
  name = "snapshot",
  colour = 0,
  { shots = Recording.MEASUREMENT_SHOTS } = {},
) {
  const id = freshSeed();
  const recorded = new Date().toISOString();
  const measurementSeed = freshSeed();
  return () => {
    const stored = snapshotStats(result.stats, result.wireCount);
    return {
      format: TAKE_FORMAT,
      id,
      name,
      colour,
      recorded,
      notes: "",
      circuit: Serializer.toJson(result.circuit),
      wires: result.wireCount,
      step: result.step,
      phase: result.phase,
      seed: result.seed,
      randomFormat: RANDOM_FORMAT,
      result: stored,
      fullResult: snapshotStats(result.fullStats, result.wireCount),
      measurement: {
        shots,
        seed: measurementSeed,
        counts: measuredCounts(stored.amplitudes, shots, measurementSeed),
      },
    };
  };
}

/** @param {!{shots: (undefined|!int)}} options As for planTake. */
function createTake(result, name = "snapshot", colour = 0, options = {}) {
  return planTake(result, name, colour, options)();
}

// Restore only runtime fields. Circuit JSON and readable exports are not encoded runtime values.
function hydrate(stored, circuit, take, step) {
  return new CircuitStats(
    circuit
      .withColumns(circuit.columns.slice(0, step))
      .withWireCount(stored.wires),
    take.phase,
    stored.survival.map(decode),
    stored.densities.map((column) =>
      column.map(
        (buffer) => new Matrix(2, 2, Float64Array.from(buffer, decode)),
      ),
    ),
    new Matrix(
      1,
      2 ** take.wires,
      Float64Array.from(stored.amplitudes, decode),
    ),
    new Map(stored.custom.map(([key, value]) => [key, decode(value)])),
    take.seed,
    structuredClone(stored.samples),
  );
}

/** Restore a take created internally or already accepted by validateTake. */
function restoreTake(take) {
  const circuit = Serializer.fromJson(CircuitDefinition, take.circuit);
  return {
    circuit,
    wireCount: take.wires,
    step: take.step,
    phase: take.phase,
    seed: take.seed,
    stats: hydrate(take.result, circuit, take, take.step),
    fullStats: hydrate(take.fullResult, circuit, take, circuit.columns.length),
  };
}

export { createTake, measuredCounts, planTake, restoreTake };
