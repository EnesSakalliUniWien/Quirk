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

const chshTestLink = {
  cols: [
    ["H"],
    ["◦", 1, 1, 1, "X"],
    ["X^-¼"],
    ["…", "…", "…", "…", "…"],
    ["~da85", "~5s2n", 1, "~5s2n", "~ahov"],
    [1, "H", 1, "H"],
    [1, "Measure", 1, "Measure"],
    ["X^½", "•"],
    [1, 1, 1, "•", "X^½"],
    ["Measure", 1, 1, 1, "Measure"],
    ["…", "…", "…", "…", "…"],
    [1, "•", "X", "•"],
    ["•", 1, "X"],
    [1, 1, "X", 1, "•"],
    [1, 1, "Chance"],
    [1, 1, "~q6e"],
  ],
  gates: [
    { id: "~da85", name: "Alice", matrix: "{{1,0},{0,1}}" },
    { id: "~ahov", name: "Bob", matrix: "{{1,0},{0,1}}" },
    { id: "~5s2n", name: "Referee", matrix: "{{1,0},{0,1}}" },
    { id: "~q6e", name: "Win?", matrix: "{{1,0},{0,1}}" },
  ],
};

export { chshTestLink };
