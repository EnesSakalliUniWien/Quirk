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

/** Rounded before signing, so a component that vanishes at this precision never reads -0.000. */
const signed = v => {
    const text = Math.abs(v).toFixed(3);
    return (v < 0 && text !== '0.000' ? '-' : '+') + text;
};

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
    return `${a.toFixed(3)} |0⟩ + (${signed(br)}${signed(bi)}i) |1⟩`;
}

/** Above this length the state is pure, and its components need no |r| in front of them. */
const PURE_STATE_LENGTH = 0.999;

/**
 * How each component reads off the angles: x and y run out with sin θ and divide by the azimuth,
 * z stands up with cos θ, and a shorter vector scales all three.
 * @param {!number} r The length of the Bloch vector.
 * @returns {!{x: !string, y: !string, z: !string, radial: !string}}
 */
function componentFormulas(r) {
    const scale = r > PURE_STATE_LENGTH ? '' : '|r| ';
    return {
        x: `${scale}sin θ cos ϕ`,
        y: `${scale}sin θ sin ϕ`,
        z: `${scale}cos θ`,
        radial: `${scale}sin θ`,
    };
}

/**
 * The state as a unit quaternion: the rotation that turns the |0⟩ pole k onto the state's
 * direction by the shortest way, a turn of theta about k × r in the equator. So q k q̄ = r / |r|.
 * Its components are also the pure state's SU(2) amplitudes, with the global phase that makes
 * |0⟩'s real: α = w and β = y - x i.
 * @param {!number} theta
 * @param {!number} phi
 * @returns {!{w: !number, x: !number, y: !number, z: !number}}
 */
function blochQuaternion(theta, phi) {
    const s = Math.sin(theta / 2);
    return {w: Math.cos(theta / 2), x: -s * Math.sin(phi), y: s * Math.cos(phi), z: 0};
}

/**
 * @param {!{x: !number, y: !number, z: !number}} v
 * @returns {!string} The pure quaternion x i + y j + z k, as the Bloch vector is written.
 */
function pureQuaternionText(v) {
    return `${signed(v.x)}i ${signed(v.y)}j ${signed(v.z)}k`;
}

/**
 * @param {!{w: !number, x: !number, y: !number, z: !number}} q
 * @returns {!string}
 */
function quaternionText(q) {
    return `${q.w.toFixed(3)} ${pureQuaternionText(q)}`;
}

export {blochCoordinates, blochAngles, pureStateText, blochQuaternion, pureQuaternionText, quaternionText,
    signed, componentFormulas}
