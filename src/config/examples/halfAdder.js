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

// A half adder adds two bits into a two-bit Sum register that starts at zero. A Toffoli writes the
// carry, A·B, into its high bit, and two CNOTs write the sum bit, A ⊕ B, into its low bit.
// Counting2 steps A and B through every input, and Chance2 reads Sum as the number A + B.
const halfAdderLink = {
  cols: [
    ["Counting2"],
    ["Chance2"],
    ["•", "•", 1, "X"],
    ["•", 1, "X"],
    [1, "•", "X"],
    [1, 1, "Chance2"],
  ],
  registers: [
    { name: "A", wires: [0, 1] },
    { name: "B", wires: [1, 1] },
    { name: "Sum", wires: [2, 2] },
  ],
};

export { halfAdderLink };
