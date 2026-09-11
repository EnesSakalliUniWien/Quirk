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

import {Registers} from "../../circuit/model/Registers.js"
import {Simulation} from "../../config/Simulation.js"

/**
 * Edits to the circuit's registers. Each is one commit, so undo, redo and the URL follow a register
 * the way they follow a gate. An edit that would break a rule - an overlap, a taken name - is
 * refused, and the reason returned for the caller to show.
 */
class RegisterActions {
    /**
     * @param {!Revision} revision
     * @param {!{get: function(): !DisplayedInspector}} displayed
     */
    constructor(revision, displayed) {
        this._revision = revision;
        this._displayed = displayed;
    }

    /**
     * @returns {!Registers} The circuit's registers now.
     */
    current() {
        return this._displayed.get().displayedCircuit.circuitDefinition.registers;
    }

    /**
     * @param {!string} name
     * @param {!Register} register What the named register becomes: renamed, moved, resized or refed.
     * @returns {undefined|!string} Why the edit was refused, if it was.
     */
    replace(name, register) {
        return this._commit(this.current().list.map(r => r.name === name ? register : r));
    }

    /**
     * @param {!string} name
     * @param {!string} newName
     * @returns {undefined|!string} Why the edit was refused, if it was.
     */
    rename(name, newName) {
        const register = this.current().named(name);
        if (register === undefined) {
            return `There is no register named "${name}".`;
        }
        return newName === name ? undefined : this.replace(name, {...register, name: newName});
    }

    /**
     * @param {!string} name
     * @param {undefined|!string} input The input letter the register feeds, or undefined for none.
     * @returns {undefined|!string} Why the edit was refused, if it was.
     */
    feed(name, input) {
        const register = this.current().named(name);
        if (register === undefined) {
            return `There is no register named "${name}".`;
        }
        return this.replace(name, {...register, input});
    }

    /**
     * Names one of the register's values, or takes the name away.
     *
     * @param {!string} name
     * @param {!int} value
     * @param {undefined|!string} label The value's new label, or undefined for none.
     * @returns {undefined|!string} Why the edit was refused, if it was.
     */
    label(name, value, label) {
        const register = this.current().named(name);
        if (register === undefined) {
            return `There is no register named "${name}".`;
        }
        const labels = {...(register.labels ?? {})};
        if (label === undefined) {
            delete labels[value];
        } else {
            labels[value] = label;
        }
        return this.replace(name, {...register, labels});
    }

    /**
     * @param {!string} name
     * @returns {undefined|!string} Why the edit was refused, if it was.
     */
    remove(name) {
        return this._commit(this.current().list.filter(r => r.name !== name));
    }

    /**
     * Adds a one-wire register on the given wire, which must be outside every register.
     *
     * @param {!int} wire
     * @returns {undefined|!string} The new register's name, or undefined when the wire is taken.
     */
    addAt(wire) {
        const registers = this.current();
        if (wire < 0 || wire >= Simulation.MAX_WIRE_COUNT || registers.covers(wire)) {
            return undefined;
        }
        const name = registers.nextFreeName();
        const refused = this._commit([...registers.list, {name, start: wire, length: 1, input: undefined, labels: undefined}]);
        return refused === undefined ? name : undefined;
    }

    /**
     * Adds a one-wire register on the first wire outside every register.
     *
     * @returns {undefined|!string} The new register's name, or undefined when every wire is taken.
     */
    add() {
        const registers = this.current();
        let wire = 0;
        while (wire < Simulation.MAX_WIRE_COUNT && registers.covers(wire)) {
            wire++;
        }
        return this.addAt(wire);
    }

    /**
     * @param {!Array.<!Register>} list
     * @returns {undefined|!string}
     * @private
     */
    _commit(list) {
        const problem = Registers.problemWith(list);
        if (problem !== undefined) {
            return problem;
        }
        const registers = new Registers(list);
        const inspector = this._displayed.get();
        const circuit = inspector.displayedCircuit.circuitDefinition;
        // A register may reach past the last wire; the circuit grows to hold it.
        const grown = circuit.withWireCount(Math.max(circuit.numWires, registers.minimumRequiredWireCount()));
        this._revision.commit(inspector.withCircuitDefinition(grown.withRegisters(registers)).afterTidyingUp().snapshot());
        return undefined;
    }
}

export {RegisterActions}
