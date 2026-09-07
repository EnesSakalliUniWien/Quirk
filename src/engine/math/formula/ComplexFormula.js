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

import { DetailedError } from "../../../base/DetailedError.js";
import { UNICODE_FRACTIONS } from "../../../base/Format.js";
import { Complex } from "../complex/Complex.js";
import { FormulaParser } from "./FormulaParser.js";

/**
 * Parses complex numbers from infix arithmetic expressions like "sqrt(1/2) * e^(i pi / 4)".
 *
 * The trigonometric functions take an angle unit. Serialized matrices (`Matrix.parse`) use
 * `ComplexFormula.DEGREES`; formula gates use `ComplexFormula.RADIANS`.
 */
class ComplexFormula {
  /**
   * Parses a complex number from an infix arithmetic expression.
   * @param {!string} text
   * @param {!string=} angleUnit ComplexFormula.DEGREES (the default) or ComplexFormula.RADIANS.
   * @param {!Object.<!string, (!number|!Complex)>=} variables Extra named values, e.g. {t: 0.5}.
   * @returns {!Complex}
   */
  static parse(text, { angleUnit, variables } = {}) {
    return Complex.from(
      FormulaParser.parse(
        text,
        ComplexFormula.tokenMap({ angleUnit, variables }),
      ),
    );
  }

  /**
   * Builds a fresh token map for parsing complex formulas, so callers can extend it freely.
   * @param {!string=} angleUnit ComplexFormula.DEGREES (the default) or ComplexFormula.RADIANS.
   * @param {!Object.<!string, (!number|!Complex)>=} variables Extra named values, e.g. {t: 0.5}.
   * @returns {!Map.<!string, *>}
   */
  static tokenMap({ angleUnit = ComplexFormula.DEGREES, variables = {} } = {}) {
    let map = new Map(ComplexFormula._cachedTokenMap(angleUnit).entries());
    for (let name of Object.keys(variables)) {
      map.set(name, variables[name]);
    }
    return map;
  }

  /**
   * Returns the shared, read-only token map for the given angle unit.
   * @param {!string} angleUnit
   * @returns {!Map.<!string, *>}
   * @private
   */
  static _cachedTokenMap(angleUnit) {
    if (!ComplexFormula._CACHE.has(angleUnit)) {
      let map;
      if (angleUnit === ComplexFormula.DEGREES) {
        map = ComplexFormula._degreeTokens();
      } else if (angleUnit === ComplexFormula.RADIANS) {
        map = ComplexFormula._radianTokens();
      } else {
        throw new DetailedError("Unrecognized angle unit.", { angleUnit });
      }
      for (let [k, v] of ComplexFormula._sharedTokens().entries()) {
        map.set(k, v);
      }
      ComplexFormula._CACHE.set(angleUnit, map);
    }
    return ComplexFormula._CACHE.get(angleUnit);
  }

  /**
   * @param {!function(*): (!number|!Complex)} action
   * @param {!number=} priority
   * @returns {!{unary_action: !function(*): (!number|!Complex), priority: !number}}
   * @private
   */
  static _unary(action, priority = 4) {
    return { unary_action: action, priority };
  }

  /**
   * Wraps a real-only function so that it rejects complex inputs with a non-zero imaginary part.
   * @param {!string} name
   * @param {!function(!number): !number} realFunction
   * @returns {!{unary_action: !function(*): !Complex, priority: !number}}
   * @private
   */
  static _realOnly(name, realFunction) {
    return ComplexFormula._unary((e) => {
      if (Complex.imagPartOf(e) !== 0) {
        throw new DetailedError(`${name} input out of range`, { e });
      }
      return Complex.from(realFunction(Complex.realPartOf(e)));
    });
  }

  /**
   * The tokens every complex formula understands, regardless of angle unit.
   * @returns {!Map.<!string, *>}
   * @private
   */
  static _sharedTokens() {
    let unary = ComplexFormula._unary;
    let map = new Map();
    map.set("i", Complex.I);
    map.set("e", Complex.from(Math.E));
    map.set("pi", Complex.from(Math.PI));
    map.set("(", "(");
    map.set(")", ")");
    for (let { character, value } of UNICODE_FRACTIONS) {
      map.set(character, value);
    }
    map.set(
      "sqrt",
      unary((e) => Complex.from(e).raisedTo(0.5)),
    );
    map.set(
      "exp",
      unary((e) => Complex.from(e).exp()),
    );
    map.set(
      "ln",
      unary((e) => Complex.from(e).ln()),
    );
    map.set("^", {
      binary_action: (a, b) => Complex.from(a).raisedTo(b),
      priority: 3,
    });
    map.set("*", {
      binary_action: (a, b) => Complex.from(a).times(b),
      priority: 2,
    });
    map.set("/", {
      binary_action: (a, b) => Complex.from(a).dividedBy(b),
      priority: 2,
    });
    map.set("-", {
      unary_action: (e) => Complex.from(e).neg(),
      binary_action: (a, b) => Complex.from(a).minus(b),
      priority: 1,
    });
    map.set("+", {
      unary_action: (e) => e,
      binary_action: (a, b) => Complex.from(a).plus(b),
      priority: 1,
    });
    map.set("√", map.get("sqrt"));
    return map;
  }

  /**
   * Trigonometric tokens that take and return degrees.
   * @returns {!Map.<!string, *>}
   * @private
   */
  static _degreeTokens() {
    let unary = ComplexFormula._unary;
    let realOnly = ComplexFormula._realOnly;
    let map = new Map();
    map.set(
      "cos",
      unary((e) => new Complex(Math.PI / 180, 0).times(e).cos()),
    );
    map.set(
      "sin",
      unary((e) => new Complex(Math.PI / 180, 0).times(e).sin()),
    );
    map.set(
      "asin",
      realOnly("asin", (v) => (Math.asin(v) * 180) / Math.PI),
    );
    map.set(
      "acos",
      realOnly("acos", (v) => (Math.acos(v) * 180) / Math.PI),
    );
    map.set("arccos", map.get("acos"));
    map.set("arcsin", map.get("asin"));
    return map;
  }

  /**
   * Trigonometric tokens that take and return radians.
   * @returns {!Map.<!string, *>}
   * @private
   */
  static _radianTokens() {
    let unary = ComplexFormula._unary;
    let realOnly = ComplexFormula._realOnly;
    let map = new Map();
    map.set(
      "cos",
      unary((e) => Complex.from(e).cos()),
    );
    map.set(
      "sin",
      unary((e) => Complex.from(e).sin()),
    );
    map.set(
      "tan",
      unary((e) => Complex.from(e).tan()),
    );
    map.set("asin", realOnly("asin", Math.asin));
    map.set("acos", realOnly("acos", Math.acos));
    map.set("atan", realOnly("atan", Math.atan));
    return map;
  }
}

/**
 * Angle unit where trigonometric functions take and return degrees.
 * @type {!string}
 */
ComplexFormula.DEGREES = "degrees";

/**
 * Angle unit where trigonometric functions take and return radians.
 * @type {!string}
 */
ComplexFormula.RADIANS = "radians";

/**
 * The shared token map per angle unit, built on first use.
 * @type {!Map.<!string, !Map.<!string, *>>}
 * @private
 */
ComplexFormula._CACHE = new Map();

export { ComplexFormula };
