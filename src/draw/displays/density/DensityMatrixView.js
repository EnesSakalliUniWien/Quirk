import {drawsAsPixels, paintMatrix, paintPhaseKey} from '../complex/MatrixView.js';
import {paintMatrixTooltip} from '../../tooltips/MatrixTooltip.js';
import {fitText, drawText, measureText} from '../../text/TextLayout.js';
import {rectangle, strokePath} from '../../shapes/ShapeView.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {Point} from '../../../geometry/Point.js';
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
    const pixels = !matrix.hasNaN() && drawsAsPixels(matrix.width(), matrix.height(), grid);
    rectangle(painter, drawArea, {fill: backgroundColor});
    paintMatrix(painter, matrix, grid, {
        density: true, backColor: backgroundColor,
        amplitudeCircleFillColor: fillColor, amplitudeCircleStrokeColor: CanvasTheme.probability.outline,
        amplitudeProbabilityFillColor: fillColor, phaseColorForDegrees: () => CanvasTheme.text.primary
    });
    // Pixels have no diagonal bars, so the diagonal that holds the probabilities is outlined instead.
    if (pixels) paintDiagonalOutline(painter, matrix, grid);
    if (grid.x > drawArea.x) {
        const caption = (text, y) => fitText(painter, text, {
            x: drawArea.center().x, y, align: 'center', baseline: 'top',
            font: LABEL_FONT, width: drawArea.w-4, height: 10, fill: CanvasTheme.text.muted,
        });
        if (pixels) {
            paintPhaseKey(painter, new Rect(grid.x, grid.bottom()+3, grid.w, 10));
            caption('Opacity: magnitude vs largest · outlined: diagonal', grid.bottom()+14);
        } else {
            caption('Diagonal: probability', grid.bottom()+3);
            caption('Off-diagonal: coupling', grid.bottom()+14);
        }
    }
    const n = Math.round(Math.log2(matrix.height()));
    if (grid.x > drawArea.x) paintBasisLabels(painter, matrix, grid, n);
    paintMatrixTooltip(painter, matrix, grid, focusPoints,
        (c, r) => c === r ? `Probability of |${bin(c, n)}⟩ (decimal ${c})` :
            `Coupling of |${bin(r, n)}⟩ to ⟨${bin(c, n)}| (decimal ${r} to ${c})`,
        (c, r, v) => c === r ? (v.real * 100).toFixed(4) + '%' : v.toString(new Format(false, 0, 6, ', ')),
        () => pixels ? 'Opacity is magnitude relative to the largest entry; the outlined diagonal holds probabilities.' :
            'Diagonal bars: probability; other entries: coupling.');
}

/** Traces the diagonal cells along their edges, so the outline marks them without covering one. */
function paintDiagonalOutline(painter, matrix, grid) {
    const cell = grid.w / matrix.width();
    const at = (column, row) => new Point(grid.x + column*cell, grid.y + row*cell);
    const above = [];
    const below = [];
    for (let i = 0; i < matrix.width(); i++) {
        above.push(at(i, i), at(i+1, i));
        below.push(at(i, i), at(i, i+1));
    }
    const end = at(matrix.width(), matrix.width());
    strokePath(painter, [...above, end], CanvasTheme.stroke.guide);
    strokePath(painter, [...below, end], CanvasTheme.stroke.guide);
}

function paintBasisLabels(painter, matrix, grid, bits) {
    const cell = grid.w / matrix.width();
    const font = LABEL_FONT;
    // A column label needs its width but a row label only its height, so rows stay fully labelled
    // longer. Sparse labels keep dense grids legible; the inspector names every selected basis state.
    const columnStride = Math.max(1, Math.ceil((measureText(bin(matrix.width()-1, bits), font).width + 4) / cell));
    const rowStride = Math.max(1, Math.ceil((font.fontSize + 3) / cell));
    for (let i = 0; i < matrix.width(); i += columnStride) {
        drawText(painter, bin(i, bits), {x: grid.x + (i+0.5)*cell, y: grid.y-5, align: 'center', font});
    }
    for (let i = 0; i < matrix.height(); i += rowStride) {
        drawText(painter, bin(i, bits), {x: grid.x-4, y: grid.y + (i+0.5)*cell, align: 'right', baseline: 'middle', font});
    }
}
