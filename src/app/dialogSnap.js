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

/**
 * Snap-zone tiling for the app dialogs, in the spirit of a desktop window manager: drag a
 * dialog by its header, and edge zones dock it into halves of the safe area. Docked dialogs
 * are rendered non-modal by src/components/app-dialogs.jsx, which subscribes to this module's
 * dock state.
 */

import {ObservableValue} from "../base/Obs.js"

/** How close to an edge, in pixels, the pointer must be to activate a zone. */
const SNAP_EDGE_PX = 40;
/** Movement below this many pixels is a click on the header, not a drag. */
const DRAG_THRESHOLD_PX = 6;
/** Matches the dialogs' narrow-viewport breakpoint in src/styles/dialogs.css. */
const MOBILE_BREAKPOINT_PX = 760;

/**
 * The area a docked dialog may occupy: the viewport minus the toolbar/transport strip.
 * @param {!number} viewportWidth
 * @param {!number} viewportHeight
 * @param {!number} chromeBottom The y where the app chrome ends and the safe area begins.
 * @returns {!{x: !number, y: !number, w: !number, h: !number}}
 */
function safeRectFor(viewportWidth, viewportHeight, chromeBottom) {
    return {x: 0, y: chromeBottom, w: viewportWidth, h: viewportHeight - chromeBottom};
}

/**
 * @param {!number} x
 * @param {!number} y
 * @param {!{x: !number, y: !number, w: !number, h: !number}} safeRect
 * @returns {undefined|!string} The zone the pointer activates, side zones winning corners.
 */
function zoneForPointer(x, y, safeRect) {
    if (x <= safeRect.x + SNAP_EDGE_PX) {
        return 'left';
    }
    if (x >= safeRect.x + safeRect.w - SNAP_EDGE_PX) {
        return 'right';
    }
    if (y <= safeRect.y + SNAP_EDGE_PX) {
        return 'max';
    }
    return undefined;
}

/**
 * @param {!string} zone
 * @param {!{x: !number, y: !number, w: !number, h: !number}} safeRect
 * @returns {!{x: !number, y: !number, w: !number, h: !number}}
 */
function rectForZone(zone, safeRect) {
    let half = Math.floor(safeRect.w / 2);
    switch (zone) {
        case 'left': return {x: safeRect.x, y: safeRect.y, w: half, h: safeRect.h};
        case 'right': return {x: safeRect.x + half, y: safeRect.y, w: safeRect.w - half, h: safeRect.h};
        case 'max': return {x: safeRect.x, y: safeRect.y, w: safeRect.w, h: safeRect.h};
        default: throw new Error("Unknown snap zone: " + zone);
    }
}

/** @type {!Map.<!string, !string>} Overlay name -> docked zone, remembered for the session. */
const _dockModes = new Map();
const _dockModesValue = new ObservableValue({});

function _emitDockModes() {
    let snapshot = {};
    for (let [name, zone] of _dockModes.entries()) {
        snapshot[name] = zone;
    }
    _dockModesValue.set(snapshot);
}

/** @returns {!Observable.<!Object.<!string, !string>>} */
function dockModes() {
    return _dockModesValue.observable();
}

/**
 * @param {!string} name
 * @param {!string} zone
 */
function setDockMode(name, zone) {
    _dockModes.set(name, zone);
    _emitDockModes();
}

/** @param {!string} name */
function clearDockMode(name) {
    if (_dockModes.delete(name)) {
        _emitDockModes();
    }
}

function resetDockModes() {
    if (_dockModes.size > 0) {
        _dockModes.clear();
    }
    _emitDockModes();
}

export {
    safeRectFor,
    zoneForPointer,
    rectForZone,
    SNAP_EDGE_PX,
    DRAG_THRESHOLD_PX,
    MOBILE_BREAKPOINT_PX,
    dockModes,
    setDockMode,
    clearDockMode,
    resetDockModes,
}
