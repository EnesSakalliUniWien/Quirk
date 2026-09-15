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

import {quat} from "gl-matrix"
import {Complex} from "./complex/Complex.js"
import {QubitMatrix} from "./matrix/QubitMatrix.js"

/**
 * The Bloch-sphere reading of a single-qubit state: where the state sits on the sphere, and the
 * angles, amplitudes, quaternion and text that describe it. Pure derivation, no drawing and no DOM,
 * so every view - the enlarged analyzer, its projections, the circuit's own spheres - reads the
 * same numbers and applies the same rules about what is undefined.
 */

/**
 * Below this a length counts as zero. A Bloch vector shorter than it has no direction, so neither
 * angle exists (RULE A); one whose equatorial part is shorter than it lies on the z axis, where the
 * azimuth does not exist (RULE B).
 */
const EPSILON = 1e-6;

/** Above this Bloch radius, views present the state as pure. */
const PURE_STATE_THRESHOLD = 0.999;

/** What a reading prints where a quantity does not exist, and a zero would lie. */
const UNDEFINED_TEXT = "—";

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
 * @typedef {!{
 *     r: !number,
 *     rxy: !number,
 *     theta: (undefined|!number),
 *     phi: (undefined|!number),
 *     rule: ("mixed"|"polar"|"general"),
 *     purity: !number,
 * }} BlochReading
 * theta is the polar angle from |0⟩, in [0, π], and phi the azimuth from |+⟩ toward |+i⟩, in
 * [0, 2π), both in radians; either is undefined where the vector cannot give it. purity is
 * Tr ρ² = (1 + |r|²) / 2.
 */

/**
 * Everything a view prints, derived once from the coordinates, with what cannot be known left
 * undefined rather than guessed:
 *   RULE A, "mixed":   |r| < ε. No direction, so no θ and no ϕ.
 *   RULE B, "polar":   on the z axis. θ is 0 or π; ϕ does not exist.
 *   RULE C, "general": both angles defined.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!BlochReading}
 */
function blochReading(vec) {
    const rxy = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    const r = Math.sqrt(rxy * rxy + vec.z * vec.z);
    const rule = r < EPSILON ? "mixed" : rxy < EPSILON ? "polar" : "general";
    // cos θ = z / |r|, clamped because rounding can leave the ratio a hair outside [-1, 1].
    const theta = rule === "mixed" ? undefined : Math.acos(Math.max(-1, Math.min(1, vec.z / r)));
    // atan2 answers in (−π, π]; the azimuth is read the conventional way, from 0 up to 2π.
    const phi = rule === "general" ? (Math.atan2(vec.y, vec.x) + 2 * Math.PI) % (2 * Math.PI) : undefined;
    return {r, rxy, theta, phi, rule, purity: (1 + r * r) / 2};
}

/**
 * The point at polar angle theta and azimuth phi, at distance r from the centre.
 * @param {!number} theta
 * @param {!number} phi
 * @param {!number=} r
 * @returns {!{x: !number, y: !number, z: !number}}
 */
function vectorFromAngles(theta, phi, r = 1) {
    return {
        x: r * Math.sin(theta) * Math.cos(phi),
        y: r * Math.sin(theta) * Math.sin(phi),
        z: r * Math.cos(theta),
    };
}

/** The six poles and the centre, for exploring the sphere away from any circuit. */
const BLOCH_PRESETS = Object.freeze([
    Object.freeze({name: "|0⟩", vec: Object.freeze({x: 0, y: 0, z: 1})}),
    Object.freeze({name: "|1⟩", vec: Object.freeze({x: 0, y: 0, z: -1})}),
    Object.freeze({name: "|+⟩", vec: Object.freeze({x: 1, y: 0, z: 0})}),
    Object.freeze({name: "|−⟩", vec: Object.freeze({x: -1, y: 0, z: 0})}),
    Object.freeze({name: "|i⟩", vec: Object.freeze({x: 0, y: 1, z: 0})}),
    Object.freeze({name: "|−i⟩", vec: Object.freeze({x: 0, y: -1, z: 0})}),
    Object.freeze({name: "Mixed", vec: Object.freeze({x: 0, y: 0, z: 0})}),
]);

/**
 * @param {undefined|!number} radians
 * @returns {!string} Degrees to one decimal, or the undefined mark.
 */
