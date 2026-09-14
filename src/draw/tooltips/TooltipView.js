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

import {createElement} from 'react';
import {DisplayView} from '../scene/DisplayView.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {Rect} from '../../geometry/Rect.js';
import {rectangle} from '../shapes/ShapeView.js';
import {measureText, fitText} from '../text/TextLayout.js';

/** A separate final layer lets Pixi handle tooltip ordering and coordinate conversion. */
export class TooltipLayer {
    static forView(view) {
        if (!view.tooltips) {
            let root = view;
            while (root.parent instanceof DisplayView) root = root.parent;
            root.tooltips ??= new TooltipLayer(root);
            view.tooltips = root.tooltips;
        }
        return view.tooltips;
    }
    constructor(root) { this.root = root; this.pending = []; }
    begin() { this.pending = []; }
    show(source, content) { this.pending.push({source, content}); }
    flush() {} // The React scene builds tooltips after source refs have committed.
    get children() { return this.native?.children ?? []; }
    element(requests, stage) {
        const children = requests.map(({source, content}, i) => {
            const view = new TooltipView(this.root.canvas, this.root.rng, this.root.pixelRatio);
            const point = stage.toLocal(source.native.toGlobal(content));
            view.update({...content, x: point.x, y: point.y});
            return view.element(i);
        });
        return createElement('pixiSceneContainer', {key: 'tooltips', ref: node => {this.native = node;}}, children);
    }
}

class TooltipView extends DisplayView {
    update({x, y, labelText, valueText, valueText2, backColor = CanvasTheme.probability.background}) {
        const labelFont = {fontSize: 12, fontFamily: Typography.DEFAULT_FONT_FAMILY};
        const valueFont = {fontSize: 12, fontFamily: Typography.MONO_FONT_FAMILY, fontWeight: 'bold'};
        const lines = [{text: labelText, font: labelFont}, {text: valueText, font: valueFont}];
        if (valueText2 !== undefined) lines.push({text: valueText2, font: valueFont});
        const width = Math.max(...lines.map(line => measureText(line.text, line.font).width));
        const viewport = new Rect(0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio);
        const bounds = new Rect(x, y - lines.length*20, width, lines.length*20).snapInside(viewport.paddedBy(-5));
        this.bounds = bounds.paddedBy(4);
        rectangle(this, this.bounds, {fill: backColor, stroke: {color: CanvasTheme.text.primary, width: 1}});
        for (const [i, line] of lines.entries()) {
            fitText(this, line.text, {
                x: bounds.x,
                y: bounds.y + (i + 1)*20,
                align: 'left',
                baseline: 'bottom',
                fill: CanvasTheme.text.primary,
                font: line.font,
                width: bounds.w,
                height: 20
            });
        }
    }
}
