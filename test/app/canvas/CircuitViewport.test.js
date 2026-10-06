import { Suite, assertThat } from "../../TestUtil.js";
import { CircuitViewport } from "../../../src/app/canvas/CircuitViewport.js";
import { EditorState } from "../../../src/editor/state/EditorState.js";
import { CircuitStats } from "../../../src/engine/simulation/CircuitStats.js";
import { RestartableRng } from "../../../src/base/RestartableRng.js";
import { Rect } from "../../../src/geometry/Rect.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { GateColumn } from "../../../src/circuit/model/GateColumn.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { Layout } from "../../../src/config/Layout.js";
import { DisplayView } from "../../draw/scene/TestDisplayView.js";

const suite = new Suite("CircuitViewport");

suite.test(
  "offsets the frame by the scroll, stamps the circuit and renders the editor layers",
  () => {
    const view = new DisplayView(document.createElement("canvas"));
    const frames = [];
    const surface = {
      size: { width: 1200, height: 600 },
      beginFrame: (...args) => {
        frames.push(args);
        return view.begin(...args);
      },
    };
    const shown = EditorState.empty(new Rect(0, 0, 600, 300));
    const stats = CircuitStats.withNanDataFromCircuitAtTime(
      shown.displayedCircuit.circuitDefinition,
      0,
    );
    const rng = new RestartableRng();

    const frame = new CircuitViewport(surface).update(shown, stats, 0, {
      rng,
      resolution: 2,
      lineScale: 1.5,
      scrollX: 30,
      scrollY: 12,
    });

    assertThat(frame === view).isEqualTo(true);
    assertThat(frames.length).isEqualTo(1);
    assertThat(frames[0][0] === rng).isEqualTo(true);
    assertThat(frames[0].slice(1)).isEqualTo([2, 1.5]);
    assertThat([view.position.x, view.position.y]).isEqualTo([-30, -12]);
    assertThat(view.circuit).isEqualTo(shown.snapshot());
    assertThat(view.elements.map((element) => element.key).slice(-3)).isEqualTo(
      ["circuit", "held-gates", "interaction"],
    );
  },
);

suite.test(
  "a scroll moves the drawn scene without describing it, until the wire names would pin",
  () => {
    const renders = [];
    const view = new DisplayView(document.createElement("canvas"));
    const surface = {
      view,
      size: { width: 1200, height: 600 },
      pending: false,
      rendering: 0,
      app: { render: () => renders.push("render") },
      beginFrame: (...args) => view.begin(...args),
    };
    const viewport = new CircuitViewport(surface);
    const shown = EditorState.empty(new Rect(0, 0, 600, 300));
    const stats = CircuitStats.withNanDataFromCircuitAtTime(
      shown.displayedCircuit.circuitDefinition,
      0,
    );
    viewport.update(shown, stats, 0, {
      rng: new RestartableRng(),
      resolution: 2,
      lineScale: 1,
      scrollX: 0,
      scrollY: 0,
    });
    // What React would have committed.
    view.native = {
      position: {
        set(x, y) {
          this.x = x;
          this.y = y;
        },
      },
    };
    assertThat(viewport.pan(0, 20, 2)).isEqualTo(true);
    assertThat([
      view.native.position.x,
      view.native.position.y,
      renders.length,
    ]).isEqualTo([-0, -20, 1]);
    // Another zoom, a frame on its way, a tooltip, or names that start to pin: describe again.
    assertThat(viewport.pan(0, 30, 3)).isEqualTo(false);
    surface.pending = true;
    assertThat(viewport.pan(0, 30, 2)).isEqualTo(false);
    surface.pending = false;
    view.tooltips.pending.push({});
    assertThat(viewport.pan(0, 30, 2)).isEqualTo(false);
    view.tooltips.pending.length = 0;
    assertThat(viewport.pan(view.pan.pinPast + 1, 30, 2)).isEqualTo(false);
    assertThat(renders.length).isEqualTo(1);
    // The next frame puts what a pan moved where its description has it.
    view.native.position.set(5, 5);
    viewport.update(shown, stats, 0, {
      rng: new RestartableRng(),
      resolution: 2,
      lineScale: 1,
      scrollX: 7,
      scrollY: 9,
    });
    assertThat([view.native.position.x, view.native.position.y]).isEqualTo([
      -7, -9,
    ]);
  },
);

