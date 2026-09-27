import {Suite, assertThat} from "../../TestUtil.js"
import {createStore} from "zustand/vanilla"
import {Revision} from "../../../src/base/Revision.js"
import {CircuitActions} from "../../../src/app/state/CircuitActions.js"
import {SelectionActions} from "../../../src/app/state/SelectionActions.js"
import {EditorState} from "../../../src/editor/state/EditorState.js"
import {Rect} from "../../../src/geometry/Rect.js"
import {Serializer} from "../../../src/serialization/Serializer.js"
import { fromJsonText_CircuitDefinition } from "../../../src/serialization/circuits/text.js";

const suite = new Suite("SelectionActions");

/**
 * The app's arrangement in miniature: a revision, a displayed circuit following its commits, and
 * the selection dropped when a commit changes the circuit it was made on.
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
    const store = createStore(() => ({circuitSelection: undefined}));
    const actions = new SelectionActions(revision, displayed, store);
    revision.latestActiveCommit().subscribe(() => actions.forgetIfChanged());
    return {
        revision,
        actions,
        store,
        undo: () => new CircuitActions(revision).undo(),
        shown: () => Serializer.toJson(inspector.displayedCircuit.circuitDefinition),
    };
}

suite.test("a selection holds whole gates, and at least one", () => {
    const {actions} = setup({cols: [["H", "X"], ["QFT2"], [1, "Z"]]});
    assertThat(actions.select({colStart: 1, colEnd: 2, wireStart: 1, wireEnd: 2})).isEqualTo(true);
    assertThat(actions.range()).isEqualTo({colStart: 1, colEnd: 2, wireStart: 0, wireEnd: 2});
    // Past the circuit, the range is kept inside it.
    assertThat(actions.select({colStart: 2, colEnd: 9, wireStart: 1, wireEnd: 9})).isEqualTo(true);
    assertThat(actions.range()).isEqualTo({colStart: 2, colEnd: 3, wireStart: 1, wireEnd: 2});
    // A range without gates selects nothing, and clears what was selected.
    assertThat(actions.select({colStart: 2, colEnd: 3, wireStart: 0, wireEnd: 1})).isEqualTo(false);
    assertThat(actions.range()).isEqualTo(undefined);
    assertThat(actions.selectAll()).isEqualTo(true);
    assertThat(actions.range()).isEqualTo({colStart: 0, colEnd: 3, wireStart: 0, wireEnd: 2});
});

suite.test("an edit the selection did not make lets it go, and undo does not bring it back", () => {
    const {revision, actions, store, undo} = setup({cols: [["H"], ["X"]]});
    actions.select({colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1});
    const before = store.getState().circuitSelection;
    // Re-committing the same circuit changes nothing, so the selection stays.
    revision.commit(revision.peekActiveCommit());
    assertThat(store.getState().circuitSelection).isEqualTo(before);
    revision.commit(JSON.stringify({cols: [["Z"], ["X"]]}));
    assertThat(store.getState().circuitSelection).isEqualTo(undefined);
    undo();
    assertThat(actions.range()).isEqualTo(undefined);
});

suite.test("a copy is the selected gates alone, custom gates carrying their definitions", () => {
    const custom = {id: "~bell", name: "Bell", circuit: {cols: [["H"], ["•", "X"]]}};
    const {actions} = setup({cols: [["H", "X", "Z"], ["•", "~bell"], [1, 1, "Y"]], gates: [custom]});
    assertThat(actions.copyText()).isEqualTo(undefined);
    actions.select({colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 3});
    assertThat(JSON.parse(actions.copyText())).isEqualTo({cols: [["X", "Z"], [custom]]});
    // Copying edits nothing.
    assertThat(actions.range()).isEqualTo({colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 3});
    // The control left behind is named.
    assertThat(actions.outsideDependencies().map(({kind, row}) => ({kind, row}))).isEqualTo([{kind: "control", row: 0}]);
});

suite.test("delete and cut are one commit each, and undo puts the gates back", () => {
    const {actions, shown, undo} = setup({cols: [["H", "X"], ["Z", "Y"], ["X"]]});
    actions.select({colStart: 0, colEnd: 2, wireStart: 1, wireEnd: 2});
    assertThat(actions.remove()).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [["H"], ["Z"], ["X"]]});
    assertThat(actions.range()).isEqualTo(undefined);
    assertThat(actions.remove()).isEqualTo(false);
    undo();
    assertThat(shown()).isEqualTo({cols: [["H", "X"], ["Z", "Y"], ["X"]]});

    actions.select({colStart: 1, colEnd: 3, wireStart: 0, wireEnd: 1});
    const text = actions.cut();
    assertThat(JSON.parse(text)).isEqualTo({cols: [["Z"], ["X"]]});
    // Emptied columns close up, as after any delete.
    assertThat(shown()).isEqualTo({cols: [["H", "X"], [1, "Y"]]});
    undo();
    assertThat(shown()).isEqualTo({cols: [["H", "X"], ["Z", "Y"], ["X"]]});
});

suite.test("a paste inserts new columns, overwriting nothing, and selects what it pasted", () => {
    const {actions, shown, undo} = setup({cols: [["H"], ["X"]]});
    const text = JSON.stringify({cols: [["Z", "Y"]]});

    // By default after the circuit.
    const atEnd = actions.paste(text);
    assertThat(atEnd.range).isEqualTo({colStart: 2, colEnd: 3, wireStart: 0, wireEnd: 2});
    assertThat(shown()).isEqualTo({cols: [["H"], ["X"], ["Z", "Y"]]});
    assertThat(actions.range()).isEqualTo(atEnd.range);
    undo();
    assertThat(shown()).isEqualTo({cols: [["H"], ["X"]]});

    // Before a column, from a wire: the rest moves right and the wires grow to fit.
    const between = actions.paste(text, {col: 1, row: 1});
    assertThat(between.range).isEqualTo({colStart: 1, colEnd: 2, wireStart: 1, wireEnd: 3});
    assertThat(shown()).isEqualTo({cols: [["H"], [1, "Z", "Y"], ["X"]]});

    // After the selection, when there is one and no point to paste at.
    actions.select({colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1});
    assertThat(actions.paste(JSON.stringify({cols: [["X"]]})).range).isEqualTo({colStart: 1, colEnd: 2, wireStart: 0, wireEnd: 1});
    assertThat(shown()).isEqualTo({cols: [["H"], ["X"], [1, "Z", "Y"], ["X"]]});
});

suite.test("a paste never lands inside a wide gate, and brings its custom gates along", () => {
    const custom = {id: "~pair", name: "Pair", circuit: {cols: [["X", "X"]]}};
    const {actions, shown} = setup({cols: [[{id: "Rx", arg: "pi/2"}]]});
    const rx = actions.current().columns[0].gates[0];
    assertThat(rx.width > 1).isEqualTo(true);
    const result = actions.paste(JSON.stringify({cols: [[custom]]}), {col: 1, row: 0});
    assertThat(result.range.colStart).isEqualTo(rx.width);
    assertThat(shown().gates).isEqualTo([custom]);
    assertThat(actions.current().customGateSet.gates.length).isEqualTo(1);

    // A second paste of the same custom gate uses the circuit's own.
    actions.paste(JSON.stringify({cols: [[custom]]}));
    assertThat(actions.current().customGateSet.gates.length).isEqualTo(1);
    assertThat(shown().cols.flat().filter(e => e === "~pair").length).isEqualTo(2);
});

suite.test("text that is not a circuit is left alone, and a circuit without gates is refused", () => {
    const {actions, shown} = setup({cols: [["H"]]});
    assertThat(actions.paste("hello").notCircuit).isEqualTo(true);
    assertThat(actions.paste('{"cols": 3}').notCircuit).isEqualTo(true);
    const empty = actions.paste('{"cols": [[1, 1]]}');
    assertThat(empty.notCircuit).isEqualTo(undefined);
    assertThat(typeof empty.error).isEqualTo("string");
    assertThat(shown()).isEqualTo({cols: [["H"]]});
});

suite.test("a copy pastes back into the circuit it came from", () => {
    const {actions, shown} = setup({cols: [["H", "•"], [1, "X"]]});
    actions.selectAll();
    const text = actions.copyText();
    actions.paste(text);
    assertThat(shown()).isEqualTo({cols: [["H", "•"], [1, "X"], ["H", "•"], [1, "X"]]});
    assertThat(actions.range()).isEqualTo({colStart: 2, colEnd: 4, wireStart: 0, wireEnd: 2});
});

suite.test("switching the selection off and on is one commit each, and keeps the selection", () => {
    const {actions, undo, shown} = setup({cols: [["H", "X"], [{id: "Z", off: true}]]});
    assertThat(actions.allDeactivated()).isEqualTo(false);
    assertThat(actions.setDeactivated(true)).isEqualTo(false);

    actions.select({colStart: 0, colEnd: 2, wireStart: 0, wireEnd: 1});
    assertThat(actions.allDeactivated()).isEqualTo(false);
    assertThat(actions.setDeactivated(true)).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [[{id: "H", off: true}, "X"], [{id: "Z", off: true}]]});
    assertThat(actions.range()).isEqualTo({colStart: 0, colEnd: 2, wireStart: 0, wireEnd: 1});
    assertThat(actions.allDeactivated()).isEqualTo(true);
    // Nothing left to switch off: no commit.
    assertThat(actions.setDeactivated(true)).isEqualTo(false);

    assertThat(actions.setDeactivated(false)).isEqualTo(true);
    assertThat(shown()).isEqualTo({cols: [["H", "X"], ["Z"]]});
    undo();
    assertThat(shown()).isEqualTo({cols: [[{id: "H", off: true}, "X"], [{id: "Z", off: true}]]});
});
