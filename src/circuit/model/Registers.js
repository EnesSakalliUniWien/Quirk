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

import {DetailedError} from "../../base/DetailedError.js"
import {Simulation} from "../../config/Simulation.js"
import {INPUT_LETTERS} from "./InputLetters.js"

/**
 * A register's name: a letter, then letters, digits and underscores. "q3" is taken: it is how a
 * wire outside every register is labelled.
 */
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const WIRE_LABEL_PATTERN = /^q[0-9]+$/;

/** A value's label: up to this many characters, none of them blank. */
const MAX_LABEL_LENGTH = 16;

/**
 * @typedef {!{name: !string, start: !int, length: !int, input: (undefined|!string),
 *     labels: (undefined|!Object.<!string, !string>)}} Register
 *     `start` is the register's first wire and `length` how many wires it covers, contiguously.
 *     `input`, when set, is the input letter - A, B or R - the register feeds to every column that
 *     has no input gate of its own for it. `labels` names some of the register's values - {"0":
 *     "A", "3": "D"} - and a named value reads by its name wherever a basis state is written.
 */

/**
 * @param {!Register} register
 * @returns {!Register} The same register, frozen, with every field present.
 */
function normalised({name, start, length, input = undefined, labels = undefined}) {
    const kept = labels === undefined || Object.keys(labels).length === 0 ? undefined : Object.freeze({...labels});
    return Object.freeze({name, start, length, input, labels: kept});
}

/**
 * @param {*} labels
 * @param {!int} length
 * @returns {undefined|!string} What is wrong with a register's value labels, if anything.
 */
function labelsProblem(labels, length) {
    if (labels === undefined) {
        return undefined;
    }
    if (labels === null || typeof labels !== "object" || Array.isArray(labels)) {
        return "value labels must map values to names.";
    }
    const seen = new Set();
    for (const [key, label] of Object.entries(labels)) {
        const value = Number(key);
        if (!/^(0|[1-9][0-9]*)$/.test(key) || value >= 2 ** length) {
            return `"${key}" is not one of the register's values (0 to ${2 ** length - 1}).`;
        }
        if (typeof label !== "string" || label.trim() === "" || label.length > MAX_LABEL_LENGTH ||
                /\s/.test(label)) {
            return `a value's label is a word of up to ${MAX_LABEL_LENGTH} characters, with no spaces.`;
        }
        if (seen.has(label)) {
            return `two values are labelled "${label}".`;
        }
        seen.add(label);
    }
    return undefined;
}

/**
 * @param {!int} value
 * @param {!int} position
 * @returns {!int} The value with a 0 bit put in at `position`.
 */
function withBitInserted(value, position) {
    return (value & ((1 << position) - 1)) | ((value >> position) << (position + 1));
}

/**
 * @param {undefined|!Object.<!string, !string>} labels
 * @param {!function(!int): (undefined|!int)} move Where each labelled value goes, or undefined for gone.
 * @returns {undefined|!Object.<!string, !string>}
 */
function movedLabels(labels, move) {
    if (labels === undefined) {
        return undefined;
    }
    const out = {};
    for (const [key, label] of Object.entries(labels)) {
        const to = move(Number(key));
        if (to !== undefined) {
            out[to] = label;
        }
    }
    return out;
}

/**
 * What is wrong with a list of registers, if anything.
 *
 * @param {!Array.<!Register>} list
 * @returns {undefined|!string}
 */
function problemWith(list) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    const names = new Set();
    const inputs = new Set();
    let end = 0;
    for (const {name, start, length, input, labels} of sorted) {
        if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
            return `"${name}" is not a register name: use letters, digits and underscores, starting with a letter.`;
        }
        if (WIRE_LABEL_PATTERN.test(name)) {
            return `"${name}" is how a wire is labelled, so it cannot name a register.`;
        }
        if (names.has(name)) {
            return `Two registers are named "${name}".`;
        }
        names.add(name);
        if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1 ||
                start + length > Simulation.MAX_WIRE_COUNT) {
            return `Register ${name} must cover one or more of the ${Simulation.MAX_WIRE_COUNT} wires.`;
        }
        if (start < end) {
            return `Register ${name} overlaps the register before it.`;
        }
        end = start + length;
        const labelProblem = labelsProblem(labels, length);
        if (labelProblem !== undefined) {
            return `Register ${name}: ${labelProblem}`;
        }
        if (input !== undefined) {
            if (!INPUT_LETTERS.includes(input)) {
                return `Register ${name} can feed input ${INPUT_LETTERS.join(", ")} or none, not "${input}".`;
            }
            if (inputs.has(input)) {
                return `Two registers feed input ${input}.`;
            }
            inputs.add(input);
        }
    }
    return undefined;
}

/**
 * The circuit's named groups of wires.
 *
 * A register names its wires - a₀, a₁, a₂ - and can feed an input letter to the arithmetic gates.
 * It says nothing about how its wires start: that is a prepare box on the wires, a gate like any
 * other. Immutable, like the rest of the circuit model: every edit returns a new set, and the
 * constructor refuses a set that breaks the rules - contiguous wires, no overlaps, unique names.
 * Registers are kept in wire order.
 */
class Registers {
    /**
     * @param {!Array.<!Register>} list
     */
    constructor(list = []) {
        const problem = problemWith(list);
        if (problem !== undefined) {
            throw new DetailedError(problem, {list});
        }
        /** @type {!Array.<!Register>} In wire order. */
        this.list = Object.freeze([...list].sort((a, b) => a.start - b.start).map(normalised));
    }

