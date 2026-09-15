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

import { DetailedError } from "../../base/DetailedError.js";

/**
 * Returns the math-style remainder, which is guaranteed to be in the range [0, denominator) even when the numerator
 * is negative.
 * @param {!number} numerator
 * @param {!number} denominator
 * @returns {!number}
 */
export function properMod(numerator, denominator) {
  if (denominator <= 0) {
    throw new DetailedError("denominator <= 0", { numerator, denominator });
  }
  const result = numerator % denominator;
  return result + (result < 0 ? denominator : 0);
}

/**
 * @param {!int} value
 * @param {!int} modulus
 * @returns {!int} A value r in [0, modulus) such that r*value = 1 (mod modulus).
 */
export function modular_multiplicative_inverse(value, modulus) {
  let { x, gcd } = extended_gcd(value, modulus);
  if (gcd !== 1) {
    return undefined;
  }
  x %= modulus;
  if (x < 0) {
    x += modulus;
  }
  return x;
}

/**
 * @param {!int} a
 * @param {!int} b
 * @returns {!{x: !int, y: !int, gcd: !int}} Such that x*a + y*b = gcd = GCD(a, b)
 */
export function extended_gcd(a, b) {
  let s = 0;
  let t = 1;
  let r = b;

  let old_s = 1;
  let old_t = 0;
  let old_r = a;
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
    [old_t, t] = [t, old_t - q * t];
  }
  return { x: old_s, y: old_t, gcd: old_r };
}
