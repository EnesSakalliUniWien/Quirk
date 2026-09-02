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

import {Painter} from "../draw/Painter.js"
import {Rect} from "../math/Rect.js"
import {RestartableRng} from "../base/RestartableRng.js"
import {WidgetPainter} from "../draw/WidgetPainter.js"

/** The tooltip is measured into this box first, then drawn at the size it reports back. */
const TOOLTIP_MEASURING_AREA = new Rect(0, 0, 500, 300);

/** Pixels kept between the tooltip and the edge of the window. */
const TOOLTIP_MARGIN = 8;

/**
 * Which functional family each toolbox group belongs to. The chip's edge rule encodes the family,
 * in the canvas's colour language: red collapses or inspects the state, green reads it out, amber
 * rotates it, cyan computes over it, and violet depends on time or a parameter. Groups not listed
 * here (such as Custom Gates) fall back to a neutral rule.
 */
const GROUP_CATEGORIES = new Map([
    ['Probes', 'measure'],
    ['X/Y Probes', 'measure'],
    ['Sampling', 'measure'],
    ['Displays', 'display'],
    ['Half Turns', 'turn'],
    ['Quarter Turns', 'turn'],
    ['Eighth Turns', 'turn'],
    ['Rotations', 'time'],
    ['Spinning', 'time'],
    ['Formulaic', 'time'],
    ['Parametrized', 'time'],
    ['Parity', 'compute'],
    ['Order', 'compute'],
    ['Frequency', 'compute'],
    ['Arithmetic', 'compute'],
    ['Compare', 'compute'],
    ['Modular', 'compute'],
    ['Scalar', 'compute']
]);

const COLLAPSED_GROUPS_STORAGE_KEY = 'toolbox-collapsed-groups';

/**
 * @returns {!Set.<!string>} Hints of the groups the user has folded shut.
 */
function loadCollapsedGroups() {
    try {
        let parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

/**
 * @param {!Set.<!string>} collapsed
 */
function storeCollapsedGroups(collapsed) {
    try {
        window.localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify([...collapsed]));
    } catch {
        // A blocked storage just means the folding does not survive a reload.
    }
}

/**
 * @returns {!number}
 * @private
 */
function _pixelRatio() {
    return window.devicePixelRatio || 1;
}

/**
 * @param {!Gate} gate
 * @returns {!string} The name a toolbox row shows.
 */
function listNameOf(gate) {
    return gate.listName || gate.name || gate.symbol || gate.serializedId;
}

/**
 * Splits a gate's symbol into its base and exponent, so the chip can typeset the exponent as a
 * real superscript instead of caret markup.
 *
 * @param {!Gate} gate
 * @returns {!{base: !string, sup: !string}}
 */
function chipPartsOf(gate) {
    let text = gate.symbol !== '' ? gate.symbol : listNameOf(gate).charAt(0);
    let caret = text.indexOf('^');
    if (caret <= 0 || caret === text.length - 1) {
        return {base: text, sup: ''};
    }
    return {base: text.slice(0, caret), sup: text.slice(caret + 1)};
}

/**
 * A gate's own documentation, drawn by the painter the circuit already uses, into a canvas that
 * plain DOM positions. The toolbox is HTML now, but the matrices and mini-circuits in these
 * tooltips are worth what it costs to keep painting them.
 */
class GateTooltip {
    /**
     * @param {!HTMLElement} container
     */
    constructor(container) {
        this._element = document.createElement('div');
        this._element.className = 'gate-tooltip';
        this._element.setAttribute('role', 'tooltip');
        this._element.hidden = true;
        this._canvas = document.createElement('canvas');
        this._element.appendChild(this._canvas);
        container.appendChild(this._element);

        /** Painted with no alpha, only to learn how large the real one has to be. */
        this._measuringCanvas = document.createElement('canvas');
        this._measuringCanvas.width = TOOLTIP_MEASURING_AREA.w;
        this._measuringCanvas.height = TOOLTIP_MEASURING_AREA.h;
    }

    /**
     * @param {!HTMLElement} anchor
     * @param {!Gate} gate
     * @param {!number} time
     * @returns {void}
     */
    show(anchor, gate, time) {
        let measurer = new Painter(this._measuringCanvas, new RestartableRng(), 1);
        measurer.ctx.save();
        measurer.ctx.globalAlpha = 0;
        let {maxW, maxH} = WidgetPainter.paintGateTooltip(
            measurer, TOOLTIP_MEASURING_AREA, gate, time, true);
        measurer.paintDeferred();
        measurer.ctx.restore();

        let needsScaling = maxW >= TOOLTIP_MEASURING_AREA.w || maxH >= TOOLTIP_MEASURING_AREA.h;
        let ratio = _pixelRatio();
        this._canvas.width = Math.round(maxW * ratio);
        this._canvas.height = Math.round(maxH * ratio);
        this._canvas.style.width = `${maxW}px`;
        this._canvas.style.height = `${maxH}px`;

        let painter = new Painter(this._canvas, new RestartableRng(), ratio);
        WidgetPainter.paintGateTooltip(painter, new Rect(0, 0, maxW, maxH), gate, time, needsScaling);
        painter.paintDeferred();

        // Fixed positioning, because the toolbox scrolls and the tooltip must not scroll with it.
        let bounds = anchor.getBoundingClientRect();
        let left = Math.min(bounds.right + TOOLTIP_MARGIN, window.innerWidth - maxW - TOOLTIP_MARGIN);
        let top = Math.min(bounds.top - TOOLTIP_MARGIN, window.innerHeight - maxH - TOOLTIP_MARGIN);
        this._element.style.left = `${Math.max(TOOLTIP_MARGIN, left)}px`;
        this._element.style.top = `${Math.max(TOOLTIP_MARGIN, top)}px`;
        this._element.hidden = false;
    }

    /**
     * @returns {void}
     */
    hide() {
        this._element.hidden = true;
    }
}

/**
 * @param {!Gate} gate
 * @param {!string} groupHint
 * @returns {!string} The text the search box matches against.
 */
function searchTextOf(gate, groupHint) {
    return `${gate.name} ${gate.listName} ${gate.symbol} ${gate.serializedId} ${groupHint}`.toLowerCase();
}

export {
    GateTooltip,
    GROUP_CATEGORIES,
    chipPartsOf,
    listNameOf,
    searchTextOf,
    loadCollapsedGroups,
    storeCollapsedGroups,
}
