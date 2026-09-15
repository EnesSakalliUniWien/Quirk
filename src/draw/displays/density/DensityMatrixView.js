import {Rendering} from '../../../config/Rendering.js';
import {paintMatrix} from '../complex/MatrixView.js';
import {paintMatrixTooltip} from '../../tooltips/MatrixTooltip.js';
import {fitText, drawText, measureText} from '../../text/TextLayout.js';
import {rectangle} from '../../shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {Rect} from '../../../geometry/Rect.js';
import {bin, Format} from '../../../base/Format.js';

const LABEL_FONT = {fontSize: 9, fontFamily: Typography.MONO_FONT_FAMILY};

/** One occupied rectangle for values, dividers, basis labels and cell lookup. */
export function densityGridRect(matrix, area) {
    const labelled = Math.min(area.w, area.h) >= 100;
    const bits = Math.round(Math.log2(matrix.height()));
    const inset = labelled ? Math.max(24, Math.ceil(measureText(bin(matrix.height()-1,bits), LABEL_FONT).width)+8) : 0;
    const footer = labelled ? 24 : 0;
    const side = Math.max(1, Math.min(area.w - inset, area.h - inset - footer));
    return new Rect(area.x + inset, area.y + inset, side, side);
}

export function paintDensityMatrix(painter, matrix, drawArea, focusPoints = [],
    backgroundColor = CanvasTheme.probability.background, fillColor = CanvasTheme.probability.fill) {
    const grid = densityGridRect(matrix, drawArea);
    rectangle(painter, drawArea, {fill: backgroundColor});
    paintMatrix(painter, matrix, grid, {
        density: true, backColor: backgroundColor,
        amplitudeCircleFillColor: fillColor, amplitudeCircleStrokeColor: CanvasTheme.probability.outline,
        amplitudeProbabilityFillColor: fillColor, phaseColorForDegrees: () => CanvasTheme.text.primary
    });
    if (grid.x > drawArea.x) {
        const dense = Math.log2(matrix.height()) > Rendering.MATRIX_DETAIL_MAX_QUBITS && grid.w / matrix.width() < 10;
        fitText(painter, dense ? 'Colour: phase' : 'Diagonal: probability', {
            x: drawArea.center().x, y: grid.bottom()+3, align: 'center', baseline: 'top',
            font: LABEL_FONT, width: drawArea.w-4, height: 10, fill: CanvasTheme.text.muted,
        });
        fitText(painter, dense ? 'Opacity: magnitude*' : 'Off-diagonal: coupling', {
            x: drawArea.center().x, y: grid.bottom()+14, align: 'center', baseline: 'top',
            font: LABEL_FONT, width: drawArea.w-4, height: 10, fill: CanvasTheme.text.muted,
        });
    }
    const n = Math.round(Math.log2(matrix.height()));
    if (grid.x > drawArea.x) paintBasisLabels(painter, matrix, grid, n);
    paintMatrixTooltip(painter, matrix, grid, focusPoints,
        (c, r) => c === r ? `Probability of |${bin(c, n)}⟩ (decimal ${c})` :
            `Coupling of |${bin(r, n)}⟩ to ⟨${bin(c, n)}| (decimal ${r} to ${c})`,
        (c, r, v) => c === r ? (v.real * 100).toFixed(4) + '%' : v.toString(new Format(false, 0, 6, ', ')),
        () => grid.w / matrix.width() < 10 ? '* Small magnitudes use a visibility floor; opacity is not probability.' :
            'Diagonal bars: probability; other entries: coupling.');
}

function paintBasisLabels(painter, matrix, grid, bits) {
    const cell = grid.w / matrix.width();
    const stride = Math.max(1, Math.ceil(Math.max(26, measureText(bin(matrix.width()-1,bits), LABEL_FONT).width+4) / cell));
    const font = LABEL_FONT;
    for (let i = 0; i < matrix.width(); i += stride) {
        // Sparse labels keep dense grids legible; the inspector names every selected basis state.
        const label = bin(i, bits);
        drawText(painter, label, {x: grid.x + (i+0.5)*cell, y: grid.y-5, align: 'center', font});
        drawText(painter, label, {x: grid.x-4, y: grid.y + (i+0.5)*cell, align: 'right', baseline: 'middle', font});
    }
}
