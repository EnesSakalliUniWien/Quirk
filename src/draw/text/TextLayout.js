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

import './LabelView.js';
import {CanvasTextMetrics, TextStyle} from 'pixi.js';
import {Typography} from '../../config/Typography.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Rect} from '../../geometry/Rect.js';
import {Point} from '../../geometry/Point.js';

const DEFAULT_FONT = {fontSize: Typography.DEFAULT_FONT_SIZE, fontFamily: Typography.DEFAULT_FONT_FAMILY};
export let textLayoutVersion = 0;
export function invalidateTextLayout() {
    CanvasTextMetrics.clearMetrics();
    textLayoutVersion++;
}

export function measureText(text, font = DEFAULT_FONT) {
    return CanvasTextMetrics.measureText(String(text), new TextStyle({...font, padding: 2}));
}

export function drawText(view, text, {x = 0, y = 0, fill = CanvasTheme.text.primary, font = DEFAULT_FONT,
        align = 'left', baseline = 'alphabetic', scale = 1, stroke} = {}) {
    const {ascent, descent} = measureText(text, font).fontProperties;
    const anchor = [align === 'center' ? 0.5 : align === 'right' || align === 'end' ? 1 : 0,
        baseline === 'middle' ? 0.5 : baseline === 'bottom' ? 1 : baseline === 'alphabetic' ? ascent / (ascent + descent) : 0];
    return view.add('pixiLabelView', {label: [text, font, fill, view.pixelRatio, stroke, textLayoutVersion],
        anchor: {x: anchor[0], y: anchor[1]}, x, y, scale});
}

/** The application's single-line fitting convention also sizes the opaque plate behind a label. */
export function fitText(view, text, {x = 0, y = 0, align = 'left', baseline = 'alphabetic',
        fill = CanvasTheme.text.primary, font = DEFAULT_FONT, width = Infinity, height = Infinity, beforeDraw, stroke} = {}) {
    const metrics = measureText(text, font);
    const naturalHeight = measureText('0', font).width * 2.5;
    const scale = Math.min(width / (metrics.width || 1), height / (naturalHeight || 1), 1);
    beforeDraw?.(metrics.width * scale, naturalHeight * scale);
    return drawText(view, text, {
        x,
        y,
        fill,
        font,
        align,
        baseline,
        scale,
        stroke
    });
}

function fit(text, area, maxFontSize, fontFamily, wrap) {
    for (let fontSize = maxFontSize; ; fontSize--) {
        const font = {fontSize, fontFamily, wordWrap: wrap, wordWrapWidth: area.w, breakWords: true};
        const metrics = measureText(text, font);
        const {ascent, descent} = metrics.fontProperties;
        const height = wrap ? (ascent + descent) * metrics.lines.length : ascent + descent;
        if ((metrics.width <= area.w && height <= area.h) || fontSize <= 4) return {font, metrics, height};
    }
}

export function fitParagraph(view, text, area, {alignment = new Point(0, 0), fill = CanvasTheme.text.default,
        maxFontSize = Typography.DEFAULT_FONT_SIZE, fontFamily = Typography.DEFAULT_FONT_FAMILY} = {}) {
    const {font, metrics, height} = fit(text, area, maxFontSize, fontFamily, true);
    const x = area.x + (area.w - metrics.width) * alignment.x;
    const y = area.y + (area.h - height) * alignment.y;
    const lineHeight = metrics.fontProperties.ascent + metrics.fontProperties.descent;
    drawText(view, text, {
        x,
        y,
        fill,
        font: {...font, lineHeight,
        align: alignment.x === 1 ? 'right' : alignment.x === 0.5 ? 'center' : 'left'},
        align: 'left',
        baseline: 'top'
    });
    return new Rect(x, y, metrics.width, height);
}

export function fitLine(view, text, area, {horizontal = 0, fill = CanvasTheme.text.default,
        maxFontSize = Typography.DEFAULT_FONT_SIZE, fontFamily = Typography.DEFAULT_FONT_FAMILY, vertical} = {}) {
    const {font, metrics, height} = fit(text, area, maxFontSize, fontFamily, false);
    const x = area.x + (area.w - metrics.width) * horizontal;
    const y = area.y + (area.h - height) * (vertical ?? metrics.fontProperties.ascent / height);
    drawText(view, text, {
        x,
        y: y + metrics.fontProperties.ascent,
        fill,
        font
    });
    return new Rect(x, y, metrics.width, height);
}
