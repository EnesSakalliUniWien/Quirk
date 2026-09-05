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

import {GateColumn} from "../circuit/GateColumn.js"

/**
 * The in-app replacement for the browser prompt that parametrized gates used: clicking a gate's
 * button opens this dialog, and applying commits a copy of the circuit with the reparametrized
 * gate in place.
 *
 * @param {!Revision} revision
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!OverlayState} overlayState
 * @returns {!function(found: !{col: !int, row: !int, gate: !Gate}): void} Opens the dialog for
 *     the clicked gate.
 */
function initGateParamDialog(revision, displayed, overlayState) {
    const titleElement = document.getElementById('gate-param-title');
    const messageElement = document.getElementById('gate-param-message');
    const inputElement = /** @type {!HTMLInputElement} */ document.getElementById('gate-param-input');
    const errorElement = document.getElementById('gate-param-error');
    const applyButton = document.getElementById('gate-param-apply-button');
    const cancelButton = document.getElementById('gate-param-cancel-button');

    /** @type {undefined|!{col: !int, row: !int, gate: !Gate}} */
    let pending = undefined;

    const apply = () => {
        if (pending === undefined) {
            return;
        }
        const {col, row} = pending;
        const circuitDefinition = displayed.get().displayedCircuit.circuitDefinition;
        const oldGate = circuitDefinition.gateInSlot(col, row);
        // The slot may not hold the clicked gate any more (e.g. the URL changed underneath the
        // dialog); applying to whatever took its place would edit the wrong gate.
        if (oldGate !== pending.gate || oldGate.paramDialog === undefined) {
            overlayState.close();
            return;
        }

        const result = oldGate.paramDialog.applyText(oldGate, inputElement.value);
        if (result.error !== undefined) {
            errorElement.textContent = result.error;
            errorElement.hidden = false;
            return;
        }

        pending = undefined;
        overlayState.close();
        if (result.gate !== oldGate && result.gate.param !== oldGate.param) {
            let cols = [...circuitDefinition.columns];
            let gates = [...cols[col].gates];
            gates.splice(row, 1, result.gate);
            cols.splice(col, 1, new GateColumn(gates));
            let newInspector = displayed.get().withCircuitDefinition(circuitDefinition.withColumns(cols));
            revision.commit(newInspector.afterTidyingUp().snapshot());
        }
    };

    applyButton.addEventListener('click', apply);
    cancelButton.addEventListener('click', () => overlayState.close());
    inputElement.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
            apply();
            ev.preventDefault();
        }
    });
    inputElement.addEventListener('input', () => {
        errorElement.hidden = true;
    });
    // The browser prompt this dialog replaces started with its text selected.
    inputElement.addEventListener('focus', () => inputElement.select());
    overlayState.active().subscribe(active => {
        if (active !== 'gate-param') {
            pending = undefined;
        }
    });

    return found => {
        titleElement.textContent = found.gate.paramDialog.title;
        messageElement.textContent = found.gate.paramDialog.message;
        inputElement.value = found.gate.param === undefined ? '' : '' + found.gate.param;
        errorElement.hidden = true;
        pending = {col: found.col, row: found.row, gate: found.gate};
        overlayState.open('gate-param');
    };
}

export {initGateParamDialog}