function degreesText(radians) {
    return radians === undefined ? UNDEFINED_TEXT : `${(radians * 180 / Math.PI).toFixed(1)}°`;
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
 * z stands up with cos θ, and a shorter vector scales all three. A formula exists only where its
 * angles do: none at all without a direction (RULE A), and none naming ϕ on the z axis (RULE B).
 * @param {!BlochReading} reading
 * @returns {!{x: (undefined|!string), y: (undefined|!string), z: (undefined|!string),
 *     radial: (undefined|!string)}}
 */
function componentFormulas(reading) {
    if (reading.rule === "mixed") {
        return {x: undefined, y: undefined, z: undefined, radial: undefined};
    }
    const scale = reading.r > PURE_STATE_LENGTH ? '' : '|r| ';
    const azimuth = reading.rule === "general";
    return {
        x: azimuth ? `${scale}sin θ cos ϕ` : undefined,
        y: azimuth ? `${scale}sin θ sin ϕ` : undefined,
        z: `${scale}cos θ`,
        radial: `${scale}sin θ`,
    };
}

/**
 * The pure state's amplitudes, with the global phase that makes |0⟩'s real: α = cos(θ/2) and
 * β = e^{iϕ} sin(θ/2). Mixed states have no such amplitudes. At the poles use the ket's ϕ = 0
 * phase convention, so |0⟩ has β = 0 and |1⟩ has β = 1 even though the azimuth is undefined.
 * @param {!BlochReading} reading
 * @returns {!{alpha: (undefined|!number), beta: (undefined|!Complex)}}
 */
function blochAmplitudes(reading) {
    if (reading.r <= PURE_STATE_LENGTH) return {alpha: undefined, beta: undefined};
    const alpha = Math.cos(reading.theta / 2);
    const beta = Complex.polar(Math.sin(reading.theta / 2), reading.phi ?? 0);
    return {alpha, beta};
}

/**
 * The state as a unit quaternion: the rotation that turns the |0⟩ pole k onto the state's
 * direction by the shortest way, a turn of θ about k × r in the equator, so q k q̄ = r / |r|.
 * Its axis-angle form is cos(θ/2) + sin(θ/2)(−sin ϕ i + cos ϕ j). Using the reading's angles
 * preserves its direction near the poles, where rotationTo would snap to a parallel or opposite
 * vector. Its components are also the pure state's SU(2) amplitudes: α = w and β = y - x i.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {undefined|!{w: !number, x: !number, y: !number, z: !number}} undefined without a
 *     direction to turn to.
 */
function blochQuaternion(vec, reading = blochReading(vec)) {
    const {theta, phi, rule} = reading;
    if (rule === "mixed") return undefined;
    // At |1⟩ every equatorial axis turns k onto −k. Take the one ϕ = 0 names, a half turn about +y,
    // so q agrees with the ket written beside it, whose β is then +1.
    if (rule === "polar" && vec.z < 0) return {w: 0, x: 0, y: 1, z: 0};
    // gl-matrix stores [x, y, z, w]; a plain array keeps the readout's double precision.
    const azimuth = phi ?? 0;
    const q = quat.setAxisAngle([0, 0, 0, 1], [-Math.sin(azimuth), Math.cos(azimuth), 0], theta);
    return {w: q[3], x: q[0], y: q[1], z: q[2]};
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

/** @param {!Complex} c @returns {!string} The number as +a+bi, each part to three places. */
function complexText(c) {
    return `${signed(c.real)}${signed(c.imag)}i`;
}

/** The notes RULE A and RULE B call for, where a view has room to say why a value is missing. */
const MIXED_NOTE = "Maximally mixed — no Bloch direction defined";
const POLAR_NOTE = "ϕ undefined — vector lies on z-axis";

/**
 * Everything the analyzer's readout prints for a state, already formatted and already following
 * RULE A/B: a quantity that does not exist reads "—" and its formula is left out. Rows are kept
 * rather than removed, so stepping between states never moves the ones below.
 * @param {!{x: !number, y: !number, z: !number}} vec
 */
function analyzerReadout(vec, reading = blochReading(vec)) {
    const formulas = componentFormulas(reading);
    const {alpha, beta} = blochAmplitudes(reading);
    const q = blochQuaternion(vec, reading);
    // Full precision for a hover, where the rounded value leaves a reader wondering.
    const exact = radians => radians === undefined ? UNDEFINED_TEXT : `${radians * 180 / Math.PI}°`;
    return {
        rule: reading.rule,
        note: reading.rule === "mixed" ? MIXED_NOTE : reading.rule === "polar" ? POLAR_NOTE : undefined,
        length: reading.r.toFixed(3),
        theta: degreesText(reading.theta),
        phi: degreesText(reading.phi),
        thetaExact: exact(reading.theta),
        phiExact: exact(reading.phi),
        components: /** @type {Array<[string, (string | undefined), number]>} */ (
            [["x", formulas.x, vec.x], ["y", formulas.y, vec.y], ["z", formulas.z, vec.z]])
            .map(([axis, formula, value]) => ({axis, formula, value: signed(value)})),
        amplitudes: [
            {name: "α", formula: alpha === undefined ? undefined : "cos(θ/2)",
                value: alpha === undefined ? UNDEFINED_TEXT : alpha.toFixed(3)},
            {name: "β", formula: beta === undefined ? undefined :
                reading.phi === undefined ? "sin(θ/2)" : "e^(iϕ) sin(θ/2)",
                value: beta === undefined ? UNDEFINED_TEXT : complexText(beta)},
        ],
        purity: reading.purity.toFixed(3),
        quaternion: q === undefined ? UNDEFINED_TEXT : quaternionText(q),
        vector: pureQuaternionText(vec),
    };
}

export {EPSILON, PURE_STATE_THRESHOLD, UNDEFINED_TEXT, BLOCH_PRESETS, blochCoordinates, blochReading, vectorFromAngles,
    degreesText, pureStateText, componentFormulas, blochAmplitudes, blochQuaternion,
    pureQuaternionText, quaternionText, analyzerReadout, MIXED_NOTE, POLAR_NOTE}
