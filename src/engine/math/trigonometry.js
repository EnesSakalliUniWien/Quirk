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

/**
 * Returns the cosine and sine of an angle, except that when the angle is the closest approximation to a multiple of
 * π/4 the result is snapped to a nice vector by assuming the input was an exact multiple.
 * @param {!number} radians
 * @returns {!Array.<!number>}
 */
export function snappedCosSin(radians) {
  const unit = Math.PI / 4;
  const i = Math.round(radians / unit);
  if (i * unit === radians) {
    const s = Math.sqrt(0.5);
    const snaps = [
      [1, 0],
      [s, s],
      [0, 1],
      [-s, s],
      [-1, 0],
      [-s, -s],
      [0, -1],
      [s, -s],
    ];
    return snaps[i & 7];
  }
  return [Math.cos(radians), Math.sin(radians)];
}
