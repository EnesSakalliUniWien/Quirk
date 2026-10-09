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

// A CNOT whose target is in |−⟩ leaves the target alone and changes the control. |−⟩ is the X
// eigenstate with eigenvalue -1, so flipping the target multiplies the state by -1 exactly when the
// control is 1: that phase lands on the control and turns |+⟩ into |−⟩. The Bloch displays show the
// control move from +x to -x while the target stays at -x. A final H reads the control as 1.
const phaseKickbackLink = {
  cols: [
    ["H", "X"],
    [1, "H"],
    ["Bloch", "Bloch"],
    ["•", "X"],
    ["Bloch", "Bloch"],
    ["H"],
    ["Chance"],
  ],
};

export { phaseKickbackLink };
