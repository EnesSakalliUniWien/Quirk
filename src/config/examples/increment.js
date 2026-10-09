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

// Adding one to a register with controlled NOTs, highest bit first. Each bit flips when every bit
// below it is 1, which is when adding one carries into it; the lowest bit always flips. Going from
// the top down lets each gate see the lower bits before they change. Counting3 steps x through
// 0 to 7, and the second Chance3 shows x + 1, with 7 wrapping round to 0.
const incrementLink = {
  cols: [
    ["Counting3"],
    ["Chance3"],
    ["•", "•", "X"],
    ["•", "X"],
    ["X"],
    ["Chance3"],
  ],
  registers: [{ name: "x", wires: [0, 3] }],
};

export { incrementLink };
