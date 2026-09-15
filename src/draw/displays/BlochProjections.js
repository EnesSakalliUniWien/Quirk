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

import {drawText, fitText} from '../text/TextLayout.js';
import {strokePath, rectangle, circle, arrowHead} from '../shapes/ShapeView.js';

import {AXIS_COLOR, unitCircleOf} from './BlochGeometry.js';
import {MIXED_NOTE, POLAR_NOTE, blochReading, componentFormulas, degreesText} from '../../engine/math/bloch.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {RenderSurface} from '../surface/RenderSurface.js';
import {Rect} from '../../geometry/Rect.js';
import {Point} from '../../geometry/Point.js';

/** The ticks both axes carry; the centre is where the axes cross, so it needs no label. */
const TICKS = [-1, -0.5, 0.5, 1];

/**
 * @typedef {!{
 *     reading: !BlochReading,
 *     across: !{letter: !string, color: !string},
 *     up: !{letter: !string, color: !string},
 *     circleColor: !string,
 *     point: !Array.<!number>,
 *     length: !number,
 *     arc: (undefined|!{from: !number, to: !number, label: !string}),
 *     formulas: !Array.<!Array.<(undefined|!string)>>,
 *     note: (undefined|!string),
 * }} ProjectionGeometry
 * point is in the plane's own coordinates, across then up; the arc's angles are in that plane,
 * counter-clockwise from the across axis.
 */

/**
 * The two cross-sections the analyzer shows beside the sphere, as plain geometry.
 *
 * The meridian is the plane through the z axis and the vector: the XZ plane turned about z by ϕ.
 * In it the vector's angle from z is θ itself; in the XZ plane proper it would be foreshortened by
 * the turn unless ϕ is 0. Without a ϕ to turn by (RULE A, B) it is the XZ plane. The equator is the
 * XY plane, where the vector's shadow makes the angle ϕ with x.
 *
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @param {!("meridian"|"equator")} plane
 * @returns {!ProjectionGeometry}
 */
function projectionGeometry(vec, plane) {
    const reading = blochReading(vec);
    const formulas = componentFormulas(reading);
    const note = reading.rule === 'mixed' ? MIXED_NOTE : undefined;
    if (plane === 'equator') {
        return {
            reading,
            across: {letter: 'x', color: AXIS_COLOR.x},
            up: {letter: 'y', color: AXIS_COLOR.y},
            circleColor: AXIS_COLOR.z,
            point: [vec.x, vec.y],
            length: reading.rxy,
            arc: reading.phi === undefined ? undefined : {from: 0, to: reading.phi, label: `ϕ ${degreesText(reading.phi)}`},
            formulas: [['x', formulas.x], ['y', formulas.y]],
            note: note ?? (reading.rule === 'polar' ? POLAR_NOTE : undefined),
        };
    }
    const turned = reading.rule === 'general';
    return {
        reading,
        across: turned ? {letter: 'ρ', color: CanvasTheme.text.muted} : {letter: 'x', color: AXIS_COLOR.x},
        up: {letter: 'z', color: AXIS_COLOR.z},
        // A turned meridian belongs to no one axis; unturned it is the circle normal to y.
        circleColor: turned ? CanvasTheme.stroke.bright : AXIS_COLOR.y,
        // In its own meridian the vector stands ρ = |r| sin θ out from the z axis, on the side it faces.
        point: [turned ? reading.rxy : vec.x, vec.z],
        length: reading.r,
        // θ turns from +z (at π/2 in the plane) toward the vector, which lies at π/2 − θ.
        arc: reading.theta === undefined ? undefined :
            {from: Math.PI / 2, to: Math.PI / 2 - reading.theta, label: `θ ${degreesText(reading.theta)}`},
        formulas: [[turned ? 'ρ' : 'x', turned ? formulas.radial : undefined], ['z', formulas.z]],
        note,
    };
}

/**
 * One cross-section, face on: its unit circle, both axes with ticks, the vector's shadow as an arrow
 * with its two components, the angle it makes, how long it is, and the formulas underneath.
 *
 * @param {!DisplayView} view
 * @param {!number} width
 * @param {!number} height
 * @param {undefined|!{x: !number, y: !number, z: !number}} vec
 * @param {!("meridian"|"equator")} plane
 * @param {!{focusAxis: (undefined|!string), layers: (undefined|!Object)}=} options
 */
