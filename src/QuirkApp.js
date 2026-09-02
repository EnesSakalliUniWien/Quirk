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

import {CircuitStats} from "./circuit/CircuitStats.js"
import {DisplayedInspector} from "./ui/DisplayedInspector.js"
import {Rect} from "./math/Rect.js"
import {Revision} from "./base/Revision.js"
import {fromJsonText_CircuitDefinition} from "./circuit/Serializer.js"
import {Util} from "./base/Util.js"
import {ObservableValue} from "./base/Obs.js"
import {initExports} from "./ui/exports.js"
import {initForge} from "./ui/forge.js"
import {initMenu} from "./ui/menu.js"
import {initUndoRedo} from "./ui/undo.js"
import {initClear} from "./ui/clear.js"
import {CircuitActions} from "./ui/CircuitActions.js"
import {Playhead} from "./ui/Playhead.js"
import {initTransport} from "./ui/transport.js"
import {initStateTable} from "./ui/stateTable.js"
import {initToolbox} from "./ui/toolbox.js"
import {initToolboxDrag, initToolboxKeyboardPlace} from "./ui/toolboxDrag.js"
import {initRedrawLoop} from "./ui/redrawLoop.js"
import {initCanvasPointer} from "./ui/canvasPointer.js"
import {scheduleBoot} from "./ui/boot.js"
import {mountAppDialogs} from "./components/app-dialogs.jsx"
import {OverlayState} from "./ui/OverlayState.js"
import {initUrlCircuitSync} from "./ui/url.js"
import {initTitleSync} from "./ui/title.js"
import {Simulator} from "./ui/sim.js"
import {circuitZoom, initZoomControls, attachCircuitScrollSource} from "./ui/zoom.js"
import {initMinimap} from "./ui/minimap.js"
import {initGateParamDialog} from "./ui/gateParamDialog.js"
import {initBlochSphereDialog} from "./ui/blochSphereDialog.js"

/**
 * Starts Quirk after its document elements are available. Must be called exactly once.
 * @returns {void}
 */
function startQuirk() {
    // The one simulator: the animation cycle's phase and the stats caches are app-wide state.
    const simulator = new Simulator();

    const canvasDiv = document.getElementById("canvasDiv");

    //noinspection JSValidateTypes
    /** @type {!HTMLCanvasElement} */
    const canvas = document.getElementById("drawCanvas");
    //noinspection JSValidateTypes
    if (!canvas) {
        throw new Error("Couldn't find 'drawCanvas'");
    }
    // A placeholder size for the pre-boot inspector; the first redraw sizes the canvas to fit.
    canvas.width = canvasDiv.clientWidth;
    /** @type {ObservableValue.<!DisplayedInspector>} */
    const displayed = new ObservableValue(
        DisplayedInspector.empty(new Rect(0, 0, canvas.clientWidth, canvas.clientHeight)));
    const mostRecentStats = new ObservableValue(CircuitStats.EMPTY);
    /** The same stats, but for the circuit only as far as the playhead has run it, alongside the
     *  number of wires the circuit shows.
     *  @type {ObservableValue.<!{stats: !CircuitStats, wireCount: !int}>} */
    const playheadStats = new ObservableValue({stats: CircuitStats.EMPTY, wireCount: 0});
    const overlayState = new OverlayState();
    // Mounted before anything that looks the dialogs' elements up by id.
    mountAppDialogs(overlayState);
    const playhead = new Playhead(
        displayed.observable().
            map(e => e.displayedCircuit.circuitDefinition.columns.length).
            whenDifferent(),
        overlayState);
    /** @type {!Revision} */
    let revision = Revision.startingAt(displayed.get().snapshot());

    revision.latestActiveCommit().subscribe(jsonText => {
        let circuitDef = fromJsonText_CircuitDefinition(jsonText);
        let newInspector = displayed.get().withCircuitDefinition(circuitDef);
        displayed.set(newInspector);
    });

    /**
     * @param {!DisplayedInspector} curInspector
     * @returns {{w: number, h: !number}}
     */
    let desiredCanvasSizeFor = curInspector => {
        // The content extent, in circuit units: at least the visible area (which covers more
        // circuit units when zoomed out), grown to fit a circuit larger than it.
        return {
            w: Math.max(canvasDiv.clientWidth / circuitZoom(), curInspector.desiredWidth()),
            h: Math.max(canvasDiv.clientHeight / circuitZoom(), curInspector.desiredHeight())
        };
    };

    /**
     * @param {!DisplayedInspector} ins
     * @returns {!DisplayedInspector}
     */
    const syncArea = ins => {
        let size = desiredCanvasSizeFor(ins);
        ins.updateArea(new Rect(0, 0, size.w, size.h));
        return ins;
    };

    // Gradually fade out old errors as user manipulates circuit.
    displayed.observable().
        map(e => e.displayedCircuit.circuitDefinition).
        whenDifferent(Util.CUSTOM_IS_EQUAL_TO_EQUALITY).
        subscribe(() => {
            let errDivStyle = document.getElementById('error-div').style;
            errDivStyle.opacity *= 0.9;
            if (errDivStyle.opacity < 0.06) {
                errDivStyle.display = 'None'
            }
        });

    const redrawLoop = initRedrawLoop(
        canvas,
        canvasDiv,
        displayed,
        simulator,
        playhead,
        mostRecentStats,
        playheadStats,
        desiredCanvasSizeFor,
        syncArea);

    // The canvas is pinned to the scroll container's visible corner, so pointer positions only
    // become circuit coordinates after the container's scroll is added back.
    attachCircuitScrollSource(canvasDiv);
    const openGateParamEditor = initGateParamDialog(revision, displayed, overlayState);
    const openBlochSphereView = initBlochSphereDialog(displayed, mostRecentStats, overlayState);
    initCanvasPointer(
        canvas, canvasDiv, revision, displayed, syncArea, openGateParamEditor, openBlochSphereView);

    let circuitActions = new CircuitActions(revision, overlayState);
    initUrlCircuitSync(revision);
    initExports(revision, mostRecentStats, overlayState);
    initForge(revision, overlayState, () => simulator.cycleTime());
    initUndoRedo(circuitActions);
    initClear(circuitActions);
    initTransport(playhead);
    initStateTable(playheadStats);
    initToolbox(
        // Compared by content, not identity: every commit deserializes a fresh CustomGateSet, and
        // rebuilding the toolbox for each one would repaint every tile and drop keyboard focus.
        displayed.observable().
            map(e => e.displayedCircuit.circuitDefinition.customGateSet).
            whenDifferent(Util.CUSTOM_IS_EQUAL_TO_EQUALITY),
        mostRecentStats,
        initToolboxDrag(canvas, revision, displayed, syncArea),
        initToolboxKeyboardPlace(revision, displayed, syncArea));
    initMenu(revision, overlayState);
    initTitleSync(revision);
    const circuitOverlay = document.getElementById('circuit-overlay');
    // Fitting never zooms in: at 100% or below the whole circuit is judged by its own width,
    // without the slack the right-aligned output displays absorb.
    initZoomControls(circuitOverlay, () =>
        Math.min(1, canvasDiv.clientWidth / displayed.get().displayedCircuit.unshiftedDesiredWidth()));
    initMinimap(circuitOverlay, canvasDiv, displayed);
    overlayState.active().subscribe(active => {
        canvasDiv.tabIndex = active === undefined ? 0 : -1;
    });

    scheduleBoot(displayed, overlayState, redrawLoop);
}

export {startQuirk}
