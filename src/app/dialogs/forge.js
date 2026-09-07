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

import {fitParagraph} from '../../draw/pixi/TextLayout.js';
import {drawingArea} from '../../draw/pixi/DisplayView.js';
import {rectangle, strokePath} from '../../draw/pixi/ShapeView.js';

import {CircuitDefinition} from '../../circuit/model/CircuitDefinition.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {drawCircuitTooltip} from '../../editor/DisplayedCircuit.js';
import {GateBuilder} from '../../circuit/model/Gate.js';
import {MathPainter} from '../../draw/MathPainter.js';
import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {Observable, ObservableValue} from '../../base/Obs.js';
import {RenderSurface} from '../../draw/pixi/RenderSurface.js';
import {Point} from '../../geometry/Point.js';
import {Rect} from '../../geometry/Rect.js';
import {fromJsonText_CircuitDefinition, Serializer} from '../../circuit/serialization/Serializer.js';
import {textEditObservable} from '../../browser/EventUtil.js';
import {
    randomCustomGateId,
    valueElsePlaceholder,
    parseUserRotation,
    parseUserMatrix,
    parseUserGateFromCircuitRange,
} from './customGateParsing.js';

/**
 * Interface note: also requires the forge panel's #gate-forge-* inputs, canvases, and buttons,
 * shipped in quirk.html's dialog stash and mounted by src/components/dialogs/forge-dialog.jsx
 * before this runs. The toolbar button that opens the panel lives in
 * src/components/toolbar/app-toolbar.jsx.
 *
 * @param {!Revision} revision
 * @param {!OverlayState} overlayState
 * @param {!function(): !number} getCycleTime Where the app's animation cycle is, from 0 to 1;
 *     the gate previews animate against the same clock as the circuit.
 */
