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

import {watchPixiPointerDrags} from '../../editor/interaction/PixiPointerGestures.js';
import {rangeBetween, selectionRect} from '../../editor/interaction/RangeSelection.js';
import {RenderSurface} from '../../draw/surface/RenderSurface.js';
import {Point} from '../../geometry/Point.js';


/** How long a touch held still waits before it opens a menu or starts a selection box. */
const TOUCH_HOLD_MILLIS = 500;
/** How far, in page pixels, a held touch may drift and still count as held still. */
const TOUCH_HOLD_SLOP = 8;

/**
 * Wires the canvas's own pointer input: click-to-toggle, grab/drag/drop editing, middle-click
 * delete, a selection box dragged from an empty part of the canvas, the menus a right click or a
 * touch held still opens, and the hover tracking that drives hints and highlights. A drag that
 * starts in the DOM toolbox is not handled here; src/app/canvas/toolboxDrag.js bridges those in.
 *
 * Modifiers follow the platform's own: Option (Alt) held when a dragged gate is dropped leaves the
 * original where it was, so the drag copies it - let go of Option before dropping, and it moves.
 * Command (Ctrl) takes the whole column, and Shift takes the gates' alternates, such as inverses.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!HTMLElement} canvasDiv
 * @param {!Revision} revision
 * @param {import("zustand/vanilla").StoreApi<{value: !EditorState}>} displayed
 * @param {!function(!EditorState): !EditorState} syncArea
 * @param {!function(found: !{col: !int, row: !int, gate: !Gate}): void} openGateParamEditor
 * @param {!function(target: !{row: !int, col: undefined|!int}): void} openBlochSphereView
 * @param {!function(name: !string, rect: !Rect): void} openRegisterRename Opens the inline rename box
 *     over the register's name, whose place in circuit coordinates is `rect`.
 * @param {!function(target: !{wire: !int, register: (undefined|!string), rect: (undefined|!Rect),
 *     x: !number, y: !number}): void} openGutterMenu Opens the menu for a wire label, at the client position.
 * @param {!function(dx: !number, dy: !number): void} panViewport
 * @param {undefined|!function(target: !{col: !int, row: !int, gate: !Gate}): void} openComplexDisplay
 * @param {!function(target: !{col: !int, row: !int, gate: !Gate, x: !number, y: !number}): void} openGateMenu
 *     Opens the menu for a gate in its slot, at the client position.
 * @param {!SelectionActions} selection The selected part of the circuit, which a box drag sets.
 * @param {!function(at: !{x: !number, y: !number}): void} openSelectionMenu Opens the selection's
 *     menu at the client position.
 * @returns {void}
 */
