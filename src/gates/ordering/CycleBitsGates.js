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

import {CanvasTheme} from '../../config/CanvasTheme.js';
import {strokePath} from '../../draw/pixi/ShapeView.js';

import {Layout} from '../../config/Layout.js';
import {Gate} from '../../circuit/model/Gate.js';
import {paintBackground, paintOutline, paintResizeTab} from '../../draw/gate/GateFrame.js';
import {PERMUTATION_DRAWER} from './PermutationDrawer.js';
import {ketArgs, ketShaderPermute} from '../../engine/simulation/gpu/KetShaderUtil.js';
import {Matrix} from '../../engine/math/matrix/Matrix.js';
import {Point} from '../../geometry/Point.js';
import {Util} from '../../base/Util.js';
import {WglArg} from '../../engine/webgl/shader/WglArg.js';

let CycleBitsGates = {};

/**
 * @param {!CircuitEvalContext} ctx
 * @param {!int} qubitSpan
 * @param {!int} shiftAmount
 * @returns {!WglConfiguredShader}
 */
let cycleBitsShader = (ctx, qubitSpan, shiftAmount) =>
    CYCLE_SHADER.withArgs(
        ...ketArgs(ctx, qubitSpan),
        WglArg.float("amount", 1 << Util.properMod(-shiftAmount, qubitSpan)));
const CYCLE_SHADER = ketShaderPermute(
    'uniform float amount;',
    'out_id *= amount; return mod(out_id, span) + floor(out_id / span);');

const makeCycleBitsPermutation = (shift, span) => e => {
    shift = Util.properMod(shift, span);
    return ((e << shift) & ((1 << span) - 1)) | (e >> (span - shift));
};
const makeCycleBitsMatrix = (shift, span) => Matrix.generateTransition(1<<span, makeCycleBitsPermutation(shift, span));

let cyclePainter = reverse => args => {
    if (args.positionInCircuit !== undefined) {
        PERMUTATION_DRAWER(args);
        return;
    }

    paintBackground(args);
    paintOutline(args);
    paintResizeTab(args);

    let x1 = args.rect.x + 6;
    let x2 = args.rect.right() - 6;
    let y = args.rect.center().y - Layout.GATE_RADIUS + 6;
    let dh = (Layout.GATE_RADIUS - 6)*2 / 2;

    for (let i = 0; i < 3; i++) {
        let j = (i + (reverse ? 2 : 1)) % 3;
        let y1 = y + i*dh;
        let y2 = y + j*dh;
        strokePath(args.painter, [
            new Point(x1, y1),
            new Point(x1 + 8, y1),
            new Point(x2 - 8, y2),
            new Point(x2, y2)
        ], CanvasTheme.text.primary, 1);
    }
};

CycleBitsGates.CycleBitsFamily = Gate.buildFamily(2, 16, (span, builder) => builder.
    setSerializedId("<<" + span).
    setSymbol("<<<").
    setTitle("Left Rotate").
    setBlurb("Rotates bits downward.").
    setDrawer(cyclePainter(false)).
    setTooltipMatrixFunc(() => makeCycleBitsMatrix(1, span)).
    setActualEffectToShaderProvider(ctx => cycleBitsShader(ctx, span, +1)).
    setKnownEffectToBitPermutation(i => (i + 1) % span));

CycleBitsGates.ReverseCycleBitsFamily = Gate.buildFamily(2, 16, (span, builder) => builder.
    setAlternateFromFamily(CycleBitsGates.CycleBitsFamily).
    setSerializedId(">>" + span).
    setSymbol(">>>").
    setTitle("Right Rotate").
    setBlurb("Rotates bits upward.").
    setDrawer(cyclePainter(true)).
    setTooltipMatrixFunc(() => makeCycleBitsMatrix(-1, span)).
    setActualEffectToShaderProvider(ctx => cycleBitsShader(ctx, span, -1)).
    setKnownEffectToBitPermutation(i => (i + span - 1) % span));

CycleBitsGates.all = [
    ...CycleBitsGates.CycleBitsFamily.all,
    ...CycleBitsGates.ReverseCycleBitsFamily.all
];

export {CycleBitsGates, cycleBitsShader, makeCycleBitsPermutation};
