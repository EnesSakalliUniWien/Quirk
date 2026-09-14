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

import {drawPath, rectangle, circle, strokePath} from '../../draw/shapes/ShapeView.js';
import {fitLine, fitText} from '../../draw/text/TextLayout.js';

import {GateBuilder} from '../../circuit/model/Gate.js';
import {amplitudesToProbabilities} from '../displays/ProbabilityDisplay.js';
import {WglTexturePool} from '../../engine/webgl/texture/WglTexturePool.js';
import {WglTextureTrader} from '../../engine/webgl/texture/WglTextureTrader.js';
import {Shaders} from '../../engine/webgl/shader/Shaders.js';
import {currentShaderCoder, Inputs, makePseudoShaderWithInputsAndOutputAndCode, Outputs} from '../../engine/webgl/coder/ShaderCoders.js';
import {CircuitShaders} from '../../engine/simulation/gpu/CircuitShaders.js';
import {Controls} from '../../circuit/model/Controls.js';
import {WglArg} from '../../engine/webgl/shader/WglArg.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {paintOutline} from '../../draw/gate/GateFrame.js';

import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {GateShaders} from '../../engine/simulation/gpu/GateShaders.js';
import {Point} from '../../geometry/Point.js';
import {DetailedError} from '../../base/DetailedError.js';
import {QuarterTurnGates} from '../rotations/QuarterTurnGates.js';
import {HalfTurnGates} from '../rotations/HalfTurnGates.js';

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!Controls} controls
 * @returns {!WglTexture}
 */
function controlMaskTex(ctx, controls) {
    const powerSize = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ctx.stateTrader.currentTexture);
    return CircuitShaders.controlMask(controls).toBoolTexture(powerSize);
}

/**
 * Prepares a 1x1 texture containing the total squared-magnitude of states matching the given controls.
 * @param {!WglTexture} ketTexture
 * @param {!WglTexture} controlMaskTex
 * @param {!boolean} forStats
 * @returns {!WglTexture}
 */
function textureWithTotalWeightMatchingGivenControls(ketTexture, controlMaskTex, forStats=false) {
    const powerSize = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ketTexture);

    // Convert the matching amplitudes to probabilities (and the non-matching ones to 0).
    const trader = new WglTextureTrader(ketTexture);
    trader.dontDeallocCurrentTexture();
    trader.shadeAndTrade(
        tex => amplitudesToProbabilities(tex, controlMaskTex),
        WglTexturePool.takeVecFloatTex(powerSize));

    // Sum the probabilities.
    let n = currentShaderCoder().vec2.arrayPowerSizeOfTexture(ketTexture);
    while (n > 0) {
        n -= 1;
        trader.shadeHalveAndTrade(Shaders.sumFoldFloat);
    }

    trader.shadeAndTrade(Shaders.packFloatIntoVec4, WglTexturePool.takeVec4Tex(0));
    return trader.currentTexture;
}

/**
 * @param {!CircuitEvalContext} ctx
 * @returns {!WglTexture}
 */
function detectorStatTexture(ctx) {
    const mask = controlMaskTex(ctx, ctx.controls.and(Controls.bit(ctx.row, true)));
    try {
        return textureWithTotalWeightMatchingGivenControls(ctx.stateTrader.currentTexture, mask, true);
    } finally {
        mask.deallocByDepositingInPool('textureWithTotalWeightMatchingPositiveMeasurement:mask')
    }
}

/**
 * Discards states that don't meet the detection result.
 */
const detectorShader = makePseudoShaderWithInputsAndOutputAndCode(
    [
        Inputs.float('total_weight'),
        Inputs.float('detection_weight'),
        Inputs.bool('classification'),
        Inputs.vec2('ket'),
    ],
    Outputs.vec2(),
    `
        uniform float rnd;

        vec2 outputFor(float k) {
            float detectChance = read_detection_weight(0.0) / read_total_weight(0.0);
            float detection_type = float(rnd < detectChance);
            float own_type = read_classification(k);
            if (detection_type == own_type) {
                float matchChance = detectChance * own_type + (1.0 - own_type) * (1.0 - detectChance);
                return read_ket(k) / sqrt(matchChance);
            } else {
                return vec2(0.0, 0.0);
            }
        }
    `);

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!string} axis
 * @param {!boolean} inverse
 */
