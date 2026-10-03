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
import { fromJsonText_CircuitDefinition } from "../serialization/circuits/text.js";
import { CUSTOM_IS_EQUAL_TO_EQUALITY } from "../base/Equate.js";

import {CircuitActions} from "./state/CircuitActions.js"
import {RegisterActions} from "./state/RegisterActions.js"
import {GateActions} from "./state/GateActions.js"
import {SelectionActions} from "./state/SelectionActions.js"
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
import {Animation} from "../config/Animation.js"
import {circuitZoom, initZoomControls, attachCircuitScrollSource} from "./canvas/zoom.js"
import {initMinimap} from "./canvas/minimap.js"
import {noteCircuitEdited} from "../diagnostics/errorReporter.js"
import {onReducedMotionChange, prefersReducedMotion} from "../browser/reducedMotion.js"
import {appStore} from "../state/appStore.js"
import {failingAssertionColumns} from '../gates/assertions/AssertionGates.js';
import {operationSchedule} from '../circuit/operationColumns.js';

const STEP_SPEED_KEY = 'shadow-quant.speed.steps';
const TIME_SPEED_KEY = 'shadow-quant.speed.time';

/**
 * @param {!string} key
 * @returns {!number} The speed this browser last chose for a lane, if it is still on offer, else 1.
 */
function storedSpeed(key) {
    try {
        const speed = Number(window.localStorage.getItem(key));
        return Animation.SPEEDS.includes(speed) ? speed : 1;
    } catch {
        return 1;
    }
}

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
 *     openGateMenu: !function(!{col: !int, row: !int, gate: !Gate, x: !number, y: !number}): void,
 *     openSelectionMenu: !function(!{x: !number, y: !number}): void,
 *     openTape: !function(): void}} shell
 * @returns {void}
 */
