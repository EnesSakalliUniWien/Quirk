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

// Rotations.
import {ExponentiatingGates} from "./rotations/ExponentiatingGates.js"
import {HalfTurnGates} from "./rotations/HalfTurnGates.js"
import {ParametrizedRotationGates} from "./rotations/ParametrizedRotationGates.js"
import {PoweringGates} from "./rotations/PoweringGates.js"
import {QuarterTurnGates} from "./rotations/QuarterTurnGates.js"
import {VariousXGates} from "./rotations/VariousXGates.js"
import {VariousYGates} from "./rotations/VariousYGates.js"
import {VariousZGates} from "./rotations/VariousZGates.js"

// Displays.
import {AmplitudeDisplayFamily} from "./displays/AmplitudeDisplay.js"
import {BlochSphereDisplay} from "./displays/BlochSphereDisplay.js"
import {DensityMatrixDisplayFamily} from "./displays/DensityMatrixDisplay.js"
import {ProbabilityDisplayFamily} from "./displays/ProbabilityDisplay.js"
import {SampleDisplayFamily} from "./displays/SampleDisplay.js"

// Probes.
import {Controls} from "./probes/Controls.js"
import {Detectors} from "./probes/Detector.js"
import {MeasurementGate} from "./probes/MeasurementGate.js"
import {PostSelectionGates} from "./probes/PostSelectionGates.js"

// Inputs.
import {InputGates} from "./inputs/InputGates.js"

// Arithmetic.
import {ArithmeticGates} from "./arithmetic/ArithmeticGates.js"
import {BitCountGates} from "./arithmetic/BitCountGates.js"
import {ComparisonGates} from "./arithmetic/ComparisonGates.js"
import {IncrementGates} from "./arithmetic/IncrementGates.js"
import {ModularAdditionGates} from "./arithmetic/ModularAdditionGates.js"
import {ModularIncrementGates} from "./arithmetic/ModularIncrementGates.js"
import {ModularMultiplicationGates} from "./arithmetic/ModularMultiplicationGates.js"
import {ModularMultiplyAccumulateGates} from "./arithmetic/ModularMultiplyAccumulateGates.js"
import {MultiplicationGates} from "./arithmetic/MultiplicationGates.js"
import {MultiplyAccumulateGates} from "./arithmetic/MultiplyAccumulateGates.js"
import {XorGates} from "./arithmetic/XorGates.js"

// Ordering.
import {CountingGates} from "./ordering/CountingGates.js"
import {CycleBitsGates} from "./ordering/CycleBitsGates.js"
import {InterleaveBitsGates} from "./ordering/InterleaveBitsGates.js"
import {PivotFlipGates} from "./ordering/PivotFlipGates.js"
import {ReverseBitsGateFamily} from "./ordering/ReverseBitsGate.js"

// Frequency.
import {FourierTransformGates} from "./frequency/FourierTransformGates.js"
import {PhaseGradientGates} from "./frequency/PhaseGradientGates.js"

// Miscellaneous.
import {ErrorInjectionGate} from "./misc/Debug_ErrorInjectionGate.js"
import {UniversalNotGate} from "./misc/Impossible_UniversalNotGate.js"
import {
    ImaginaryGate,
    AntiImaginaryGate,
    SqrtImaginaryGate,
    AntiSqrtImaginaryGate
} from "./misc/Joke_ImaginaryGate.js"
import {NeGate} from "./misc/Joke_NeGate.js"
import {ZeroGate} from "./misc/Joke_ZeroGate.js"
import {SpacerGate} from "./misc/SpacerGate.js"
import {SwapGateHalf} from "./misc/SwapGateHalf.js"

import {seq} from "../base/Seq.js"

let Gates = {};

/** Gates that have special behavior requiring custom code / logic to handle. */
Gates.Special = {
    Measurement: MeasurementGate,
    SwapHalf: SwapGateHalf
};
/**
 * Gates that display information without affecting the state.
 * (In reality these would require multiple runs of the circuit to do tomography.)
 */