function switchToBasis(ctx, axis, inverse) {
    switch (axis) {
        case 'X':
            GateShaders.applyMatrixOperation(ctx, HalfTurnGates.H.knownMatrixAt(0));
            break;
        case 'Y':
            if (inverse) {
                GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXBackward.knownMatrixAt(0));
            } else {
                GateShaders.applyMatrixOperation(ctx, QuarterTurnGates.SqrtXForward.knownMatrixAt(0));
            }
            break;
        case 'Z':
            break; // Already in the right basis.
        default:
            throw new DetailedError('Unrecognized axis.', {axis});
    }

}
/**
 * Applies a sample measurement operation to the state.
 * @param {!CircuitEvalContext} ctx
 */
function sampleMeasure(ctx) {
    const maskAll = controlMaskTex(ctx, Controls.NONE);
    const maskMatch = controlMaskTex(ctx, ctx.controls.and(Controls.bit(ctx.row, true)));
    const weightAll = textureWithTotalWeightMatchingGivenControls(ctx.stateTrader.currentTexture, maskAll);
    const weightMatch = textureWithTotalWeightMatchingGivenControls(ctx.stateTrader.currentTexture, maskMatch);

    ctx.applyOperation(detectorShader(
        weightAll,
        weightMatch,
        maskMatch,
        ctx.stateTrader.currentTexture,
        WglArg.float('rnd', ctx.random())));

    weightMatch.deallocByDepositingInPool();
    weightAll.deallocByDepositingInPool();
    maskMatch.deallocByDepositingInPool();
    maskAll.deallocByDepositingInPool();
}

/**
 * @param {!GateRenderParams} args
 * @param {!string} axis
 */
function drawDetector(args, axis) {
    drawHighlight(args);
    drawWedge(args, axis);
    drawClick(args, axis);
}

/**
 * @param {!GateRenderParams} args
 */
function drawHighlight(args) {
    // Can't use the typical highlight function because the detector has no box outline.
    if (args.isHighlighted) {
        rectangle(args.painter, args.rect, {fill: CanvasTheme.gate.hover});
        paintOutline(args);
    }
}

/**
 * @param {!GateRenderParams} args
 * @param {!string} axis
 */
function drawWedge(args, axis) {
    // Draw semi-circle wedge.
    const τ = Math.PI * 2;
    const r = Math.min(args.rect.h / 2, args.rect.w) - 1;
    let {x, y} = args.rect.center();
    x -= r*0.5;
    x += 0.5;
    y += 0.5;
    drawPath(args.painter, trace => {
        trace.arc(x, y, r, τ*3/4, τ/4);
        trace.lineTo(x, y - r - 1);
    }, [{stroke: {color: CanvasTheme.text.primary, width: 2}}, {fill: CanvasTheme.gate.time}]);
    fitLine(args.painter, axis, args.rect, {
        horizontal: 0.5,
        vertical: 0.5
    });
}

/**
 * @param {!GateRenderParams} args
 * @param {undefined|!string} axis
 */
function drawClick(args, axis) {
    // Draw tilted "*click*" text.
    const clicked = args.customStats;
    if (!clicked) {
        return;
}
    const r = Math.min(args.rect.h / 2, args.rect.w);
    args.painter.group('click-label-' + args.painter.order, painter => {
        painter.position.set(args.rect.center().x, args.rect.center().y);
        painter.rotation = axis === undefined ? Math.PI / 3 : Math.PI / 4;
        const stroke = {
            color: CanvasTheme.surface.background,
            width: 3
        };
        fitText(painter, '*click*', {
            x: 0,
            y: axis === undefined ? 0 : -5,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {
                fontSize: 16,
                fontFamily: Typography.DEFAULT_FONT_FAMILY,
                fontWeight: 'bold'
            },
            width: r * 2.8,
            height: r * 2.8,
            stroke
        });
        if (axis !== undefined) {
            fitText(painter, axis, {
                x: 0,
                y: 10,
                align: 'center',
                baseline: 'middle',
                fill: CanvasTheme.text.primary,
                font: {
                    fontSize: 16,
                    fontFamily: Typography.DEFAULT_FONT_FAMILY,
                    fontWeight: 'bold'
                },
                width: r * 2.8,
                height: r * 2.8,
                stroke
            });
        }
    });
}

