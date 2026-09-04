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

import {Palette} from "../config/Palette.js"
import {Typography} from "../config/Typography.js"

/**
 * The enlarged Bloch sphere view: clicking any Bloch sphere on the canvas opens this dialog,
 * which shows the same single-qubit state at a size where the geometry is actually readable,
 * lets the view be rotated by dragging, and prints the state as numbers.
 */

// The default view: yawed and tilted so all three axes are visibly distinct.
const DEFAULT_YAW = Math.PI * -0.15;
const DEFAULT_PITCH = Math.PI * 0.11;
// The sphere fills this fraction of the canvas; the rest is room for the axis labels.
const SPHERE_CANVAS_FRACTION = 0.72;
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
 * Orthographic projection of a scene point through the view rotation. Depth is positive toward
 * the viewer, so positive-depth strokes draw as the front of the sphere.
 * @param {!number} x
 * @param {!number} y
 * @param {!number} z
 * @param {!number} yaw
 * @param {!number} pitch
 * @returns {!{sx: !number, sy: !number, depth: !number}} Unit-sphere screen offsets (y up).
 */
function projectPoint(x, y, z, yaw, pitch) {
    let cy = Math.cos(yaw);
    let sy = Math.sin(yaw);
    let right = -x * sy + y * cy;
    let toward = x * cy + y * sy;
    let cp = Math.cos(pitch);
    let sp = Math.sin(pitch);
    return {
        sx: right,
        sy: z * cp + toward * sp,
        depth: toward * cp - z * sp,
    };
}

/**
 * Strokes one great circle of the sphere in two passes: the part facing the viewer solid, the
 * part behind dashed and dimmer, which is most of the view's depth cue.
 * @param {!CanvasRenderingContext2D} ctx
 * @param {!function(!number): !Array.<!number>} pointAt Maps an angle to a scene point.
 * @param {!number} cx
 * @param {!number} cy
 * @param {!number} scale
 * @param {!number} yaw
 * @param {!number} pitch
 */
function strokeGreatCircle(ctx, pointAt, cx, cy, scale, yaw, pitch) {
    for (let front of [false, true]) {
        ctx.beginPath();
        ctx.strokeStyle = front ? Palette.MID_LINE_COLOR : Palette.FAINT_LINE_COLOR;
        ctx.setLineDash(front ? [] : [3, 4]);
        let penDown = false;
        for (let i = 0; i <= 120; i++) {
            let [x, y, z] = pointAt(i * Math.PI * 2 / 120);
            let p = projectPoint(x, y, z, yaw, pitch);
            if ((p.depth >= 0) === front) {
                let px = cx + p.sx * scale;
                let py = cy - p.sy * scale;
                if (penDown) {
                    ctx.lineTo(px, py);
                } else {
                    ctx.moveTo(px, py);
                    penDown = true;
                }
            } else {
                penDown = false;
            }
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

/**
 * @param {!HTMLCanvasElement} canvas
 * @param {undefined|!{x: !number, y: !number, z: !number}} vec undefined paints the NaN state.
 * @param {!number} yaw
 * @param {!number} pitch
 */
function drawBlochScene(canvas, vec, yaw, pitch) {
    let cssSize = canvas.clientWidth;
    if (cssSize === 0) {
        return;
    }
    let dpr = window.devicePixelRatio || 1;
    let backing = Math.round(cssSize * dpr);
    if (canvas.width !== backing || canvas.height !== backing) {
        canvas.width = backing;
        canvas.height = backing;
    }
    let ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    let cx = cssSize / 2;
    let cy = cssSize / 2;
    let scale = cssSize * SPHERE_CANVAS_FRACTION / 2;
    let project = (x, y, z) => {
        let p = projectPoint(x, y, z, yaw, pitch);
        return {x: cx + p.sx * scale, y: cy - p.sy * scale, depth: p.depth};
    };

    // The shell.
    ctx.fillStyle = Palette.DISPLAY_GATE_BACK_COLOR;
    ctx.strokeStyle = Palette.MID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // The equator and the two meridians through the axis poles.
    strokeGreatCircle(ctx, t => [Math.cos(t), Math.sin(t), 0], cx, cy, scale, yaw, pitch);
    strokeGreatCircle(ctx, t => [Math.cos(t), 0, Math.sin(t)], cx, cy, scale, yaw, pitch);
    strokeGreatCircle(ctx, t => [0, Math.cos(t), Math.sin(t)], cx, cy, scale, yaw, pitch);

    // The axes, with their basis-state kets on the tips and the axis letters on the positive ones.
    let axes = [
        {dir: [1, 0, 0], ket: '|+⟩', letter: 'x'},
        {dir: [-1, 0, 0], ket: '|−⟩', letter: undefined},
        {dir: [0, 1, 0], ket: '|+i⟩', letter: 'y'},
        {dir: [0, -1, 0], ket: '|−i⟩', letter: undefined},
        {dir: [0, 0, 1], ket: '|0⟩', letter: 'z'},
        {dir: [0, 0, -1], ket: '|1⟩', letter: undefined},
    ];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let axis of axes) {
        let [x, y, z] = axis.dir;
        let tip = project(x, y, z);
        ctx.strokeStyle = tip.depth >= 0 ? Palette.MID_LINE_COLOR : Palette.FAINT_LINE_COLOR;
        ctx.setLineDash(tip.depth >= 0 ? [] : [3, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.setLineDash([]);

        let label = project(x * 1.22, y * 1.22, z * 1.22);
        ctx.fillStyle = tip.depth >= 0 ? Palette.INK_COLOR : Palette.MUTED_TEXT_COLOR;
        ctx.font = `13px ${Typography.MONO_FONT_FAMILY}`;
        ctx.fillText(axis.ket, label.x, label.y);
        if (axis.letter !== undefined) {
            ctx.fillStyle = Palette.MUTED_TEXT_COLOR;
            ctx.font = `11px ${Typography.MONO_FONT_FAMILY}`;
            ctx.fillText(axis.letter, label.x, label.y + 14);
        }
    }

    if (vec === undefined) {
        ctx.fillStyle = Palette.ERROR_COLOR;
        ctx.font = `14px ${Typography.MONO_FONT_FAMILY}`;
        ctx.fillText('NaN', cx, cy);
        return;
    }

    // The state vector, with a dashed drop line to the equator plane as its depth guide.
    let tip = project(vec.x, vec.y, vec.z);
    let foot = project(vec.x, vec.y, 0);
    ctx.strokeStyle = Palette.MUTED_TEXT_COLOR;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(foot.x, foot.y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = Palette.DISPLAY_GATE_FORE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = Palette.DISPLAY_GATE_FORE_COLOR;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = Palette.INK_COLOR;
    ctx.stroke();
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
