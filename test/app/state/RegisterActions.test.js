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

import {Suite, assertThat} from "../../TestUtil.js"
import {Revision} from "../../../src/base/Revision.js"
import {CircuitActions} from "../../../src/app/state/CircuitActions.js"
import {RegisterActions} from "../../../src/app/state/RegisterActions.js"
import {EditorState} from "../../../src/editor/state/EditorState.js"
import {Rect} from "../../../src/geometry/Rect.js"
import {fromJsonText_CircuitDefinition} from "../../../src/serialization/Serializer.js"

const suite = new Suite("RegisterActions");

/**
 * The app's arrangement in miniature: a revision, and a displayed circuit following its commits.
 *
 * @param {!object} json
 */
function setup(json) {
    let inspector = EditorState.empty(new Rect(0, 0, 800, 400)).
        withCircuitDefinition(fromJsonText_CircuitDefinition(JSON.stringify(json)));
    const revision = Revision.startingAt(inspector.snapshot());
    revision.latestActiveCommit().subscribe(text => {
        inspector = inspector.withCircuitDefinition(fromJsonText_CircuitDefinition(text));
    });
    return {
        revision,
        actions: new RegisterActions(revision, {getState: () => ({value: inspector})}),
        registers: () => inspector.displayedCircuit.circuitDefinition.registers,
    };
}

suite.test("an edit is one commit, and undo takes it back", () => {
    const {revision, actions, registers} = setup({cols: [["X"]], registers: [{name: "a", wires: [0, 2]}]});
    assertThat(actions.rename("a", "acc")).isEqualTo(undefined);
    assertThat(registers().named("acc").length).isEqualTo(2);
    assertThat(actions.feed("acc", "A")).isEqualTo(undefined);
    assertThat(registers().named("acc").input).isEqualTo("A");
    const circuit = new CircuitActions(revision);
    circuit.undo();
    assertThat(registers().named("acc").input).isEqualTo(undefined);
    circuit.undo();
    assertThat(registers().named("a").input).isEqualTo(undefined);
});

suite.test("an edit that breaks a rule is refused with the reason, and nothing is committed", () => {
    const {actions, registers} = setup({cols: [], registers: [{name: "a", wires: [0, 2]}, {name: "b", wires: [2, 1]}]});
    assertThat(typeof actions.replace("b", {name: "b", start: 1, length: 2, input: undefined})).isEqualTo("string");
    assertThat(typeof actions.rename("b", "a")).isEqualTo("string");
    assertThat(typeof actions.rename("b", "q7")).isEqualTo("string");
    assertThat(registers().named("b").start).isEqualTo(2);
});

suite.test("a register grown past the last wire grows the circuit with it", () => {
    const {actions, registers} = setup({cols: [["H"]], registers: [{name: "a", wires: [0, 1]}]});
    assertThat(actions.replace("a", {name: "a", start: 0, length: 5, input: undefined})).isEqualTo(undefined);
    assertThat(registers().named("a").length).isEqualTo(5);
});

suite.test("a value is labelled and unlabelled in place", () => {
    const {actions, registers} = setup({cols: [], registers: [{name: "a", wires: [0, 2]}]});
    assertThat(actions.label("a", 0, "A")).isEqualTo(undefined);
    assertThat(actions.label("a", 3, "D")).isEqualTo(undefined);
    assertThat(registers().named("a").labels).isEqualTo({"0": "A", "3": "D"});
    assertThat(typeof actions.label("a", 1, "A")).isEqualTo("string");
    assertThat(typeof actions.label("a", 4, "E")).isEqualTo("string");
    assertThat(actions.label("a", 0, undefined)).isEqualTo(undefined);
    assertThat(registers().named("a").labels).isEqualTo({"3": "D"});
});

suite.test("adding takes a free wire; removing takes the register away", () => {
    const {actions, registers} = setup({cols: [["H"]], registers: [{name: "a", wires: [0, 1]}]});
    assertThat(actions.addAt(0)).isEqualTo(undefined);
    assertThat(actions.add()).isEqualTo("b");
    assertThat(registers().named("b")).isEqualTo({name: "b", start: 1, length: 1, input: undefined, labels: undefined});
    assertThat(actions.remove("a")).isEqualTo(undefined);
    assertThat(registers().named("a")).isEqualTo(undefined);
});
