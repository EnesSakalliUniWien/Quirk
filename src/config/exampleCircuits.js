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

/**
 * The example circuits a panel can offer: data, no behaviour. Each entry carries the name shown
 * for it, so the list is describable without markup. Each circuit lives in its own module under
 * `examples/`; this file only orders them and freezes the combined list.
 */

import { twoStateUnitaryLink } from "./examples/twoStateUnitary.js";
import { bellStateLink } from "./examples/bellState.js";
import { ghzStateLink } from "./examples/ghzState.js";
import { dagCopyLink } from "./examples/dagCopy.js";
import { swapFromCnotsLink } from "./examples/swapFromCnots.js";
import { phaseKickbackLink } from "./examples/phaseKickback.js";
import { toffoliLink } from "./examples/toffoli.js";
import { chshTestLink } from "./examples/chshTest.js";
import { teleportLink } from "./examples/teleport.js";
import { superdenseCodingLink } from "./examples/superdenseCoding.js";
import { eraserLink } from "./examples/eraser.js";
import { symmetryBreakingLink } from "./examples/symmetryBreaking.js";
import { bernsteinVaziraniLink } from "./examples/bernsteinVazirani.js";
import { qftLink } from "./examples/qft.js";
import { groverLink } from "./examples/grover.js";
import { shorLink } from "./examples/shor.js";
import { halfAdderLink } from "./examples/halfAdder.js";
import { fullAdderLink } from "./examples/fullAdder.js";
import { incrementLink } from "./examples/increment.js";
import { additionLink } from "./examples/addition.js";
import { distillLink } from "./examples/distill.js";

// Simplest and most foundational first, most advanced last:
//  - a single qubit's rotation, then the Bell and GHZ states and the entangling copy they grow
//    into, to start with one and a few qubits;
//  - the two-qubit constructions every circuit leans on: a SWAP made of three CNOTs, phase
//    kickback, and the Toffoli gate as a reversible AND;
//  - the Bell-pair protocols (CHSH, teleportation, superdense coding), which all share the same
//    entangled-pair mechanics;
//  - the eraser and symmetry-breaking experiments, which turn on more delicate measurement timing;
//  - the textbook algorithms: Bernstein-Vazirani, the smallest oracle algorithm, then QFT before
//    the searches and factoring that are built from it;
//  - reversible arithmetic, from the half and full adders and a controlled-NOT increment to
//    multi-bit reversible addition, then magic state distillation: circuit-engineering and
//    fault-tolerance topics that build on the Toffoli gate and everything above.
/** @type {!Array.<!{name: !string, circuit: !object}>} */
const EXAMPLE_CIRCUITS = [
  { name: "Two State Model Unitary from Eigenvalues", circuit: twoStateUnitaryLink },
  { name: "Bell State", circuit: bellStateLink },
  { name: "GHZ State", circuit: ghzStateLink },
  { name: "Amplitudes Copied into DAG Children", circuit: dagCopyLink },
  { name: "SWAP from Three CNOTs", circuit: swapFromCnotsLink },
  { name: "Phase Kickback", circuit: phaseKickbackLink },
  { name: "Toffoli as Reversible AND", circuit: toffoliLink },
  { name: "Bell Inequality Test (CHSH)", circuit: chshTestLink },
  { name: "Quantum Teleportation", circuit: teleportLink },
  { name: "Superdense Coding", circuit: superdenseCodingLink },
  { name: "Delayed Choice Eraser", circuit: eraserLink },
  { name: "Symmetry Breaking", circuit: symmetryBreakingLink },
  { name: "Bernstein-Vazirani", circuit: bernsteinVaziraniLink },
  { name: "Quantum Fourier Transform", circuit: qftLink },
  { name: "Grover Search", circuit: groverLink },
  { name: "Shor Period Finding", circuit: shorLink },
  { name: "Half Adder", circuit: halfAdderLink },
  { name: "Full Adder", circuit: fullAdderLink },
  { name: "Increment from Controlled NOTs", circuit: incrementLink },
  { name: "Reversible Addition", circuit: additionLink },
  { name: "Magic State Distillation", circuit: distillLink },
];

// These literals are an acyclic JSON tree. Freeze every nested array and object so loading or
// editing one example cannot change the menu's source data for the next load.
function freezeExampleData(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeExampleData(child);
    Object.freeze(value);
  }
}
freezeExampleData(EXAMPLE_CIRCUITS);

export { EXAMPLE_CIRCUITS };
