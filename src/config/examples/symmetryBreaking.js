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

const symmetryBreakingLink = {
  cols: [
    ["~tpqg", 1, "~r2ku"],
    ["…", "…", "…", "…"],
    ["H"],
    [1, 1, "H"],
    ["•", "X"],
    [1, 1, "•", "X"],
    [1, "Swap", 1, "Swap"],
    ["•", "X"],
    [1, 1, "•", "X"],
    ["X^½", "◦"],
    [1, 1, "X^½", "◦"],
    [1, "X^½"],
    [1, 1, 1, "X^½"],
    ["Measure", "Measure", "Measure", "Measure"],
    [1, "~57au"],
    ["•", 1, "Chance"],
    [1, "•", 1, "Chance"],
    ["◦", 1, "Chance"],
    [1, "◦", 1, "Chance"],
  ],
  gates: [
    {
      id: "~tpqg",
      name: "Alice^1",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
    {
      id: "~r2ku",
      name: "Alice^2",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
    {
      id: "~57au",
      name: "disagree",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
  ],
};

export { symmetryBreakingLink };
