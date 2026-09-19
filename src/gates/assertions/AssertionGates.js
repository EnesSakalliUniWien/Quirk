import {Gate} from "../../circuit/model/Gate.js";
import {CanvasTheme} from "../../config/CanvasTheme.js";
import {paintBackground, paintGateButton, paintOutline, paintResizeTab} from "../../draw/gate/GateFrame.js";
import {paintGateSymbol} from "../../draw/gate/GateSymbol.js";
import {frame} from "../../draw/shapes/ShapeView.js";
import {densityDisplayStatTexture} from "../displays/density/densityDisplayStatTexture.js";
import {densityPixelsToMatrix} from "../displays/density/densityPixelsToMatrix.js";
import {MAX_AMPLITUDE_WIRES, parseAmplitudes} from "../prepare/PrepareGates.js";
import {isEntangled, isState, isSuperposition} from "./assertionVerdicts.js";

/**
 * Assertions, the way a debugger for quantum programs has them (the MQT Debugger's assert-sup,
 * assert-ent and assert-eq): a gate that does nothing to the state, and says whether the state of its wires, as
 * it is at the gate's column, is what the circuit's author claims. A run of the playhead halts
 * before an assertion that fails.
 *
 * Each is a density display underneath: the same statistics, judged instead of drawn.
 */

/** @param {!GateRenderParams} args */
function assertionRenderer(args) {
    const holds = args.customStats?.holds;
    paintBackground(args);
    paintOutline(args);
    paintResizeTab(args);
    paintGateSymbol(args, args.gate.symbol + (holds === undefined ? "" : holds ? "\n✓" : "\n✗"), false);
    if (holds !== undefined) {
        frame(args.painter, args.rect, holds ? CanvasTheme.probability.outline : CanvasTheme.error.text);
    }
    if (args.gate.paramDialog !== undefined) paintGateButton(args);
}

/**
 * @param {!string} id
 * @param {!string} title
 * @param {!string} blurb
 * @param {!function(!Matrix, !int, !Gate): !boolean} verdict Of the density matrix, for a gate of
 *     this many wires.
 * @returns {!function(!int, !GateBuilder): !GateBuilder}
 */
const assertionMaker = (id, title, blurb, verdict) => (span, builder) => builder.
    setSerializedId(id + span).
    setSymbol(id).
    setTitle(title).
    setBlurb(blurb).
    promiseHasNoNetEffectOnStateVector().
    setExtraDisableReasonFinder(args => args.isNested ? "can't\nnest\nassertions\n(sorry)" : undefined).
    setRenderer(assertionRenderer).
    setStatTexturesMaker(ctx => densityDisplayStatTexture(
        ctx.stateTrader.currentTexture, ctx.wireCount, ctx.controls, ctx.row, span)).
    setStatPixelDataPostProcessor((pixels, circuit, col, row) => {
        const density = densityPixelsToMatrix(pixels, circuit, col, row);
        // A state nothing can reach - an impossible postselection - holds no claim true.
        return {holds: !density.hasNaN() && verdict(density, span, circuit.gateInSlot(col, row)), density};
    }).
    setProcessedStatsToJsonFunc(data => ({holds: data.holds}));

const AssertionGates = {};

AssertionGates.SuperpositionFamily = Gate.buildFamily(1, 8, assertionMaker(
    "assert-sup",
    "Superposition Assertion",
    "Holds while its wires could be found in more than one basis state.\nA run halts before it when it fails.",
    isSuperposition));

AssertionGates.EntanglementFamily = Gate.buildFamily(2, 8, assertionMaker(
    "assert-ent",
    "Entanglement Assertion",
    "Holds while every two of its wires are correlated.\nA run halts before it when it fails.",
    isEntangled));

// The claimed state is the gate's parameter, amplitudes like the ones a |ψ⟩ prepare box takes, and
// edited in the amplitudes editor (src/components/panels/gate-param/amplitudes-editor.jsx).
const equalityMaker = assertionMaker(
    "assert-eq",
    "Equality Assertion",
    "Holds while its wires are in the state typed in as amplitudes, up to a global phase.\n" +
        "Click the box to enter them. A run halts before it when it fails.",
    (density, span, gate) => isState(density, gate.param));
AssertionGates.EqualityFamily = Gate.buildFamily(1, MAX_AMPLITUDE_WIRES, (span, builder) => {
    equalityMaker(span, builder).setParamDialog({
        title: "Enter the state to assert.",
        message: `${1 << span} amplitudes, one per basis state from |${"0".repeat(span)}⟩ up, the first wire as the ` +
            `lowest bit. Formulas such as 1/sqrt(2) and -i work; the state is scaled to unit length.`,
        editor: "amplitudes",
        applyText: (oldGate, text) => {
            const parsed = parseAmplitudes(text, span);
            return parsed.error !== undefined ? parsed : {gate: oldGate.withParam(parsed.amplitudes)};
        },
    });
    builder.gate.param = Array.from({length: 1 << span}, (_, i) => [i === 0 ? 1 : 0, 0]);
});

AssertionGates.all = [
    ...AssertionGates.SuperpositionFamily.all,
    ...AssertionGates.EntanglementFamily.all,
    ...AssertionGates.EqualityFamily.all,
];

// By id, not identity: an assertion given a parameter is a copy of its family's gate.
const ASSERTION_IDS = new Set(AssertionGates.all.map(gate => gate.serializedId));

/**
 * @param {!CircuitStats} stats
 * @returns {!Array.<!int>} The columns holding an assertion that fails in these stats, in order.
 */
function failingAssertionColumns(stats) {
    return stats.circuitDefinition.columns.flatMap((column, col) =>
        column.gates.some((gate, row) =>
            gate !== undefined && ASSERTION_IDS.has(gate.serializedId) &&
            stats.customStatsForSlot(col, row)?.holds === false) ? [col] : []);
}

export {AssertionGates, failingAssertionColumns};
