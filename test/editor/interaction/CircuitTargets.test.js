import { EventBoundary } from "pixi.js";
import { Suite, assertThat } from "../../TestUtil.js";
import { DisplayView } from "../../draw/scene/TestDisplayView.js";
import { CircuitViewState } from "../../../src/editor/state/CircuitViewState.js";
import { PointerInteractionState } from "../../../src/editor/interaction/PointerInteractionState.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { renderCircuitTargets } from "../../../src/editor/interaction/CircuitTargets.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { GateColumn } from "../../../src/circuit/model/GateColumn.js";
import { DensityMatrixDisplayFamily } from "../../../src/gates/displays/density/DensityMatrixDisplay.js";
const suite = new Suite("CircuitTargets");
suite.test(
  "Pixi resolves gate edges and initial-state regions and retains targets across pointer updates",
  async () => {
    const definition = CircuitDefinition.fromTextDiagram(
      new Map([["B", Gates.Displays.BlochSphereDisplay]]),
      "B",
    );
    const circuit = CircuitViewState.empty(20).withCircuit(definition);
    const geometry = circuit.geometry();
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 500;
    const view = new DisplayView(canvas);
    renderCircuitTargets(
      view,
      { definition, geometry },
      PointerInteractionState.EMPTY,
    );
    await view.commit();
    const boundary = new EventBoundary(view.native);
    const rect = geometry.gateDrawRect(0, 0, Gates.Displays.BlochSphereDisplay);
    const gate = boundary.hitTest(rect.x + 1, rect.center().y);
    assertThat(gate.circuitTarget.type).isEqualTo("gate");
    const ket = geometry.wireInitialStateRect(0).center();
    assertThat(boundary.hitTest(ket.x, ket.y).circuitTarget.type).isEqualTo(
      "initial",
    );
    view.begin();
    renderCircuitTargets(
      view,
      { definition, geometry },
      PointerInteractionState.EMPTY.withPos(ket),
    );
    await view.commit();
    assertThat(
      new EventBoundary(view.native).hitTest(rect.x + 1, rect.center().y) ===
        gate,
    ).isEqualTo(true);
  },
);

suite.test(
  "only the gates in the range have targets, and the gutter and displays keep theirs",
  () => {
    const columns = Array.from(
      { length: 30 },
      () => new GateColumn([Gates.HalfTurns.H, undefined, undefined]),
    );
    // A gate three columns wide, starting before the range and covering its first column.
    columns[8] = new GateColumn([
      DensityMatrixDisplayFamily.ofSize(3),
      undefined,
      undefined,
    ]);
    const definition = new CircuitDefinition(3, columns);
    const geometry = CircuitViewState.empty(0)
      .withCircuit(definition)
      .geometry();
    const keysIn = (range) => {
      const view = new DisplayView(document.createElement("canvas"));
      renderCircuitTargets(
        view,
        { definition, geometry },
        PointerInteractionState.EMPTY,
        range,
      );
      return view.elements.map((element) => element.key);
    };
    const centre = (col) => geometry.opRect(col).center().x;

    const all = keysIn(undefined);
    const ranged = keysIn({ left: centre(10), right: centre(12) });
    const gateKeys = (keys) => keys.filter((key) => key.startsWith("gate-"));
    assertThat(gateKeys(all).length).isEqualTo(30);
    assertThat(gateKeys(ranged)).isEqualTo([
      "gate-8-0",
      "gate-10-0",
      "gate-11-0",
      "gate-12-0",
    ]);
    // Everything that is not a gate's is the same: wires, kets, registers and the displays.
    const ofGate = (key) => /^(gate|resize|button)-/.test(key);
    assertThat(ranged.filter((key) => !ofGate(key))).isEqualTo(
      all.filter((key) => !ofGate(key)),
    );
    assertThat(
      ranged.filter((key) => key.startsWith("bloch-")).length,
    ).isEqualTo(3);
    // A gate's resize tab and button belong to its column: none is left where the gate is not.
    assertThat(
      ranged
        .filter(ofGate)
        .every((key) => ["8", "10", "11", "12"].includes(key.split("-")[1])),
    ).isEqualTo(true);
  },
);
