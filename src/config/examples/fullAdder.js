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

// A full adder adds three bits, A, B and a carry in Cin, into a two-bit Sum register that starts at
// zero. The first Toffoli and CNOT are a half adder: they write A·B into the carry, Sum₁, and leave
// A ⊕ B on B. The second Toffoli adds (A ⊕ B)·Cin to the carry, which makes it the majority of the
// three bits; two CNOTs write A ⊕ B ⊕ Cin into Sum₀; and the last CNOT restores B. Counting3 steps
// the inputs through every value, and Chance2 reads Sum as the number A + B + Cin.
const fullAdderLink = {
  cols: [
    ["Counting3"],
    ["Chance3"],
    ["•", "•", 1, 1, "X"],
    ["•", "X"],
    [1, "•", "•", 1, "X"],
    [1, "•", 1, "X"],
    [1, 1, "•", "X"],
    ["•", "X"],
    [1, 1, 1, "Chance2"],
  ],
  registers: [
    { name: "A", wires: [0, 1] },
    { name: "B", wires: [1, 1] },
    { name: "Cin", wires: [2, 1] },
    { name: "Sum", wires: [3, 2] },
  ],
};

export { fullAdderLink };
