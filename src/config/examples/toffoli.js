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

// The Toffoli gate, an X with two controls, as a reversible AND. Counting2 steps the inputs A and
// B through 00, 01, 10 and 11 over time, and the Toffoli flips AND from 0 to A·B. A and B pass
// through unchanged, so the gate can be undone, unlike an ordinary AND.
const toffoliLink = {
  cols: [
    ["Counting2"],
    ["Chance2"],
    ["•", "•", "X"],
    [1, 1, "Chance"],
  ],
  registers: [
    { name: "A", wires: [0, 1] },
    { name: "B", wires: [1, 1] },
    { name: "AND", wires: [2, 1] },
  ],
};

export { toffoliLink };