function startQuirk({canvas, canvasDiv, scrollSpacer, circuitOverlay, onReady,
                     openGateParamEditor, openBlochSphereView, openRegisterRename, openGutterMenu, openGateMenu,
                     openSelectionMenu, openTape, openComplexDisplay}) {
    // The one simulator: the animation cycle's phase and the stats caches are app-wide state.
    const simulator = new Simulator();

    // A placeholder size for the pre-boot inspector; the first redraw sizes the canvas to fit.

    /** @type {import("zustand/vanilla").StoreApi<{value: !EditorState}>} */
    const displayed = createEditorStore(
        EditorState.empty(new Rect(0, 0, canvasDiv.clientWidth, canvasDiv.clientHeight)));
    const mostRecentStats = createValueStore(CircuitStats.EMPTY);
    const playhead = new Playhead(
        observeStore(displayed).
            map(e => e.displayedCircuit.circuitDefinition).
            whenDifferent().map(operationSchedule));
    /** @type {!Revision} */
    const revision = Revision.startingAt(displayed.getState().value.snapshot());

    // Only a frame of the redraw loop may be shown stats a run behind (see Simulator.evaluate): whoever
    // else captures wants the result for the circuit as it is now.
    const captureCommitted = (mayLag = false) => {
        const circuit = fromJsonText_CircuitDefinition(revision.peekActiveCommit());
        const result = simulator.evaluate(circuit, circuit.numWires, playhead.step(), true, mayLag === true);
        // A run halts before an assertion that fails, as it does before a breakpoint.
        playhead.setHaltColumns(failingAssertionColumns(result.fullStats));
        return result;
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
        whenDifferent(CUSTOM_IS_EQUAL_TO_EQUALITY).
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
        syncArea, captureCommitted, () => appStore.getState().circuitSelection);

    // Registered after the subscription that shows each commit, so it compares with the new circuit.
    const selectionActions = new SelectionActions(revision, displayed, appStore);
    revision.latestActiveCommit().subscribe(() => selectionActions.forgetIfChanged());
    appStore.subscribe((state, previous) => {
        if (state.circuitSelection !== previous.circuitSelection) {
            redrawLoop.trigger();
        }
    });

    // The canvas is pinned to the scroll container's visible corner, so pointer positions only
    // become circuit coordinates after the container's scroll is added back.
    attachCircuitScrollSource(canvasDiv);
    initCanvasPointer(
        canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor, openBlochSphereView,
        openRegisterRename, openGutterMenu, (dx, dy) => canvasDiv.scrollBy(dx, dy), openComplexDisplay,
        openGateMenu, selectionActions, openSelectionMenu);

    const circuitActions = new CircuitActions(revision);
    const registerActions = new RegisterActions(revision, displayed);
    const gateActions = new GateActions(revision, displayed);
    // The toolbar and transport components act on these through the store, and show what they
    // may do from the mirrored availability and playhead state.
    appStore.setState({circuitActions, playhead, registerActions, gateActions, selectionActions, recorder});
    circuitActions.availability().subscribe(circuitAvailability => appStore.setState({circuitAvailability}));
    // The transport is two lanes. The Steps lane moves the playhead through the columns; it never
    // moves t, so a step shows the circuit at whatever t the Time lane stands at. A restored take
    // brings its own phase.
    let generation = playhead.generation;
    playhead.state().subscribe(playheadState => {
        simulator.setPlaying(playheadState.playing, generation !== playhead.generation);
        generation = playhead.generation;
        if (!recorder.restoring) captureCommitted();
        appStore.setState({playheadState});
        redrawLoop.trigger();
    });

    // The Time lane says where the cycle is and what, if anything, holds it still, and its controls
    // only act while the circuit has gates that move with t.
    observeStore(displayed).
        map(e => e.displayedCircuit.circuitDefinition.stableDuration() < Infinity).
        whenDifferent().
        subscribe(cycleAnimates => appStore.setState({cycleAnimates}));
    appStore.setState({cycleHold: simulator.cycleHold.getState().value});
    simulator.cycleHold.subscribe(({value: cycleHold}) => {
        appStore.setState({cycleHold});
        redrawLoop.trigger();
    });
    // Its pause is a hold like a recording's. Reduce Motion starts the cycle paused rather than
    // locking it: the lane still runs it on request, and scrubs and nudges it a phase at a time.
    let releasePause = undefined;
    const setCyclePaused = paused => {
        if (paused && releasePause === undefined) {
            releasePause = simulator.holdClock('paused');
        } else if (!paused && releasePause !== undefined) {
            releasePause();
            releasePause = undefined;
        }
    };
    setCyclePaused(prefersReducedMotion());
    onReducedMotionChange(setCyclePaused);
    // A take's phase and a recording's are theirs; t is the user's to move only while it runs or
    // they paused it.
    const tIsTheUsers = () => [undefined, 'paused'].includes(simulator.cycleHold.getState().value);
    const movedT = () => {
        captureCommitted();
        redrawLoop.trigger();
    };
    appStore.setState({cycleControls: {
        toggle: () => {
            if (simulator.clockRunning()) {
                setCyclePaused(true);
            } else if (tIsTheUsers()) {
                setCyclePaused(false);
            }
        },
        nudge: direction => {
            if (!tIsTheUsers()) return;
            simulator.advanceCycle(direction * Animation.T_NUDGE);
            movedT();
        },
        scrub: phase => {
            if (!tIsTheUsers()) return;
            simulator.setPhase(phase);
            movedT();
        },
    }});
    // Each lane has its own speed, as each track of a sequencer has: the Steps lane's paces Play,
    // the Time lane's paces t's cycle. They are the viewer's own settings, kept in this browser.
    const keepSpeed = (key, speed) => {
        try {
            window.localStorage.setItem(key, String(speed));
        } catch {
            // Without storage the speed lasts this visit.
        }
    };
    const setStepSpeed = speed => {
        playhead.setSpeed(speed);
        appStore.setState({stepSpeed: speed});
        keepSpeed(STEP_SPEED_KEY, speed);
    };
    const setTimeSpeed = speed => {
        simulator.setSpeed(speed);
        appStore.setState({timeSpeed: speed});
        keepSpeed(TIME_SPEED_KEY, speed);
    };
    appStore.setState({setStepSpeed, setTimeSpeed});
    setStepSpeed(storedSpeed(STEP_SPEED_KEY));
    setTimeSpeed(storedSpeed(TIME_SPEED_KEY));
    // A circuit opened from a link is a new program: the playhead rests at its end, on its answer.
    initUrlCircuitSync(revision, recorder, playhead, openTape, () => playhead.rest());
    const gateToolbox = /** @type {!Object} */ ({
        // Compared by content, not identity: every commit deserializes a fresh CustomGateSet, and
        // rebuilding the toolbox for each one would recreate every tile and drop keyboard focus.
        obsCustomGateSet: observeStore(displayed).
            map(e => e.displayedCircuit.circuitDefinition.customGateSet).
            whenDifferent(CUSTOM_IS_EQUAL_TO_EQUALITY),
        mostRecentStats,
        onGrab: initToolboxDrag(canvas, revision, displayed, syncArea),
        onPlace: initToolboxKeyboardPlace(revision, displayed, syncArea),
    });
    appStore.setState({
        gateToolbox,
        panelDeps: {revision, displayed, mostRecentStats, completed: simulator.completed, recorder, syncArea,
                    cycleTime: () => simulator.cycleTime(), stablePrefix: simulator.wholeCircuitPrefix},
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
