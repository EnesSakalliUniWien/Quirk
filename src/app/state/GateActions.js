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

import {GateColumn} from "../../circuit/model/GateColumn.js"

/**
 * Edits to one gate in its slot: the ones the gate's menu offers, and the angle its dial turns.
 * Each is one commit, so undo, redo and the URL follow them the way they follow a drag - except a
 * previewed parameter, which shows on the circuit until the turn that makes it settles into one
 * commit. An edit aimed at a slot whose gate has gone is refused rather than applied to another.
 */
class GateActions {
    /**
     * @param {!Revision} revision
     * @param {import("zustand/vanilla").StoreApi<{value: !EditorState}>} displayed
     */
    constructor(revision, displayed) {
        this._revision = revision;
        this._displayed = displayed;
    }

    /**
     * @returns {!CircuitDefinition} The circuit now.
     */
    current() {
        return this._displayed.getState().value.displayedCircuit.circuitDefinition;
    }

    /**
     * @param {!int} col
     * @param {!int} row
     * @returns {undefined|!Gate} The gate whose top-left slot this is.
     */
    gateAt(col, row) {
        return this.current().columns[col]?.gates[row];
    }

    /**
     * Switches the gate off, or back on. Off, it keeps its slot but the simulation skips it.
     *
     * @param {!int} col
     * @param {!int} row
     * @param {!boolean} deactivated
     * @returns {!boolean} Whether the circuit changed.
     */
    setDeactivated(col, row, deactivated) {
        const gate = this.gateAt(col, row);
        if (gate === undefined) {
            return false;
        }
        return this._replace(col, row, gate.withDeactivated(deactivated));
    }

    /**
     * @param {!int} col
     * @param {!int} row
     * @returns {!boolean} Whether the circuit changed.
     */
    remove(col, row) {
        return this.gateAt(col, row) === undefined ? false : this._replace(col, row, undefined);
    }

    /**
     * Gives the gate a new parameter through its own dialog, so the text is checked as typed text
     * is. Previewed, the change shows on the circuit but is not yet a commit: a turn of the dial
     * previews each step and commits once when it settles, and undo takes the whole turn back.
     *
     * @param {!int} col
     * @param {!int} row
     * @param {!string} text
     * @param {!{preview: (undefined|!boolean)}=} options
     * @returns {undefined|!string} Why the text was refused, if it was.
     */
    setParamText(col, row, text, {preview = false} = {}) {
        const gate = this.gateAt(col, row);
        if (gate?.paramDialog === undefined) {
            return 'There is no parameter gate in that slot.';
        }
        const result = gate.paramDialog.applyText(gate, text);
        if (result.error !== undefined) {
            return result.error;
        }
        this._replace(col, row, result.gate, preview);
        return undefined;
    }

    /**
     * @param {!int} col
     * @param {!int} row
     * @param {undefined|!Gate} gate
     * @param {!boolean=} preview Show the change without committing it.
     * @returns {!boolean} Whether the circuit changed.
     * @private
     */
    _replace(col, row, gate, preview = false) {
        const definition = this.current();
        const gates = [...definition.columns[col].gates];
        gates[row] = gate;
        const cols = [...definition.columns];
        cols[col] = new GateColumn(gates);
        const state = this._displayed.getState().value.
            withCircuitDefinition(definition.withColumns(cols)).
            afterTidyingUp();
        if (preview) {
            if (definition.columns[col].gates[row] === gate) {
                return false;
            }
            this._revision.startedWorkingOnCommit();
            this._displayed.setState({value: state});
            return true;
        }
        // A settled preview commits even when its last step changed nothing more.
        const snapshot = state.snapshot();
        if (snapshot === this._revision.peekActiveCommit() && !this._revision.isWorkingOnCommit) {
            return false;
        }
        this._revision.commit(snapshot);
        return true;
    }
}

export {GateActions}
