import { Suite, assertThat } from "../../TestUtil.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { CircuitEvalContext } from "../../../src/engine/simulation/CircuitEvalContext.js";
import { CircuitShaders } from "../../../src/engine/simulation/gpu/CircuitShaders.js";
import { Controls } from "../../../src/circuit/model/Controls.js";
import { GateBuilder } from "../../../src/circuit/model/Gate.js";
import { GateColumn } from "../../../src/circuit/model/GateColumn.js";
import { Gates } from "../../../src/gates/AllGates.js";
import {
  advanceStateWithCircuit,
  setGateBuilderEffectToCircuit,
} from "../../../src/engine/simulation/CircuitComputeUtil.js";
import { fusedRunAt } from "../../../src/engine/simulation/gateFusion.js";
import { Complex } from "../../../src/engine/math/complex/Complex.js";
import { Matrix } from "../../../src/engine/math/matrix/Matrix.js";
import { Shaders } from "../../../src/engine/webgl/operations/Shaders.js";
import { KetTextureUtil } from "../../../src/engine/simulation/gpu/KetTextureUtil.js";
import { WglTextureTrader } from "../../../src/engine/webgl/texture/WglTextureTrader.js";

const suite = new Suite("gateFusion");

/** A two-wire gate with a known, unremarkable unitary matrix. */
const W = new GateBuilder()
  .setSerializedId("fusion-W")
  .setHeight(2)
  .setKnownEffectToMatrix(
    Matrix.square(
      0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      new Complex(0, 0.5),
      -0.5,
      new Complex(0, -0.5),
      0.5,
      -0.5,
      0.5,
      -0.5,
      0.5,
      new Complex(0, -0.5),
      -0.5,
      new Complex(0, 0.5),
    ),
  ).gate;

const gateMap = [
  ["H", Gates.HalfTurns.H],
  ["X", Gates.HalfTurns.X],
  ["Y", Gates.HalfTurns.Y],
  ["Z", Gates.HalfTurns.Z],
  ["S", Gates.QuarterTurns.SqrtZForward],
  ["T", Gates.OtherZ.Z4],
  ["W", W],
  ["t", Gates.Powering.XForward],
  ["y", Gates.Powering.YForward],
  ["•", Gates.Controls.Control],
  ["◦", Gates.Controls.AntiControl],
  ["⊕", Gates.Controls.XAntiControl],
  ["@", Gates.Displays.BlochSphereDisplay],
  ["M", Gates.Special.Measurement],
  ["!", Gates.PostSelectionGates.PostSelectOn],
  ["s", Gates.Special.SwapHalf],
  ["-", undefined],
  ["/", null],
];

const circuit = (diagram, ...extras) =>
  CircuitDefinition.fromTextDiagram(new Map([...gateMap, ...extras]), diagram);

/**
 * Runs the circuit on a random state, fused and gate by gate, starting at `row` under the given outer
 * controls, and checks the two agree.
 */
const assertFusionMatches = (
  c,
  { time = 0.3, controls = Controls.NONE, row = 0, extraWires = 0 } = {},
) => {
  const n = c.numWires + extraWires;
  const input = Matrix.generate(
    1,
    1 << n,
    () => new Complex(Math.random() - 0.5, Math.random() - 0.5),
  );
  const run = (fuse) => {
    const trader = new WglTextureTrader(
      Shaders.vec2Data(input.rawBuffer()).toVec2Texture(n),
    );
    const controlTex = CircuitShaders.controlMask(controls).toBoolTexture(n);
    try {
      const ctx = new CircuitEvalContext(
        time,
        row,
        n,
        controls,
        controlTex,
        controls,
        trader,
        new Map(),
      );
      advanceStateWithCircuit(
        ctx,
        c,
        false,
        undefined,
        0,
        fuse ? { stopBefore: () => false } : undefined,
      );
    } finally {
      controlTex.deallocByDepositingInPool();
    }
    return new Matrix(
      1,
      1 << n,
      KetTextureUtil.tradeTextureForVec2Output(trader),
    );
  };
  assertThat(run(true)).isApproximatelyEqualTo(run(false), 0.00001);
};

/** The fused steps of the run starting at `col`, as [row, matrix width, controlled?]. */
const stepsAt = (c, col) =>
  fusedRunAt(c, col, 0).steps.map(({ row, matrix, controls }) => [
    row,
    matrix.width(),
    !controls.isEqualTo(Controls.NONE),
  ]);

suite.test(
  "a run of quiet columns fuses into one matrix over the wires it touches",
  () => {
    const c = circuit(`---H-•-T-
                       -H-S-X-•-
                       ---------`);
    assertThat(fusedRunAt(c, 0, 0).end).isEqualTo(c.columns.length);
    assertThat(stepsAt(c, 0)).isEqualTo([[0, 4, false]]);
  },
);

