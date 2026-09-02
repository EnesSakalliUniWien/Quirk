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

import {CooldownThrottle} from "../base/CooldownThrottle.js"
import {Util} from "../base/Util.js"

/**
 * Amplitudes at or below this probability are treated as absent. NaN amplitudes fail the same
 * comparison, so a circuit that failed to simulate reports nothing rather than a screen of NaN.
 * @type {!number}
 */
const NEGLIGIBLE_PROBABILITY = 1e-12;

/**
 * The most rows the table draws. Sixteen qubits is 65536 amplitudes, which is more rows than a
 * table is any use for.
 * @type {!int}
 */
const MAX_ROWS = 4096;

/** Milliseconds. Rate-limit on rebuilding the table, which redraws far slower than the canvas. */
const STATE_TABLE_COOLDOWN_MILLIS = 100;

/**
 * The rows of the state table, derived from a circuit's output superposition.
 *
 * The simulator drops wires no gate touches, so its state can be shorter than the circuit on
 * screen. Those wires stayed |0>, which means the short state is a prefix of the full one and the
 * rest is zero, so the missing amplitudes read as zero rather than being relabelled.
 *
 * @param {!CircuitStats} stats
 * @param {!int} wireCount The number of wires the circuit shows.
 * @param {!int=} maxRows
 * @returns {!{
 *     amplitudeCount: !int,
 *     nonzeroCount: !int,
 *     rows: !Array.<!{
 *         ket: !string,
 *         probability: !number,
 *         real: !number,
 *         imag: !number,
 *         phaseDegrees: !number
 *     }>
 * }}
 */
function stateTableRows(stats, wireCount, maxRows=MAX_ROWS) {
    let buf = stats.finalState.rawBuffer();
    let amplitudeCount = 1 << wireCount;

    let rows = [];
    let nonzeroCount = 0;
    for (let i = 0; i < amplitudeCount; i++) {
        let real = i*2 < buf.length ? buf[i*2] : 0;
        let imag = i*2 + 1 < buf.length ? buf[i*2 + 1] : 0;
        let probability = real*real + imag*imag;
        if (!(probability > NEGLIGIBLE_PROBABILITY)) {
            continue;
        }

        nonzeroCount++;
        if (rows.length < maxRows) {
            rows.push({
                ket: Util.bin(i, wireCount),
                probability,
                real,
                imag,
                phaseDegrees: Math.atan2(imag, real) * 180 / Math.PI
            });
        }
    }

    return {amplitudeCount, nonzeroCount, rows};
}

/**
 * @param {!number} v
 * @param {!int} digits
 * @returns {!string}
 * @private
 */
function _forceSign(v, digits) {
    return (v >= 0 ? '+' : '') + v.toFixed(digits);
}

/**
 * The hue carries the phase, so a glance down the column shows which amplitudes share one.
 * @param {!number} phaseDegrees
 * @returns {!string}
 * @private
 */
function _phaseColor(phaseDegrees) {
    return `hsl(${((phaseDegrees % 360) + 360) % 360} 85% 62%)`;
}

/**
 * @param {!HTMLTableSectionElement} tbody
 * @returns {!{
 *     row: !HTMLTableRowElement,
 *     ket: !HTMLElement,
 *     bar: !HTMLElement,
 *     probability: !HTMLElement,
 *     amplitude: !HTMLElement,
 *     swatch: !HTMLElement,
 *     phase: !HTMLElement
 * }}
 * @private
 */
function _appendRow(tbody) {
    const row = document.createElement('tr');
    row.innerHTML =
        '<td class="state-ket"></td>' +
        '<td class="state-probability">' +
            '<span class="state-bar"><span class="state-bar-fill"></span></span>' +
            '<span class="state-number"></span>' +
        '</td>' +
        '<td class="state-amplitude"></td>' +
        '<td class="state-phase">' +
            '<span class="state-swatch"></span>' +
            '<span class="state-number"></span>' +
        '</td>';
    tbody.appendChild(row);
    return {
        row,
        ket: row.querySelector('.state-ket'),
        bar: row.querySelector('.state-bar-fill'),
        probability: row.querySelector('.state-probability .state-number'),
        amplitude: row.querySelector('.state-amplitude'),
        swatch: row.querySelector('.state-swatch'),
        phase: row.querySelector('.state-phase .state-number')
    };
}

/**
 * Fills the state table from the stats at the playhead. Rows are reused across updates, because
 * the table redraws whenever the circuit or the playhead moves.
 *
 * Interface note: also requires #state-table-body, #state-summary, and #state-truncation-note,
 * shipped in html/state.partial.html.
 *
 * @param {!ObservableValue.<!{stats: !CircuitStats, wireCount: !int}>} obsPlayheadStats
 * @returns {void}
 */
function initStateTable(obsPlayheadStats) {
    const tbody = /** @type {!HTMLTableSectionElement} */ document.getElementById('state-table-body');
    const summaryElement = /** @type {!HTMLElement} */ document.getElementById('state-summary');
    const noteElement = /** @type {!HTMLElement} */ document.getElementById('state-truncation-note');

    /** @type {!Array.<!object>} */
    const pool = [];
    /** @type {undefined|!{stats: !CircuitStats, wireCount: !int}} */
    let latest = undefined;

    const render = () => {
        if (latest === undefined) {
            return;
        }
        let wireCount = latest.wireCount;
        let {amplitudeCount, nonzeroCount, rows} = stateTableRows(latest.stats, wireCount);

        summaryElement.textContent =
            `${wireCount} qubit${wireCount === 1 ? '' : 's'} · ` +
            `${amplitudeCount} amplitudes · ` +
            `${nonzeroCount} nonzero`;
        // Never let a cap read as "that's all of them".
        noteElement.textContent = nonzeroCount > rows.length ?
            `Showing the first ${rows.length} of ${nonzeroCount} nonzero amplitudes.` :
            '';

        while (pool.length < rows.length) {
            pool.push(_appendRow(tbody));
        }
        for (let i = 0; i < pool.length; i++) {
            let cells = pool[i];
            if (i >= rows.length) {
                cells.row.style.display = 'none';
                continue;
            }
            let {ket, probability, real, imag, phaseDegrees} = rows[i];
            cells.row.style.display = '';
            cells.ket.textContent = `|${ket}⟩`;
            cells.bar.style.width = `${Math.min(100, probability * 100)}%`;
            cells.probability.textContent = probability.toFixed(4);
            cells.amplitude.textContent = `${_forceSign(real, 3)} ${_forceSign(imag, 3)}i`;
            cells.swatch.style.background = _phaseColor(phaseDegrees);
            cells.phase.textContent = _forceSign(phaseDegrees, 2);
        }
    };

    const throttle = new CooldownThrottle(render, STATE_TABLE_COOLDOWN_MILLIS);
    obsPlayheadStats.observable().subscribe(value => {
        latest = value;
        throttle.trigger();
    });
}

export {initStateTable, stateTableRows}
