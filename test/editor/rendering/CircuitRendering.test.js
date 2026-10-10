import { paintCircuit } from "../../../src/editor/rendering/CircuitRendering.js";
import { Suite, assertThat, assertTrue } from "../../TestUtil.js";
import { DisplayView, scenePixels } from "../../draw/scene/TestDisplayView.js";
import { CircuitViewState } from "../../../src/editor/state/CircuitViewState.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { CircuitStats } from "../../../src/engine/simulation/CircuitStats.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { PointerInteractionState } from "../../../src/editor/interaction/PointerInteractionState.js";
import { drawCircuitTooltip } from "../../../src/editor/rendering/previews/CircuitPreview.js";
import { Rect } from "../../../src/geometry/Rect.js";
import { labelsIn } from "./RenderingTestUtil.js";
import { Layout } from "../../../src/config/Layout.js";
import { selectionRect } from "../../../src/editor/interaction/RangeSelection.js";
import { Point } from "../../../src/geometry/Point.js";
import { GateColumn } from "../../../src/circuit/model/GateColumn.js";
import { DensityMatrixDisplayFamily } from "../../../src/gates/displays/density/DensityMatrixDisplay.js";

const suite = new Suite("CircuitRendering");

suite.test(
  "every gate in the palette draws on a simulated circuit, so none can blank the canvas",
  async () => {
    const gates = [
      ...Gates.TopToolboxGroups,
      ...Gates.BottomToolboxGroups,
    ].flatMap((group) => group.gates);
    for (const gate of gates) {
      const wires = Math.max(2, gate.height);
      const definition = new CircuitDefinition(wires, [
        new GateColumn([gate, ...Array(wires - 1).fill(undefined)]),
      ]);
      const circuit = CircuitViewState.empty(0).withCircuit(definition);
      const view = new DisplayView(document.createElement("canvas"));
      try {
        paintCircuit(
          circuit,
          view,
          PointerInteractionState.EMPTY,
          CircuitStats.fromCircuitAtTime(definition, 0.3),
          true,
          true,
        );
        await scenePixels(view.canvas, 0, 0, 1, 1);
      } catch (error) {
        throw new Error(`${gate.serializedId}: ${error.message}`, {
          cause: error,
        });
      }
    }
  },
);

suite.test(
  "tooltip circuits toggle wires without output labels or rebuilding the gate",
  async () => {
    const definition = CircuitDefinition.fromTextDiagram(
      new Map([
        ["H", Gates.HalfTurns.H],
        ["-", undefined],
      ]),
      "H-\n--",
    );
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const view = new DisplayView(document.createElement("canvas"));
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    const x = Math.ceil(circuit.gateRect(0, 0).right() + 5);
    const y = Math.floor(circuit.wireRect(0).center().y);
    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      true,
      true,
    );
    const visible = (await scenePixels(view.canvas, x, y, 1, 1)).data[3];
    const labels = labelsIn(view);
    assertThat(labels.map((label) => label.text)).isEqualTo(["H"]);
    view.begin();
    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      true,
      false,
    );
    const hidden = (await scenePixels(view.canvas, x, y, 1, 1)).data[3];
    assertThat(visible > 0).isEqualTo(true);
    assertThat(hidden).isEqualTo(0);
    assertThat(labelsIn(view)[0] === labels[0]).isEqualTo(true);
  },
);

suite.test(
  "definition previews match public tooltip rendering without creating display state",
  async () => {
    const definition = CircuitDefinition.fromTextDiagram(
      new Map([["H", Gates.HalfTurns.H]]),
      "H",
    );
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const geometry = circuit.geometry();
    const stats = CircuitStats.withNanDataFromCircuitAtTime(definition, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const view = new DisplayView(canvas);
    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      true,
      true,
    );
    const expected = (await scenePixels(canvas)).data;
    view.begin();
    drawCircuitTooltip(
      view,
      definition,
      new Rect(0, 0, geometry.desiredWidth(true), geometry.desiredHeight(true)),
      true,
      0,
    );
    const actual = (await scenePixels(canvas)).data;
    assertThat(actual).isEqualTo(expected);
    assertThat(circuit.geometry() === geometry).isEqualTo(true);
  },
);