suite.test("a lone gate keeps its own pass and its controls", () => {
  assertThat(
    stepsAt(
      circuit(`-H-
                                ---`),
      0,
    ),
  ).isEqualTo([[0, 2, false]]);
  assertThat(
    stepsAt(
      circuit(`-•-
                                -X-`),
      0,
    ),
  ).isEqualTo([[1, 2, true]]);
});

suite.test("gates across many wires fuse wire by wire", () => {
  const c = circuit(`-H-T-
                       -H-S-
                       -H-T-`);
  assertThat(stepsAt(c, 0)).isEqualTo([
    [0, 2, false],
    [1, 2, false],
    [2, 2, false],
  ]);
});

suite.test(
  "a run stops where something observes or can't be written as a matrix",
  () => {
    for (const stop of ["@", "M", "!", "⊕"]) {
      const c = circuit(`H-S-${stop}-H-S
                           X-H---X-H`);
      assertThat(fusedRunAt(c, 0, 0)?.end)
        .withInfo({ stop })
        .isEqualTo(4);
      assertThat(fusedRunAt(c, 4, 0))
        .withInfo({ stop })
        .isEqualTo(undefined);
    }
    const swapped = circuit(`H-S-s-H
                             X-H-s-X`);
    assertThat(fusedRunAt(swapped, 0, 0)?.end).isEqualTo(4);
  },
);

suite.test(
  "a run stops at the first time-dependent column, where animation frames start",
  () => {
    const c = circuit(`H-S-t-y-H
                       X-H-y-t-X`);
    assertThat(fusedRunAt(c, 0, 0)?.end).isEqualTo(4);
    assertThat(fusedRunAt(c, 4, 0)?.end).isEqualTo(9);
  },
);

suite.test(
  "a gate controlled from too far away is applied on its own, after what it needs",
  () => {
    const c = circuit(`H-•-H-
                       --X---
                       ------
                       ------
                       ----•-
                       ----X-`);
    assertThat(fusedRunAt(c, 0, 0).end).isEqualTo(6);
    assertThat(stepsAt(c, 0)).isEqualTo([
      [0, 4, false],
      [0, 2, true],
      [5, 2, true],
    ]);
  },
);

suite.testUsingWebGL(
  "fused runs act like their gates, with controls folded in",
  () => {
    assertFusionMatches(
      circuit(`-H-•-T-◦-H-
                                 -S-X-•-Y-•-
                                 -T-◦-S-•-H-`),
    );
    // Four wires wide, wider than one fused matrix.
    assertFusionMatches(
      circuit(`-H-•-T---•-
                                 -H-S-•-T---
                                 -H---X-•---
                                 -H-----S-Z-`),
    );
    assertFusionMatches(
      circuit(`-W-H-•-
                                 -/-X-W-
                                 -H-•-/-`),
    );
  },
);

suite.testUsingWebGL(
  "fused runs act like their gates under outer controls and shifted rows",
  () => {
    const c = circuit(`-H-•-T-
                       -S-X-•-
                       -T-◦-S-`);
    assertFusionMatches(c, {
      row: 1,
      extraWires: 1,
      controls: Controls.bit(0, true),
    });
    assertFusionMatches(c, {
      row: 2,
      extraWires: 2,
      controls: new Controls(0b11, 0b01),
    });
  },
);

suite.testUsingWebGL(
  "fused time-dependent runs act like their gates at every time",
  () => {
    const c = circuit(`-t-•-y-
                       -y-t-•-`);
    for (const time of [0, 0.125, 0.3, 0.77]) {
      assertFusionMatches(c, { time });
    }
  },
);

suite.testUsingWebGL("fusion inside a circuit gate acts like its gates", () => {
  const inner = setGateBuilderEffectToCircuit(
    new GateBuilder(),
    circuit(`H-•-T
                                                                           S-X-•`),
  ).gate;
  assertFusionMatches(
    circuit(
      `-•-?-
                                 ---/-
                                 -H-•-`,
      ["?", inner],
    ),
  );
});

suite.testUsingWebGL(
  "random circuits act the same fused and gate by gate",
  () => {
    const pool = [
      Gates.HalfTurns.H,
      Gates.HalfTurns.X,
      Gates.HalfTurns.Y,
      Gates.QuarterTurns.SqrtZForward,
      Gates.OtherZ.Z4,
      Gates.Powering.XForward,
      Gates.Controls.Control,
      Gates.Controls.AntiControl,
      undefined,
      undefined,
    ];
    for (let repeat = 0; repeat < 8; repeat++) {
      const columns = Array.from(
        { length: 12 },
        () =>
          new GateColumn(
            Array.from(
              { length: 5 },
              () => pool[Math.floor(Math.random() * pool.length)],
            ),
          ),
      );
      assertFusionMatches(new CircuitDefinition(5, columns), {
        time: Math.random(),
      });
    }
  },
);