Gates.Displays = {
    AmplitudeDisplayFamily: AmplitudeDisplayFamily,
    ProbabilityDisplayFamily: ProbabilityDisplayFamily,
    SampleDisplayFamily: SampleDisplayFamily,
    DensityMatrixDisplayFamily: DensityMatrixDisplayFamily,
    BlochSphereDisplay: BlochSphereDisplay
};
Gates.Displays.DensityMatrixDisplay = DensityMatrixDisplayFamily.ofSize(1);
Gates.Displays.DensityMatrixDisplay2 = DensityMatrixDisplayFamily.ofSize(2);
Gates.Displays.ChanceDisplay = Gates.Displays.ProbabilityDisplayFamily.ofSize(1);

// Rotations.
Gates.Exponentiating = ExponentiatingGates;
Gates.HalfTurns = HalfTurnGates;
Gates.OtherX = VariousXGates;
Gates.OtherY = VariousYGates;
Gates.OtherZ = VariousZGates;
Gates.ParametrizedRotationGates = ParametrizedRotationGates;
Gates.Powering = PoweringGates;
Gates.QuarterTurns = QuarterTurnGates;

// Probes.
Gates.Controls = Controls;
Gates.Detectors = Detectors;
Gates.PostSelectionGates = PostSelectionGates;

// Inputs.
Gates.InputGates = InputGates;

// Arithmetic.
Gates.Arithmetic = ArithmeticGates;
Gates.BitCountGates = BitCountGates;
Gates.ComparisonGates = ComparisonGates;
Gates.IncrementGates = IncrementGates;
Gates.ModularAdditionGates = ModularAdditionGates;
Gates.ModularIncrementGates = ModularIncrementGates;
Gates.ModularMultiplicationGates = ModularMultiplicationGates;
Gates.ModularMultiplyAccumulateGates = ModularMultiplyAccumulateGates;
Gates.MultiplicationGates = MultiplicationGates;
Gates.MultiplyAccumulateGates = MultiplyAccumulateGates;
Gates.XorGates = XorGates;

// Ordering.
Gates.CountingGates = CountingGates;
Gates.CycleBitsGates = CycleBitsGates;
Gates.InterleaveBitsGates = InterleaveBitsGates;
Gates.PivotFlipGates = PivotFlipGates;
Gates.ReverseBitsGateFamily = ReverseBitsGateFamily;

// Frequency.
Gates.FourierTransformGates = FourierTransformGates;
Gates.PhaseGradientGates = PhaseGradientGates;

// Miscellaneous.
Gates.AntiImaginaryGate = AntiImaginaryGate;
Gates.AntiSqrtImaginaryGate = AntiSqrtImaginaryGate;
Gates.ErrorInjection = ErrorInjectionGate;
Gates.ImaginaryGate = ImaginaryGate;
Gates.NeGate = NeGate;
Gates.SpacerGate = SpacerGate;
Gates.SqrtImaginaryGate = SqrtImaginaryGate;
Gates.UniversalNot = UniversalNotGate;
Gates.ZeroGate = ZeroGate;

/** @type {!Array.<!Gate>} */
Gates.KnownToSerializer = [
    ...Controls.all,
    ...InputGates.all,
    MeasurementGate,
    SwapGateHalf,
    SpacerGate,
    UniversalNotGate,
    ErrorInjectionGate,
    ZeroGate,
    NeGate,
    ImaginaryGate,
    AntiImaginaryGate,
    SqrtImaginaryGate,
    AntiSqrtImaginaryGate,

    ...AmplitudeDisplayFamily.all,
    ...ProbabilityDisplayFamily.all,
    ...SampleDisplayFamily.all,
    ...DensityMatrixDisplayFamily.all,
    BlochSphereDisplay,

    ...HalfTurnGates.all,
    ...QuarterTurnGates.all,
    ...VariousXGates.all,
    ...VariousYGates.all,
    ...VariousZGates.all,
    ...ExponentiatingGates.all,
    ...PoweringGates.all,
    ...ParametrizedRotationGates.all,

    ...Detectors.all,
    ...PostSelectionGates.all,

    ...ArithmeticGates.all,
    ...BitCountGates.all,
    ...ComparisonGates.all,
    ...IncrementGates.all,
    ...ModularAdditionGates.all,
    ...ModularIncrementGates.all,
    ...ModularMultiplicationGates.all,
    ...ModularMultiplyAccumulateGates.all,
    ...MultiplicationGates.all,
    ...MultiplyAccumulateGates.all,
    ...XorGates.all,

    ...CountingGates.all,
    ...CycleBitsGates.all,
    ...InterleaveBitsGates.all,
    ...PivotFlipGates.all,
    ...ReverseBitsGateFamily.all,

    ...FourierTransformGates.all,
    ...PhaseGradientGates.all
];