suite.test(
  "a selection is outlined around its gates, and a box being dragged is outlined in its place",
  async () => {
    const definition = CircuitDefinition.fromTextDiagram(
      new Map([
        ["H", Gates.HalfTurns.H],
        ["-", undefined],
      ]),
      "H-\n-H",
    );
    const circuit = CircuitViewState.empty(20).withCircuit(definition);
    const geometry = circuit.geometry();
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const view = new DisplayView(canvas);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    // A strip along the top edge of a range's outline, clear of the wires and the gates.
    const topEdge = async (range) => {
      const rect = selectionRect(geometry, range);
      return [
        ...(
          await scenePixels(
            canvas,
            Math.round(rect.x + 4),
            Math.floor(rect.y),
            12,
            1,
          )
        ).data,
      ];
    };
    const first = { colStart: 0, colEnd: 1, wireStart: 0, wireEnd: 1 };
    const second = { colStart: 1, colEnd: 2, wireStart: 1, wireEnd: 2 };

    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      false,
      true,
      undefined,
      [],
    );
    const plain = [await topEdge(first), await topEdge(second)];

    view.begin();
    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      false,
      true,
      undefined,
      [],
      first,
    );
    assertThat(await topEdge(first)).isNotEqualTo(plain[0]);
    assertThat(await topEdge(second)).isEqualTo(plain[1]);

    // While a box is dragged over the second gate, it is outlined instead of the selection.
    const centre = geometry.gateRect(1, 1).center();
    const boxing = PointerInteractionState.EMPTY.withPos(
      new Point(centre.x, centre.y),
    ).withSelectingRange(centre);
    view.begin();
    paintCircuit(
      circuit,
      view,
      boxing,
      stats,
      false,
      true,
      undefined,
      [],
      first,
    );
    assertThat(await topEdge(first)).isEqualTo(plain[0]);
    assertThat(await topEdge(second)).isNotEqualTo(plain[1]);
  },
);

suite.test(
  "the outputs say where the followed state stands: at the start, or after an operation",
  async () => {
    const definition = new CircuitDefinition(2, [
      new GateColumn([Gates.HalfTurns.H, undefined]),
      new GateColumn([Gates.HalfTurns.X, undefined]),
    ]);
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    const captions = async (follow) => {
      const view = new DisplayView(document.createElement("canvas"));
      paintCircuit(
        circuit,
        view,
        PointerInteractionState.EMPTY,
        stats,
        false,
        true,
        0,
        [],
        undefined,
        follow,
      );
      await view.commit();
      return labelsIn(view)
        .map((label) => label.text)
        .filter((text) => text.startsWith("State-vector grid"));
    };
    assertThat(await captions(undefined)).isEqualTo(["State-vector grid"]);
    assertThat(await captions({ stats, operation: 0 })).isEqualTo([
      "State-vector grid · at the start",
    ]);
    assertThat(await captions({ stats, operation: 1 })).isEqualTo([
      "State-vector grid · after operation 1",
    ]);
  },
);

suite.test(
  "scrolled past the gutter, each wire keeps its name at the left edge of the view",
  async () => {
    const definition = new CircuitDefinition(2, [
      new GateColumn([Gates.HalfTurns.H, undefined]),
    ]);
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    const names = async (scrollX) => {
      const view = new DisplayView(document.createElement("canvas"));
      paintCircuit(
        circuit,
        view,
        PointerInteractionState.EMPTY,
        stats,
        false,
        true,
        undefined,
        [],
        undefined,
        undefined,
        scrollX,
      );
      await view.commit();
      return labelsIn(view)
        .filter((label) => /^q\d$/.test(label.text))
        .map((label) => [label.text, label.getBounds().x]);
    };
    // Unscrolled, the gutter's own labels are the only ones.
    assertThat((await names(0)).map(([text]) => text)).isEqualTo(["q0", "q1"]);
    // Scrolled, the gutter's labels are still drawn where they were, and a pinned copy rides at the edge.
    const pinned = (await names(300)).filter(([, x]) => x >= 300);
    assertThat(pinned.map(([text]) => text)).isEqualTo(["q0", "q1"]);
    assertThat(pinned.every(([, x]) => x < 300 + 12)).isEqualTo(true);
  },
);

