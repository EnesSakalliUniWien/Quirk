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

import {Gates} from "../gates/AllGates.js"
import {MysteryGateSymbol, MysteryGateMaker} from "../gates/misc/Joke_MysteryGate.js"
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
 * @returns {!Set.<!string>}
 * @private
 */
function _loadCollapsedGroups() {
    try {
        let parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

/**
 * @param {!Set.<!string>} collapsed
 * @private
 */
function _storeCollapsedGroups(collapsed) {
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
 * Splits a gate's symbol into its base and exponent, so the chip can typeset the exponent as a
 * real superscript instead of caret markup.
 *
 * @param {!Gate} gate
 * @returns {!{base: !string, sup: !string}}
 * @private
 */
function _chipPartsOf(gate) {
    let text = gate.symbol !== '' ? gate.symbol : _listNameOf(gate).charAt(0);
    let caret = text.indexOf('^');
    if (caret <= 0 || caret === text.length - 1) {
        return {base: text, sup: ''};
    }
    return {base: text.slice(0, caret), sup: text.slice(caret + 1)};
}

/**
 * Fills a chip with the gate's symbol, at a size chosen so the text fits.
 *
 * @param {!HTMLElement} chip
 * @param {!Gate} gate
 * @private
 */
function _renderChip(chip, gate) {
    let {base, sup} = _chipPartsOf(gate);
    let symbolElement = document.createElement('span');
    symbolElement.className = 'gate-chip-symbol';
    symbolElement.textContent = base;
    if (sup !== '') {
        let supElement = document.createElement('sup');
        supElement.textContent = sup;
        symbolElement.appendChild(supElement);
    }
    chip.replaceChildren(symbolElement);
    let length = base.length + sup.length;
    chip.dataset.fit = length <= 3 ? 'large' : length <= 6 ? 'medium' : 'small';
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
 * @private
 */
function _searchTextOf(gate, groupHint) {
    return `${gate.name} ${gate.listName} ${gate.symbol} ${gate.serializedId} ${groupHint}`.toLowerCase();
}

/**
 * @param {!Gate} gate
 * @returns {!string} The name a toolbox row shows.
 * @private
 */
function _listNameOf(gate) {
    return gate.listName || gate.name || gate.symbol || gate.serializedId;
}

/**
 * Fills the gate toolbox: the gate groups, their symbol chips, the search box that filters them,
 * the painted tooltips, and the hand-off to the circuit when a gate is dragged out.
 *
 * Interface note: also requires the elements #gate-search, #gate-toolbox-groups, and
 * #gate-toolbox-empty, rendered by src/components/gate-toolbox.jsx before this runs.
 *
 * @param {!Observable.<!CustomGateSet>} obsCustomGateSet
 * @param {!ObservableValue.<!CircuitStats>} mostRecentStats
 * @param {!function(!Gate, !MouseEvent|!Touch): void} onGrab Called when a gate is dragged out.
 * @param {!function(!Gate): void} onPlace Called when a gate is chosen without a pointer, by
 *     activating its tile with the keyboard.
 * @returns {void}
 */
function initToolbox(obsCustomGateSet, mostRecentStats, onGrab, onPlace) {
    const searchInput = /** @type {!HTMLInputElement} */ document.getElementById('gate-search');
    const groupsElement = /** @type {!HTMLElement} */ document.getElementById('gate-toolbox-groups');
    const emptyElement = /** @type {!HTMLElement} */ document.getElementById('gate-toolbox-empty');
    const tooltip = new GateTooltip(document.body);

    /** @type {!Array.<!{gate: !Gate, chip: !HTMLElement, tile: !HTMLElement, search: !string}>} */
    let tiles = [];
    /** @type {!Array.<!{section: !HTMLElement, grid: !HTMLElement, hint: !string}>} */
    let groupElements = [];
    /** @type {!number} */
    let latestTime = 0;
    /** @type {!Set.<!string>} Hints of the groups the user has folded shut. */
    let collapsedGroups = _loadCollapsedGroups();

    /**
     * @param {!Gate} gate
     * @param {!string} groupHint
     * @returns {!HTMLElement}
     */
    const buildTile = (gate, groupHint) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'gate-tile';
        tile.dataset.gateId = gate.serializedId;
        tile.setAttribute('aria-label', gate.name || gate.symbol || gate.serializedId);

        // The name is the row's identity; the chip shows the gate's circuit symbol, with its edge
        // rule saying what family the gate belongs to. The full painted rendering, matrix and all,
        // lives in the tooltip where there is room for it.
        const chip = document.createElement('span');
        chip.className = 'gate-chip';
        chip.dataset.category = GROUP_CATEGORIES.get(groupHint) || 'neutral';
        _renderChip(chip, gate);
        tile.appendChild(chip);

        const nameElement = document.createElement('span');
        nameElement.className = 'gate-tile-name';
        nameElement.textContent = _listNameOf(gate);
        tile.appendChild(nameElement);

        let entry = {gate, chip, tile, search: _searchTextOf(gate, groupHint)};
        tiles.push(entry);

        tile.addEventListener('mouseenter', () => tooltip.show(tile, entry.gate, latestTime));
        tile.addEventListener('focus', () => tooltip.show(tile, entry.gate, latestTime));
        tile.addEventListener('mouseleave', () => tooltip.hide());
        tile.addEventListener('blur', () => tooltip.hide());

        const afterTaking = () => {
            if (entry.gate.symbol === MysteryGateSymbol) {
                // Taking the mystery gate leaves a different random gate behind it.
                entry.gate = MysteryGateMaker();
                entry.search = _searchTextOf(entry.gate, groupHint);
                nameElement.textContent = _listNameOf(entry.gate);
                _renderChip(chip, entry.gate);
            }
        };
        const grab = pointer => {
            tooltip.hide();
            onGrab(entry.gate, pointer);
            afterTaking();
        };
        tile.addEventListener('mousedown', ev => {
            if (ev.button === 0) {
                grab(ev);
                ev.preventDefault();
            }
        });
        tile.addEventListener('touchstart', ev => {
            grab(ev.changedTouches[0]);
            ev.preventDefault();
        }, {passive: false});
        tile.addEventListener('click', ev => {
            // Enter and Space arrive as a click with no pointer behind it (detail 0). A mouse
            // press has already gone through the drag path on mousedown.
            if (ev.detail !== 0) {
                return;
            }
            onPlace(entry.gate);
            afterTaking();
        });

        return tile;
    };

    /**
     * @param {!Array.<!{hint: !string, gates: !Array.<undefined|!Gate>}>} groups
     */
    const build = groups => {
        tiles = [];
        groupElements = [];
        groupsElement.replaceChildren();

        for (let group of groups) {
            const gates = group.gates.filter(gate => gate !== undefined);
            if (gates.length === 0) {
                continue;
            }

            const section = document.createElement('section');
            section.className = 'gate-group';

            const label = document.createElement('h3');
            label.className = 'gate-group-label';
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'gate-group-toggle';
            toggle.textContent = group.hint;
            toggle.setAttribute('aria-expanded', '' + !collapsedGroups.has(group.hint));
            label.appendChild(toggle);
            section.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'gate-group-tiles';
            grid.id = `gate-group-tiles-${groupElements.length}`;
            toggle.setAttribute('aria-controls', grid.id);
            for (let gate of gates) {
                grid.appendChild(buildTile(gate, group.hint));
            }
            section.appendChild(grid);

            toggle.addEventListener('click', () => {
                if (collapsedGroups.has(group.hint)) {
                    collapsedGroups.delete(group.hint);
                } else {
                    collapsedGroups.add(group.hint);
                }
                toggle.setAttribute('aria-expanded', '' + !collapsedGroups.has(group.hint));
                _storeCollapsedGroups(collapsedGroups);
                applyFilter();
            });

            groupsElement.appendChild(section);
            groupElements.push({section, grid, hint: group.hint});
        }
    };

    // The list is one tab stop, like the toolbar: Up and Down move between the visible tiles, and
    // Enter or Space places the focused gate. Without this the gates are over a hundred tab stops
    // between the search box and the rest of the page.
    const visibleTileElements = () =>
        tiles.filter(entry => !entry.tile.hidden && !entry.tile.parentElement.hidden).map(entry => entry.tile);
    const setTileStop = stop => {
        for (let {tile} of tiles) {
            tile.tabIndex = tile === stop ? 0 : -1;
        }
    };
    const ensureTileStop = () => {
        const usable = visibleTileElements();
        if (usable.length === 0) {
            return;
        }
        const stops = tiles.map(entry => entry.tile).filter(tile => tile.tabIndex === 0);
        // The stop must be reachable: not filtered out, and not inside a folded group.
        if (stops.length !== 1 || !usable.includes(stops[0])) {
            setTileStop(usable[0]);
        }
    };
    groupsElement.addEventListener('keydown', ev => {
        const usable = visibleTileElements();
        const from = usable.indexOf(document.activeElement);
        if (from === -1 || usable.length === 0) {
            return;
        }
        let to;
        switch (ev.key) {
            case 'ArrowDown': to = Math.min(from + 1, usable.length - 1); break;
            case 'ArrowUp': to = Math.max(from - 1, 0); break;
            case 'Home': to = 0; break;
            case 'End': to = usable.length - 1; break;
            default: return;
        }
        ev.preventDefault();
        setTileStop(usable[to]);
        usable[to].focus();
    });
    groupsElement.addEventListener('focusin', ev => {
        const target = ev.target;
        if (target.classList.contains('gate-tile') && !target.hidden) {
            setTileStop(target);
        }
    });

    const applyFilter = () => {
        const query = searchInput.value.trim().toLowerCase();
        for (let {tile, search} of tiles) {
            tile.hidden = query !== '' && !search.includes(query);
        }
        let anyShown = false;
        for (let {section, grid, hint} of groupElements) {
            const shown = [...section.querySelectorAll('.gate-tile')].some(tile => !tile.hidden);
            section.hidden = !shown;
            // A search overrides folding: matches must be visible to be believed.
            grid.hidden = query === '' && collapsedGroups.has(hint);
            anyShown = anyShown || shown;
        }
        emptyElement.hidden = anyShown;
        ensureTileStop();
    };

    obsCustomGateSet.subscribe(customGateSet => {
        let groups = [...Gates.TopToolboxGroups, ...Gates.BottomToolboxGroups];
        if (customGateSet.gates.length > 0) {
            groups = [...groups, {hint: 'Custom Gates', gates: customGateSet.gates}];
        }
        build(groups);
        applyFilter();
    });

    // The chips are static text, but a tooltip opened on a time-dependent gate still paints the
    // gate at the simulation's current time.
    mostRecentStats.observable().subscribe(stats => {
        latestTime = stats.time;
    });

    searchInput.addEventListener('input', applyFilter);
    searchInput.addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && searchInput.value !== '') {
            searchInput.value = '';
            applyFilter();
            ev.stopPropagation();
        }
    });
}

export {initToolbox}
