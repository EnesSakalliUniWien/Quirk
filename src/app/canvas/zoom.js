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

import {Point} from "../../geometry/Point.js"
import {iconElement} from "../../resources/icons/index.js"
import {appStore} from "../../state/appStore.js"

/**
 * The circuit's camera: a zoom factor plus the scroll container's offset. 1 is the natural
 * drawing size, smaller pulls a large circuit into view. The drawing pipeline scales and
 * translates its painter by these, and the pointer code maps screen positions back through them,
 * so everything between the two keeps working in the circuit's own units.
 */

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 1.25;

/** @type {undefined|!HTMLElement} */
let _scrollSource = undefined;

/** @returns {!number} */
function circuitZoom() {
    return appStore.getState().zoom;
}

/**
 * @param {!number} z
 */
function setCircuitZoom(z) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    if (clamped === circuitZoom()) {
        return;
    }
    appStore.getState().setZoom(clamped);
}

/**
 * @param {!function(): void} listener
 * @returns {!function(): void} Unsubscribes.
 */
function onCircuitZoomChanged(listener) {
    return appStore.subscribe((state, previous) => {
        if (state.zoom !== previous.zoom) {
            listener();
        }
    });
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
    const sx = _scrollSource === undefined ? 0 : _scrollSource.scrollLeft;
    const sy = _scrollSource === undefined ? 0 : _scrollSource.scrollTop;
    const zoom = circuitZoom();
    return new Point((pt.x + sx) / zoom, (pt.y + sy) / zoom);
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
        if (typeof content === 'string') {
            button.textContent = content;
        } else {
            button.appendChild(content);
        }
        button.setAttribute('aria-label', label);
        button.addEventListener('click', onActivate);
        cluster.appendChild(button);
        return button;
    };

    // The minus and plus come from src/resources/icons, where the app keeps the icons it draws
    // itself; the stylesheet sizes them to the buttons' text line.
    makeButton(iconElement('minus'), 'Zoom out', () => setCircuitZoom(circuitZoom() / ZOOM_STEP));
    const readout = makeButton('100%', 'Reset zoom', () => setCircuitZoom(1));
    readout.setAttribute('aria-live', 'polite');
    makeButton(iconElement('plus'), 'Zoom in', () => setCircuitZoom(circuitZoom() * ZOOM_STEP));
    makeButton('Fit', 'Fit the circuit to the visible area', () => setCircuitZoom(fitFactorProvider()));

    const showZoom = () => {
        readout.textContent = Math.round(circuitZoom() * 100) + '%';
    };
    onCircuitZoomChanged(showZoom);
    showZoom();

    container.appendChild(cluster);
}

export {circuitZoom, onCircuitZoomChanged, pointIntoCircuitCoords, initZoomControls, attachCircuitScrollSource}