/**
 * @param {!GateRenderParams} args
 * @param {!string} axis
 */
function drawControlBulb(args, axis) {
    redrawControlWires(args);
    const p = args.rect.center();
    switch (axis) {
        case 'X':
            circle(args.painter, p, 5, {fill: CanvasTheme.surface.gate});
            circle(args.painter, p, 5, {stroke: {color: CanvasTheme.text.primary, width: 1}});
            strokePath(args.painter, [p.offsetBy(0, -5), p.offsetBy(0, +5)], CanvasTheme.text.primary, 1);
            strokePath(args.painter, [p.offsetBy(-5, 0), p.offsetBy(+5, 0)], CanvasTheme.text.primary, 1);
            break;
        case 'Y': {
            circle(args.painter, p, 5, {fill: CanvasTheme.surface.gate});
            circle(args.painter, p, 5, {stroke: {color: CanvasTheme.text.primary, width: 1}});
            const r = 5*Math.sqrt(0.5)*1.1;
            strokePath(args.painter, [p.offsetBy(+r, -r), p.offsetBy(-r, +r)], CanvasTheme.text.primary, 1);
            strokePath(args.painter, [p.offsetBy(-r, -r), p.offsetBy(+r, +r)], CanvasTheme.text.primary, 1);
            break;
        }
        case 'Z':
            circle(args.painter, p, 5, {fill: CanvasTheme.text.primary});
            break;
        default:
            throw new DetailedError('Unrecognized axis.', {axis});
    }
}

/**
 * @param {!GateRenderParams} args
 * @param {!string} axis
 */
function drawDetectClearReset(args, axis) {
    const fullRect = args.rect;
    const detectorRect = fullRect.leftHalf();
    const resetRect = fullRect.rightHalf();

    // Draw background.
    const clearWireRect = fullRect.rightHalf();
    clearWireRect.y += clearWireRect.h / 2 - 2;
    clearWireRect.h = 5;
    rectangle(args.painter, clearWireRect, {fill: CanvasTheme.surface.background});
    drawHighlight(args);

    // Draw text elements.
    fitLine(args.painter, '|0⟩', resetRect, {
        horizontal: 1,
        vertical: 0.5
    });

    // Draw detector.
    args.rect = detectorRect;
    drawWedge(args, axis);

    args.rect = fullRect;
    drawControlBulb(args, axis);
    args.rect = detectorRect;
    drawClick(args, undefined);

    args.rect = fullRect;
}

/**
 * @param {!GateRenderParams} args
 */
function redrawControlWires(args) {
    if (args.positionInCircuit === undefined || args.isHighlighted) {
        return;
    }
    const painter = args.painter;
    const columnIndex = args.positionInCircuit.col;
    const x = Math.round(args.rect.center().x - 0.5) + 0.5;

    // Dashed line indicates effects from non-unitary gates may affect, or appear to affect, other wires.
    const circuit = args.stats.circuitDefinition;
    if (circuit.columns[columnIndex].hasGatesWithGlobalEffects()) {
        painter.group('global-control-' + painter.order, painter => {
            strokePath(painter, [new Point(x, args.rect.y), new Point(x, args.rect.bottom())], CanvasTheme.text.primary, 1, [1, 4]);
        });
    }

    const row = args.positionInCircuit.row;
    for (const {first, last, measured} of circuit.controlLinesRanges(columnIndex)) {
        if (first <= row && row <= last) {
            const y1 = first === row ? args.rect.center().y : args.rect.y;
            const y2 = last === row ? args.rect.center().y : args.rect.bottom();
            if (measured) {
                strokePath(painter, [new Point(x + 1, y1), new Point(x + 1, y2)], CanvasTheme.text.primary, 1);
                strokePath(painter, [new Point(x - 1, y1), new Point(x - 1, y2)], CanvasTheme.text.primary, 1);
            } else {
                strokePath(painter, [new Point(x, y1), new Point(x, y2)], CanvasTheme.text.primary, 1);
            }
        }
    }
}

