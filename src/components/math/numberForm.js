/**
 * Which exact form a number takes, before anything is drawn.
 *
 * Kept apart from the MathML that renders it (src/components/math/mathml.jsx) so the recognition is
 * a plain function with plain tests: a wrong guess here would put a false "cos(π/8)" in front of a
 * reader, and that has to be checkable without a browser.
 *
 * The forms are tried in the order a reader recognises them: an integer, a fraction, something
 * over a root, then a cosine or sine of a simple fraction of π - which is what the entries of a
 * rotation are - and only then three decimals. So 1/√2 stays 1/√2 rather than becoming cos(π/4),
 * while 0.9239… becomes cos(π/8) instead of an anonymous decimal.
 *
 * @typedef {!({kind: "integer", value: !int}|
 *     {kind: "fraction", numerator: !int, denominator: !int}|
 *     {kind: "overRoot", numerator: !int, root: !int}|
 *     {kind: "trig", fn: ("cos"|"sin"), numerator: !int, denominator: !int}|
 *     {kind: "decimal", value: !number})} NumberForm
 */

/** How close a value must be to a form before it is written as that form. */
const TOLERANCE = 1e-6;
/** Denominators worth writing as a fraction rather than a decimal. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 12, 16];
/** Roots worth writing as a radical: √2 and √3 cover the gates that exist. */
const ROOTS = [2, 3];
/**
 * Fractions of π worth naming inside a cos or sin. Halvings and thirds are what rotation angles
 * are built from; stopping at 64 keeps a varying gate's arbitrary angle from landing near one by
 * accident, which would make its entry flicker between a decimal and a trig name.
 */
const ANGLE_DENOMINATORS = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

/**
 * @param {!int} a
 * @param {!int} b
 * @returns {!int}
 */
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * The simplest `fn(kπ/d)` equal to `size`, with the angle in (0, π/2].
 *
 * @param {!number} size Between 0 and 1.
 * @param {!("cos"|"sin")} fn
 * @returns {undefined|!{numerator: !int, denominator: !int}}
 */
function angleFor(size, fn) {
  const f = fn === "cos" ? Math.cos : Math.sin;
  for (const denominator of ANGLE_DENOMINATORS) {
    for (let k = 1; 2 * k <= denominator; k++) {
      if (Math.abs(f((k * Math.PI) / denominator) - size) < TOLERANCE) {
        const g = gcd(k, denominator);
        return { numerator: k / g, denominator: denominator / g };
      }
    }
  }
  return undefined;
}

/**
 * @param {!number} size A magnitude: the sign is the renderer's business.
 * @param {!("cos"|"sin")=} prefer Which function to name first when a value is both - every cosine
 *     of a nice angle is also a sine of one. A rotation's diagonal reads as cosines and its
 *     off-diagonal as sines, so the caller, which knows the position, decides.
 * @returns {!NumberForm}
 */
function numberForm(size, prefer = "cos") {
  if (Math.abs(size - Math.round(size)) < TOLERANCE) {
    return { kind: "integer", value: Math.round(size) };
  }
  for (const denominator of DENOMINATORS) {
    const numerator = size * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < TOLERANCE) {
      return { kind: "fraction", numerator: Math.round(numerator), denominator };
    }
  }
  for (const root of ROOTS) {
    const numerator = size * Math.sqrt(root);
    if (Math.abs(numerator - Math.round(numerator)) < TOLERANCE) {
      return { kind: "overRoot", numerator: Math.round(numerator), root };
    }
  }
  if (size < 1) {
    for (const fn of prefer === "sin" ? ["sin", "cos"] : ["cos", "sin"]) {
      const angle = angleFor(size, fn);
      if (angle !== undefined) {
        return { kind: "trig", fn, ...angle };
      }
    }
  }
  return { kind: "decimal", value: size };
}

export { numberForm, TOLERANCE };
