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

import {drawText} from '../TextLayout.js';
import {strokePath, rectangle, circle} from '../ShapeView.js';

import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {RenderSurface} from '../RenderSurface.js';
import {Rect} from '../../../geometry/Rect.js';
import {Point} from '../../../geometry/Point.js';

function projectPoint(x, y, z, yaw, pitch) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const right = -x * sy + y * cy;
    const toward = x * cy + y * sy;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    return {
        sx: right,
        sy: z * cp + toward * sp,
        depth: toward * cp - z * sp,
    };
}

function strokeGreatCircle(view, pointAt, cx, cy, scale, yaw, pitch) {
    for (const front of [false, true]) {

        let points = [];
        const flush = () => { strokePath(view, points, front ? CanvasTheme.stroke.guide : CanvasTheme.stroke.faint, 1, front ? [] : [3, 4]); points = []; };
        for (let i = 0; i <= 120; i++) {
            const p = projectPoint(...pointAt(i * Math.PI * 2 / 120), yaw, pitch);
            if ((p.depth >= 0) === front) points.push(new Point(cx + p.sx * scale, cy - p.sy * scale));
            else flush();
        }
        flush();
    }

}

function drawBlochScene(canvas, vec, yaw, pitch) {
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(size * dpr);
    const view = RenderSurface.forCanvas(canvas).beginFrame(undefined, dpr);
    rectangle(view, new Rect(0, 0, size, size), {fill: CanvasTheme.surface.background});
    const cx = size / 2, cy = size / 2, scale = size * 0.72 / 2;
    const center = new Point(cx, cy);
    const project = (x, y, z) => {
        const p = projectPoint(x, y, z, yaw, pitch);
        return {x: cx + p.sx * scale, y: cy - p.sy * scale, depth: p.depth};
    };
    circle(view, center, scale, {fill: CanvasTheme.bloch.background});
    circle(view, center, scale, {stroke: {color: CanvasTheme.stroke.guide, width: 1}});
    strokeGreatCircle(view, t => [Math.cos(t), Math.sin(t), 0], cx, cy, scale, yaw, pitch);
    strokeGreatCircle(view, t => [Math.cos(t), 0, Math.sin(t)], cx, cy, scale, yaw, pitch);
    strokeGreatCircle(view, t => [0, Math.cos(t), Math.sin(t)], cx, cy, scale, yaw, pitch);
    for (const [dir, ket, letter] of [
        [[1,0,0], '|+⟩', 'x'], [[-1,0,0], '|−⟩'], [[0,1,0], '|+i⟩', 'y'],
        [[0,-1,0], '|−i⟩'], [[0,0,1], '|0⟩', 'z'], [[0,0,-1], '|1⟩']]) {
        const tip = project(...dir);

        strokePath(view, [center, tip], tip.depth >= 0 ? CanvasTheme.stroke.guide : CanvasTheme.stroke.faint, 1, tip.depth >= 0 ? [] : [3, 4]);

        const label = project(...dir.map(v => v * 1.22));
        drawText(view, ket, {
            x: label.x,
            y: label.y,
            fill: tip.depth >= 0 ? CanvasTheme.text.primary : CanvasTheme.text.muted,
            font: {fontSize: 13, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center',
            baseline: 'middle'
        });
        if (letter) drawText(view, letter, {
            x: label.x,
            y: label.y + 14,
            fill: CanvasTheme.text.muted,
            font: {fontSize: 11, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center',
            baseline: 'middle'
        });
    }
    if (!vec) {
        drawText(view, 'NaN', {
            x: cx,
            y: cy,
            fill: CanvasTheme.error.text,
            font: {fontSize: 14, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center',
            baseline: 'middle'
        });
        return;
    }
    const tip = project(vec.x, vec.y, vec.z), foot = project(vec.x, vec.y, 0);

    strokePath(view, [tip, foot, center], CanvasTheme.text.muted, 1, [3, 4]);

    strokePath(view, [center, tip], CanvasTheme.bloch.vector, 2);
    circle(view, tip, 5, {fill: CanvasTheme.bloch.vector});
    circle(view, tip, 5, {stroke: {color: CanvasTheme.text.primary, width: 1}});
}
export {drawBlochScene, projectPoint};