function initForge(revision, overlayState, getCycleTime) {
    const obsActiveOverlay = overlayState.active();
    const obsForgeIsShowing = obsActiveOverlay.map(active => active === "forge").whenDifferent();
    const obsOnShown = obsForgeIsShowing.filter(e => e === true);
    /** @type {!String} */
    let latestInspectorText;
    revision.latestActiveCommit().subscribe(e => { latestInspectorText = e; });

    function computeAndPaintOp(canvas, opGetter, button) {
        button.disabled = true;
        let painter = RenderSurface.forCanvas(canvas).beginFrame();
        rectangle(painter, drawingArea(painter), {fill: CanvasTheme.surface.gate});
        let d = Math.min((canvas.width - 5)/2, canvas.height);
        let rect1 = new Rect(0, 0, d, d);
        let rect2 = new Rect(d + 5, 0, d, d);
        try {
            let op = opGetter();
            MathPainter.paintMatrix(
                painter,
                op,
                rect1,
                CanvasTheme.operation.fill,
                CanvasTheme.text.primary,
                undefined,
                CanvasTheme.operation.background,
                undefined,
                CanvasTheme.transparent);
            if (!op.isUnitary(0.009)) {
                fitParagraph(painter, 'NOT UNITARY', rect2, {
                    alignment: new Point(0.5, 0.5),
                    fill: CanvasTheme.error.text,
                    maxFontSize: 24
                });
            } else  if (op.width() !== 2) {
                fitParagraph(painter, '(Not a 1-qubit rotation)', rect2, {
                    alignment: new Point(0.5, 0.5),
                    fill: CanvasTheme.text.muted,
                    maxFontSize: 20
                });
            } else {
                MathPainter.paintBlochSphereRotation(
                    painter,
                    op,
                    rect2,
                    CanvasTheme.operation.background,
                    CanvasTheme.operation.fill);
            }
            let cx = (rect1.right() + rect2.x)/2;
            strokePath(painter, [new Point(cx, 0), new Point(cx, canvas.height)], CanvasTheme.text.primary, 2);
            if (!op.hasNaN()) {
                button.disabled = false;
            }
        } catch (ex) {
            fitParagraph(painter, ex+"", new Rect(0, 0, canvas.width, canvas.height), {
                alignment: new Point(0.5, 0.5),
                fill: CanvasTheme.error.text,
                maxFontSize: 24
            });
        }
    }

    /**
     * @param {!Gate} gate
     * @param {undefined|!CircuitDefinition=undefined} circuitDef
     */
    function createCustomGateAndClose(gate, circuitDef=undefined) {
        let c = circuitDef || fromJsonText_CircuitDefinition(latestInspectorText);
        revision.commit(JSON.stringify(Serializer.toJson(c.withCustomGate(gate)), null, 0));
        overlayState.close();
    }

    /**
     * Redraws whenever the dialog opens or any of the watched inputs changes, rate-limited so
     * typing doesn't recompute on every keystroke.
     *
     * @param {!Array.<!Observable>} inputObservables
     * @param {!function(): void} redraw
     */
    function redrawOnShownOrEdited(inputObservables, redraw) {
        Observable.of(obsOnShown, ...inputObservables).
            flatten().
            throttleLatest(100).
            subscribe(redraw);
    }

    /**
     * One matrix-based forge method: parse the inputs into an operation, preview it beside its
     * Bloch rotation, and on confirmation wrap it in a gate and commit it. The rotation and
     * matrix sections are both this skeleton; only their inputs, parsing, and gate dressing
     * differ.
     *
     * @param {!{
     *     canvasId: !string,
     *     buttonId: !string,
     *     nameBoxId: !string,
     *     inputObservables: !Array.<!Observable>,
     *     parseOp: !function(): !Matrix,
     *     buildGate: !function(!Matrix, !string): !Gate
     * }} method
     */
    function initMatrixMethod({canvasId, buttonId, nameBoxId, inputObservables, parseOp, buildGate}) {
        const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById(canvasId);
        const button = /** @type {!HTMLInputElement} */ document.getElementById(buttonId);
        const nameBox = /** @type {!HTMLInputElement} */ document.getElementById(nameBoxId);
        obsOnShown.subscribe(() => { nameBox.value = ""; });

        redrawOnShownOrEdited(inputObservables, () => computeAndPaintOp(canvas, parseOp, button));

        button.addEventListener('click', () => {
            let mat;
            try {
                mat = parseOp();
            } catch (ex) {
                console.warn(ex);
                return; // Button is about to be disabled, so no handling required.
            }
            createCustomGateAndClose(buildGate(mat, nameBox.value));
        });
    }

    (() => {
        const txtAxis = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-rotation-axis');
        const txtAngle = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-rotation-angle');
        const txtPhase = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-rotation-phase');

        initMatrixMethod({
            canvasId: 'gate-forge-rotation-canvas',
            buttonId: 'gate-forge-rotation-button',
            nameBoxId: 'gate-forge-rotation-name',
            inputObservables: [txtPhase, txtAxis, txtAngle].map(textEditObservable),
            parseOp: () => parseUserRotation(
                valueElsePlaceholder(txtAngle),
                valueElsePlaceholder(txtPhase),
                valueElsePlaceholder(txtAxis)),
            buildGate: (mat, name) => new GateBuilder().
                setSerializedId(randomCustomGateId()).
                setSymbol(name).
                setTitle('Custom Rotation Gate').
                setKnownEffectToMatrix(mat).
                gate
        });
    })();

    (() => {
        const txtMatrix = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-matrix');
        const chkFix = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-matrix-fix');

        initMatrixMethod({
            canvasId: 'gate-forge-matrix-canvas',
            buttonId: 'gate-forge-matrix-button',
            nameBoxId: 'gate-forge-matrix-name',
            inputObservables: [textEditObservable(txtMatrix), Observable.elementEvent(chkFix, 'change')],
            parseOp: () => parseUserMatrix(valueElsePlaceholder(txtMatrix), chkFix.checked),
            buildGate: (mat, rawName) => {
                let name = rawName.trim();
                let h = Math.round(Math.log2(mat.height()));
                return new GateBuilder().
                    setSerializedId(randomCustomGateId()).
                    setSymbol(name).
                    setTitle('Custom Matrix Gate').
                    setHeight(h).
                    setWidth(name === '' ? h : 1).
                    setKnownEffectToMatrix(mat).
                    gate;
            }
        });
    })();

    (() => {
        const circuitCanvas = /** @type {!HTMLCanvasElement} */ document.getElementById('gate-forge-circuit-canvas');
        const txtCols = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-circuit-cols');
        const txtRows = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-circuit-rows');
        const spanInputs = /** @type {!HTMLElement} */ document.getElementById('gate-forge-circuit-inputs');
        const spanWeight = /** @type {!HTMLElement} */ document.getElementById('gate-forge-circuit-weight');
        const circuitButton = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-circuit-button');
        const txtName = /** @type {!HTMLInputElement} */ document.getElementById('gate-forge-circuit-name');
        obsOnShown.subscribe(() => { txtName.value = ""; });

        /** @returns {{gate: !Gate, circuit: !CircuitDefinition}} */
        function parseEnteredCircuitGate() {
            let circuit = fromJsonText_CircuitDefinition(latestInspectorText);
            let gate = parseUserGateFromCircuitRange(
                circuit,
                valueElsePlaceholder(txtCols),
                valueElsePlaceholder(txtRows),
                txtName.value.trim());
            return {gate, circuit};
        }

        let latestGate = new ObservableValue(undefined);
        let drawGate = (painter, gate) => drawCircuitTooltip(
            painter,
            gate.knownCircuitNested,
            new Rect(0, 0, circuitCanvas.width, circuitCanvas.height),
            true,
            getCycleTime());

        latestGate.observable().
            zipLatest(obsForgeIsShowing, (g, s) => s ? g : undefined).
            map(e => e === undefined || e.gate.stableDuration() === Infinity ?
                Observable.of() :
                Observable.requestAnimationTicker().map(_ => e)).
            flattenLatest().
            subscribe(e => {
                let painter = RenderSurface.forCanvas(circuitCanvas).beginFrame();
                rectangle(painter, drawingArea(painter), {fill: CanvasTheme.surface.gate});
                drawGate(painter, e.gate);
            });

        let redraw = () => {
            circuitButton.disabled = true;
            let painter = RenderSurface.forCanvas(circuitCanvas).beginFrame();
            rectangle(painter, drawingArea(painter), {fill: CanvasTheme.surface.gate});
            try {
                let {gate} = parseEnteredCircuitGate();
                let keys = gate.getUnmetContextKeys();
                spanInputs.innerText = keys.size === 0 ?
                    "(none)" :
                    [...keys].map(e => e.replace("Input Range ", "").
                                         replace("Input NO_DEFAULT Range ", "")).join(", ");
                spanWeight.innerText = "" + gate.knownCircuit.gateWeight();
                drawGate(painter, gate);
                circuitButton.disabled = false;
                latestGate.set({gate});
            } catch (ex) {
                latestGate.set(undefined);
                spanInputs.innerText = "(err)";
                spanWeight.innerText = "(err)";
                fitParagraph(painter, ex+"", new Rect(0, 0, circuitCanvas.width, circuitCanvas.height), {
                    alignment: new Point(0.5, 0.5),
                    fill: CanvasTheme.error.text,
                    maxFontSize: 24
                });
            }
        };

        redrawOnShownOrEdited([txtCols, txtRows].map(textEditObservable), redraw);

        circuitButton.addEventListener('click', () => {
            try {
                let {gate, circuit} = parseEnteredCircuitGate();
                createCustomGateAndClose(gate, circuit);
            } catch (ex) {
                // Button is about to be disabled, so no handling required.
                console.warn(ex);
            }
        });
    })();
}

export {initForge}
