import {Suite, assertThat} from "../../TestUtil.js"
import {Revision} from "../../../src/base/Revision.js"
import {CircuitActions} from "../../../src/app/state/CircuitActions.js"
import {GateActions} from "../../../src/app/state/GateActions.js"
import {EditorState} from "../../../src/editor/state/EditorState.js"
import {Rect} from "../../../src/geometry/Rect.js"
import {Serializer} from "../../../src/serialization/Serializer.js"
import { fromJsonText_CircuitDefinition } from "../../../src/serialization/circuits/text.js";

const suite = new Suite("GateActions");

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
    const displayed = {
        getState: () => ({value: inspector}),
        setState: ({value}) => { inspector = value; },
    };
    return {
        revision,
        actions: new GateActions(revision, displayed),
        shown: () => Serializer.toJson(inspector.displayedCircuit.circuitDefinition),
        committed: () => JSON.parse(revision.peekActiveCommit()),
    };
}

suite.test("switching a gate off and on, and deleting it, are each one commit", () => {
    const {revision, actions, shown} = setup({cols: [["X", "H"]]});
    assertThat(actions.gateAt(0, 0).serializedId).isEqualTo("X");
    assertThat(actions.setDeactivated(0, 0, true)).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [[{id: "X", off: true}, "H"]]});
    // Already off: nothing to commit.
    assertThat(actions.setDeactivated(0, 0, true)).isEqualTo(false);
    assertThat(actions.setDeactivated(0, 0, false)).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [["X", "H"]]});
    assertThat(actions.remove(0, 1)).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [["X"]]});
    assertThat(actions.remove(0, 1)).isEqualTo(false);

    const circuit = new CircuitActions(revision);
    circuit.undo();
    assertThat(shown()).isEqualTo({cols: [["X", "H"]]});
    circuit.undo();
    assertThat(shown()).isEqualTo({cols: [[{id: "X", off: true}, "H"]]});
    circuit.undo();
    assertThat(shown()).isEqualTo({cols: [["X", "H"]]});
});

suite.test("a previewed parameter shows at once and settles into one commit", () => {
    const {revision, actions, shown, committed} = setup({cols: [[{id: "Rx", arg: "pi/2"}]]});
    assertThat(actions.setParamText(0, 0, "pi/3", {preview: true})).isEqualTo(undefined);
    assertThat(shown()).isEqualTo({cols: [[{id: "Rx", arg: "pi/3"}]]});
    assertThat(committed()).isEqualTo({cols: [[{id: "Rx", arg: "pi/2"}]]});
    assertThat(actions.setParamText(0, 0, "pi/4", {preview: true})).isEqualTo(undefined);
    assertThat(shown()).isEqualTo({cols: [[{id: "Rx", arg: "pi/4"}]]});
    assertThat(committed()).isEqualTo({cols: [[{id: "Rx", arg: "pi/2"}]]});

    // The settling step repeats the last preview, and still commits it.
    assertThat(actions.setParamText(0, 0, "pi/4")).isEqualTo(undefined);
    assertThat(committed()).isEqualTo({cols: [[{id: "Rx", arg: "pi/4"}]]});
    const circuit = new CircuitActions(revision);
    circuit.undo();
    assertThat(shown()).isEqualTo({cols: [[{id: "Rx", arg: "pi/2"}]]});
    assertThat(revision.isAtBeginningOfHistory()).isEqualTo(true);
});

suite.test("a parameter the gate refuses, or a slot without one, is refused with the reason", () => {
    const {actions, shown} = setup({cols: [[{id: "Rx", arg: "pi/2"}, "H"]]});
    assertThat(typeof actions.setParamText(0, 0, "not an angle")).isEqualTo("string");
    assertThat(typeof actions.setParamText(0, 1, "pi")).isEqualTo("string");
    assertThat(typeof actions.setParamText(3, 0, "pi")).isEqualTo("string");
    assertThat(shown()).isEqualTo({cols: [[{id: "Rx", arg: "pi/2"}, "H"]]});
});
