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

import {fitLine} from '../../draw/text/TextLayout.js';
import {circle, strokePath, rectangle} from '../../draw/shapes/ShapeView.js';

import {GateBuilder} from '../../circuit/model/Gate.js';
import {paintBackground, paintOutline} from '../../draw/gate/GateFrame.js';
import {GateShaders} from '../../engine/simulation/gpu/GateShaders.js';
import {HalfTurnGates} from '../rotations/HalfTurnGates.js';
import {QuarterTurnGates} from '../rotations/QuarterTurnGates.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Simulation} from '../../config/Simulation.js';
import {ketArgs, ketShaderPermute} from '../../engine/simulation/gpu/KetShaderUtil.js';
import {WglArg} from '../../engine/webgl/shader/WglArg.js';
import { ceilLg2 } from "../../engine/math/powersOfTwo.js";

const Controls = {};

/** An X or Y control's face: larger than a Z control's dot, so its mark reads. */
const AXIS_CONTROL_RADIUS = 6.5;

/**
 * An X or Y control, drawn in its axis's hue - the hue its gates and its Bloch axis wear - so it
 * is told from a Z control (the white dot and ring) and from the large filled ⊕ a CNOT targets.
 * The marks inside say which state it conditions on.
 * @param {!function(): !string} hue The axis colour, read when drawn so the scheme is current.
 * @param {!function(!Point, !number): !Array.<!Array.<!Point>>} marks Strokes across the face.
 */
const axisControlRenderer = (hue, marks) => args => {
    if (args.isHighlighted) {
        paintBackground(args);
        paintOutline(args);
    }
    const p = args.rect.center();
    const r = AXIS_CONTROL_RADIUS;
    circle(args.painter, p, r, {fill: CanvasTheme.surface.gate});
    circle(args.painter, p, r, {stroke: {color: hue(), width: 1.5}});
    for (const stroke of marks(p, r)) {
        strokePath(args.painter, stroke, hue(), 1.5);
    }
};
const xHue = () => CanvasTheme.bloch.axisX;
const yHue = () => CanvasTheme.bloch.axisY;
const across = (p, r) => [p.offsetBy(-r, 0), p.offsetBy(+r, 0)];
const upright = (p, r) => [p.offsetBy(0, -r), p.offsetBy(0, +r)];
const diagonal = (p, r, sign) => {
    const d = r * Math.sqrt(0.5);
    return [p.offsetBy(+d, -d * sign), p.offsetBy(-d, +d * sign)];
};

Controls.Control = new GateBuilder().
    setSerializedIdAndSymbol("•").
    setTitle("Control").
    setBlurb("Conditions on a qubit being ON.\nGates in the same column only apply to states meeting the condition.").
    promiseHasNoNetEffectOnStateVector().
    markAsControlExpecting(true).
    promiseEffectIsUnitary().
    setRenderer(args => {
        if (args.isHighlighted) {
            paintBackground(args);
            paintOutline(args);
        }
        circle(args.painter, args.rect.center(), 5, {fill: CanvasTheme.text.primary});
    }).
    gate;

Controls.AntiControl = new GateBuilder().
    setAlternate(Controls.Control).
    setSerializedIdAndSymbol("◦").
    setTitle("Anti-Control").
    setBlurb("Conditions on a qubit being OFF.\nGates in the same column only apply to states meeting the condition.").
    promiseHasNoNetEffectOnStateVector().
    markAsControlExpecting(false).
    promiseEffectIsUnitary().
    setRenderer(args => {
        if (args.isHighlighted) {
            paintBackground(args);
            paintOutline(args);
        }
        const p = args.rect.center();
        circle(args.painter, p, 5, {fill: CanvasTheme.surface.gate});
        circle(args.painter, p, 5, {stroke: {color: CanvasTheme.text.primary, width: 1}});
    }).
    gate;

Controls.XAntiControl = new GateBuilder().
    setSerializedId("⊕").  // The drawn +/- convention was changed, but the serialized id must stay the same.
    setSymbol("⊖").
    setTitle("X-Axis Anti-Control").
    setBlurb("Conditions on a qubit being ON+OFF.\n" +
        "Gates in the same column only apply to states meeting the condition.").
    markAsControlExpecting(false).
    setSetupCleanupEffectToUpdateFunc(
        HalfTurnGates.H.customOperation,
        HalfTurnGates.H.customOperation).
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    setRenderer(axisControlRenderer(xHue, (p, r) => [across(p, r)])).
    gate;

Controls.XControl = new GateBuilder().
    setAlternate(Controls.XAntiControl).
    setSerializedId("⊖").  // The drawn +/- convention was changed, but the serialized id must stay the same.
    setSymbol("⊕").
    setTitle("X-Axis Control").
    setBlurb("Conditions on a qubit being ON-OFF.\n" +
        "Gates in the same column only apply to states meeting the condition.").
    markAsControlExpecting(true).
    setSetupCleanupEffectToUpdateFunc(
        HalfTurnGates.H.customOperation,
        HalfTurnGates.H.customOperation).
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    setRenderer(axisControlRenderer(xHue, (p, r) => [upright(p, r), across(p, r)])).
    gate;

Controls.YAntiControl = new GateBuilder().
    setSerializedId("⊗").  // The drawn cross/slash convention was changed, but the serialized id must stay the same.
    setSymbol("(/)").
    setTitle("Y-Axis Anti-Control").
    setBlurb("Conditions on a qubit being ON+iOFF.\n" +
        "Gates in the same column only apply to states meeting the condition.").
    markAsControlExpecting(false).
    setSetupCleanupEffectToUpdateFunc(
        ctx => GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXForward._knownMatrix),
        ctx => GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXBackward._knownMatrix)).
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    setRenderer(axisControlRenderer(yHue, (p, r) => [diagonal(p, r, 1)])).
    gate;

