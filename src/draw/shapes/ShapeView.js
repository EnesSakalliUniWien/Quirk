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

import {extend} from '@pixi/react';
import {drawGraphics} from '../scene/DisplayView.js';
import {Graphics, GraphicsPath} from 'pixi.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {PathGeometry} from './PathGeometry.js';
import {Appearance} from '../../appearance/Appearance.js';

/** Fixed shapes keep their GraphicsContext until geometry or colours change. */
class ShapeView extends Graphics {
    constructor() { super(); }
    set shape([kind, coordinates, {fill, stroke} = {}]) {
        const values = [kind, ...coordinates, fill, stroke?.color, stroke?.width];
        if (!this.values || values.length !== this.values.length || values.some((v, i) => !Object.is(v, this.values[i]))) {
            this.clear();
            this[kind](...coordinates);
            if (fill !== undefined) this.fill(fill);
            if (stroke !== undefined) this.stroke(stroke);
            this.values = values;
        }
    }
}

extend({ShapeView});

export function rectangle(view, r, style, radius) {
    return view.add('pixiShapeView', {shape: [radius === undefined ? 'rect' : 'roundRect',
        radius === undefined ? [r.x, r.y, r.w, r.h] : [r.x, r.y, r.w, r.h, radius], style]});
}

/**
 * A width for the canvas's structural lines - wires, gate outlines, frames, the highlight - that
 * never renders thinner than the same width in CSS pixels. The circuit is drawn in its own units and
 * scaled by the zoom, so below 100% a 1-unit line would shrink to a fraction of a pixel. Data
 * strokes belong to their picture and scale with it, so they don't use this.
 */
export function lineWidth(view, width) {
    return width * view.lineScale;
}

/** The 1px frame every container wears: displays, kets, output boxes, the resize tab. */
export function frame(view, r, color = CanvasTheme.stroke.frame) {
    return rectangle(view, r, {stroke: {color, width: lineWidth(view, Appearance.borders.width.regular)}});
}

/**
 * The 2px ring around whatever is hovered or dropped on. It sits just outside the element's 1px
 * outline instead of over it, on the rect grown by 1.5: element edges are snapped to .5, so that
 * also lands it on whole pixels.
 */
export function highlightRing(view, r) {
    const {regular, strong} = Appearance.borders.width;
    return rectangle(view, r.paddedBy(lineWidth(view, (regular + strong) / 2)),
        {stroke: {color: CanvasTheme.interaction.outline, width: lineWidth(view, strong)}});
}

export function circle(view, p, radius, style) {
    // Preserve the existing scientific marker's diameter convention.
    return view.add('pixiShapeView', {shape: ['circle', [p.x, p.y, Math.max(0, radius - 0.5)], style]});
}

export function polygon(view, points, style) {
    if (points.length) return drawPath(view, path => path.poly(points.flatMap(p => [p.x, p.y])), [style]);
}

/** A filled arrowhead at `tip`, pointing the way the line from `from` runs, in screen space. */
export function arrowHead(view, from, tip, color, radius) {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    return drawPath(view, path => PathGeometry.arrowHead(path, tip.x - Math.cos(angle) * radius * 0.5,
        tip.y - Math.sin(angle) * radius * 0.5, radius, angle, Math.PI / 2.6), [{fill: color}]);
}

export function strokePath(view, points, color = CanvasTheme.text.primary, width = Appearance.borders.width.regular, dash = []) {
    if (points.length) return drawPath(view, path => PathGeometry.polyline(path, points, dash), [{stroke: {color, width}}]);
}

export function drawPath(view, draw, styles) {
    const path = new GraphicsPath();
    draw(path);
    return drawGraphics(view, graphics => {
    for (const {fill, stroke} of styles) {
        // Pixi consumes a path after stroking; resubmit it for the phase halo and foreground.
        if (fill !== undefined) graphics.path(path).fill(fill);
        if (stroke !== undefined) graphics.path(path).stroke(stroke);
    }
    });
}
