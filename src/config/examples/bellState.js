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

// The smallest entangled state. H puts the first qubit into an equal superposition, and a CNOT
// copies it onto the second: (|00⟩ + |11⟩)/√2. Chance2 shows only 00 and 11, each half the time,
// so the two bits always agree. Each Bloch display shows its qubit alone as the centre of the
// sphere: an entangled qubit has no state of its own.
const bellStateLink = {
  cols: [["H"], ["•", "X"], ["Chance2"], ["Bloch", "Bloch"]],
};

export { bellStateLink };