    /**
     * @param {!Array.<!Register>} list
     * @returns {undefined|!string} What is wrong with the list, for an editor to say before it tries.
     */
    static problemWith(list) {
        return problemWith(list);
    }

    /** @returns {!boolean} */
    isEmpty() {
        return this.list.length === 0;
    }

    /**
     * @param {!int} wire
     * @returns {undefined|!Register} The register covering the wire.
     */
    at(wire) {
        return this.list.find(r => wire >= r.start && wire < r.start + r.length);
    }

    /**
     * @param {!int} wire
     * @returns {!boolean}
     */
    covers(wire) {
        return this.at(wire) !== undefined;
    }

    /**
     * @param {!string} name
     * @returns {undefined|!Register}
     */
    named(name) {
        return this.list.find(r => r.name === name);
    }

    /**
     * @param {!Register} register
     * @returns {!Registers}
     */
    withRegister(register) {
        return new Registers([...this.list, register]);
    }

    /**
     * @param {!string} name
     * @param {!Register} register What the named register becomes: renamed, resized or refed.
     * @returns {!Registers}
     */
    withReplaced(name, register) {
        return new Registers(this.list.map(r => r.name === name ? register : r));
    }

    /**
     * @param {!string} name
     * @returns {!Registers}
     */
    withoutRegister(name) {
        return new Registers(this.list.filter(r => r.name !== name));
    }

    /**
     * The registers after the row at `row` is taken out of the circuit: the ones below it move up,
     * and the one it was in loses it - or goes, if that was its only wire.
     *
     * @param {!int} row
     * @returns {!Registers}
     */
    afterRowRemoved(row) {
        const kept = [];
        for (const r of this.list) {
            if (r.start > row) {
                kept.push({...r, start: r.start - 1});
            } else if (row < r.start + r.length) {
                if (r.length > 1) {
                    // A value whose removed bit was 1 is no value of the smaller register.
                    const bit = row - r.start;
                    kept.push({...r, length: r.length - 1, labels: movedLabels(r.labels, v =>
                        (v >> bit) & 1 ? undefined : (v & ((1 << bit) - 1)) | ((v >> (bit + 1)) << bit))});
                }
            } else {
                kept.push(r);
            }
        }
        return new Registers(kept);
    }

    /**
     * The registers after a row is put into the circuit at `row`: the ones at or below it move
     * down, and one it lands strictly inside takes it in, so registers stay contiguous. A row put
     * at a register's first wire goes above the register, not into it.
     *
     * @param {!int} row
     * @returns {!Registers}
     */
    afterRowInserted(row) {
        return new Registers(this.list.
            filter(r => r.start + (r.start >= row ? 1 : 0) + r.length +
                (r.start < row && row < r.start + r.length ? 1 : 0) <= Simulation.MAX_WIRE_COUNT).
            map(r => {
                if (r.start >= row) {
                    return {...r, start: r.start + 1};
                }
                if (row < r.start + r.length) {
                    // The new wire is |0⟩, so a labelled value gains a 0 bit where it went in.
                    return {...r, length: r.length + 1,
                        labels: movedLabels(r.labels, v => withBitInserted(v, row - r.start))};
                }
                return r;
            }));
    }

    /**
     * @param {!int} numWires
     * @returns {!Registers} The registers that fit in a circuit of `numWires` wires.
     */
    fittingIn(numWires) {
        return this.list.every(r => r.start + r.length <= numWires)
            ? this
            : new Registers(this.list.filter(r => r.start + r.length <= numWires));
    }

    /**
     * @param {!Register} register
     * @param {!int} value
     * @returns {!string} The value's label, or the value itself when it has none.
     */
    static valueLabel(register, value) {
        return register.labels?.[value] ?? String(value);
    }

    /**
     * @returns {!int} How many wires a circuit needs to hold every register.
     */
    minimumRequiredWireCount() {
        return this.list.reduce((best, r) => Math.max(best, r.start + r.length), 0);
    }

    /**
     * The input ranges the registers feed, as the column context an input gate would provide.
     *
     * @param {!int} outerRowOffset
     * @returns {!Map.<!string, !{offset: !int, length: !int}>}
     */
    inputContext(outerRowOffset) {
        return new Map(this.list.
            filter(r => r.input !== undefined).
            map(r => [`Input Range ${r.input}`, {offset: outerRowOffset + r.start, length: r.length}]));
    }

    /**
     * @returns {!string} The first of a, b, c... that no register is named yet.
     */
    nextFreeName() {
        for (let i = 0; ; i++) {
            const name = i < 26 ? String.fromCharCode(97 + i) : `r${i - 25}`;
            if (this.named(name) === undefined) {
                return name;
            }
        }
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Registers &&
            this.list.length === other.list.length &&
            this.list.every((r, i) => {
                const o = other.list[i];
                return r.name === o.name && r.start === o.start && r.length === o.length && r.input === o.input &&
                    JSON.stringify(r.labels ?? null) === JSON.stringify(o.labels ?? null);
            });
    }

    /** @returns {!string} */
    toString() {
        return `Registers(${this.list.map(r => `${r.name}:${r.start}+${r.length}`).join(", ")})`;
    }
}

Registers.EMPTY = new Registers([]);

export {Registers}
