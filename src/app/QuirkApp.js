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

import {createEditorStore} from '../editor/state/editorStore.js';
import {createValueStore, observeStore} from '../base/valueStore.js';
import {CircuitStats} from "../engine/simulation/CircuitStats.js"
import {EditorState} from "../editor/state/EditorState.js"
import {Rect} from "../geometry/Rect.js"
import {Revision} from "../base/Revision.js"
import {fromJsonText_CircuitDefinition} from "../serialization/Serializer.js"
import {Util} from "../base/Util.js"

import {CircuitActions} from "./state/CircuitActions.js"
import {RegisterActions} from "./state/RegisterActions.js"
import {Playhead} from "./state/Playhead.js"
import {initToolboxDrag, initToolboxKeyboardPlace} from "./canvas/toolboxDrag.js"
import {initRedrawLoop} from "./canvas/redrawLoop.js"
import {initCanvasPointer} from "./canvas/canvasPointer.js"
import {scheduleBoot} from "./session/boot.js"
import {initUrlCircuitSync} from "./session/url.js"
import {initTitleSync} from "./session/title.js"
import {Recorder} from "./state/Recorder.js";
import {TapeStore} from "../results/tapeStore.js";
import {Simulator} from "./state/Simulator.js"
import {circuitZoom, initZoomControls, attachCircuitScrollSource} from "./canvas/zoom.js"
import {initMinimap} from "./canvas/minimap.js"
import {noteCircuitEdited} from "../diagnostics/errorReporter.js"
import {appStore} from "../state/appStore.js"

/**
 * Starts Quirk once the shell has mounted the circuit's elements. Must be called exactly once.
 *
 * Every element it works on is handed in: nothing here looks the DOM up, and nothing here mounts
 * any UI. What the shell needs back is published through the app store, the way the circuit
 * actions and the playhead already are.
 *
 * @param {!{canvas: !HTMLCanvasElement, canvasDiv: !HTMLElement, scrollSpacer: !HTMLElement,
 *     circuitOverlay: !HTMLElement, onReady: !function(): void,
 *     openGateParamEditor: !function(!{col: !int, row: !int, gate: !Gate}): void,
 *     openBlochSphereView: !function(!{row: !int, col: (undefined|!int)}): void,
 *     openTape: !function(): void}} shell
 * @returns {void}
 */
