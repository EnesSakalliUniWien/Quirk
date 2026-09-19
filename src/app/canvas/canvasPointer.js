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
import {RenderSurface} from '../../draw/surface/RenderSurface.js';
import {Point} from '../../geometry/Point.js';


/**
 * Wires the canvas's own pointer input: click-to-toggle, grab/drag/drop editing, middle-click
 * delete, and the hover tracking that drives hints and highlights. A drag that starts in the DOM
 * toolbox is not handled here; src/app/canvas/toolboxDrag.js bridges those in.
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
 * @returns {void}
 */
function initCanvasPointer(canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor,
                           openBlochSphereView, openRegisterRename, openGutterMenu, panViewport, openComplexDisplay,
                           openGateMenu) {
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

            let newInspector = syncArea(oldInspector.withHand(newHand));
            clickDownGateButtonKey = (
                ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey ? undefined : buttonKey(ev.target.circuitTarget));
            if (clickDownGateButtonKey !== undefined) {
                displayed.setState({value: newInspector});
                return;
            }

            newInspector = newInspector.afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey);
            if (displayed.getState().value.isEqualTo(newInspector) || !newInspector.hand.isBusy()) {
                return;
            }

            // Add extra wire temporarily - unless the press is on a wire label, picking wires for a
            // register: a wire appearing would move the labels under the pointer.
            revision.startedWorkingOnCommit();
            const extraWires = newInspector.hand.selectingWires === undefined ? 1 : 0;
            displayed.setState(
                {value: syncArea(oldInspector.withHand(newHand).withJustEnoughWires(extraWires)).
                    afterGrabbing(ev.shiftKey, ev.ctrlKey || ev.metaKey, false, ev.altKey)});

            ev.preventDefault();
        },
        /**
         * Cancel: the browser took the pointer for scrolling, or the touch was interrupted.
         * @param {!PointerEvent} ev
         */
        onCancel: ev => {
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
            if (!displayed.getState().value.hand.isBusy()) {
                if (touchPanPosition) {
                    panViewport(touchPanPosition.x - ev.clientX, touchPanPosition.y - ev.clientY);
                    touchPanPosition = {x: ev.clientX, y: ev.clientY};
                }
                return;
            }

            const newHand = displayed.getState().value.hand.withPos(intoCircuit(pt));
            const newInspector = displayed.getState().value.withHand(newHand);
            displayed.setState({value: newInspector});
            ev.preventDefault();
        },
        /**
         * Drop
         * @param {undefined|!Point} pt
         * @param {!PointerEvent} ev
         */
        onDrop: (pt, ev) => {
            touchPanPosition = undefined;
            if (!displayed.getState().value.hand.isBusy()) {
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

            const registersBefore = displayed.getState().value.displayedCircuit.circuitDefinition.registers;
            const newHand = displayed.getState().value.hand.withPos(intoCircuit(pt));
            const newInspector = syncArea(displayed.getState().value).withHand(newHand).afterDropping().afterTidyingUp();

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

    // A right click on a gate, its change button or its resize tab opens the gate's menu; on a wire
    // label, the label's. The browser's own menu would open over either, and on macOS it fires on
    // the press, before Pixi's rightclick, so the press remembers what it landed on.
    const isGateMenuTarget = target =>
        target?.type === 'gate' || target?.type === 'button' || target?.type === 'resize';
    const isMenuTarget = target => isGateMenuTarget(target) || target?.type === 'wire' || target?.type === 'register';
    let rightPressTarget = undefined;
    stage.on('pointerdown', ev => {
        if (ev.button === 2) {
            rightPressTarget = ev.target.circuitTarget;
        }
    });
    const suppressNativeMenu = ev => {
        if (isMenuTarget(rightPressTarget)) {
            ev.preventDefault();
        }
        rightPressTarget = undefined;
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
    // Elsewhere the browser's own menu stays.
    stage.on('rightclick', ev => {
        const circuit = syncArea(displayed.getState().value).displayedCircuit;
        const target = ev.target.circuitTarget;
        if (isGateMenuTarget(target)) {
            openGateMenu({col: target.col, row: target.row, gate: target.gate, x: ev.clientX, y: ev.clientY});
            ev.preventDefault();
            return;
        }
        const found = target?.type === 'wire' || target?.type === 'register' ? {
            wire: circuit.indexOfDisplayedRowAt(circuitPosOf(ev).y),
            register: circuit.circuitDefinition.registers.at(target.row)
        } : undefined;
        if (found !== undefined) {
            const {register} = found;
            openGutterMenu({
                wire: found.wire,
                register: register?.name,
                // Where the register's name is, for the menu's rename to put the box over it.
                rect: register === undefined ? undefined :
                    circuit.geometry().registerNameRect(register.start, register.length),
                x: ev.clientX,
                y: ev.clientY,
            });
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
