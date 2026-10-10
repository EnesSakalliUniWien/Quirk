import { Suite, assertThat } from "../../../TestUtil.js";
import { wireRuns } from "../../../../src/editor/rendering/wires/CircuitWires.js";
import { CircuitDefinition } from "../../../../src/circuit/model/CircuitDefinition.js";
import { GateColumn } from "../../../../src/circuit/model/GateColumn.js";
import { CircuitViewState } from "../../../../src/editor/state/CircuitViewState.js";
import { Point } from "../../../../src/geometry/Point.js";
import { Gates } from "../../../../src/gates/AllGates.js";

const suite = new Suite("CircuitWires");

const H = Gates.HalfTurns.H;
const MEASURE = Gates.Special.Measurement;

/** The wire's segments as they were drawn before: one to the centre of each column, in turn. */
function segmentsPerColumn({ definition, geometry }, row, startX, showLabels) {
  const segments = [];
  const wireEndX = showLabels ? geometry.outputWireEndX() : Infinity;
  let lastX = startX;
  for (
    let col = 0;
    showLabels ? lastX < wireEndX : col <= definition.columns.length;
    col++
  ) {
    const x = Math.min(geometry.opRect(col).center().x, wireEndX);
    segments.push({
      from: lastX,
      to: x,
      measured: definition.locIsMeasured(new Point(col, row)),
    });
    lastX = x;
  }
  return segments;
}

/** @returns {!Array} The segments, with each pair that abut and share a state made one. */
function merged(segments) {
  const runs = [];
  for (const segment of segments) {
    const last = runs.at(-1);
    if (
      last !== undefined &&
      last.measured === segment.measured &&
      last.to === segment.from
    ) {
      last.to = segment.to;
    } else {
      runs.push({ ...segment });
    }
  }
  return runs;
}

const contextOf = (columns) => {
  const definition = new CircuitDefinition(3, columns);
  return {
    definition,
    geometry: CircuitViewState.empty(0).withCircuit(definition).geometry(),
  };
};
const column = (...gates) =>
  new GateColumn([...gates, ...Array(3 - gates.length).fill(undefined)]);

suite.test(
  "a wire that is never measured is one run to the displays, or to its last column without them",
  () => {
    const context = contextOf([column(H), column(H), column(H)]);
    const startX = 90;
    assertThat(wireRuns(context, 0, startX, true)).isEqualTo([
      { from: startX, to: context.geometry.outputWireEndX(), measured: false },
    ]);
    assertThat(wireRuns(context, 1, startX, false)).isEqualTo([
      {
        from: startX,
        to: context.geometry.opRect(3).center().x,
        measured: false,
      },
    ]);
  },
);

suite.test(
  "a wire turns classical at the centre of the column of the gate that measured it",
  () => {
    const context = contextOf([
      column(H),
      column(undefined, H),
      column(undefined, MEASURE),
      column(H, H),
    ]);
    const startX = 90;
    const measuredAt = context.geometry.opRect(2).center().x;
    assertThat(wireRuns(context, 1, startX, true)).isEqualTo([
      { from: startX, to: measuredAt, measured: false },
      {
        from: measuredAt,
        to: context.geometry.outputWireEndX(),
        measured: true,
      },
    ]);
    assertThat(wireRuns(context, 0, startX, true).length).isEqualTo(1);
  },
);

suite.test(
  "runs are the segments of a wire a column at a time, made one wherever the wire keeps its state",
  () => {
    const circuits = [
      [column(MEASURE, MEASURE, H), column(H), column(H, H, MEASURE)],
      [column(H), column(H), column(H), column(undefined, undefined, MEASURE)],
      [column(), column(MEASURE), column(), column()],
      Array.from({ length: 40 }, (_, col) =>
        col === 25 ? column(H, MEASURE) : column(undefined, undefined, H),
      ),
    ];
    for (const columns of circuits) {
      const context = contextOf(columns);
      for (const showLabels of [true, false]) {
        for (let row = 0; row < 3; row++) {
          const startX = showLabels
            ? context.geometry.wireInitialStateRect(row).right()
            : 5;
          assertThat(wireRuns(context, row, startX, showLabels))
            .withInfo({ row, showLabels, columns: columns.length })
            .isEqualTo(
              merged(segmentsPerColumn(context, row, startX, showLabels)),
            );
        }
      }
    }
  },
);
