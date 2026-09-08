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
import {Simulation} from '../../config/Simulation.js';
import {Gate} from '../../circuit/model/Gate.js';
import {ketArgs, ketShaderPermute} from '../../engine/simulation/gpu/KetShaderUtil.js';
import {paintBackground, paintOutline, paintResizeTab} from '../../draw/gate/GateFrame.js';
import {PERMUTATION_DRAWER} from './PermutationDrawer.js';
import {Point} from '../../geometry/Point.js';

const InterleaveBitsGates = {};

/**
 * Transforms from a block bit position to a striped bit position.
 * @param {!int} bit
 * @param {!int} len
 * @returns {!int}
 */
function interleaveBit(bit, len) {
    const h = Math.ceil(len / 2);
    const group = Math.floor(bit / h);
    const stride = bit % h;
    return stride * 2 + group;
}

/**
 * Transforms from a striped bit position to a block bit position.
 * @param {!int} bit
 * @param {!int} len
 * @returns {!int}
 */
function deinterleaveBit(bit, len) {
    const h = Math.ceil(len / 2);
    const stride = Math.floor(bit / 2);
    const group = bit % 2;
    return stride + group * h;
}

/**
 * Constructs a shader that permutes bits based on the given function.
 * @param {!int} span
 * @param {!function(bit: !int, len: !int) : !int} bitPermutation
 * @return {!{withArgs: !function(args: ...!WglArg|!WglTexture) : !WglConfiguredShader}}
 */
function shaderFromBitPermutation(span, bitPermutation) {
    const bitMoveLines = [];
    for (let i = 0; i < span; i++) {
        bitMoveLines.push(`r += mod(floor(out_id / ${1 << bitPermutation(i, span)}.0), 2.0) * ${1 << i}.0;`);
    }

    return ketShaderPermute(
        '',
        `
            float r = 0.0;
            ${bitMoveLines.join(`
            `)}
            return r;
        `,
        span);
}

/**
 * @type {!Map.<!int, !{withArgs: !function(args: ...!WglArg|!WglTexture) : !WglConfiguredShader}>}
 */
const _interleaveShadersForSize = new Map(
    Array.from({length: Simulation.MAX_WIRE_COUNT - 1}, (_, i) => i + 2).
        map(k => [k, shaderFromBitPermutation(k, interleaveBit)]));

/**
 * @type {!Map.<!int, !{withArgs: !function(args: ...!WglArg|!WglTexture) : !WglConfiguredShader}>}
 */
const _deinterleaveShadersForSize = new Map(
    Array.from({length: Simulation.MAX_WIRE_COUNT - 1}, (_, i) => i + 2).
        map(k => [k, shaderFromBitPermutation(k, deinterleaveBit)]));

const interleavePainter = reverse => args => {
    if (args.positionInCircuit !== undefined) {
        PERMUTATION_DRAWER(args);
        return;
    }

    paintBackground(args);
    paintOutline(args);
    paintResizeTab(args);

    const x1 = args.rect.x + 6;
    const x2 = args.rect.right() - 6;
    const y = args.rect.center().y - Layout.GATE_RADIUS + 6;
    const dh = ((Layout.GATE_RADIUS - 6)*2 - 14) / 5;

    for (let i = 0; i < 6; i++) {
        const j = interleaveBit(i, 6);
        const yi = y + i*dh + Math.floor(i/3)*14;
        const yj = y + j*dh + Math.floor(j/2)*7;
        const [y1, y2] = reverse ? [yj, yi] : [yi, yj];
        strokePath(args.painter, [
            new Point(x1, y1),
            new Point(x1 + 8, y1),
            new Point(x2 - 8, y2),
            new Point(x2, y2)
        ], CanvasTheme.text.primary, 1);
    }
};

InterleaveBitsGates.InterleaveBitsGateFamily = Gate.buildFamily(4, 16, (span, builder) => builder.
    setSerializedId("weave" + span).
    setSymbol("Interleave").
    setTitle("Interleave").
    setBlurb("Re-orders blocks of bits into stripes of bits.").
    setWidth(span <= 8 ? 1 : 2).
    setDrawer(interleavePainter(false)).
    setActualEffectToShaderProvider(ctx => _interleaveShadersForSize.get(span).withArgs(...ketArgs(ctx, span))).
    setKnownEffectToBitPermutation(b => interleaveBit(b, span)));

InterleaveBitsGates.DeinterleaveBitsGateFamily = Gate.buildFamily(4, 16, (span, builder) => builder.
    setAlternateFromFamily(InterleaveBitsGates.InterleaveBitsGateFamily).
    setSerializedId("split" + span).
    setSymbol("Deinterleave").
    setTitle("Deinterleave").
    setBlurb("Re-orders stripes of bits into blocks of bits.").
    setWidth(span <= 8 ? 1 : 2).
    setDrawer(interleavePainter(true)).
    setActualEffectToShaderProvider(ctx => _deinterleaveShadersForSize.get(span).withArgs(...ketArgs(ctx, span))).
    setKnownEffectToBitPermutation(b => deinterleaveBit(b, span)));

InterleaveBitsGates.all = [
    ...InterleaveBitsGates.InterleaveBitsGateFamily.all,
    ...InterleaveBitsGates.DeinterleaveBitsGateFamily.all
];

export {
    InterleaveBitsGates,
    interleaveBit,
    deinterleaveBit
}