function initCanvasPointer(canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor,
                           openBlochSphereView, openRegisterRename, openGutterMenu, panViewport, openComplexDisplay,
                           openGateMenu, selection, openSelectionMenu) {
    // Positions arrive in the canvas's on-screen pixels; the hand and geometry live in circuit
    // coordinates, which differ from those by the zoom factor and the scroll.
    const surface = RenderSurface.forCanvas(canvas);
    const stage = surface.app.stage;
    const intoCircuit = pt => pt;
    const circuitPosOf = ev => {
        const local = ev.getLocalPosition(surface.view.native);
        return new Point(local.x, local.y);
    };

    /**
     * Puts the inline rename box over a register's name.
     * @param {!string} name
     */
    const renameRegister = name => {
        const circuit = syncArea(displayed.getState().value).displayedCircuit;
        const register = circuit.circuitDefinition.registers.named(name);
        if (register !== undefined) {
            openRegisterRename(name, circuit.geometry().registerNameRect(register.start, register.length));
        }
    };


    /** @type {undefined|!string} */
    let clickDownGateButtonKey = undefined;
    const buttonKey = target => target?.type === 'button' ? 'gate-button-' + target.col + ':' + target.row :
        target?.type === 'initial' ? 'wire-init-' + target.row : undefined;
    /** @type {undefined|!Point} Where the gesture pressed down, in circuit coordinates. */
    let gestureDownPos = undefined;
    let touchPanPosition;
    /**
     * The two ways a gate picked up can land, fixed when it is picked up: moved out of its slot, or
     * copied, the original left where it was. Option held at the drop chooses the copy, and the
     * circuit shows the choice while the gate is dragged.
     * @type {undefined|!{moved: !CircuitViewState, copied: !CircuitViewState}}
     */
    let grabbed = undefined;
    const withDropChoice = (state, variants, ev) => variants === undefined ? state :
        state.withDisplayedCircuit(ev.altKey ? variants.copied : variants.moved);

    // A right click on a gate, its change button or its resize tab opens the gate's menu; on a wire
    // label, the label's; elsewhere inside the selection, the selection's. The browser's own menu
    // would open over any of them, and on macOS it fires on the press, before Pixi's rightclick, so
    // the press remembers whether it landed on one.
    const isGateMenuTarget = target =>
        target?.type === 'gate' || target?.type === 'button' || target?.type === 'resize';
    const isMenuTarget = target => isGateMenuTarget(target) || target?.type === 'wire' || target?.type === 'register';
    const isInsideSelection = pos => {
        const range = selection.range();
        return range !== undefined &&
            selectionRect(syncArea(displayed.getState().value).displayedCircuit.geometry(), range).containsPoint(pos);
    };

    /**
     * Opens the menu a right click or a touch held still asks for at the point: a gate's, a wire
     * label's, or elsewhere inside the selection, the selection's.
     *
     * @param {*} target The circuit target under the point.
     * @param {!Point} pos The point, in circuit coordinates.
     * @param {!number} x
     * @param {!number} y The point in client coordinates, where the menu opens.
     * @returns {!boolean} Whether a menu opened.
     */
    const openMenuAt = (target, pos, x, y) => {
        const circuit = syncArea(displayed.getState().value).displayedCircuit;
        if (isGateMenuTarget(target)) {
            openGateMenu({col: target.col, row: target.row, gate: target.gate, x, y});
            return true;
        }
        if (target?.type === 'wire' || target?.type === 'register') {
            const register = circuit.circuitDefinition.registers.at(target.row);
            openGutterMenu({
                wire: circuit.indexOfDisplayedRowAt(pos.y),
                register: register?.name,
                // Where the register's name is, for the menu's rename to put the box over it.
                rect: register === undefined ? undefined :
                    circuit.geometry().registerNameRect(register.start, register.length),
                x,
                y,
            });
            return true;
        }
        if (isInsideSelection(pos)) {
            openSelectionMenu({x, y});
            return true;
        }
        return false;
    };

    /**
     * A touch has no right button, so a touch held still stands in for one: on a gate, a wire label
     * or the selection it opens the menu a right click would, putting back whatever the press picked
     * up; on an empty part of the circuit it starts a selection box, the way a mouse press there
     * does, and the finger drags it out. A touch that moves first drags or scrolls as before.
     * @type {undefined|!{timer: *, x: !number, y: !number, pointerId: !number, before: !EditorState,
     *     target: *, pos: !Point}}
     */
    let touchHold = undefined;
    const stopTouchHold = () => {
        if (touchHold !== undefined) {
            clearTimeout(touchHold.timer);
            touchHold = undefined;
        }
    };
    const heldStill = ({pointerId, before, target, pos, x, y}) => {
        if (isMenuTarget(target) || isInsideSelection(pos)) {
            // The drag ends here, and whatever it picked up goes back. Pixi reuses its event
            // objects, so the press is named by its pointer rather than kept.
            gestures.cancel({pointerId, preventDefault: () => {}});
            grabbed = undefined;
            displayed.setState({value: before});
            openMenuAt(target, pos, x, y);
        } else if (target === undefined) {
            touchPanPosition = undefined;
            displayed.setState({value: syncArea(before.withHand(before.hand.withPos(pos).withSelectingRange(pos)))});
        }
    };

    stage.on('pointertap', ev => {
        if (ev.button !== 0) return;

        // Relative to the canvas, not canvasDiv: the canvas is pinned to the scroll container's
        // visible corner, and the conversion adds the scroll back.
        const pt = circuitPosOf(ev);
        const curInspector = displayed.getState().value;
        if (buttonKey(ev.target.circuitTarget) !== clickDownGateButtonKey) {
            return;
        }
        const syncedInspector = syncArea(curInspector.withHand(curInspector.hand.withPos(pt)));
        const target = ev.target.circuitTarget;
        const buttonGate = target?.type === 'button' ? target : undefined;
        if (buttonGate !== undefined && buttonGate.gate.paramDialog !== undefined) {
            openGateParamEditor(buttonGate);
            return;
        }
        // A stationary click on a Bloch sphere opens the enlarged view; the distance check keeps
        // a drag that happens to end on a sphere from opening it.
        const wasStationary = gestureDownPos !== undefined &&
            Math.hypot(pt.x - gestureDownPos.x, pt.y - gestureDownPos.y) < 6;
        if (wasStationary) {
            // Pixi's click count distinguishes a double click on the same retained target.
            const register = target?.type === 'register' || target?.type === 'wire' ?
                syncedInspector.displayedCircuit.circuitDefinition.registers.at(target.row) : undefined;
            if (register !== undefined) {
                if (ev.detail === 2) {
                    renameRegister(register.name);
                }
                return;
            }
            if (target?.type === 'gate' && /^(Amps[0-9]+|Density[0-9]*)$/.test(target.gate.serializedId)) {
                openComplexDisplay?.(target);
                return;
            }
            const bloch = target?.type === 'bloch' ? {row: target.row, col: undefined} :
                target?.type === 'gate' && target.gate.serializedId === 'Bloch' ? target : undefined;
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

    const gestures = watchPixiPointerDrags(stage, {
        /**
         * Grab
         * @param {!Point} pt
         * @param {!PointerEvent} ev
         */
        onGrab: (pt, ev) => {
            touchPanPosition = ev.pointerType === 'touch' ? {x: ev.clientX, y: ev.clientY} : undefined;
            const oldInspector = displayed.getState().value;
            const newHand = oldInspector.hand.withPos(intoCircuit(pt));
            gestureDownPos = newHand.pos;
            stopTouchHold();
            grabbed = undefined;
            if (ev.pointerType === 'touch') {
                const hold = {x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId, before: oldInspector,
                    target: ev.target.circuitTarget, pos: newHand.pos};
                touchHold = {...hold, timer: setTimeout(() => {
                    touchHold = undefined;
                    heldStill(hold);
                }, TOUCH_HOLD_MILLIS)};
            }

            let newInspector = syncArea(oldInspector.withHand(newHand));
            clickDownGateButtonKey = (
                ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey ? undefined : buttonKey(ev.target.circuitTarget));
            if (clickDownGateButtonKey !== undefined) {
                displayed.setState({value: newInspector});
                return;
            }

            newInspector = newInspector.afterGrabbing(false, ev.ctrlKey || ev.metaKey);
            if (displayed.getState().value.isEqualTo(newInspector) || !newInspector.hand.isBusy()) {
                // A mouse or pen press on an empty part of the canvas starts a selection box; a
                // finger there scrolls instead, unless it is held still first. The box edits
                // nothing, so no commit is begun.
                if ((ev.pointerType === 'mouse' || ev.pointerType === 'pen') && ev.target.circuitTarget === undefined &&
                        !(ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)) {
                    displayed.setState({value: syncArea(oldInspector.withHand(newHand.withSelectingRange(newHand.pos)))});
                    // The selection's keys act while the circuit has the focus, and a prevented
                    // press does not move it there.
                    canvasDiv.focus({preventScroll: true});
                    ev.preventDefault();
                }
                return;
            }

            // Add extra wire temporarily - unless the press is on a wire label, picking wires for a
            // register: a wire appearing would move the labels under the pointer.
            revision.startedWorkingOnCommit();
            const extraWires = newInspector.hand.selectingWires === undefined ? 1 : 0;
            const picked = syncArea(oldInspector.withHand(newHand).withJustEnoughWires(extraWires));
            const moved = picked.afterGrabbing(false, ev.ctrlKey || ev.metaKey, false, ev.shiftKey);
            const copied = picked.afterGrabbing(true, ev.ctrlKey || ev.metaKey, false, ev.shiftKey);
            grabbed = {moved: moved.displayedCircuit, copied: copied.displayedCircuit};
            displayed.setState({value: ev.altKey ? copied : moved});

            ev.preventDefault();
        },
        /**
         * Cancel: the browser took the pointer for scrolling, or the touch was interrupted.
         * @param {!PointerEvent} ev
         */
        onCancel: ev => {
            stopTouchHold();
            grabbed = undefined;
            touchPanPosition = undefined;
            gestureDownPos = undefined;
            clickDownGateButtonKey = undefined;
            revision.cancelCommitBeingWorkedOn();
            ev.preventDefault();
        },
        /**
         * Drag
         * @param {undefined|!Point} pt
         * @param {!PointerEvent} ev
         */
        onDrag: (pt, ev) => {
            if (touchHold !== undefined &&
                    Math.hypot(ev.clientX - touchHold.x, ev.clientY - touchHold.y) > TOUCH_HOLD_SLOP) {
                stopTouchHold();
            }
            if (!displayed.getState().value.hand.isBusy()) {
                if (touchPanPosition) {
                    panViewport(touchPanPosition.x - ev.clientX, touchPanPosition.y - ev.clientY);
                    touchPanPosition = {x: ev.clientX, y: ev.clientY};
                }
                return;
            }

            // Pressing or letting go of Option on the way shows the copy or the move the drop makes.
            const current = withDropChoice(displayed.getState().value, grabbed, ev);
            displayed.setState({value: current.withHand(current.hand.withPos(intoCircuit(pt)))});
            ev.preventDefault();
        },
        /**
         * Drop
         * @param {undefined|!Point} pt
         * @param {!PointerEvent} ev
         */
        onDrop: (pt, ev) => {
            stopTouchHold();
            touchPanPosition = undefined;
            const variants = grabbed;
            grabbed = undefined;
            if (!displayed.getState().value.hand.isBusy()) {
                return;
            }

            // A selection box selects the gates it spans; a press that never moved clears the selection.
            const from = displayed.getState().value.hand.selectingRangeFrom;
            if (from !== undefined) {
                const shown = syncArea(displayed.getState().value);
                const end = intoCircuit(pt) ?? shown.hand.pos;
                const moved = end !== undefined && Math.hypot(end.x - from.x, end.y - from.y) >= 6;
                const circuit = shown.displayedCircuit;
                selection.select(moved ? rangeBetween(circuit.circuitDefinition, circuit.geometry(), from, end) : undefined);
                displayed.setState({value: shown.withHand(shown.hand.withPos(end).withDrop())});
                ev.preventDefault();
                return;
            }

            // A press on a wire label that never moved is a click, and a click makes no register.
            const dropPos = intoCircuit(pt);
            if (displayed.getState().value.hand.selectingWires !== undefined && (dropPos === undefined ||
                    gestureDownPos === undefined ||
                    Math.hypot(dropPos.x - gestureDownPos.x, dropPos.y - gestureDownPos.y) < 6)) {
                revision.cancelCommitBeingWorkedOn();
                ev.preventDefault();
                return;
            }

            // Option held at the drop leaves the original where it was.
            const current = withDropChoice(displayed.getState().value, variants, ev);
            const registersBefore = current.displayedCircuit.circuitDefinition.registers;
            const newHand = current.hand.withPos(intoCircuit(pt));
            const newInspector = syncArea(current).withHand(newHand).afterDropping().afterTidyingUp();

            const clearInspector = newInspector.withJustEnoughWires(0);
            revision.commit(clearInspector.snapshot());
            // A drag down the wire labels made a register: offer its name straight away.
            const created = clearInspector.displayedCircuit.circuitDefinition.registers.list.
                find(r => registersBefore.named(r.name) === undefined);
            if (created !== undefined) {
                renameRegister(created.name);
            }
            ev.preventDefault();
        },
    }, circuitPosOf);
    // Pixi forwards pointer releases but does not forward native pointercancel.
    canvas.addEventListener('pointercancel', gestures.cancel);

    let rightPressOpensMenu = false;
    stage.on('pointerdown', ev => {
        if (ev.button === 2) {
            rightPressOpensMenu = isMenuTarget(ev.target.circuitTarget) || isInsideSelection(circuitPosOf(ev));
        }
    });
    const suppressNativeMenu = ev => {
        if (rightPressOpensMenu) {
            ev.preventDefault();
        }
        rightPressOpensMenu = false;
    };
    canvas.addEventListener('contextmenu', suppressNativeMenu);

    stage.once('destroyed', () => {
        canvas.removeEventListener('pointercancel', gestures.cancel);
        canvas.removeEventListener('contextmenu', suppressNativeMenu);
        gestures.dispose();
    });

    // Middle-click to delete a gate.
    stage.on('pointerdown', ev => {
        if (ev.pointerType !== 'mouse' || ev.button !== 1) {
            return;
        }
        const cur = syncArea(displayed.getState().value);
        const initOver = buttonKey(ev.target.circuitTarget);
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
                withJustEnoughWires(0);
        }
        if (!displayed.getState().value.isEqualTo(newInspector)) {
            revision.commit(newInspector.snapshot());
            ev.preventDefault();
        }
    });

    // A right click on a gate opens its menu: switch it off or on, edit its parameter, or delete it.
    // On a wire label, the label's menu: group the wire, or rename, feed or ungroup its register.
    // Elsewhere inside the selection, the selection's menu: copy, cut or delete it. Elsewhere the
    // browser's own menu stays.
    stage.on('rightclick', ev => {
        if (openMenuAt(ev.target.circuitTarget, circuitPosOf(ev), ev.clientX, ev.clientY)) {
            ev.preventDefault();
        }
    });

    // When the mouse moves without dragging, track it (for showing hints and things). A finger
    // has no hover, so touch moves outside a drag are left alone.
    stage.on('pointermove', ev => {
        if (ev.pointerType === 'mouse' && !displayed.getState().value.hand.isBusy()) {
            displayed.getState().setPointer(circuitPosOf(ev));
        }
    });
    stage.on('pointerleave', ev => {
        if (ev.pointerType === 'mouse' && !displayed.getState().value.hand.isBusy()) {
            displayed.getState().setPointer(undefined);
        }
    });
}

export {initCanvasPointer}
