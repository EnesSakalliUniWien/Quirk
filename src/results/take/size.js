// Long lists are measured on a sample of their elements, so that sizing a take costs a few
// hundred values rather than every amplitude it holds.
const SAMPLE = 64;
const encoder = new TextEncoder();

/** @typedef {null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue | undefined}} JsonValue */

// Exact for strings without escapes or non-ASCII characters, which are nearly all of them.
/** @param {string} text */
function stringBytes(text) {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || code === 0x22 || code === 0x5c || code > 0x7e) {
      return encoder.encode(JSON.stringify(text)).byteLength;
    }
  }
  return text.length + 2;
}

/** @param {JsonValue[]} list */
function listBytes(list) {
  // An odd stride visits real and imaginary parts, which alternate in amplitude lists, equally often.
  const stride =
    list.length > SAMPLE ? Math.floor(list.length / SAMPLE) | 1 : 1;
  let measured = 0;
  let count = 0;
  for (let index = 0; index < list.length; index += stride) {
    measured += jsonBytes(list[index]);
    count++;
  }
  // Brackets, commas, and the average sampled element for each one.
  return (
    2 +
    Math.max(0, list.length - 1) +
    Math.round((measured / Math.max(1, count)) * list.length)
  );
}

/** @param {{[key: string]: JsonValue | undefined}} object */
function objectBytes(object) {
  let bytes = 2;
  let entries = 0;
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) continue;
    bytes += stringBytes(key) + 1 + jsonBytes(object[key]);
    entries++;
  }
  return bytes + Math.max(0, entries - 1);
}

/**
 * The size in bytes of `JSON.stringify(value)` in UTF-8, for the acyclic JSON values that takes and
 * their records are made of. It is exact except for lists longer than 64 elements, which are
 * measured on an evenly spaced sample and scaled: counting a take's amplitudes one by one would
 * cost as much as serialising them, and Tape's cap only needs the size to a few percent.
 *
 * @param {JsonValue | undefined} value
 * @returns {!number}
 */
function jsonBytes(value) {
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value).length : 4;
  if (typeof value === "string") return stringBytes(value);
  if (typeof value === "boolean") return value ? 4 : 5;
  if (value === null || value === undefined) return 4;
  return Array.isArray(value) ? listBytes(value) : objectBytes(value);
}

export { jsonBytes };
