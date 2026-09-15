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

export function numberOfSetBits(i) {
  if (i < 0) {
    throw new Error("i < 0");
  }
  if (!Number.isInteger(i)) {
    throw new Error("!Number.isInteger(i)");
  }
  if (i > 0xffffffff) {
    throw new Error("i > 0xFFFFFFFF");
  }

  // Start with each bit representing its own pop count.
  // Merge adjacent 1-bit pop counts into 2-bit pop counts.
  i = (i & 0x55555555) + ((i >> 1) & 0x55555555);
  // Merge adjacent 2-bit pop counts into 4-bit pop counts.
  i = (i & 0x33333333) + ((i >> 2) & 0x33333333);
  // Merge adjacent 4-bit pop counts into 8-bit pop counts.
  // Because log(8) < 4, the count won't overflow in to the adjacent 4-bit count. Masking can happen after.
  i = (i + (i >> 4)) & 0x0f0f0f0f;
  // Merge adjacent 8-bit pop counts into 16-bit pop counts.
  // Because log(48) < 8, we no longer need to mask while merging.
  i += i >> 8;
  // Merge adjacent 16-bit pop counts into 32-bit pop counts.
  i += i >> 16;
  // Done. The total is in the low byte (the others contain noise due to lack of masking during later merges).
  return i & 0xff;
}

/**
 * Counts the number of set bits in an integer.
 *
 * @param {!int} i
 * @returns {!int}
 */
export function popcnt(i) {
  if (i < 0) {
    return Math.POSITIVE_INFINITY;
  }
  let t = 0;
  while (i > 0) {
    i &= i - 1;
    t++;
  }
  return t;
}
