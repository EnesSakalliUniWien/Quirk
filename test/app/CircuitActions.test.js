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

import {Suite, assertThat} from "../TestUtil.js"
import {Revision} from "../../src/base/Revision.js"
import {CircuitActions} from "../../src/app/CircuitActions.js"
import {OverlayState} from "../../src/app/OverlayState.js"

let suite = new Suite("CircuitActions");

const EMPTY_STATE = '{"cols":[]}';
const CIRCUIT_STATE = '{"cols":[["H"]]}';
const CUSTOM_GATE_STATE = '{"cols":[["H"]],"gates":[{"id":"~test"}]}';

function closedOverlays() {
    let overlays = new OverlayState();
    overlays.close();
    return overlays;
}

suite.test("availability follows revision history and overlays", () => {
    let revision = Revision.startingAt(EMPTY_STATE);
    let overlays = closedOverlays();
    let actions = new CircuitActions(revision, overlays);

    assertThat(actions.availability().snapshot()).isEqualTo([{
        canUndo: false,
        canRedo: false,
        canClearCircuit: false,
        canClearAll: false
    }]);

    revision.commit(CIRCUIT_STATE);
    assertThat(actions.availability().snapshot()).isEqualTo([{
        canUndo: true,
        canRedo: false,
        canClearCircuit: true,
        canClearAll: true
    }]);

    overlays.open("menu");
    assertThat(actions.availability().snapshot()).isEqualTo([{
        canUndo: false,
        canRedo: false,
        canClearCircuit: false,
        canClearAll: false
    }]);
});

suite.test("undo and redo move through the revision", () => {
    let revision = Revision.startingAt(EMPTY_STATE);
    revision.commit(CIRCUIT_STATE);
    let actions = new CircuitActions(revision, closedOverlays());

    assertThat(actions.undo()).isEqualTo(EMPTY_STATE);
    assertThat(revision.peekActiveCommit()).isEqualTo(EMPTY_STATE);
    assertThat(actions.redo()).isEqualTo(CIRCUIT_STATE);
    assertThat(revision.peekActiveCommit()).isEqualTo(CIRCUIT_STATE);
});

suite.test("clearCircuit preserves custom gates and clearAll removes them", () => {
    let revision = Revision.startingAt(CUSTOM_GATE_STATE);
    let actions = new CircuitActions(revision, closedOverlays());

    actions.clearCircuit();
    assertThat(revision.peekActiveCommit()).isEqualTo('{"cols":[],"gates":[{"id":"~test"}]}');

    actions.undo();
    actions.clearAll();
    assertThat(revision.peekActiveCommit()).isEqualTo(EMPTY_STATE);
});