/**
 * @param {!function(!CircuitEvalContext) : T} func
 * @returns {!function(!CircuitEvalContext) : T}
 * @template T
 */
function withClearedControls(func) {
    return ctx => {
        const controls = ctx.controls;
        const texture = ctx.controlsTexture;
        try {
            ctx.controls = Controls.NONE;
            ctx.controlsTexture = controlMaskTex(ctx, ctx.controls);
            return func(ctx);
        } finally {
            ctx.controlsTexture.deallocByDepositingInPool('withClearedControls');
            ctx.controlsTexture = texture;
            ctx.controls = controls;
        }
    };
}

/**
 * @param {!string} axis
 * @returns {!Gate}
 */
function makeDetectControlClearGate(axis) {
    const builder = new GateBuilder().
        setSerializedIdAndSymbol(`${axis}DetectControlReset`).
        setTitle(`${axis} Detect-Control-Reset`).
        setBlurb(`Does a sampled ${axis}-axis measurement.\nControls operations with the result.\nResets the target to |0⟩.`).
        setRenderer(args => drawDetectClearReset(args, axis)).
        markAsControlExpecting(true, true).
        markAsReachingOtherWires().
        setActualEffectToUpdateFunc(() => {}).
        setStatTexturesMaker(withClearedControls(detectorStatTexture)).
        setSetupCleanupEffectToUpdateFunc(
            withClearedControls(ctx => {
                switchToBasis(ctx, axis, false);
                sampleMeasure(ctx);
            }),
            withClearedControls(ctx => {
                GateShaders.applyMatrixOperation(ctx, Matrix.square(1, 1, 0, 0));
            })).
        setStatPixelDataPostProcessor((pixels, circuit, row, col) => pixels[0] > 0);
    if (axis === 'Z') {
        builder.promiseEffectIsDiagonal();
        builder.setMeasureEffect("collapse");
    }
    return builder.gate;
}

/**
 * @param {!string} axis
 * @returns {!Gate}
 */
function makeDetector(axis) {
    const state = new Map([
        ['X', '|0⟩-|1⟩'],
        ['Y', '|0⟩-i|1⟩'],
        ['Z', '|1⟩'],
    ]).get(axis);
    const builder = new GateBuilder().
        setSerializedIdAndSymbol(`${axis}Detector`).
        setTitle(`${axis} Axis Detector`).
        setBlurb(
            `Sampled ${axis}-axis measurement.\n` +
            `Shows *click* when the target qubit is ${state} and controls are satisfied.`).
        setRenderer(args => drawDetector(args, axis)).
        markAsReachingOtherWires().
        setSetupCleanupEffectToUpdateFunc(
            ctx => switchToBasis(ctx, axis, false),
            ctx => switchToBasis(ctx, axis, true)).
        setActualEffectToUpdateFunc(sampleMeasure).
        setStatTexturesMaker(detectorStatTexture).
        setStatPixelDataPostProcessor((pixels, circuit, row, col) => pixels[0] > 0);
    if (axis === 'Z') {
        builder.promiseEffectIsDiagonal();
        builder.setMeasureEffect("collapse");
    }
    return builder.gate;
}

const Detectors = {};

Detectors.XDetector = makeDetector('X');
Detectors.YDetector = makeDetector('Y');
Detectors.ZDetector = makeDetector('Z');

Detectors.XDetectControlClear = makeDetectControlClearGate('X');
Detectors.YDetectControlClear = makeDetectControlClearGate('Y');
Detectors.ZDetectControlClear = makeDetectControlClearGate('Z');

Detectors.all = [
    Detectors.XDetector,
    Detectors.YDetector,
    Detectors.ZDetector,
    Detectors.XDetectControlClear,
    Detectors.YDetectControlClear,
    Detectors.ZDetectControlClear,
];

export {Detectors}