Controls.YControl = new GateBuilder().
    setAlternate(Controls.YAntiControl).
    setSerializedId("(/)").  // The drawn cross/slash convention was changed, but the serialized id must stay the same.
    setSymbol("⊗").
    setTitle("Y-Axis Control").
    setBlurb("Conditions on a qubit being ON-iOFF.\n" +
        "Gates in the same column only apply to states meeting the condition.").
    markAsControlExpecting(true).
    setSetupCleanupEffectToUpdateFunc(
        ctx => GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXForward._knownMatrix),
        ctx => GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXBackward._knownMatrix)).
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    setRenderer(axisControlRenderer(yHue, (p, r) => [diagonal(p, r, 1), diagonal(p, r, -1)])).
    gate;

const PARITY_SHADER = ketShaderPermute(
    `
        uniform float parityMask;
    `,
    `
        float bitPos = 1.0;
        float result = 0.5;
        for (int i = 0; i < ${Simulation.MAX_WIRE_COUNT}; i++) {
            float maskBit = mod(floor(parityMask/bitPos), 2.0);
            float posBit = mod(floor(full_out_id/bitPos), 2.0);
            float flip = maskBit * posBit;
            result += flip;
            bitPos *= 2.0;
        }
        return mod(result, 2.0) - 0.5;`,
    1);

/**
 * Applies a multi-target CNOT operation, merging the parities onto a single qubit (or reversing that process).
 *
 * Note that this method is invoked for each parity control, but only the last one in the column is supposed to
 * perform the operation (or, when uncomputing, the first one).
 *
 * @param {!CircuitEvalContext} ctx
 * @param {!boolean} order
 */
function parityGatherScatter(ctx, order) {
    const c = ctx.rawControls;
    const isLast = 2 << ctx.row > c.parityMask;
    const isFirst = 1 << ctx.row === (c.parityMask & ~(c.parityMask - 1));
    if (order ? isLast : isFirst) {
        ctx.applyOperation(PARITY_SHADER.withArgs(
            ...ketArgs(ctx.withRow(ceilLg2(c.parityMask & c.inclusionMask))),
            WglArg.float('parityMask', c.parityMask)
        ));
    }
}

/**
 * @param {!string} name
 * @returns {!function(args: !GateRenderParams)}
 */
function parityRenderer(name) {
    return args => {
        if (args.isHighlighted) {
            paintBackground(args);
            paintOutline(args);
        }
        const center = args.rect.paddedBy(-10);
        rectangle(args.painter, center, {fill: CanvasTheme.surface.gate});
        rectangle(args.painter, center, {stroke: {color: CanvasTheme.text.primary, width: 1}});
        rectangle(args.painter, center.paddedBy(-4).skipBottom(-6).skipTop(-6), {fill: CanvasTheme.surface.gate});
        fitLine(args.painter, name, center, {
            horizontal: 0.5,
            vertical: 0
        });
        fitLine(args.painter, 'par', center, {
            horizontal: 0.5,
            fill: CanvasTheme.text.muted,
            maxFontSize: 10,
            vertical: 1
        });
    }
}

Controls.XParityControl = new GateBuilder().
    setSerializedIdAndSymbol("xpar").
    setTitle("Parity Control (X)").
    setBlurb("Includes a qubit's X observable in the column parity control.\n" +
        "Gates in the same column only apply if an odd number of parity controls are satisfied.").
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    markAsControlExpecting('parity').
    setSetupCleanupEffectToUpdateFunc(
        ctx => {
            HalfTurnGates.H.customOperation(ctx);
            parityGatherScatter(ctx, true);
        },
        ctx => {
            parityGatherScatter(ctx, false);
            HalfTurnGates.H.customOperation(ctx);
        }).
    setRenderer(parityRenderer('X')).
    gate;

Controls.YParityControl = new GateBuilder().
    setSerializedIdAndSymbol("ypar").
    setTitle("Parity Control (Y)").
    setBlurb("Includes a qubit's Y observable in the column parity control.\n" +
        "Gates in the same column only apply if an odd number of parity controls are satisfied.").
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsStable().
    promiseEffectIsUnitary().
    markAsControlExpecting('parity').
    setSetupCleanupEffectToUpdateFunc(
        ctx => {
            GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXForward._knownMatrix);
            parityGatherScatter(ctx, true);
        },
        ctx => {
            parityGatherScatter(ctx, false);
            GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXBackward._knownMatrix);
        }).
    setRenderer(parityRenderer('Y')).
    gate;

Controls.ZParityControl = new GateBuilder().
    setSerializedIdAndSymbol("zpar").
    setTitle("Parity Control (Z)").
    setBlurb("Includes a qubit's Z observable in the column parity control.\n" +
        "Gates in the same column only apply if an odd number of parity controls are satisfied.").
    promiseHasNoNetEffectOnStateVector().
    markAsControlExpecting('parity').
    setSetupCleanupEffectToUpdateFunc(
        ctx => parityGatherScatter(ctx, true),
        ctx => parityGatherScatter(ctx, false)).
    setActualEffectToUpdateFunc(() => {}).
    promiseEffectIsUnitary().
    setRenderer(parityRenderer('Z')).
    gate;

Controls.all = [
    Controls.Control,
    Controls.AntiControl,
    Controls.XAntiControl,
    Controls.XControl,
    Controls.YAntiControl,
    Controls.YControl,
    Controls.XParityControl,
    Controls.YParityControl,
    Controls.ZParityControl,
];

export {Controls}
