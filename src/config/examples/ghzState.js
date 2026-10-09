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

// A Bell pair extended to three qubits: H, then a chain of CNOTs that copies each qubit onto the
// next. The state is (|000⟩ + |111⟩)/√2, so Chance3 shows only 000 and 111, each half the time.
const ghzStateLink = {
  cols: [["H"], ["•", "X"], [1, "•", "X"], ["Chance3"]],
};

export { ghzStateLink };
