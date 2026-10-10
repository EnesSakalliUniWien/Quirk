import { Suite, assertThat } from "../../TestUtil.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { CircuitViewState } from "../../../src/editor/state/CircuitViewState.js";
import {
  insertionCellAt,
  rangeBetween,
  selectionRect,
} from "../../../src/editor/interaction/RangeSelection.js";
import { Point } from "../../../src/geometry/Point.js";
import { Serializer } from "../../../src/serialization/Serializer.js";

const suite = new Suite("RangeSelection");

const layout = (json) => {
  const definition = Serializer.fromJson(CircuitDefinition, json);
  return {
    definition,
    geometry: CircuitViewState.empty(0).withCircuit(definition).geometry(),
  };
};

suite.test(
  "a box selects the cells nearest its corners, in either direction",
  () => {
    const { definition, geometry } = layout({
      cols: [
        ["H", "X"],
        ["Z", "Y"],
        ["X", "H"],
      ],
    });
    const at = (col, row) => geometry.gateRect(row, col).center();
    assertThat(
      rangeBetween(definition, geometry, at(0, 0), at(1, 1)),
    ).isEqualTo({ colStart: 0, colEnd: 2, wireStart: 0, wireEnd: 2 });
    assertThat(
      rangeBetween(definition, geometry, at(2, 1), at(1, 1)),
    ).isEqualTo({ colStart: 1, colEnd: 3, wireStart: 1, wireEnd: 2 });
    // Past the circuit's edges, the box stops at its last column and wire.
    assertThat(
      rangeBetween(
        definition,
        geometry,
        new Point(-500, -500),
        new Point(5000, 5000),
      ),
    ).isEqualTo({
      colStart: 0,
      colEnd: 3,
      wireStart: 0,
      wireEnd: definition.numWires,
    });
  },
);

suite.test(
  "a box never cuts a gate, and an empty circuit has nothing to box",
  () => {
    const { definition, geometry } = layout({ cols: [["•", "X"]] });
    const at = (col, row) => geometry.gateRect(row, col).center();
    assertThat(
      rangeBetween(definition, geometry, at(0, 1), at(0, 1)),
    ).isEqualTo({ colStart: 0, colEnd: 1, wireStart: 1, wireEnd: 2 });

    const tall = layout({ cols: [["QFT2"]] });
    const top = tall.geometry.gateRect(0, 0).center();
    assertThat(
      rangeBetween(tall.definition, tall.geometry, top, top),
    ).isEqualTo({ colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 2 });

    const empty = layout({ cols: [] });
    assertThat(
      rangeBetween(
        empty.definition,
        empty.geometry,
        new Point(0, 0),
        new Point(100, 100),
      ),
    ).isEqualTo(undefined);
  },
);

suite.test(
  "a selection is drawn around its gates, and a paste goes to the cell under the pointer",
  () => {
    const { geometry } = layout({ cols: [["H", "X"], ["Z"]] });
    const rect = selectionRect(geometry, {
      colStart: 0,
      colEnd: 2,
      wireStart: 0,
      wireEnd: 2,
    });
    for (const [col, row] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ]) {
      const gate = geometry.gateRect(row, col);
      assertThat(
        rect.containsPoint(gate.topLeft()) &&
          rect.containsPoint(gate.bottomRight()),
      ).isEqualTo(true);
    }
    assertThat(
      insertionCellAt(geometry, geometry.gateRect(1, 1).center()),
    ).isEqualTo({ col: 1, row: 1 });
    assertThat(insertionCellAt(geometry, new Point(-100, -100))).isEqualTo({
      col: 0,
      row: 0,
    });
  },
);
