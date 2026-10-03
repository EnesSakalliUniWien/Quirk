import { CircuitStats } from "../../engine/simulation/CircuitStats.js";
import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { Serializer } from "../../serialization/Serializer.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { paddedState } from "../../engine/simulation/stepAlgebra.js";
import { RANDOM_FORMAT, freshSeed } from "../../engine/simulation/random.js";
import { TAKE_FORMAT } from "./schema.js";
import { encode, encodeNumber, decode } from "./values.js";

// What toReadableJson(true) lists as output_amplitudes, encoded. It holds one { r, i } object per
// amplitude, so building it from the buffer saves a Complex per entry and a generic encode of each.
function readableAmplitudes(state) {
  const buffer = state.rawBuffer();
  const listed = [];
  for (let index = 0; index < buffer.length; index += 2) {
    listed.push({ r: encodeNumber(buffer[index]), i: encodeNumber(buffer[index + 1]) });
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
 * Fixes a take's identity, time and inputs now, and returns a function that builds it. The results
 * a take records are immutable, so the encoding, which takes tens of milliseconds at sixteen qubits,
 * can wait without changing what is recorded.
 *
 * @param {!Object} result What Simulator.evaluate returns: circuit, wireCount, step, phase, seed, stats and fullStats.
 * @returns {() => Object} Builds the take; each call encodes it afresh.
 */
function planTake(result, name = "take", colour = 0) {
  const id = freshSeed();
  const recorded = new Date().toISOString();
  return () => ({
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
    result: snapshotStats(result.stats, result.wireCount),
    fullResult: snapshotStats(result.fullStats, result.wireCount),
  });
}

function createTake(result, name = "take", colour = 0) {
  return planTake(result, name, colour)();
}

// Restore only runtime fields. Circuit JSON and readable exports are not encoded runtime values.
function hydrate(stored, circuit, take, step) {
  return new CircuitStats(
    circuit.withColumns(circuit.columns.slice(0, step)).withWireCount(stored.wires),
    take.phase,
    stored.survival.map(decode),
    stored.densities.map(column => column.map(buffer =>
      new Matrix(2, 2, Float64Array.from(buffer, decode)))),
    new Matrix(1, 2 ** take.wires, Float64Array.from(stored.amplitudes, decode)),
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

export { createTake, planTake, restoreTake };