/** A circuit of eighty columns, many screens wide, and a viewport on it. */
const WIDE_COLUMN_COUNT = 80;
function wideViewport() {
  const columns = Array.from(
    { length: WIDE_COLUMN_COUNT },
    () => new GateColumn([Gates.HalfTurns.H, undefined]),
  );
  const empty = EditorState.empty(new Rect(0, 0, 600, 300));
  const shown = empty.withDisplayedCircuit(
    empty.displayedCircuit.withCircuit(new CircuitDefinition(2, columns)),
  );
  const stats = CircuitStats.withNanDataFromCircuitAtTime(
    shown.displayedCircuit.circuitDefinition,
    0,
  );
  const view = new DisplayView(document.createElement("canvas"));
  const renders = [];
  // Twelve hundred device pixels at a resolution of two: a viewport six hundred circuit units wide.
  const surface = {
    view,
    size: { width: 1200, height: 600 },
    pending: false,
    rendering: 0,
    app: { render: () => renders.push("render") },
    beginFrame: (...args) => view.begin(...args),
  };
  const viewport = new CircuitViewport(surface);
  const update = (scrollX) =>
    viewport.update(shown, stats, 0, {
      rng: new RestartableRng(),
      resolution: 2,
      lineScale: 1,
      scrollX,
      scrollY: 0,
    });
  const centre = (col) =>
    shown.displayedCircuit.geometry().opRect(col).center().x;
  // What React would have committed.
  view.native = {
    position: {
      set(x, y) {
        this.x = x;
        this.y = y;
      },
    },
  };
  const columnsDescribed = () =>
    view.elements
      .find((element) => element.key === "circuit")
      .props.frame.elements.map((element) => element.key)
      .filter((key) => /^column-\d+$/.test(key))
      .map((key) => Number(key.slice(7)));
  return {
    viewport,
    view,
    update,
    centre,
    columnsDescribed,
    renders,
    viewWidth: 600,
  };
}

suite.test(
  "a frame describes the columns within a viewport width of the viewport, either side",
  () => {
    const { update, centre, columnsDescribed, viewWidth } = wideViewport();
    update(3000);
    const columns = columnsDescribed();
    // Every column that touches [scrollX - width, scrollX + 2 * width], and none that does not.
    const half = Layout.COLUMN_SPACING / 2;
    const touching = Array.from(
      { length: WIDE_COLUMN_COUNT },
      (_, col) => col,
    ).filter(
      (col) =>
        centre(col) + half >= 3000 - viewWidth &&
        centre(col) - half <= 3000 + 2 * viewWidth,
    );
    assertThat(columns).isEqualTo(touching);
    assertThat(
      columns.length > 0 && columns.length < WIDE_COLUMN_COUNT,
    ).isEqualTo(true);
    // A viewport at the circuit's start has the columns that fall in its first two screens.
    update(0);
    assertThat(columnsDescribed().length < WIDE_COLUMN_COUNT).isEqualTo(true);
    assertThat(columnsDescribed()[0]).isEqualTo(0);
  },
);

suite.test(
  "a scroll refuses to move the scene past the columns described, and describing again goes on from there",
  () => {
    const { viewport, view, update, columnsDescribed, renders, viewWidth } =
      wideViewport();
    update(3000);
    const { left, right } = view.pan.described;
    assertThat(
      left < 3000 - viewWidth && right > 3000 + 2 * viewWidth,
    ).isEqualTo(true);
    // Inside the described columns the camera moves; the viewport is viewWidth wide.
    assertThat(viewport.pan(left, 0, 2)).isEqualTo(true);
    assertThat(viewport.pan(right - viewWidth, 0, 2)).isEqualTo(true);
    assertThat(renders.length).isEqualTo(2);
    // One step further, a column that was left out would show.
    assertThat(viewport.pan(left - 1, 0, 2)).isEqualTo(false);
    assertThat(viewport.pan(right - viewWidth + 1, 0, 2)).isEqualTo(false);
    assertThat(renders.length).isEqualTo(2);

    // The frame that follows describes the columns around where the scroll has got to.
    const before = columnsDescribed();
    update(right - viewWidth + 1);
    assertThat(columnsDescribed()).isNotEqualTo(before);
    assertThat(columnsDescribed().includes(before.at(-1) + 1)).isEqualTo(true);
    assertThat(viewport.pan(right - viewWidth + 1 + 50, 0, 2)).isEqualTo(true);
  },
);

suite.test(
  "a circuit all of whose columns are described never refuses a scroll for want of them",
  () => {
    const view = new DisplayView(document.createElement("canvas"));
    const surface = {
      view,
      size: { width: 1200, height: 600 },
      pending: false,
      rendering: 0,
      app: { render: () => {} },
      beginFrame: (...args) => view.begin(...args),
    };
    const viewport = new CircuitViewport(surface);
    const shown = EditorState.empty(new Rect(0, 0, 600, 300));
    const stats = CircuitStats.withNanDataFromCircuitAtTime(
      shown.displayedCircuit.circuitDefinition,
      0,
    );
    viewport.update(shown, stats, 0, {
      rng: new RestartableRng(),
      resolution: 2,
      lineScale: 1,
      scrollX: 100,
      scrollY: 0,
    });
    view.native = { position: { set() {} } };
    assertThat([view.pan.described.left, view.pan.described.right]).isEqualTo([
      -Infinity,
      Infinity,
    ]);
    assertThat(viewport.pan(100000, 0, 2)).isEqualTo(true);
  },
);
