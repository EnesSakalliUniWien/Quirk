import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { Serializer } from "../../serialization/Serializer.js";
import { takeSchema } from "./schema.js";
import { validateDisplays } from "./displays.js";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

const canonicalJson = value => JSON.stringify(stable(value));

function circuitFromJson(value) {
  if (!Array.isArray(value.cols) ||
      value.cols.some(column => !Array.isArray(column) || column.length > 16)) {
    throw new Error("Invalid circuit columns");
  }
  const circuit = Serializer.fromJson(CircuitDefinition, value);
  // Keep the round-trip check: Serializer can recover malformed circuits with error gates.
  if (canonicalJson(value) !== canonicalJson(Serializer.toJson(circuit))) {
    throw new Error("Circuit is not a supported canonical circuit");
  }
  return circuit;
}

function validateDimensions(stored, take, expected, step) {
  if (stored.amplitudes.length !== 2 * 2 ** take.wires) {
    throw new Error("Invalid amplitude count");
  }
  if (stored.wires > take.wires || stored.wires !== expected.numWires) {
    throw new Error("Invalid simulated wire count");
  }
  const simulatedAmplitudeCount = 2 * 2 ** stored.wires;
  // Unused displayed wires remain |0>, for available and unavailable results alike.
  for (let index = simulatedAmplitudeCount; index < stored.amplitudes.length; index++) {
    if (stored.amplitudes[index] !== 0) throw new Error("Invalid amplitude padding");
  }
  if (stored.available) {
    if (stored.densities.length !== step + 1 || stored.survival.length !== step ||
        stored.densities.some(column => column.length !== stored.wires)) {
      throw new Error("Invalid result dimensions");
    }
    return;
  }
  // CircuitStats.withNanDataFromCircuitAtTime supplies empty histories and survival [1].
  if (stored.densities.length !== 0 || stored.custom.length !== 0 ||
      stored.survival.length !== 1 || stored.survival[0] !== 1) {
    throw new Error("Invalid unavailable result");
  }
  for (let index = 0; index < simulatedAmplitudeCount; index++) {
    if (typeof stored.amplitudes[index] === "number") {
      throw new Error("Invalid unavailable result");
    }
  }
}

function validateStats(stored, take, circuit, step) {
  const definition = circuitFromJson(stored.circuit);
  const expected = circuit.withColumns(circuit.columns.slice(0, step)).withMinimumWireCount();
  if (canonicalJson(Serializer.toJson(definition)) !== canonicalJson(Serializer.toJson(expected))) {
    throw new Error("Stored results do not match the circuit step");
  }
  validateDimensions(stored, take, expected, step);
  validateDisplays(stored, definition, step);
}

function validateTake(value) {
  const parsed = takeSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue.path.join(".") || "root";
    throw new Error(`Invalid take at ${location}: ${issue.message}`, { cause: parsed.error });
  }
  const take = parsed.data;
  const circuit = circuitFromJson(take.circuit);
  if (take.step > circuit.columns.length || circuit.numWires > Math.max(1, take.wires)) {
    throw new Error("Invalid take step or wire count");
  }
  for (const [field, step] of [["result", take.step], ["fullResult", circuit.columns.length]]) {
    try {
      validateStats(take[field], take, circuit, step);
    } catch (cause) {
      throw new Error(`Invalid take at ${field}: ${cause.message}`, { cause });
    }
  }
  return take;
}

export { validateTake };
