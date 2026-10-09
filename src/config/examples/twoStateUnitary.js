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

// U(t) = V · Rz(pi t) · V† with V = Rz(pi/4) · Ry(pi/3), as five rotations in time order:
// Rz(-pi/4), Ry(-pi/3), Rz(pi t), Ry(pi/3), Rz(pi/4). Rz(pi t) holds the eigenvalues
// e^(∓i pi t/2), and V turns the z axis to the eigenvector axis at polar angle pi/3 and azimuth
// pi/4. From state 0 or 1, the Bloch vector turns about that axis by pi t, the difference between
// the eigenvalue phases. Each constant rotation is two columns wide, so an empty column follows it.
const twoStateUnitaryLink = {
  init: [0, 1],
  cols: [
    [
      { id: "Rz", arg: "-pi/4" },
      { id: "Rz", arg: "-pi/4" },
    ],
    [],
    [
      { id: "Ry", arg: "-pi/3" },
      { id: "Ry", arg: "-pi/3" },
    ],
    [],
    [
      { id: "Rzft", arg: "pi t" },
      { id: "Rzft", arg: "pi t" },
    ],
    ["Bloch", "Bloch"],
    [
      { id: "Ry", arg: "pi/3" },
      { id: "Ry", arg: "pi/3" },
    ],
    [],
    [
      { id: "Rz", arg: "pi/4" },
      { id: "Rz", arg: "pi/4" },
    ],
    [],
    ["Bloch", "Bloch"],
  ],
};

export { twoStateUnitaryLink };
