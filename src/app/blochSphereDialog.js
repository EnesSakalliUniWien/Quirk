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

import {drawBlochScene, projectPoint} from "../draw/pixi/displays/BlochScene.js"

/**
 * The enlarged Bloch sphere view: clicking any Bloch sphere on the canvas opens this dialog,
 * which shows the same single-qubit state at a size where the geometry is actually readable,
 * lets the view be rotated by dragging, and prints the state as numbers.
 */

// The default view: yawed and tilted so all three axes are visibly distinct.
const DEFAULT_YAW = Math.PI * -0.15;
const DEFAULT_PITCH = Math.PI * 0.11;
// The sphere fills this fraction of the canvas; the rest is room for the axis labels.
const PURE_STATE_THRESHOLD = 0.999;

/**
 * The conventional Bloch coordinates of a qubit density matrix: |+⟩ toward +x, |+i⟩ toward +y,
 * |0⟩ at +z. The internal vector points away from the viewer and down in the small glyphs, so
 * two of its signs flip.
 * @param {!Matrix} densityMatrix
 * @returns {!{x: !number, y: !number, z: !number}}
 */
function blochCoordinates(densityMatrix) {
    let [ix, iy, iz] = densityMatrix.qubitDensityMatrixToBlochVector();
    return {x: -ix, y: iy, z: -iz};
}

/**
 * Everything the readout panel prints, derived once from the coordinates.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!{r: !number, theta: !number, phi: !number}} theta is the polar angle from |0⟩ and
 *     phi the azimuth from |+⟩, both in radians.
 */
function blochAngles(vec) {
    let r = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    let theta = r < 1e-8 ? 0 : Math.acos(Math.max(-1, Math.min(1, vec.z / r)));
    let phi = Math.atan2(vec.y, vec.x);
    return {r, theta, phi};
}

/**
 * The ket the vector points at, as amplitude text, for states pure enough to have one.
 * @param {!number} theta
 * @param {!number} phi
 * @returns {!string}
 */
function pureStateText(theta, phi) {
    let a = Math.cos(theta / 2);
    let br = Math.sin(theta / 2) * Math.cos(phi);
    let bi = Math.sin(theta / 2) * Math.sin(phi);
    let sign = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
    return `${a.toFixed(3)} |0⟩ + (${sign(br)}${sign(bi)}i) |1⟩`;
}

/**
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!ObservableValue.<!CircuitStats>} mostRecentStats
 * @param {!OverlayState} overlayState
 * @returns {!function(target: !{row: !int, col: undefined|!int}): void} Opens the dialog for a
 *     clicked sphere; col is the Bloch display gate's column, or undefined for a wire-end sphere.
 */
function initBlochSphereDialog(displayed, mostRecentStats, overlayState) {
    const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById('bloch-canvas');
    const subtitleElement = document.getElementById('bloch-subtitle');
    const stateElement = document.getElementById('bloch-state');
    const xElement = document.getElementById('bloch-x');
    const yElement = document.getElementById('bloch-y');
    const zElement = document.getElementById('bloch-z');
    const thetaElement = document.getElementById('bloch-theta');
    const phiElement = document.getElementById('bloch-phi');
    const purityElement = document.getElementById('bloch-purity');
    const closeButton = document.getElementById('bloch-close-button');

    /** @type {undefined|!{row: !int, col: undefined|!int}} */
    let pending = undefined;
    let yaw = DEFAULT_YAW;
    let pitch = DEFAULT_PITCH;

    const densityMatrixOfPending = () => {
        let circuitDefinition = displayed.get().displayedCircuit.circuitDefinition;
        let stats = mostRecentStats.get();
        if (pending.col !== undefined) {
            let gate = circuitDefinition.gateInSlot(pending.col, pending.row);
            if (gate === undefined || gate.serializedId !== 'Bloch') {
                return undefined;
            }
            return stats.qubitDensityMatrix(pending.col, pending.row);
        }
        if (pending.row >= displayed.get().displayedCircuit.importantWireCount()) {
            return undefined;
        }
        return stats.qubitDensityMatrix(Infinity, pending.row);
    };

    const repaint = () => {
        if (pending === undefined || overlayState.current() !== 'bloch') {
            return;
        }
        // The sphere the dialog was opened for can vanish underneath it (an undo, a URL change);
        // showing some other slot's state would be worse than closing.
        let densityMatrix = densityMatrixOfPending();
        if (densityMatrix === undefined) {
            overlayState.close();
            return;
        }

        subtitleElement.textContent = `Qubit ${pending.row + 1} · ` +
            (pending.col === undefined ? 'final output state' : `at column ${pending.col + 1}`);

        if (densityMatrix.hasNaN()) {
            drawBlochScene(canvas, undefined, yaw, pitch);
            for (let e of [stateElement, xElement, yElement, zElement, thetaElement, phiElement, purityElement]) {
                e.textContent = 'n/a';
            }
            return;
        }

        let vec = blochCoordinates(densityMatrix);
        let {r, theta, phi} = blochAngles(vec);
        drawBlochScene(canvas, vec, yaw, pitch);

        let sign = v => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
        let deg = v => (v * 180 / Math.PI).toFixed(1) + '°';
        stateElement.textContent = r > PURE_STATE_THRESHOLD ?
            pureStateText(theta, phi) :
            'mixed — |r| < 1 (entangled or decohered)';
        xElement.textContent = sign(vec.x);
        yElement.textContent = sign(vec.y);
        zElement.textContent = sign(vec.z);
        thetaElement.textContent = deg(theta);
        phiElement.textContent = deg(phi);
        purityElement.textContent = r.toFixed(3);
    };

    // Drag rotates the view; pointer events so touch drags work the same way.
    canvas.addEventListener('pointerdown', ev => {
        if (!ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) {
            return;
        }
        canvas.setPointerCapture(ev.pointerId);
        ev.preventDefault();
    });
    canvas.addEventListener('pointermove', ev => {
        if (!canvas.hasPointerCapture(ev.pointerId)) {
            return;
        }
        let cssSize = Math.max(1, canvas.clientWidth);
        yaw -= ev.movementX * Math.PI / cssSize;
        pitch += ev.movementY * Math.PI / cssSize;
        pitch = Math.max(Math.PI * -0.49, Math.min(Math.PI * 0.49, pitch));
        repaint();
    });

    closeButton.addEventListener('click', () => overlayState.close());
    // Simulation frames keep arriving while a time-dependent circuit animates; the open dialog
    // follows them.
    mostRecentStats.observable().subscribe(repaint);
    // A docked dialog resizes the canvas without a stats tick; redraw so the sphere fills it.
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => repaint()).observe(canvas);
    }
    overlayState.active().subscribe(active => {
        if (active !== 'bloch') {
            pending = undefined;
        }
    });

    return target => {
        pending = target;
        yaw = DEFAULT_YAW;
        pitch = DEFAULT_PITCH;
        overlayState.open('bloch');
        // The readout nodes live in the dialog stash and survive being adopted by the popup, so
        // the text can fill in immediately; the canvas has no size until the popup adopts it, so
        // it paints a frame later.
        repaint();
        window.requestAnimationFrame(repaint);
    };
}

export {initBlochSphereDialog, blochCoordinates, blochAngles, pureStateText, projectPoint}
