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

import {Layout} from "../config/Layout.js"
import {Point} from "../math/Point.js"
import {eventPosRelativeTo} from "../browser/MouseWatcher.js"
import {pointIntoCircuitCoords} from "./zoom.js"

/**
 * Bridges a grab in the DOM toolbox onto the canvas's hand.
 *
 * The canvas's own drag watcher only sees presses that start on the canvas, so a gate taken from
 * the sidebar needs its own tracker. It ends the same way a canvas drag does: commit the drop, or
 * cancel and put everything back.
 *
 * @param {!HTMLCanvasElement} canvas The element drag positions are measured against.
 * @param {!Revision} revision
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!function(!DisplayedInspector): !DisplayedInspector} syncArea
 * @returns {!function(!Gate, !MouseEvent|!Touch): void} Starts dragging the given gate from the
 *     given pointer. Passed to initToolbox as its onGrab callback.
 */
function initToolboxDrag(canvas, revision, displayed, syncArea) {
    /** @type {undefined|!function(): void} */
    let stopDrag = undefined;

    /**
     * @param {!Gate} gate
     * @param {!MouseEvent|!Touch} pointer
     */
    return (gate, pointer) => {
        if (stopDrag !== undefined) {
            stopDrag();
        }

        const handAt = source => displayed.get().hand.
            withPos(pointIntoCircuitCoords(eventPosRelativeTo(source, canvas))).
            withHeldGate(gate, new Point(Layout.GATE_RADIUS, Layout.GATE_RADIUS));

        revision.startedWorkingOnCommit();
        let grabbed = handAt(pointer);
        displayed.set(syncArea(displayed.get().withHand(grabbed)).withJustEnoughWires(grabbed, 1));

        const onMove = source => {
            displayed.set(displayed.get().withHand(handAt(source)));
        };
        const onDrop = source => {
            stopDrag();
            let dropped = syncArea(displayed.get().withHand(handAt(source))).afterDropping().afterTidyingUp();
            let clearHand = dropped.hand.withPos(undefined);
            revision.commit(dropped.withJustEnoughWires(clearHand, 0).snapshot());
        };

        const mouseMove = ev => { onMove(ev); ev.preventDefault(); };
        const mouseUp = ev => { onDrop(ev); ev.preventDefault(); };
        const touchMove = ev => { onMove(ev.changedTouches[0]); ev.preventDefault(); };
        const touchEnd = ev => { onDrop(ev.changedTouches[0]); ev.preventDefault(); };
        const touchCancel = () => {
            stopDrag();
            revision.cancelCommitBeingWorkedOn();
        };

        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
        document.addEventListener('touchmove', touchMove, {passive: false});
        document.addEventListener('touchend', touchEnd, {passive: false});
        document.addEventListener('touchcancel', touchCancel);
        stopDrag = () => {
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
            document.removeEventListener('touchmove', touchMove);
            document.removeEventListener('touchend', touchEnd);
            document.removeEventListener('touchcancel', touchCancel);
            stopDrag = undefined;
        };
    };
}

/**
 * Places a gate with no pointer involved: it lands in a fresh column at the end of the circuit,
 * on the top wire, through the same drop pipeline a drag ends with. This is how a gate chosen
 * with the keyboard reaches the circuit.
 *
 * @param {!Revision} revision
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!function(!DisplayedInspector): !DisplayedInspector} syncArea
 * @returns {!function(!Gate): void} Passed to initToolbox as its onPlace callback.
 */
function initToolboxKeyboardPlace(revision, displayed, syncArea) {
    return gate => {
        let cur = syncArea(displayed.get());
        let endColumn = cur.displayedCircuit.circuitDefinition.columns.length;
        let pt = cur.displayedCircuit.gateRect(0, endColumn).center();
        let held = cur.hand.
            withPos(pt).
            withHeldGate(gate, new Point(Layout.GATE_RADIUS, Layout.GATE_RADIUS));
        let dropped = syncArea(cur.withHand(held).withJustEnoughWires(held, 1)).
            afterDropping().
            afterTidyingUp();
        let clearHand = dropped.hand.withPos(undefined);
        revision.commit(dropped.withJustEnoughWires(clearHand, 0).snapshot());
    };
}

export {initToolboxDrag, initToolboxKeyboardPlace}
