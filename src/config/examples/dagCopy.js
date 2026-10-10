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

// A dag with roots A and B and children C, D and E, one wire each. The roots get amplitudes from
// Ry(pi/3) and Ry(pi/4), and the children start empty. Each edge copies its parent into its child
// with a CNOT: A → C, A → D, B → D, B → E. D has two parents, so it holds A ⊕ B. The copies
// entangle the children with the roots, so the four root amplitudes move to the basis states
// where C = A, D = A ⊕ B and E = B. A rotation is three columns wide with its dial, and an Amps5
// display is three columns wide.
const dagCopyLink = {
  cols: [
    [
      { id: "Ry", arg: "pi/3" },
      { id: "Ry", arg: "pi/4" },
    ],
    [],
    [],
    ["Amps5"],
    [],
    [],
    ["•", 1, "X"],
    ["•", 1, 1, "X"],
    [1, "•", 1, "X"],
    [1, "•", 1, 1, "X"],
    ["Amps5"],
  ],
  registers: [
    { name: "A", wires: [0, 1] },
    { name: "B", wires: [1, 1] },
    { name: "C", wires: [2, 1] },
    { name: "D", wires: [3, 1] },
    { name: "E", wires: [4, 1] },
  ],
};

export { dagCopyLink };
