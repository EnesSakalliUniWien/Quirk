import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { unavailable, matrix } from "./schema.js";

// These conversions preserve the existing matrix and non-finite-number representations.
// They accept the acyclic values produced by CircuitStats, not arbitrary JavaScript objects.
function encode(value) {
  if (typeof value === "number" && !Number.isFinite(value))
    return { unavailable: String(value) };
  if (value instanceof Matrix)
    return {
      kind: "matrix",
      width: value.width(),
      height: value.height(),
      buffer: Array.from(value.rawBuffer(), encode),
    };
  // DataView is not an iterable numeric buffer. Reject it instead of silently producing [].
  if (value instanceof DataView) throw new TypeError("Unsupported DataView in take data");
  if (Array.isArray(value) || ArrayBuffer.isView(value))
    return Array.from(value, encode);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, encode(v)]),
    );
  return value;
}

function decode(value) {
  if (value !== null && typeof value === "object") {
    if (Object.hasOwn(value, "unavailable"))
      return Number(unavailable.parse(value).unavailable);
    if (value.kind === "matrix") {
      const m = matrix.parse(value);
      return new Matrix(
        m.width,
        m.height,
        Float64Array.from(m.buffer, decode),
      );
    }
    if (Array.isArray(value)) return value.map(decode);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, decode(v)]),
    );
  }
  return value;
}

export { encode, decode };