suite.test(
  "the state-vector grid's key says how a ket is read and which amplitude phases are measured from",
  async () => {
    // Y·Y leaves −|11⟩: the grid measures phases from |11⟩, its largest amplitude, so it reads as |11⟩.
    const definition = new CircuitDefinition(2, [
      new GateColumn([Gates.HalfTurns.Y, Gates.HalfTurns.Y]),
    ]);
    const circuit = CircuitViewState.empty(0).withCircuit(definition);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0);
    const view = new DisplayView(document.createElement("canvas"));
    paintCircuit(
      circuit,
      view,
      PointerInteractionState.EMPTY,
      stats,
      false,
      true,
    );
    await view.commit();
    const texts = labelsIn(view).map((label) => label.text);
    assertTrue(texts.includes("hand = phase, 0° at |11⟩"));
    assertTrue(texts.includes("colour = phase"));
    assertTrue(texts.includes("ket = rows q1, then columns q0"));
    // A cell big enough says its chance.
    assertTrue(texts.includes("100%"));
  },
);

/** The keys of the groups a painted circuit describes, in order. */
const groupKeys = (view) => view.elements.map((element) => element.key);
const columnKeys = (view) =>
  groupKeys(view).filter((key) => /^column-\d+$/.test(key));

/** @returns {!{circuit: !CircuitViewState, stats: !CircuitStats, centre: !function(!int): !number}} */
function wideCircuit(columns, wires = 3) {
  const definition = new CircuitDefinition(wires, columns);
  const circuit = CircuitViewState.empty(0).withCircuit(definition);
  return {
    circuit,
    stats: CircuitStats.withNanDataFromCircuitAtTime(definition, 0),
    centre: (col) => circuit.geometry().opRect(col).center().x,
  };
}
const hadamardColumns = (count) =>
  Array.from(
    { length: count },
    () => new GateColumn([Gates.HalfTurns.H, undefined, undefined]),
  );
const paintInRange = ({ circuit, stats }, range, selection = undefined) => {
  const view = new DisplayView(document.createElement("canvas"));
  paintCircuit(
    circuit,
    view,
    PointerInteractionState.EMPTY,
    stats,
    false,
    true,
    undefined,
    [],
    selection,
    undefined,
    0,
    range,
  );
  return view;
};

suite.test(
  "a range leaves out the columns that draw outside it, and the groups that stay whole stay",
  () => {
    const wide = wideCircuit(hadamardColumns(40));
    const everything = paintInRange(wide, undefined);
    assertThat(columnKeys(everything).length).isEqualTo(40);

    const ranged = paintInRange(wide, {
      left: wide.centre(10),
      right: wide.centre(13),
    });
    assertThat(columnKeys(ranged)).isEqualTo([
      "column-10",
      "column-11",
      "column-12",
      "column-13",
    ]);
    // Wires, the outputs at the right and their captions, and the selection's own group are described whole,
    // and in the order they are drawn in.
    const kept = (key) => !/^column-\d+$/.test(key);
    assertThat(groupKeys(ranged).filter(kept)).isEqualTo(
      groupKeys(everything).filter(kept),
    );
    assertThat(
      groupKeys(ranged).indexOf("wires") <
        groupKeys(ranged).indexOf("column-10"),
    ).isEqualTo(true);
    assertThat(
      groupKeys(ranged).indexOf("column-13") <
        groupKeys(ranged).indexOf("outputs"),
    ).isEqualTo(true);
  },
);