function paintBlochProjection(view, width, height, vec, plane, {focusAxis, layers = {trig: true}} = {}) {
    rectangle(view, new Rect(0, 0, width, height), {fill: CanvasTheme.surface.background});
    const geometry = projectionGeometry(vec ?? {x: 0, y: 0, z: 0}, plane);
    // The sphere beside it, in a box this wide, draws this same circle at this same height.
    const {cx, cy, radius, plot} = unitCircleOf(width, height);
    const center = new Point(cx, cy);
    const at = (a, u) => new Point(cx + a * radius, cy - u * radius);
    const font = fontSize => ({fontSize, fontFamily: Typography.MONO_FONT_FAMILY});
    // Off the axis being read, a mark fades instead of leaving.
    const forAxis = (key, letter, draw) => view.group(key, inner => {
        inner.alpha *= focusAxis === undefined || focusAxis === letter ? 1 : 0.15;
        draw(inner);
    });

    circle(view, center, radius, {fill: CanvasTheme.bloch.background});
    if (layers.circles !== false) circle(view, center, radius, {stroke: {color: geometry.circleColor, width: 1.25}});

    // Both axes with their ticks, each in its own colour; tick values left of and under them.
    const {across, up} = geometry;
    forAxis('across-axis', across.letter, inner => {
        strokePath(inner, [at(-1.12, 0), at(1.12, 0)], across.color, 1);
        for (const t of TICKS) {
            strokePath(inner, [at(t, 0).offsetBy(0, -3), at(t, 0).offsetBy(0, 3)], across.color, 1);
            drawText(inner, String(t), {x: at(t, 0).x, y: cy + 12, fill: CanvasTheme.text.muted,
                font: font(11), align: 'center', baseline: 'middle'});
        }
        // The letter sits low and right of the axis's end, clear of the ticks and the title above.
        drawText(inner, across.letter, {x: at(1.12, 0).x + 4, y: cy + 12, fill: across.color,
            font: font(12), align: 'left', baseline: 'middle'});
    });
    forAxis('up-axis', up.letter, inner => {
        strokePath(inner, [at(0, -1.12), at(0, 1.12)], up.color, 1);
        for (const t of TICKS) {
            strokePath(inner, [at(0, t).offsetBy(-3, 0), at(0, t).offsetBy(3, 0)], up.color, 1);
            drawText(inner, String(t), {x: cx - 6, y: at(0, t).y, fill: CanvasTheme.text.muted,
                font: font(11), align: 'right', baseline: 'middle'});
        }
        drawText(inner, up.letter, {x: cx + 6, y: at(0, 1.12).y, fill: up.color,
            font: font(12), align: 'left', baseline: 'middle'});
    });

    if (vec !== undefined && geometry.reading.rule !== 'mixed') {
        const [a, u] = geometry.point;
        const tip = at(a, u);
        // The shadow's two components, dashed in their own colours, then the shadow as an arrow.
        if (layers.components !== false) {
            forAxis('across-leg', across.letter, inner => strokePath(inner, [center, at(a, 0)], across.color, 1, [3, 3]));
            forAxis('up-leg', up.letter, inner => strokePath(inner, [at(a, 0), tip], up.color, 1, [3, 3]));
        }
        strokePath(view, [center, tip], CanvasTheme.bloch.vector, 2);
        if (center.distanceTo(tip) > 9) {
            arrowHead(view, center, tip, CanvasTheme.bloch.vector, 7);
        } else {
            circle(view, tip, 3.5, {fill: CanvasTheme.bloch.vector});
        }

        const {arc} = geometry;
        if (arc !== undefined && layers.angles !== false) {
            const arcRadius = radius * 0.3;
            const sweep = arc.to - arc.from;
            if (Math.abs(sweep) > 1e-3) {
                const points = Array.from({length: 33}, (_, i) => {
                    const t = arc.from + sweep * i / 32;
                    return new Point(cx + Math.cos(t) * arcRadius, cy - Math.sin(t) * arcRadius);
                });
                strokePath(view, points, CanvasTheme.text.primary, 1.5);
            }
            // The value goes in the plot's corner: on the arc's bisector a narrow wedge would put it
            // over the vector or an axis, and in the corner it meets neither at any angle.
            drawText(view, arc.label, {x: 10, y: 12, fill: CanvasTheme.text.primary,
                font: font(12), align: 'left', baseline: 'middle'});
        }
        // How long the shadow is, on a badge at its tip, pushed outward so it clears the arrowhead.
        const outward = center.distanceTo(tip) < 1 ? new Point(0, -1) :
            tip.minus(center).times(1 / center.distanceTo(tip));
        plated(view, geometry.length.toFixed(3),
            Math.max(24, Math.min(width - 24, tip.x + outward.x * 22)),
            Math.max(14, Math.min(plot - 14, tip.y + outward.y * 16)),
            CanvasTheme.bloch.vector, font(11));
    }

    // Formulas share one row in the square's bottom margin. Undefined-angle notes use that row
    // when the state's formulas are undefined.
    const line = height - 8;
    if (layers.trig) {
        const formulas = geometry.formulas.filter(([, formula]) => formula !== undefined);
        for (const [index, [letter, formula]] of formulas.entries()) {
            const cellWidth = width / formulas.length;
            const color = letter === across.letter ? across.color : up.color;
            forAxis('formula-' + letter, letter, inner => fitText(inner, `${letter} = ${formula}`,
                {x: cellWidth * (index + 0.5), y: line, fill: color, font: font(12),
                    align: 'center', baseline: 'bottom', width: cellWidth - 16}));
        }
    }
    const note = vec === undefined ? 'State unavailable' : geometry.note;
    if (note !== undefined) {
        // Shrunk to the canvas rather than clipped at its edges; the readout carries it full size.
        fitText(view, note, {x: cx, y: line, fill: CanvasTheme.text.muted,
            font: font(11), align: 'center', baseline: 'bottom', width: width - 16});
    }
}

/** A label on a translucent plate, so it reads over whatever geometry it crosses. */
function plated(view, text, x, y, fill, font) {
    fitText(view, text, {
        x,
        y,
        align: 'center',
        baseline: 'middle',
        fill,
        font,
        beforeDraw: (w, h) => view.group(`plate-${text}-${Math.round(x)}-${Math.round(y)}`, plate => {
            plate.alpha *= 0.8;
            rectangle(plate, new Rect(x - w / 2 - 3, y - h / 2, w + 6, h), {fill: CanvasTheme.surface.background}, 3);
        }),
    });
}

/**
 * Draws one cross-section into its own canvas, filling it.
 * @param {!HTMLCanvasElement} canvas
 * @param {undefined|!{x: !number, y: !number, z: !number}} vec
 * @param {!("meridian"|"equator")} plane
 * @param {!Object=} options As for paintBlochProjection.
 */
function drawBlochProjection(canvas, vec, plane, options = {}) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    const view = RenderSurface.forCanvas(canvas).resize(width * dpr, height * dpr).beginFrame(undefined, dpr);
    paintBlochProjection(view, width, height, vec, plane, options);
}

export {drawBlochProjection, projectionGeometry};
