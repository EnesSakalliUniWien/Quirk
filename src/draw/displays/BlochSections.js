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

import {drawText} from '../text/TextLayout.js';
import {strokePath, rectangle, circle} from '../shapes/ShapeView.js';

import {AXIS_COLOR} from './BlochGeometry.js';
import {blochAngles, componentFormulas} from '../../engine/math/bloch.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {RenderSurface} from '../surface/RenderSurface.js';
import {Rect} from '../../geometry/Rect.js';
import {Point} from '../../geometry/Point.js';

/**
 * One section per axis: looking straight down it, at the plane it is normal to. The sphere's
 * perspective is what makes a component hard to read off; face-on, each one is a plain length.
 */
const SECTIONS = [
    {axis: 'x', across: 'y', up: 'z'},
    {axis: 'y', across: 'x', up: 'z'},
    {axis: 'z', across: 'x', up: 'y'},
];

/** Below this the shadow is a point, and it has no direction to report. */
const DEGENERATE_SHADOW = 1e-3;

/**
 * A cell's circle and where it sits: the circle stays clear of the title above it and of the two
 * formulas and the reading underneath.
 * @param {!number} width
 * @param {!number} height
 * @returns {!{cell: !number, radius: !number, centerY: !number}}
 */
function sectionLayout(width, height) {
    const cell = width / 3;
    return {cell, radius: Math.min(cell * 0.34, height * 0.28), centerY: height * 0.42};
}

/**
 * Where the vector falls in each section: its two in-plane components, how far that is from the
 * centre, and which way it points there.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!Array.<!{axis: !string, across: !string, up: !string, point: !Array.<!number>,
 *     length: !number, angle: !number}>}
 */
function sectionProjections(vec) {
    return SECTIONS.map(({axis, across, up}) => ({
        axis,
        across,
        up,
        point: [vec[across], vec[up]],
        length: Math.hypot(vec[across], vec[up]),
        angle: Math.atan2(vec[up], vec[across]),
    }));
}

/**
 * @param {!HTMLCanvasElement} canvas Three cells wide and one tall.
 * @param {undefined|!{x: !number, y: !number, z: !number}} vec
 * @param {!{focusAxis: (undefined|!string), layers: (undefined|!Object)}=} options The axis being
 *     read, whose section keeps its full strength while the others fade, and which constructions
 *     to draw.
 */
function drawBlochSections(canvas, vec, {focusAxis, layers = {trig: true}} = {}) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    const view = RenderSurface.forCanvas(canvas).resize(width * dpr, height * dpr).beginFrame(undefined, dpr);
    rectangle(view, new Rect(0, 0, width, height), {fill: CanvasTheme.surface.background});
    const {cell, radius, centerY} = sectionLayout(width, height);
    const font = fontSize => ({fontSize, fontFamily: Typography.MONO_FONT_FAMILY});
    const shadows = vec === undefined ? undefined : sectionProjections(vec);
    const formulas = vec === undefined ? undefined : componentFormulas(blochAngles(vec).r);
    for (const [index, {axis, across, up}] of SECTIONS.entries()) {
        view.group('section-' + axis, inner => {
            inner.alpha *= focusAxis === undefined || focusAxis === axis ? 1 : 0.15;
            const cx = cell * (index + 0.5), cy = centerY;
            const center = new Point(cx, cy);
            const at = (a, u) => new Point(cx + a * radius, cy - u * radius);
            // The plane's own circle, in the colour of the axis it is normal to.
            circle(inner, center, radius, {fill: CanvasTheme.bloch.background});
            circle(inner, center, radius, {stroke: {color: AXIS_COLOR[axis], width: 1.25}});
            drawText(inner, `${across}${up} ⊥ ${axis}`, {x: cx, y: height * 0.08, fill: AXIS_COLOR[axis],
                font: font(11), align: 'center', baseline: 'middle'});
            // The two axes that span the plane, each still wearing its own colour.
            for (const [from, to, letter, color] of [
                [at(-1.06, 0), at(1.06, 0), across, AXIS_COLOR[across]],
                [at(0, -1.06), at(0, 1.06), up, AXIS_COLOR[up]]]) {
                inner.group('axis-' + letter, line => {
                    line.alpha *= 0.55;
                    strokePath(line, [from, to], color, 1);
                });
                // Beside each axis's far end, so the upright one keeps clear of the title above.
                drawText(inner, letter, {x: to.x + 8, y: to.y, fill: color,
                    font: font(11), align: 'left', baseline: 'middle'});
            }
            if (shadows === undefined) return;
            const {point: [a, u], length, angle} = shadows[index];
            const tip = at(a, u);
            // The shadow's own two components, then the shadow itself.
            strokePath(inner, [center, at(a, 0)], AXIS_COLOR[across], 1, [3, 3]);
            strokePath(inner, [at(a, 0), tip], AXIS_COLOR[up], 1, [3, 3]);
            strokePath(inner, [center, tip], CanvasTheme.bloch.vector, 2);
            circle(inner, tip, 3.5, {fill: CanvasTheme.bloch.vector});
            // Underneath the circle, each dashed leg is named by the trigonometry it comes from.
            if (layers.trig) {
                for (const [line, letter] of [[0, across], [1, up]]) {
                    drawText(inner, `${letter} = ${formulas[letter]}`, {x: cx, y: height - 40 + line * 14,
                        fill: AXIS_COLOR[letter], font: font(10), align: 'center', baseline: 'middle'});
                }
            }
            const bearing = length <= DEGENERATE_SHADOW ? '' :
                ` ∠ ${(angle * 180 / Math.PI).toFixed(1)}°`;
            drawText(inner, `${length.toFixed(3)}${bearing}`, {x: cx, y: height - 11,
                fill: CanvasTheme.text.muted, font: font(11), align: 'center', baseline: 'middle'});
        });
    }
}

export {drawBlochSections, sectionProjections, sectionLayout};
