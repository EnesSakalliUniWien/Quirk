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

import {watchPointerDrags, eventPosRelativeTo} from "../../browser/PointerDrag.js"
import {pointIntoCircuitCoords} from "./zoom.js"

/**
 * Wires the canvas's own pointer input: click-to-toggle, grab/drag/drop editing, middle-click
 * delete, and the hover tracking that drives hints and highlights. A drag that starts in the DOM
 * toolbox is not handled here; src/app/canvas/toolboxDrag.js bridges those in.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!HTMLElement} canvasDiv
 * @param {!Revision} revision
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!function(!DisplayedInspector): !DisplayedInspector} syncArea
 * @param {!function(found: !{col: !int, row: !int, gate: !Gate}): void} openGateParamEditor
 * @param {!function(target: !{row: !int, col: undefined|!int}): void} openBlochSphereView
 * @returns {void}
 */
function initCanvasPointer(canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor,
                           openBlochSphereView) {
    // Positions arrive in the canvas's on-screen pixels; the hand and geometry live in circuit
    // coordinates, which differ from those by the zoom factor and the scroll.
    const intoCircuit = pt => pt === undefined ? undefined : pointIntoCircuitCoords(pt);
    const circuitPosOf = ev => pointIntoCircuitCoords(eventPosRelativeTo(ev, canvas));

    /** @type {undefined|!string} */
    let clickDownGateButtonKey = undefined;
    /** @type {undefined|!Point} Where the gesture pressed down, in circuit coordinates. */
    let gestureDownPos = undefined;
    canvasDiv.addEventListener('click', ev => {
        // Relative to the canvas, not canvasDiv: the canvas is pinned to the scroll container's
        // visible corner, and the conversion adds the scroll back.
        const pt = circuitPosOf(ev);
        const curInspector = displayed.get();
        if (curInspector.tryGetHandOverButtonKey() !== clickDownGateButtonKey) {
            return;
        }
        const syncedInspector = syncArea(curInspector.withHand(curInspector.hand.withPos(pt)));
        const buttonGate = syncedInspector.displayedCircuit.findGateWithButtonContaining(pt);
        if (buttonGate !== undefined && buttonGate.gate.paramDialog !== undefined) {
            openGateParamEditor(buttonGate);
            return;
        }
        // A stationary click on a Bloch sphere opens the enlarged view; the distance check keeps
        // a drag that happens to end on a sphere from opening it.
        const wasStationary = gestureDownPos !== undefined &&
            Math.hypot(pt.x - gestureDownPos.x, pt.y - gestureDownPos.y) < 6;
        if (wasStationary) {
            const bloch = syncedInspector.displayedCircuit.findBlochSphereContaining(pt);
            if (bloch !== undefined) {
                openBlochSphereView(bloch);
                return;
            }
        }
        const clicked = syncedInspector.tryClick();
        if (clicked !== undefined) {
            revision.commit(clicked.afterTidyingUp().snapshot());
        }
    });

    watchPointerDrags(canvasDiv, {
        /**
         * Grab
         * @param {!Point} pt
         * @param {!PointerEvent} ev
         */
        onGrab: (pt, ev) => {
            const oldInspector = displayed.get();
            const newHand = oldInspector.hand.withPos(intoCircuit(pt));
            gestureDownPos = newHand.pos;
            let newInspector = syncArea(oldInspector.withHand(newHand));
            clickDownGateButtonKey = (
                ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey ? undefined : newInspector.tryGetHandOverButtonKey());
            if (clickDownGateButtonKey !== undefined) {
                displayed.set(newInspector);
                return;
            }

            newInspector = newInspector.afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey);
            if (displayed.get().isEqualTo(newInspector) || !newInspector.hand.isBusy()) {
                return;
            }

            // Add extra wire temporarily.
            revision.startedWorkingOnCommit();
            displayed.set(
                syncArea(oldInspector.withHand(newHand).withJustEnoughWires(newInspector.hand, 1)).
                    afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey, false, ev.altKey));

            ev.preventDefault();
        },
        /**
         * Cancel: the browser took the pointer for scrolling, or the touch was interrupted.
         * @param {!PointerEvent} ev
         */
        onCancel: ev => {
            revision.cancelCommitBeingWorkedOn();
            ev.preventDefault();
        },
        /**
         * Drag
         * @param {undefined|!Point} pt
         * @param {!PointerEvent} ev
         */
        onDrag: (pt, ev) => {
            if (!displayed.get().hand.isBusy()) {
                return;
            }

            const newHand = displayed.get().hand.withPos(intoCircuit(pt));
            const newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
            ev.preventDefault();
        },
        /**
         * Drop
         * @param {undefined|!Point} pt
         * @param {!PointerEvent} ev
         */
        onDrop: (pt, ev) => {
            if (!displayed.get().hand.isBusy()) {
                return;
            }

            const newHand = displayed.get().hand.withPos(intoCircuit(pt));
            const newInspector = syncArea(displayed.get()).withHand(newHand).afterDropping().afterTidyingUp();
            const clearHand = newInspector.hand.withPos(undefined);
            const clearInspector = newInspector.withJustEnoughWires(clearHand, 0);
            revision.commit(clearInspector.snapshot());
            ev.preventDefault();
        },
    }, canvas);

    // Middle-click to delete a gate.
    canvasDiv.addEventListener('pointerdown', ev => {
        if (ev.pointerType !== 'mouse' || ev.button !== 1) {
            return;
        }
        const cur = syncArea(displayed.get());
        const initOver = cur.tryGetHandOverButtonKey();
        const newHand = cur.hand.withPos(circuitPosOf(ev));
        let newInspector;
        if (initOver !== undefined && initOver.startsWith('wire-init-')) {
            const newCircuit = cur.displayedCircuit.circuitDefinition.withSwitchedInitialStateOn(
                parseInt(initOver.slice(10)), 0);
            newInspector = cur.withCircuitDefinition(newCircuit).withHand(newHand).afterTidyingUp();
        } else {
            newInspector = cur.
                withHand(newHand).
                afterGrabbing(false, false, true, false). // Grab the gate.
                withHand(newHand). // Lose the gate.
                afterTidyingUp().
                withJustEnoughWires(newHand, 0);
        }
        if (!displayed.get().isEqualTo(newInspector)) {
            revision.commit(newInspector.snapshot());
            ev.preventDefault();
        }
    });

    // When the mouse moves without dragging, track it (for showing hints and things). A finger
    // has no hover, so touch moves outside a drag are left alone.
    canvasDiv.addEventListener('pointermove', ev => {
        if (ev.pointerType === 'mouse' && !displayed.get().hand.isBusy()) {
            const newHand = displayed.get().hand.withPos(circuitPosOf(ev));
            const newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
        }
    });
    canvasDiv.addEventListener('pointerleave', ev => {
        if (ev.pointerType === 'mouse' && !displayed.get().hand.isBusy()) {
            const newHand = displayed.get().hand.withPos(undefined);
            const newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
        }
    });
}

export {initCanvasPointer}
