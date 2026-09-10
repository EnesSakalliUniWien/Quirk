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

import {fitText} from '../TextLayout.js';

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {GatePainting} from '../../gate/GatePainting.js';
import {Matrix} from '../../../engine/math/matrix/Matrix.js';
import {DATA_RENDERERS} from '../../renderers/dataRenderers.js';

/**
 * @type {!function(!GateRenderParams)}
 */
const AMPLITUDE_RENDERER_FROM_CUSTOM_STATS = GatePainting.makeDisplayRenderer(args => {
    const n = args.gate.height;
    const {quality, ket, phaseLockIndex, incoherentKet} = args.customStats || {
        ket: (n === 1 ? Matrix.zero(2, 1) : Matrix.zero(1 << Math.floor(n / 2), 1 << Math.ceil(n / 2))).times(NaN),
        quality: 1,
        phaseLockIndex: 0,
        incoherentKet: undefined
    };

    const isIncoherent = quality < 0.99;
    const matrix = isIncoherent ? incoherentKet : ket;
    const dw = args.rect.w - args.rect.h*ket.width()/ket.height();
    const drawRect = args.rect.skipLeft(dw/2).skipRight(dw/2);
    const indicatorAlpha = Math.min(1, Math.max(0, (quality - 0.9999) / 0.0001));
    // The drawing is the shared state renderer's (src/draw/renderers/dataRenderers.js); this gate
    // only decides which amplitudes, where, and how sure it is of their phases.
    DATA_RENDERERS.state(args.painter, matrix, drawRect, {
        wireCount: args.gate.height,
        focusPoints: args.focusPoints,
        coherent: !isIncoherent,
        indicatorAlpha,
        phaseLockIndex,
    });

    paintErrorIfPresent(args, indicatorAlpha);
});

/**
 * @param {!GateRenderParams} args
 * @param {!number} indicatorAlpha
 */
function paintErrorIfPresent(args, indicatorAlpha) {
    /** @type {undefined|!string} */
    let err = undefined;
    const {col, row} = args.positionInCircuit;
    const measured = ((args.stats.circuitDefinition.colIsMeasuredMask(col) >> row) & ((1 << args.gate.height) - 1)) !== 0;
    if (measured) {
        err = args.gate.width <= 2 ? '(w/ measure defer)' : '(assuming measurement deferred)';
    } else if (indicatorAlpha < 0.999) {
        err = 'incoherent';
    }
    if (err !== undefined) {
        fitText(args.painter, err, {
            x: args.rect.x+args.rect.w/2,
            y: args.rect.y+args.rect.h,
            align: 'center',
            baseline: 'hanging',
            fill: CanvasTheme.error.text,
            font: {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: args.rect.w,
            height: args.rect.h
        });
    }
}

export {AMPLITUDE_RENDERER_FROM_CUSTOM_STATS};
