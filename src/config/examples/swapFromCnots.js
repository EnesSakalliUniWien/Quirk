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

// Three CNOTs, with the middle one pointing the other way, exchange two qubits. H sets the first
// qubit on the +x axis and X^½ sets the second on the -y axis. The Bloch displays after the three
// CNOTs show the two vectors traded places, as a Swap gate would trade them.
const swapFromCnotsLink = {
  cols: [
    ["H", "X^½"],
    ["Bloch", "Bloch"],
    ["•", "X"],
    ["X", "•"],
    ["•", "X"],
    ["Bloch", "Bloch"],
  ],
};

export { swapFromCnotsLink };
