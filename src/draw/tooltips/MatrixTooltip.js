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

import {Rectangle} from 'pixi.js';
import {Rect} from '../../geometry/Rect.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {rectangle} from '../shapes/ShapeView.js';
import {TooltipLayer} from './TooltipView.js';

export function paintMatrixTooltip(
        painter,
        matrix,
        drawArea,
        focusPoints,
        titleFunc,
        valueTextFunc1,
        valueTextFunc2 = () => undefined) {
    const numCols = matrix.width();
    const numRows = matrix.height();
    const {x, y} = drawArea;
    const diam = Math.min(drawArea.w / numCols, drawArea.h / numRows);
    // One native hover region per matrix. Pixi pointer events supply focusPoints through the editor.
    // Cell lookup stays constant-time and also supports offscreen rendering.
    painter.add('pixiSceneContainer', {
        eventMode: 'static', hitArea: new Rectangle(x, y, diam * numCols, diam * numRows)
    });
    for (const pt of focusPoints) {
        const c = Math.floor((pt.x - x) / diam);
        const r = Math.floor((pt.y - y) / diam);
        if (c >= 0 && c < matrix.width() && r >= 0 && r < matrix.height()) {
            rectangle(painter, new Rect(x + diam*c, y + diam*r, diam, diam), {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
            const v = matrix.cell(c, r);
            TooltipLayer.forView(painter).show(painter, {
                x: x + diam*c + diam,
                y: y + diam*r,
                labelText: titleFunc(c, r),
                valueText: valueTextFunc1(c, r, v),
                valueText2: valueTextFunc2(c, r, v)
            });
        }
    }
}
