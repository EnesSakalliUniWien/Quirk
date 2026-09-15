import { CircuitStats } from "../../engine/simulation/CircuitStats.js";
import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { Serializer } from "../../serialization/Serializer.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { paddedState } from "../../engine/simulation/stepAlgebra.js";
import { RANDOM_FORMAT, freshSeed } from "../../engine/simulation/random.js";
import { TAKE_FORMAT } from "./schema.js";
import { encode, decode } from "./values.js";

function snapshotStats(stats, wires) {
  const data = stats.snapshotData();
  return encode({
    circuit: Serializer.toJson(stats.circuitDefinition),
    wires: stats.circuitDefinition.numWires,
    available: data.densities.length > 0,
    amplitudes: paddedState(stats.finalState, wires).rawBuffer(),
    ...data,
    samples: stats.sampleOutcomes,
    readable: stats.toReadableJson(true),
  });
}

function createTake(result, name = "take", colour = 0) {
  return {
    format: TAKE_FORMAT,
    id: freshSeed(),
    name,
    colour,
    recorded: new Date().toISOString(),
    notes: "",
    circuit: Serializer.toJson(result.circuit),
    wires: result.wireCount,
    step: result.step,
    phase: result.phase,
    seed: result.seed,
    randomFormat: RANDOM_FORMAT,
    result: snapshotStats(result.stats, result.wireCount),
    fullResult: snapshotStats(result.fullStats, result.wireCount),
  };
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

export { createTake, restoreTake };