suite.test(
  "a column keeps its key whichever columns are around it, so none is remounted as the range moves",
  async () => {
    const wide = wideCircuit(hadamardColumns(40));
    const view = paintInRange(wide, {
      left: wide.centre(10),
      right: wide.centre(13),
    });
    await view.commit();
    const mounted = view.elements.find((element) => element.key === "column-12")
      .props.frame.native;
    view.begin();
    paintCircuit(
      wide.circuit,
      view,
      PointerInteractionState.EMPTY,
      wide.stats,
      false,
      true,
      undefined,
      [],
      undefined,
      undefined,
      0,
      { left: wide.centre(11), right: wide.centre(15) },
    );
    await view.commit();
    assertThat(columnKeys(view)).isEqualTo([
      "column-11",
      "column-12",
      "column-13",
      "column-14",
      "column-15",
    ]);
    assertThat(
      view.elements.find((element) => element.key === "column-12").props.frame
        .native === mounted,
    ).isEqualTo(true);
  },
);

suite.test(
  "a gate spanning columns is described while any column it covers is in the range",
  () => {
    const columns = hadamardColumns(10);
    columns[2] = new GateColumn([
      DensityMatrixDisplayFamily.ofSize(3),
      undefined,
      undefined,
    ]);
    const wide = wideCircuit(columns);
    // The gate starts at column 2 and covers columns 3 and 4.
    assertThat(
      columnKeys(
        paintInRange(wide, { left: wide.centre(4), right: wide.centre(5) }),
      ),
    ).isEqualTo(["column-2", "column-4", "column-5"]);
    assertThat(
      columnKeys(
        paintInRange(wide, { left: wide.centre(5), right: wide.centre(6) }),
      ),
    ).isEqualTo(["column-5", "column-6"]);
  },
);

suite.test(
  "a control line crossing the edge of the range is described, whole, with its column",
  () => {
    const columns = hadamardColumns(10);
    columns[6] = new GateColumn([
      Gates.Controls.Control,
      undefined,
      Gates.HalfTurns.X,
    ]);
    const wide = wideCircuit(columns);
    // The edge falls past the line, which is on the column's centre, and within the column's cell.
    const view = paintInRange(wide, {
      left: wide.centre(6) + 10,
      right: wide.centre(8),
    });
    assertThat(columnKeys(view)).isEqualTo([
      "column-6",
      "column-7",
      "column-8",
    ]);
    // The line is drawn by the column, from the control to the gate it controls.
    const drawn = view.elements.find((element) => element.key === "column-6")
      .props.frame.elements;
    assertThat(drawn.length > 1).isEqualTo(true);
    const left = paintInRange(wide, {
      left: wide.centre(2),
      right: wide.centre(6) - 10,
    });
    assertThat(columnKeys(left)).isEqualTo([
      "column-2",
      "column-3",
      "column-4",
      "column-5",
      "column-6",
    ]);
  },
);

suite.test(
  "the selection is described whole, whichever columns the range leaves out",
  () => {
    const wide = wideCircuit(hadamardColumns(40));
    const selection = { colStart: 2, colEnd: 30, wireStart: 0, wireEnd: 3 };
    const selected = paintInRange(
      wide,
      { left: wide.centre(10), right: wide.centre(13) },
      selection,
    );
    const plain = paintInRange(wide, {
      left: wide.centre(10),
      right: wide.centre(13),
    });
    const outline = (view) =>
      view.elements.find((element) => element.key === "selection").props.frame
        .elements.length;
    assertThat(outline(selected)).isNotEqualTo(outline(plain));
    assertThat(columnKeys(selected)).isEqualTo([
      "column-10",
      "column-11",
      "column-12",
      "column-13",
    ]);
  },
);

suite.test(
  "the pan info says how far the view may scroll before a column left out would show",
  () => {
    const wide = wideCircuit(hadamardColumns(40));
    const view = paintInRange(wide, {
      left: wide.centre(10),
      right: wide.centre(13),
    });
    const { left, right } = view.pan.described;
    const half = Layout.COLUMN_SPACING / 2;
    assertThat([left, right]).isEqualTo([
      wide.centre(9) + half,
      wide.centre(14) - half,
    ]);
    // Described whole, nothing limits it.
    const whole = paintInRange(wide, undefined);
    assertThat([whole.pan.described.left, whole.pan.described.right]).isEqualTo(
      [-Infinity, Infinity],
    );
  },
);
