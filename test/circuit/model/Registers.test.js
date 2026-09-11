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

import {Suite, assertThat, assertThrows} from "../../TestUtil.js"
import {Registers} from "../../../src/circuit/model/Registers.js"

const suite = new Suite("Registers");

/** A register as the model keeps it, every field present. */
const reg = (name, start, length, input = undefined, labels = undefined) => ({name, start, length, input, labels});

suite.test("registers are kept in wire order and found by wire", () => {
    const registers = new Registers([reg("b", 3, 2), reg("a", 0, 3)]);
    assertThat(registers.list.map(r => r.name)).isEqualTo(["a", "b"]);
    assertThat(registers.at(2).name).isEqualTo("a");
    assertThat(registers.at(3).name).isEqualTo("b");
    assertThat(registers.at(5)).isEqualTo(undefined);
    assertThat(registers.covers(4)).isEqualTo(true);
    assertThat(registers.minimumRequiredWireCount()).isEqualTo(5);
    assertThat(Registers.EMPTY.minimumRequiredWireCount()).isEqualTo(0);
    assertThat(registers.nextFreeName()).isEqualTo("c");
});

suite.test("registers must be contiguous, apart and well named", () => {
    const broken = [
        [reg("a", 0, 3), reg("b", 2, 2)],
        [reg("a", 0, 1), reg("a", 1, 1)],
        [reg("2x", 0, 1)],
        [reg("_x", 0, 1)],
        [reg("q3", 0, 1)],
        [reg("a", 0, 0)],
        [reg("a", 15, 2)],
        [reg("a", 0, 1, "A"), reg("b", 1, 1, "A")],
        [reg("a", 0, 1, "Q")],
        [reg("a", 0, 1, undefined, {"2": "A"})],
        [reg("a", 0, 1, undefined, {"0": ""})],
        [reg("a", 0, 1, undefined, {"0": "A B"})],
        [reg("a", 0, 1, undefined, {"0": "A", "1": "A"})],
        [reg("a", 0, 1, undefined, ["A"])],
    ];
    for (const list of broken) {
        assertThat(Registers.problemWith(list) === undefined).withInfo({list}).isEqualTo(false);
        assertThrows(() => new Registers(list));
    }
    assertThat(Registers.problemWith([reg("a", 0, 3), reg("b_2", 3, 2, "B")])).isEqualTo(undefined);
});

suite.test("taking a row out moves the registers below up and shrinks the one it was in", () => {
    const registers = new Registers([reg("a", 0, 3), reg("b", 3, 2), reg("c", 6, 1)]);
    assertThat(registers.afterRowRemoved(1).list).isEqualTo([reg("a", 0, 2), reg("b", 2, 2), reg("c", 5, 1)]);
    // A register that loses its only wire goes.
    assertThat(registers.afterRowRemoved(6).list.map(r => r.name)).isEqualTo(["a", "b"]);
});

suite.test("putting a row in moves the registers below down and grows the one it lands inside", () => {
    const registers = new Registers([reg("a", 0, 3), reg("b", 3, 2)]);
    assertThat(registers.afterRowInserted(1).list).isEqualTo([reg("a", 0, 4), reg("b", 4, 2)]);
    // At a register's first wire the row goes above it.
    assertThat(registers.afterRowInserted(3).list).isEqualTo([reg("a", 0, 3), reg("b", 4, 2)]);
    assertThat(registers.afterRowInserted(4).list).isEqualTo([reg("a", 0, 3), reg("b", 3, 3)]);
});

suite.test("a register can feed an input, the way an input gate would", () => {
    const registers = new Registers([reg("a", 2, 3, "A")]);
    assertThat([...registers.inputContext(0).entries()]).isEqualTo([["Input Range A", {offset: 2, length: 3}]]);
    assertThat([...registers.inputContext(4).entries()]).isEqualTo([["Input Range A", {offset: 6, length: 3}]]);
});

suite.test("a value reads by its label, and labels follow a register's wires", () => {
    const registers = new Registers([reg("a", 0, 2, undefined, {"0": "A", "3": "D"})]);
    assertThat(Registers.valueLabel(registers.named("a"), 3)).isEqualTo("D");
    assertThat(Registers.valueLabel(registers.named("a"), 1)).isEqualTo("1");
    // A wire put in at position 1 gives every value a 0 bit there: 3 (11) becomes 5 (101).
    assertThat(registers.afterRowInserted(1).named("a").labels).isEqualTo({"0": "A", "5": "D"});
    // Taking a₀ out keeps the values whose a₀ was 0: D, whose a₀ was 1, goes.
    assertThat(registers.afterRowRemoved(0).named("a").labels).isEqualTo({"0": "A"});
    // No labels at all is the same as none.
    assertThat(new Registers([reg("a", 0, 2, undefined, {})]).named("a").labels).isEqualTo(undefined);
});

suite.test("register sets compare by content", () => {
    const a = new Registers([reg("a", 0, 2)]);
    assertThat(a.isEqualTo(new Registers([reg("a", 0, 2)]))).isEqualTo(true);
    assertThat(a.isEqualTo(new Registers([reg("a", 0, 2, "A")]))).isEqualTo(false);
    assertThat(a.isEqualTo(new Registers([reg("a", 0, 2, undefined, {"0": "A"})]))).isEqualTo(false);
    assertThat(a.isEqualTo(a.withReplaced("a", reg("b", 0, 2)))).isEqualTo(false);
    assertThat(a.withoutRegister("a").isEmpty()).isEqualTo(true);
    assertThat(a.withRegister(reg("b", 2, 1)).list.length).isEqualTo(2);
});
