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

import {watchDrags, isMiddleClicking, eventPosRelativeTo} from "../browser/MouseWatcher.js"
import {pointIntoCircuitCoords} from "./zoom.js"

/**
 * Wires the canvas's own pointer input: click-to-toggle, grab/drag/drop editing, middle-click
 * delete, and the hover tracking that drives hints and highlights. A drag that starts in the DOM
 * toolbox is not handled here; src/ui/toolboxDrag.js bridges those in.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!HTMLElement} canvasDiv
 * @param {!Revision} revision
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!function(!DisplayedInspector): !DisplayedInspector} syncArea
 * @param {!function(found: !{col: !int, row: !int, gate: !Gate}): void} openGateParamEditor
 * @returns {void}
 */
function initCanvasPointer(canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor) {
    // Positions arrive in the canvas's on-screen pixels; the hand and geometry live in circuit
    // coordinates, which differ from those by the zoom factor.
    const intoCircuit = pt => pt === undefined ? undefined : pointIntoCircuitCoords(pt);
    const circuitPosOf = ev => pointIntoCircuitCoords(eventPosRelativeTo(ev, canvas));

    /** @type {undefined|!string} */
    let clickDownGateButtonKey = undefined;
    canvasDiv.addEventListener('click', ev => {
        // Relative to the canvas, not canvasDiv: canvasDiv is a scroll container, and drawn
        // coordinates move with the canvas when it scrolls.
        let pt = circuitPosOf(ev);
        let curInspector = displayed.get();
        if (curInspector.tryGetHandOverButtonKey() !== clickDownGateButtonKey) {
            return;
        }
        let syncedInspector = syncArea(curInspector.withHand(curInspector.hand.withPos(pt)));
        let buttonGate = syncedInspector.displayedCircuit.findGateWithButtonContaining(pt);
        if (buttonGate !== undefined && buttonGate.gate.paramDialog !== undefined) {
            openGateParamEditor(buttonGate);
            return;
        }
        let clicked = syncedInspector.tryClick();
        if (clicked !== undefined) {
            revision.commit(clicked.afterTidyingUp().snapshot());
        }
    });

    watchDrags(canvasDiv,
        /**
         * Grab
         * @param {!Point} pt
         * @param {!MouseEvent|!TouchEvent} ev
         */
        (pt, ev) => {
            let oldInspector = displayed.get();
            let newHand = oldInspector.hand.withPos(intoCircuit(pt));
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
         * Cancel
         * @param {!MouseEvent|!TouchEvent} ev
         */
        ev => {
            revision.cancelCommitBeingWorkedOn();
            ev.preventDefault();
        },
        /**
         * Drag
         * @param {undefined|!Point} pt
         * @param {!MouseEvent|!TouchEvent} ev
         */
        (pt, ev) => {
            if (!displayed.get().hand.isBusy()) {
                return;
            }

            let newHand = displayed.get().hand.withPos(intoCircuit(pt));
            let newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
            ev.preventDefault();
        },
        /**
         * Drop
         * @param {undefined|!Point} pt
         * @param {!MouseEvent|!TouchEvent} ev
         */
        (pt, ev) => {
            if (!displayed.get().hand.isBusy()) {
                return;
            }

            let newHand = displayed.get().hand.withPos(intoCircuit(pt));
            let newInspector = syncArea(displayed.get()).withHand(newHand).afterDropping().afterTidyingUp();
            let clearHand = newInspector.hand.withPos(undefined);
            let clearInspector = newInspector.withJustEnoughWires(clearHand, 0);
            revision.commit(clearInspector.snapshot());
            ev.preventDefault();
        },
        canvas);

    // Middle-click to delete a gate.
    canvasDiv.addEventListener('mousedown', ev => {
        if (!isMiddleClicking(ev)) {
            return;
        }
        let cur = syncArea(displayed.get());
        let initOver = cur.tryGetHandOverButtonKey();
        let newHand = cur.hand.withPos(circuitPosOf(ev));
        let newInspector;
        if (initOver !== undefined && initOver.startsWith('wire-init-')) {
            let newCircuit = cur.displayedCircuit.circuitDefinition.withSwitchedInitialStateOn(
                parseInt(initOver.substr(10)), 0);
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

    // When mouse moves without dragging, track it (for showing hints and things).
    canvasDiv.addEventListener('mousemove', ev => {
        if (!displayed.get().hand.isBusy()) {
            let newHand = displayed.get().hand.withPos(circuitPosOf(ev));
            let newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
        }
    });
    canvasDiv.addEventListener('mouseleave', () => {
        if (!displayed.get().hand.isBusy()) {
            let newHand = displayed.get().hand.withPos(undefined);
            let newInspector = displayed.get().withHand(newHand);
            displayed.set(newInspector);
        }
    });
}

export {initCanvasPointer}
