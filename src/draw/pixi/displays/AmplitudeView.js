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
import {strokePath, rectangle} from '../ShapeView.js';

import {CanvasTheme, phaseColor} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {GatePainting} from '../../gate/GatePainting.js';
import {Format} from '../../../base/Format.js';
import {MathPainter} from '../../MathPainter.js';
import {Matrix} from '../../../engine/math/matrix/Matrix.js';
import {Point} from '../../../geometry/Point.js';
import {Rect} from '../../../geometry/Rect.js';
import {Util} from '../../../base/Util.js';

/**
 * @type {!function(!GateDrawParams)}
 */
const AMPLITUDE_DRAWER_FROM_CUSTOM_STATS = GatePainting.makeDisplayDrawer(args => {
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
    MathPainter.paintMatrix(
        args.painter,
        matrix,
        drawRect,
        CanvasTheme.amplitude.circle,
        CanvasTheme.text.primary,
        CanvasTheme.amplitude.fill,
        CanvasTheme.amplitude.background,
        phase => indicatorAlpha > 0 ? phaseColor(phase, indicatorAlpha) : undefined);

    const forceSign = v => (v >= 0 ? '+' : '') + v.toFixed(2);
    if (isIncoherent) {
        MathPainter.paintMatrixTooltip(args.painter, matrix, drawRect, args.focusPoints,
            (c, r) => `Chance of |${Util.bin(r*matrix.width() + c, args.gate.height)}⟩ (decimal ${r*matrix.width() + c}) [amplitude not defined]`,
            (c, r, v) => `raw: ${(v.norm2()*100).toFixed(4)}%, log: ${(Math.log10(v.norm2())*10).toFixed(1)} dB`,
            (c, r, v) => '[entangled with other qubits]');
    } else {
        MathPainter.paintMatrixTooltip(args.painter, matrix, drawRect, args.focusPoints,
            (c, r) => `Amplitude of |${Util.bin(r*matrix.width() + c, args.gate.height)}⟩ (decimal ${r*matrix.width() + c})`,
            (c, r, v) => 'val:' + v.toString(new Format(false, 0, 5, ", ")),
            (c, r, v) => `mag²:${(v.norm2()*100).toFixed(4)}%, phase:${forceSign(v.phase() * 180 / Math.PI)}°`);
        if (phaseLockIndex !== undefined && indicatorAlpha > 0) {
            const cw = drawRect.w/matrix.width();
            const rh = drawRect.h/matrix.height();
            const c = phaseLockIndex % matrix.width();
            const r = Math.floor(phaseLockIndex / matrix.width());
            const cx = drawRect.x + cw*(c+0.5);
            const cy = drawRect.y + rh*(r+0.5);
            strokePath(args.painter, [new Point(cx, cy), new Point(cx + cw/2, cy)], CanvasTheme.amplitude.reference, 2);
            fitText(args.painter, 'fixed', {
                x: cx + 0.5*cw,
                y: cy,
                align: 'right',
                baseline: 'bottom',
                fill: CanvasTheme.amplitude.reference,
                font: {fontSize: 12, fontFamily: Typography.MONO_FONT_FAMILY},
                width: cw*0.5,
                height: rh*0.5,
                beforeDraw: (w, h) => rectangle(args.painter, new Rect(cx + cw/2 - w, cy - h, w, h), {fill: CanvasTheme.surface.gate})
            });
        }
    }

    paintErrorIfPresent(args, indicatorAlpha);
});

/**
 * @param {!GateDrawParams} args
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

export {AMPLITUDE_DRAWER_FROM_CUSTOM_STATS};
