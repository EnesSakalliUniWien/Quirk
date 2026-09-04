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
        _emitDockModes();
    }
}

/** Popup element ids (src/components/app-dialogs.jsx) keyed back to overlay names. */
const _NAME_BY_DIV_ID = new Map([
    ['menu-div', 'menu'],
    ['export-div', 'export'],
    ['gate-forge-div', 'forge'],
    ['gate-param-div', 'gate-param'],
    ['bloch-div', 'bloch'],
]);

let _ghost = undefined;
let _drag = undefined;
let _initialized = false;

function _ghostElement() {
    if (_ghost === undefined) {
        _ghost = document.createElement('div');
        _ghost.className = 'snap-ghost';
        _ghost.hidden = true;
        document.body.appendChild(_ghost);
    }
    return _ghost;
}

function _chromeBottom() {
    // The toolbar is the only top chrome; the transport lives in the bottom debugger dock.
    let toolbar = document.getElementById('app-toolbar-root');
    return toolbar === null ? 0 : toolbar.getBoundingClientRect().bottom;
}

function _safeRect() {
    return safeRectFor(window.innerWidth, window.innerHeight, _chromeBottom());
}

/** @param {!HTMLElement} popup @param {!{x:!number,y:!number,w:!number,h:!number}} rect */
function _applyRect(popup, rect) {
    popup.style.left = rect.x + 'px';
    popup.style.top = rect.y + 'px';
    popup.style.width = rect.w + 'px';
    popup.style.height = rect.h + 'px';
    popup.style.maxWidth = 'none';
    popup.style.maxHeight = 'none';
    popup.style.transform = 'none';
}

/** Returns the popup to CSS-driven sizing, keeping only an explicit position. */
function _clearRect(popup) {
    popup.style.width = '';
    popup.style.height = '';
    popup.style.maxWidth = '';
    popup.style.maxHeight = '';
}

/**
 * Re-applies a remembered dock rect to a freshly created popup. Also drops stale dock state
 * when the viewport has shrunk below the breakpoint since the mode was remembered.
 * @param {!string} name
 * @param {!HTMLElement} popupElement
 */
function notifyDialogOpened(name, popupElement) {
    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        resetDockModes();
        return;
    }
    let zone = _dockModes.get(name);
    if (zone !== undefined) {
        _applyRect(popupElement, rectForZone(zone, _safeRect()));
    }
}

function _onPointerDown(ev) {
    if (ev.button !== 0 || window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        return;
    }
    let handle = ev.target.closest('[data-snap-handle]');
    if (handle === null || ev.target.closest('button, a, input, select, textarea') !== null) {
        return;
    }
    let popup = handle.closest('.dialog-layout');
    if (popup === null || !_NAME_BY_DIV_ID.has(popup.id)) {
        return;
    }
    let bounds = popup.getBoundingClientRect();
    _drag = {
        name: _NAME_BY_DIV_ID.get(popup.id),
        popup,
        startX: ev.clientX,
        startY: ev.clientY,
        startBounds: bounds,
        moved: false,
        zone: undefined,
    };
    window.addEventListener('pointermove', _onPointerMove);
    window.addEventListener('pointerup', _onPointerUp);
    ev.preventDefault();
}

function _onPointerMove(ev) {
    let dx = ev.clientX - _drag.startX;
    let dy = ev.clientY - _drag.startY;
    if (!_drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
            return;
        }
        _drag.moved = true;
        if (_dockModes.has(_drag.name)) {
            // Dragging a docked dialog out: back to modal + CSS sizing, following the pointer.
            clearDockMode(_drag.name);
            _clearRect(_drag.popup);
            _drag.startBounds = _drag.popup.getBoundingClientRect();
        }
    }
    _drag.popup.style.left = (_drag.startBounds.x + dx) + 'px';
    _drag.popup.style.top = (_drag.startBounds.y + dy) + 'px';
    _drag.popup.style.transform = 'none';

    _drag.zone = zoneForPointer(ev.clientX, ev.clientY, _safeRect());
    let ghost = _ghostElement();
    if (_drag.zone === undefined) {
        ghost.hidden = true;
    } else {
        let rect = rectForZone(_drag.zone, _safeRect());
        ghost.style.left = rect.x + 'px';
        ghost.style.top = rect.y + 'px';
        ghost.style.width = rect.w + 'px';
        ghost.style.height = rect.h + 'px';
        ghost.hidden = false;
    }
}

function _onPointerUp() {
    window.removeEventListener('pointermove', _onPointerMove);
    window.removeEventListener('pointerup', _onPointerUp);
    _ghostElement().hidden = true;
    if (_drag !== undefined && _drag.moved && _drag.zone !== undefined) {
        _applyRect(_drag.popup, rectForZone(_drag.zone, _safeRect()));
        setDockMode(_drag.name, _drag.zone);
    }
    _drag = undefined;
}

function _reclampDocked() {
    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
        resetDockModes();
        return;
    }
    for (let [divId, name] of _NAME_BY_DIV_ID.entries()) {
        let zone = _dockModes.get(name);
        let popup = document.getElementById(divId);
        if (zone !== undefined && popup !== null) {
            _applyRect(popup, rectForZone(zone, _safeRect()));
        }
    }
}

/** Installs the snap listeners. Must be called exactly once, from startQuirk. */
function initDialogSnap() {
    if (_initialized) {
        throw new Error("initDialogSnap was already called.");
    }
    _initialized = true;
    document.addEventListener('pointerdown', _onPointerDown);
    let reclampQueued = false;
    window.addEventListener('resize', () => {
        if (!reclampQueued) {
            reclampQueued = true;
            requestAnimationFrame(() => {
                reclampQueued = false;
                _reclampDocked();
            });
        }
    });
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
    initDialogSnap,
    notifyDialogOpened,
}
