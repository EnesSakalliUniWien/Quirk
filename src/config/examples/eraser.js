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

const eraserLink = {
  cols: [
    [1, "H"],
    [1, "•", 1, 1, "X"],
    [1, "~slits", "QFT7"],
    [
      1,
      1,
      "Measure",
      "Measure",
      "Measure",
      "Measure",
      "Measure",
      "Measure",
      "Measure",
    ],
    ["…", "…", "Chance7"],
    ["…", "…"],
    ["…", "…"],
    ["…", "…"],
    ["H"],
    ["Measure"],
    ["~choice"],
    ["•", "X^½"],
    [1, "Measure"],
    [1, "~result", 1, 1, 1, "~flat"],
    ["◦", "◦", "Chance7"],
    ["◦", "•", "Chance7"],
    [1, 1, 1, 1, 1, "~waves"],
    ["•", "◦", "Chance7"],
    ["•", "•", "Chance7"],
  ],
  gates: [
    { id: "~choice", name: "choice", matrix: "{{1,0},{0,1}}" },
    { id: "~result", name: "result", matrix: "{{1,0},{0,1}}" },
    { id: "~flat", name: "flat", matrix: "{{1,0},{0,1}}" },
    { id: "~waves", name: "waves", matrix: "{{1,0},{0,1}}" },
    { id: "~slits", name: "slits", matrix: "{{1,0},{0,1}}" },
  ],
};

export { eraserLink };