function startQuirk({canvas, canvasDiv, scrollSpacer, circuitOverlay, onReady,
                     openGateParamEditor, openBlochSphereView, openRegisterRename, openGutterMenu, openTape}) {
    // The one simulator: the animation cycle's phase and the stats caches are app-wide state.
    const simulator = new Simulator();

    // A placeholder size for the pre-boot inspector; the first redraw sizes the canvas to fit.

    /** @type {import("zustand/vanilla").StoreApi<{value: !EditorState}>} */
    const displayed = createEditorStore(
        EditorState.empty(new Rect(0, 0, canvasDiv.clientWidth, canvasDiv.clientHeight)));
    const mostRecentStats = createValueStore(CircuitStats.EMPTY);
    const playhead = new Playhead(
        observeStore(displayed).
            map(e => e.displayedCircuit.circuitDefinition.columns.length).
            whenDifferent());
    /** @type {!Revision} */
    const revision = Revision.startingAt(displayed.getState().value.snapshot());

    const captureCommitted = () => {
        const circuit = fromJsonText_CircuitDefinition(revision.peekActiveCommit());
        return simulator.evaluate(circuit, circuit.numWires, playhead.step());
    };
    const tapeStore = new TapeStore();
    const recorder = new Recorder(revision, playhead, simulator, tapeStore, captureCommitted,
        {onRestore: () => redrawLoop.trigger()});
    let lastCommit = revision.peekActiveCommit();
    revision.latestActiveCommit().subscribe(jsonText => {
        if (jsonText !== lastCommit && !recorder.restoring) {
            simulator.newRun();
        }
        lastCommit = jsonText;
        const circuitDef = fromJsonText_CircuitDefinition(jsonText);
        const newInspector = displayed.getState().value.withCircuitDefinition(circuitDef);
        displayed.setState({value: newInspector});
        if (!recorder.restoring) captureCommitted();
    });

    /**
     * @param {!EditorState} curInspector
     * @returns {{w: number, h: !number}}
     */
    const desiredCanvasSizeFor = curInspector => {
        // The content extent, in circuit units: at least the visible area (which covers more
        // circuit units when zoomed out), grown to fit a circuit larger than it.
        return {
            // Previous right-alignment slack must not become a minimum width after zooming in.
            w: Math.max(canvasDiv.clientWidth / circuitZoom(),
                curInspector.displayedCircuit.unshiftedDesiredWidth()),
            h: Math.max(canvasDiv.clientHeight / circuitZoom(), curInspector.desiredHeight())
        };
    };

    /**
     * @param {!EditorState} ins
     * @returns {!EditorState}
     */
    const syncArea = ins => {
        const size = desiredCanvasSizeFor(ins);
        return ins.withArea(new Rect(0, 0, size.w, size.h));
    };

    // A stale recovery message disappears once the user moves on; a live problem re-raises it.
    observeStore(displayed).
        map(e => e.displayedCircuit.circuitDefinition).
        whenDifferent(Util.CUSTOM_IS_EQUAL_TO_EQUALITY).
        subscribe(() => noteCircuitEdited());

    const redrawLoop = initRedrawLoop(
        canvas,
        canvasDiv,
        scrollSpacer,
        displayed,
        simulator,
        playhead,
        mostRecentStats,
        desiredCanvasSizeFor,
        syncArea, captureCommitted);

    // The canvas is pinned to the scroll container's visible corner, so pointer positions only
    // become circuit coordinates after the container's scroll is added back.
    attachCircuitScrollSource(canvasDiv);
    initCanvasPointer(
        canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor, openBlochSphereView,
        openRegisterRename, openGutterMenu, (dx, dy) => canvasDiv.scrollBy(dx, dy));

    const circuitActions = new CircuitActions(revision);
    const registerActions = new RegisterActions(revision, displayed);
    // The toolbar and transport components act on these through the store, and show what they
    // may do from the mirrored availability and playhead state.
    appStore.setState({circuitActions, playhead, registerActions, recorder});
    circuitActions.availability().subscribe(circuitAvailability => appStore.setState({circuitAvailability}));
    let generation = playhead.generation;
    playhead.state().subscribe(playheadState => {
        simulator.setPlaying(playheadState.playing, generation !== playhead.generation);
        generation = playhead.generation;
        if (!recorder.restoring) captureCommitted();
        appStore.setState({playheadState});
        redrawLoop.trigger();
    });
    initUrlCircuitSync(revision, recorder, openTape);
    const gateToolbox = /** @type {!Object} */ ({
        // Compared by content, not identity: every commit deserializes a fresh CustomGateSet, and
        // rebuilding the toolbox for each one would recreate every tile and drop keyboard focus.
        obsCustomGateSet: observeStore(displayed).
            map(e => e.displayedCircuit.circuitDefinition.customGateSet).
            whenDifferent(Util.CUSTOM_IS_EQUAL_TO_EQUALITY),
        mostRecentStats,
        onGrab: initToolboxDrag(canvas, revision, displayed, syncArea),
        onPlace: initToolboxKeyboardPlace(revision, displayed, syncArea),
    });
    appStore.setState({
        gateToolbox,
        panelDeps: {revision, displayed, mostRecentStats, completed: simulator.completed, recorder, syncArea,
                    cycleTime: () => simulator.cycleTime()},
    });
    initTitleSync(revision);
    // Fitting never zooms in: at 100% or below the whole circuit is judged by its own width,
    // without the slack the right-aligned output displays absorb.
    initZoomControls(circuitOverlay, () =>
        Math.min(1, canvasDiv.clientWidth / displayed.getState().value.displayedCircuit.unshiftedDesiredWidth()));
    initMinimap(circuitOverlay, canvasDiv, displayed);
    // The circuit is always editable, so the canvas always keeps its tab stop.
    canvasDiv.tabIndex = 0;

    scheduleBoot(redrawLoop, onReady);
}

export {startQuirk}
