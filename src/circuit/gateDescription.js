/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Complex } from "../engine/math/complex/Complex.js";
import { Format } from "../base/Format.js";
import { bin } from "../base/Format.js";

/**
 * What a gate does, in words: the ket a basis state becomes, the axis a rotation turns around.
 *
 * Text only, no drawing and no DOM, so the canvas painter and the React panels can say the same
 * things about a gate without one of them importing the other's stack.
 */

/**
 * A basis state, scaled by an amplitude, written the way a reader would: |01⟩, -|1⟩, i|0⟩,
 * (½+½i)·|10⟩. An amplitude of zero has nothing to write, and returns the empty string.
 *
 * @param {!int} bitCount
 * @param {!int} bitMask
 * @param {!Complex|!number} factor
 * @param {!Format} format
 * @returns {!string}
 */
function describeKet(bitCount, bitMask, factor, format) {
  factor = Complex.from(factor);
  if (factor.isEqualTo(0)) {
    return "";
  }
  const scaleFactorDesc = factor.isEqualTo(1)
    ? ""
    : factor.isEqualTo(-1)
      ? "-"
      : factor.isEqualTo(Complex.I)
        ? "i"
        : factor.isEqualTo(Complex.I.times(-1))
          ? "-i"
          : (factor.real === 0 || factor.imag === 0) &&
              format !== Format.CONSISTENT
            ? factor.toString(format)
            : "(" + factor.toString(format) + ")·";

  return scaleFactorDesc + "|" + bin(bitMask, bitCount) + "⟩";
}

/**
 * One sentence per column of the matrix, saying what that basis state turns into. Columns that
 * only scale their own state are called out as phases, discards, or no-ops rather than written out
 * as a sum of one term.
 *
 * @param {!Matrix} matrix
 * @param {!Format} format
 * @returns {!Array.<!string>}
 */
function describeGateTransformations(matrix, format) {
  const n = matrix.height();
  const b = Math.round(Math.log2(n));
  return Array.from({ length: n }, (_, c) => {
    const inputDescription = describeKet(b, c, 1, Format.SIMPLIFIED);
    const col = matrix.getColumn(c);
    if (col.every((e) => e.isEqualTo(0))) {
      return "discards " + inputDescription;
    } else if (col.every((e, r) => e.isEqualTo(r === c ? 1 : 0))) {
      if (format !== Format.CONSISTENT) {
        return "doesn't affect " + inputDescription;
      }
    } else if (col.every((e, r) => r === c || e.isEqualTo(0))) {
      const degs = (col[c].ln().imag * 180) / Math.PI;
      return (
        "phases " + inputDescription + " by " + format.formatFloat(degs) + "°"
      );
    }
    const outputDescription = col
      .map((e, c) => describeKet(b, c, e, format))
      .filter((e) => e !== "")
      .join(" + ")
      .split(" + -")
      .join(" - ")
      .split(" + +")
      .join(" + ");
    return "transforms " + inputDescription + " into " + outputDescription;
  });
}

/**
 * A rotation axis by the axes it leans on: X, -Z, X + Z, 0.5·X + Z. Scaled so the largest
 * component is 1, because the direction is what matters and "0.707·X + 0.707·Z" reads worse than
 * "X + Z".
 *
 * @param {!Array.<!number>} unitAxis x, y, z
 * @param {!Format} format
 * @returns {!string}
 */
function describeAxis(unitAxis, format) {
  const max = Math.max(...unitAxis.map((e) => Math.abs(e)));
  return unitAxis
    .map((e) => e / max)
    .map((val, i) => {
      const name = ["X", "Y", "Z"][i];
      if (val === 0) {
        return "";
      }
      if (val === 1) {
        return name;
      }
      if (val === -1) {
        return "-" + name;
      }
      return format.formatFloat(val) + "·" + name;
    })
    .filter((e) => e !== "")
    .join(" + ")
    .replace(" + -", " - ")
    .replace(" + +", " + ");
}

export { describeKet, describeGateTransformations, describeAxis };
