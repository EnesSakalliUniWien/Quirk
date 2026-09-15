import { CircuitDefinition } from "../../circuit/model/CircuitDefinition.js";
import { Serializer } from "../../serialization/Serializer.js";
import { decode } from "./values.js";

/** Computational-basis probabilities from a created or validated take. */
function distributions(take) {
  const circuit = Serializer.fromJson(CircuitDefinition, take.circuit);
  const amplitudes = take.result.amplitudes;
  // Decode each pair directly instead of allocating another full amplitude array.
  const joint = Array.from({ length: 2 ** take.wires }, (_, index) => {
    const real = decode(amplitudes[2 * index]);
    const imaginary = decode(amplitudes[2 * index + 1]);
    return real ** 2 + imaginary ** 2;
  });
  const groups = [];
  for (let start = 0; start < take.wires;) {
    const register = circuit.registers.at(start);
    const length = register?.length ?? 1;
    const probabilities = new Array(2 ** length).fill(0);
    const mask = 2 ** length - 1;
    for (let index = 0; index < joint.length; index++) {
      probabilities[(index >> start) & mask] += joint[index];
    }
    groups.push({
      name: register?.name ?? `q${start}`, start, length,
      labels: register?.labels ?? {}, probabilities,
    });
    start += length;
  }
  return { joint, groups };
}

export { distributions };
