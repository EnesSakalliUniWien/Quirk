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

import {Graphics, GraphicsPath} from 'pixi.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {PathGeometry} from './PathGeometry.js';

/** Fixed shapes keep their GraphicsContext until geometry or colours change. */
class ShapeView extends Graphics {
    update(kind, coordinates, {fill, stroke} = {}) {
        const values = [kind, ...coordinates, fill, stroke?.color, stroke?.width];
        if (!this.values || values.length !== this.values.length || values.some((v, i) => !Object.is(v, this.values[i]))) {
            this.clear();
            this[kind](...coordinates);
            if (fill !== undefined) this.fill(fill);
            if (stroke !== undefined) this.stroke(stroke);
            this.values = values;
        }
        return this;
    }
}

export function rectangle(view, r, style, radius) {
    return view.use(ShapeView).update(radius === undefined ? 'rect' : 'roundRect',
        radius === undefined ? [r.x, r.y, r.w, r.h] : [r.x, r.y, r.w, r.h, radius], style);
}

export function circle(view, p, radius, style) {
    // Preserve the existing scientific marker's diameter convention.
    return view.use(ShapeView).update('circle', [p.x, p.y, Math.max(0, radius - 0.5)], style);
}

export function polygon(view, points, style) {
    if (points.length) return drawPath(view, path => path.poly(points.flatMap(p => [p.x, p.y])), [style]);
}

export function strokePath(view, points, color = CanvasTheme.text.primary, width = 1, dash = []) {
    if (points.length) return drawPath(view, path => PathGeometry.polyline(path, points, dash), [{stroke: {color, width}}]);
}

export function drawPath(view, draw, styles) {
    const path = new GraphicsPath();
    draw(path);
    const graphics = view.graphics();
    for (const {fill, stroke} of styles) {
        // Pixi consumes a path after stroking; resubmit it for the phase halo and foreground.
        if (fill !== undefined) graphics.path(path).fill(fill);
        if (stroke !== undefined) graphics.path(path).stroke(stroke);
    }
    return graphics;
}
