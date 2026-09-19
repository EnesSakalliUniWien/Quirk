import {Suite, assertThat, assertTrue} from "../../TestUtil.js"
import {Gates} from "../../../src/gates/AllGates.js"

const suite = new Suite("turnsAt");

/** The gates that draw a dial or a square wave: every one of them says how far round it is. */
const DIAL_GATES = [
    ...Gates.CountingGates.all,
    ...Gates.Powering.all,
    ...Gates.Exponentiating.all,
    Gates.ParametrizedRotationGates.FormulaicRotationX,
    Gates.ParametrizedRotationGates.FormulaicRotationY,
    Gates.ParametrizedRotationGates.FormulaicRotationZ,
    Gates.ParametrizedRotationGates.FormulaicRotationRx,
    Gates.ParametrizedRotationGates.FormulaicRotationRy,
    Gates.ParametrizedRotationGates.FormulaicRotationRz,
];

const TIMES = [0, 0.125, 0.3, 0.5, 0.75, 0.9];

suite.test("every gate that draws its time says how far round it is, through withParam too", () => {
    for (const gate of DIAL_GATES) {
        assertThat(typeof gate.turnsAt).withInfo(gate.serializedId).isEqualTo("function");
        for (const time of TIMES) {
            const turns = gate.turnsAt(time, gate.param);
            assertTrue(Number.isFinite(turns));
        }
    }
    // A formula gate edited through withParam keeps its turnsAt, and reads the new formula.
    const edited = Gates.ParametrizedRotationGates.FormulaicRotationRz.withParam("pi t");
    assertThat(edited.turnsAt(0.25, edited.param)).isApproximatelyEqualTo(0.25, 0.0001);
});

suite.test("a backward gate is its forward twin's turns negated, and its matrix follows the same turns", () => {
    const pairs = [
        [Gates.Powering.XForward, Gates.Powering.XBackward],
        [Gates.Powering.YForward, Gates.Powering.YBackward],
        [Gates.Powering.ZForward, Gates.Powering.ZBackward],
        [Gates.Exponentiating.XForward, Gates.Exponentiating.XBackward],
        [Gates.Exponentiating.YForward, Gates.Exponentiating.YBackward],
        [Gates.Exponentiating.ZForward, Gates.Exponentiating.ZBackward],
    ];
    for (const [forward, backward] of pairs) {
        for (const time of TIMES) {
            const info = {gate: forward.serializedId, time};
            assertThat(backward.turnsAt(time, backward.param)).
                withInfo(info).
                isApproximatelyEqualTo(-forward.turnsAt(time, forward.param), 0.0000001);
            // The matrix is built from those same turns, so turning back undoes turning forward.
            assertThat(backward.knownMatrixAt(time).times(forward.knownMatrixAt(time))).
                withInfo(info).
                isApproximatelyEqualTo(forward.knownMatrixAt(time).times(backward.knownMatrixAt(time)), 0.0001);
        }
    }
});

suite.test("a quarter-phased clock pulse is the plain one three quarters of a cycle on", () => {
    const plain = Gates.CountingGates.ClockPulseGate;
    const quartered = Gates.CountingGates.QuarterPhaseClockPulseGate;
    for (const time of TIMES) {
        assertThat(quartered.turnsAt(time)).isApproximatelyEqualTo(plain.turnsAt(time) + 0.75, 0.0000001);
        // The wave and the matrix come off the same turns, so the pulse arrives where the wave shows it.
        assertThat(quartered.knownMatrixAt(time)).
            withInfo({time}).
            isEqualTo(plain.knownMatrixAt((time + 0.75) % 1));
    }
});

suite.test("the dial's turns are the gate's own cycles: a whole turn brings the matrix back", () => {
    for (const gate of [...Gates.Powering.all, ...Gates.Exponentiating.all]) {
        for (const time of TIMES) {
            const turns = gate.turnsAt(time, gate.param);
            // The time a whole turn later, which the gate's matrix must repeat up to a global phase.
            const later = time + Math.abs(1 / (gate.turnsAt(1, gate.param) - gate.turnsAt(0, gate.param)));
            assertThat(Math.abs(gate.turnsAt(later, gate.param) - turns)).
                withInfo({gate: gate.serializedId, time}).
                isApproximatelyEqualTo(1, 0.0000001);
        }
    }
});
