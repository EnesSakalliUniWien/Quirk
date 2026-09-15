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

/** Returns whether the Number is a positive integer power of two. */
export function isPowerOf2(i) {
  return Number.isInteger(i) && i > 0 && 2 ** floorLg2(i) === i;
}

/**
 * Returns the smallest power of two at least n, with a minimum of 1.
 * Requires a finite Number; results beyond Number.MAX_VALUE are Infinity.
 */
export function ceilingPowerOf2(n) {
  return 2 ** ceilLg2(n);
}

/** Returns ceil(log2(n)), clamped to zero, for a finite Number. */
export function ceilLg2(n) {
  const p = floorLg2(n);
  return n <= 2 ** p ? p : p + 1;
}

/** Returns floor(log2(n)), clamped to zero, for a finite Number. */
export function floorLg2(n) {
  if (!Number.isFinite(n)) {
    throw new RangeError("Expected a finite number.");
  }
  if (n <= 1) {
    return 0;
  }
  const p = Math.floor(Math.log2(n));
  // Math.log2 can round to an adjacent integer near a power of two.
  // Exponentiation preserves the comparison beyond the 32-bit bitwise range.
  if (n < 2 ** p) {
    return p - 1;
  }
  return n >= 2 ** (p + 1) ? p + 1 : p;
}
