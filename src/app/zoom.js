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

import {Point} from "../math/Point.js"

/**
 * The circuit's camera: a zoom factor plus the scroll container's offset. 1 is the natural
 * drawing size, smaller pulls a large circuit into view. The drawing pipeline scales and
 * translates its painter by these, and the pointer code maps screen positions back through them,
 * so everything between the two keeps working in the circuit's own units.
 */

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 1.25;

let _zoom = 1;
/** @type {!Array.<!function(): void>} */
let _listeners = [];
/** @type {undefined|!HTMLElement} */
let _scrollSource = undefined;

/** @returns {!number} */
function circuitZoom() {
    return _zoom;
}

/**
 * @param {!number} z
 */
function setCircuitZoom(z) {
    let clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    if (clamped === _zoom) {
        return;
    }
    _zoom = clamped;
    for (let listener of _listeners) {
        listener();
    }
}

/**
 * @param {!function(): void} listener
 */
function onCircuitZoomChanged(listener) {
    _listeners.push(listener);
}

/**
 * Registers the scroll container whose offsets complete the camera. The canvas stays pinned to
 * the container's visible corner, so canvas-relative positions only become circuit coordinates
 * after the scroll is added back.
 * @param {!HTMLElement} element
 */
function attachCircuitScrollSource(element) {
    _scrollSource = element;
}

/**
 * Maps a position measured against the canvas's on-screen pixels into circuit coordinates.
 * @param {!Point} pt
 * @returns {!Point}
 */
function pointIntoCircuitCoords(pt) {
    let sx = _scrollSource === undefined ? 0 : _scrollSource.scrollLeft;
    let sy = _scrollSource === undefined ? 0 : _scrollSource.scrollTop;
    return new Point((pt.x + sx) / _zoom, (pt.y + sy) / _zoom);
}

/**
 * Builds the zoom button cluster inside the circuit overlay.
 * @param {!HTMLElement} container
 * @param {!function(): !number} fitFactorProvider Returns the factor that makes the whole
 *     circuit fit the visible area.
 * @returns {void}
 */
function initZoomControls(container, fitFactorProvider) {
    const cluster = document.createElement('div');
    cluster.className = 'circuit-zoom-controls';
    cluster.setAttribute('role', 'group');
    cluster.setAttribute('aria-label', 'Circuit zoom');

    const makeButton = (content, label, onActivate) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'circuit-zoom-button';
        if (content.startsWith('<svg')) {
            button.innerHTML = content;
        } else {
            button.textContent = content;
        }
        button.setAttribute('aria-label', label);
        button.addEventListener('click', onActivate);
        cluster.appendChild(button);
        return button;
    };

    // Lucide's minus and plus, inlined the way quirk.html inlines the menu icons: the same 24px
    // grid and the app's 1.5 stroke, sized to sit on the buttons' 12px text line.
    const MINUS_ICON_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"' +
        ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"' +
        ' aria-hidden="true"><path d="M5 12h14"/></svg>';
    const PLUS_ICON_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"' +
        ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"' +
        ' aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

    makeButton(MINUS_ICON_SVG, 'Zoom out', () => setCircuitZoom(_zoom / ZOOM_STEP));
    const readout = makeButton('100%', 'Reset zoom', () => setCircuitZoom(1));
    readout.setAttribute('aria-live', 'polite');
    makeButton(PLUS_ICON_SVG, 'Zoom in', () => setCircuitZoom(_zoom * ZOOM_STEP));
    makeButton('Fit', 'Fit the circuit to the visible area', () => setCircuitZoom(fitFactorProvider()));

    const showZoom = () => {
        readout.textContent = Math.round(_zoom * 100) + '%';
    };
    onCircuitZoomChanged(showZoom);
    showZoom();

    container.appendChild(cluster);
}

export {circuitZoom, onCircuitZoomChanged, pointIntoCircuitCoords, initZoomControls, attachCircuitScrollSource}
