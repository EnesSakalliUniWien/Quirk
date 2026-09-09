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

import {QubitMatrix} from "./matrix/QubitMatrix.js"

/**
 * The Bloch-sphere reading of a single-qubit state: where the state sits on the sphere, and the
 * angles and ket text that describe it. Pure derivation, no drawing and no DOM.
 */

/**
 * The conventional Bloch coordinates of a qubit density matrix: |+⟩ toward +x, |+i⟩ toward +y,
 * |0⟩ at +z. The internal vector points away from the viewer and down in the small glyphs, so
 * two of its signs flip.
 * @param {!Matrix} densityMatrix
 * @returns {!{x: !number, y: !number, z: !number}}
 */
function blochCoordinates(densityMatrix) {
    const [ix, iy, iz] = QubitMatrix.densityMatrixToBlochVector(densityMatrix);
    return {x: -ix, y: iy, z: -iz};
}

/**
 * Everything a readout prints, derived once from the coordinates.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!{r: !number, theta: !number, phi: !number}} theta is the polar angle from |0⟩ and
 *     phi the azimuth from |+⟩, both in radians.
 */
function blochAngles(vec) {
    const r = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    const theta = r < 1e-8 ? 0 : Math.acos(Math.max(-1, Math.min(1, vec.z / r)));
    const phi = Math.atan2(vec.y, vec.x);
    return {r, theta, phi};
}

/**
 * The ket the vector points at, as amplitude text, for states pure enough to have one.
 * @param {!number} theta
 * @param {!number} phi
 * @returns {!string}
 */
function pureStateText(theta, phi) {
    const a = Math.cos(theta / 2);
    const br = Math.sin(theta / 2) * Math.cos(phi);
    const bi = Math.sin(theta / 2) * Math.sin(phi);
    const sign = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
    return `${a.toFixed(3)} |0⟩ + (${sign(br)}${sign(bi)}i) |1⟩`;
}

export {blochCoordinates, blochAngles, pureStateText}