let gatesById = seq(Gates.KnownToSerializer).keyedBy(g => g.serializedId);
/**
 * @param {!String} id
 * @param {!CustomGateSet} customGateSet
 * @returns {undefined|!Gate}
 */
Gates.findKnownGateById = (id, customGateSet) => {
    return gatesById.has(id) ? gatesById.get(id) : customGateSet.findGateWithSerializedId(id);
};

/** @type {!Array<!{hint: !string, gates: !Array<undefined|!Gate>}>} */
Gates.TopToolboxGroups = [
    {
        hint: "Probes",
        gates: [
            MeasurementGate,                  undefined,
            PostSelectionGates.PostSelectOff, PostSelectionGates.PostSelectOn,
            Controls.AntiControl,             Controls.Control
        ]
    },
    {
        hint: "Displays",
        gates: [
            undefined, undefined,
            DensityMatrixDisplayFamily.ofSize(1), BlochSphereDisplay,
            ProbabilityDisplayFamily.ofSize(1),   AmplitudeDisplayFamily.ofSize(2)
        ]
    },
    {
        hint: "Half Turns",
        gates: [
            HalfTurnGates.Z, SwapGateHalf,
            HalfTurnGates.Y, undefined,
            HalfTurnGates.X, HalfTurnGates.H
        ]
    },
    {
        hint: "Quarter Turns",
        gates: [
            QuarterTurnGates.SqrtZForward, QuarterTurnGates.SqrtZBackward,
            QuarterTurnGates.SqrtYForward, QuarterTurnGates.SqrtYBackward,
            QuarterTurnGates.SqrtXForward, QuarterTurnGates.SqrtXBackward
        ]
    },
    {
        hint: "Eighth Turns",
        gates: [
            VariousZGates.Z4, VariousZGates.Z4i,
            VariousYGates.Y4, VariousYGates.Y4i,
            VariousXGates.X4, VariousXGates.X4i,
        ]
    },
    {
        hint: "Spinning",
        gates: [
            PoweringGates.ZForward, PoweringGates.ZBackward,
            PoweringGates.YForward, PoweringGates.YBackward,
            PoweringGates.XForward, PoweringGates.XBackward,
        ]
    },
    {
        hint: "Formulaic",
        gates: [
            ParametrizedRotationGates.FormulaicRotationZ, ParametrizedRotationGates.FormulaicRotationRz,
            ParametrizedRotationGates.FormulaicRotationY, ParametrizedRotationGates.FormulaicRotationRy,
            ParametrizedRotationGates.FormulaicRotationX, ParametrizedRotationGates.FormulaicRotationRx,
        ]
    },
    {
        hint: "Parametrized",
        gates: [
            ParametrizedRotationGates.ZToA, ParametrizedRotationGates.ZToMinusA,
            ParametrizedRotationGates.YToA, ParametrizedRotationGates.YToMinusA,
            ParametrizedRotationGates.XToA, ParametrizedRotationGates.XToMinusA,
        ]
    },
    {
        hint: 'Sampling',
        gates: [
            Detectors.ZDetector, Detectors.ZDetectControlClear,
            Detectors.YDetector, Detectors.YDetectControlClear,
            Detectors.XDetector, Detectors.XDetectControlClear,
        ]
    },
    {
        hint: "Parity",
        gates: [
            Controls.ZParityControl, undefined,
            Controls.YParityControl, undefined,
            Controls.XParityControl, undefined,
        ]
    },
];

