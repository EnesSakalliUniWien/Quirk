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

const shorLink = {
  cols: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, "~input", 1, 1, 1, "~guess"],
    [
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      { id: "setR", arg: 55 },
      1,
      1,
      1,
      { id: "setB", arg: 26 },
    ],
    [],
    ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H", "X"],
    ["inputA10", 1, 1, 1, 1, 1, 1, 1, 1, 1, "*BToAmodR6"],
    ["QFT†10"],
    [1, 1, 1, 1, "~out"],
    ["Chance10"],
  ],
  gates: [
    {
      id: "~guess",
      name: "guess:",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
    {
      id: "~input",
      name: "input:",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
    {
      id: "~out",
      name: "out:",
      matrix: "{{1,0,0,0},{0,1,0,0},{0,0,1,0},{0,0,0,1}}",
    },
  ],
};

export { shorLink };
