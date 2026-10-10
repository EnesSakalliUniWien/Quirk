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

// The oracle computes s·x, the parity of the bits x shares with a hidden string s = 101, onto a
// fourth qubit held in |−⟩. Phase kickback turns that parity into a phase (-1)^(s·x) on the
// inputs, and the Hadamards on each side turn the phases into s itself. One call to the oracle
// reveals all of s: Chance3 shows 101 with certainty, where a classical search needs one query
// per bit.
const bernsteinVaziraniLink = {
  cols: [
    [1, 1, 1, "X"],
    ["H", "H", "H", "H"],
    ["~s101"],
    ["H", "H", "H"],
    ["Chance3"],
  ],
  gates: [
    {
      id: "~s101",
      name: "Oracle",
      circuit: {
        cols: [
          ["•", 1, 1, "X"],
          [1, 1, "•", "X"],
        ],
      },
    },
  ],
};

export { bernsteinVaziraniLink };