/** @type {!Array<!{hint: !string, gates: !Array<undefined|!Gate>}>} */
Gates.BottomToolboxGroups = [
    {
        hint: "X/Y Probes",
        gates: [
            Controls.XAntiControl, Controls.XControl,
            Controls.YAntiControl, Controls.YControl,
            PostSelectionGates.PostSelectAntiX, PostSelectionGates.PostSelectX,
            PostSelectionGates.PostSelectAntiY, PostSelectionGates.PostSelectY,
        ]
    },
    {
        hint: "Order",
        gates: [
            CountingGates.CountingFamily.ofSize(3),          CountingGates.UncountingFamily.ofSize(3),
            ReverseBitsGateFamily.ofSize(2), undefined,
            CycleBitsGates.CycleBitsFamily.ofSize(3),        CycleBitsGates.ReverseCycleBitsFamily.ofSize(3),
            InterleaveBitsGates.InterleaveBitsGateFamily.ofSize(6),
            InterleaveBitsGates.DeinterleaveBitsGateFamily.ofSize(6),
        ]
    },
    {
        hint: 'Frequency',
        gates: [
            FourierTransformGates.FourierTransformFamily.ofSize(2),
                FourierTransformGates.InverseFourierTransformFamily.ofSize(2),
            undefined, undefined,
            PhaseGradientGates.PhaseGradientFamily.ofSize(2),
                PhaseGradientGates.PhaseDegradientFamily.ofSize(2),
            PhaseGradientGates.DynamicPhaseGradientFamily.ofSize(2),
                PhaseGradientGates.DynamicPhaseDegradientFamily.ofSize(2),
        ]
    },
    {
        hint: "Inputs",
        gates: [
            InputGates.InputAFamily.ofSize(2), InputGates.SetA,
            InputGates.InputBFamily.ofSize(2), InputGates.SetB,
            InputGates.InputRFamily.ofSize(2), InputGates.SetR,
            undefined, undefined,
        ]
    },
    {
        hint: 'Arithmetic',
        gates: [
            IncrementGates.IncrementFamily.ofSize(2), IncrementGates.DecrementFamily.ofSize(2),
            ArithmeticGates.PlusAFamily.ofSize(2), ArithmeticGates.MinusAFamily.ofSize(2),
            MultiplyAccumulateGates.MultiplyAddInputsFamily.ofSize(2),
                MultiplyAccumulateGates.MultiplySubtractInputsFamily.ofSize(2),
            MultiplicationGates.TimesAFamily.ofSize(2), MultiplicationGates.TimesAInverseFamily.ofSize(2),
        ]
    },
    {
        hint: "Compare",
        gates: [
            ComparisonGates.ALessThanB, ComparisonGates.AGreaterThanB,
            ComparisonGates.ALessThanOrEqualToB, ComparisonGates.AGreaterThanOrEqualToB,
            ComparisonGates.AEqualToB, ComparisonGates.ANotEqualToB,
            undefined, undefined,
        ]
    },
    {
        hint: "Modular",
        gates: [
            ModularIncrementGates.IncrementModRFamily.ofSize(2), ModularIncrementGates.DecrementModRFamily.ofSize(2),
            ModularAdditionGates.PlusAModRFamily.ofSize(2), ModularAdditionGates.MinusAModRFamily.ofSize(2),
            ModularMultiplicationGates.TimesAModRFamily.ofSize(2),
                ModularMultiplicationGates.TimesAModRInverseFamily.ofSize(2),
            ModularMultiplicationGates.TimesBToTheAModRFamily.ofSize(2),
                ModularMultiplicationGates.TimesInverseBToTheAModRFamily.ofSize(2),
        ]
    },
    {
        hint: 'Scalar',
        gates: [
            SpacerGate, ZeroGate,
            NeGate, undefined,
            ImaginaryGate, AntiImaginaryGate,
            SqrtImaginaryGate, AntiSqrtImaginaryGate,
        ]
    },
];

/** @type {!Map.<undefined|!string, !Array.<!Gate>>} */
const INITIAL_STATES_TO_GATES = new Map([
    [undefined, []],
    ['1', [Gates.HalfTurns.X]],
    ['+', [Gates.HalfTurns.H]],
    ['-', [Gates.HalfTurns.H, Gates.HalfTurns.Z]],
    ['i', [Gates.HalfTurns.H, Gates.QuarterTurns.SqrtZForward]],
    ['-i', [Gates.HalfTurns.H, Gates.QuarterTurns.SqrtZBackward]]
]);

export {Gates, INITIAL_STATES_TO_GATES}
