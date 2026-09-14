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
import {strokePath, rectangle, circle, polygon} from '../shapes/ShapeView.js';

import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Typography} from '../../config/Typography.js';
import {RenderSurface} from '../surface/RenderSurface.js';
import {Rect} from '../../geometry/Rect.js';
import {Point} from '../../geometry/Point.js';
import {AXIS_COLOR} from './BlochGeometry.js';
import {blochAngles, componentFormulas} from '../../engine/math/bloch.js';

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

/** A leg shorter than this is a point, and its triangle is not drawn. */
const DEGENERATE_LEG = 1e-3;

/** The sphere's centre, where every triangle has its corner. */
const ORIGIN = [0, 0, 0];

/**
 * The right triangles that measure the vector along each axis: the centre, the vector's foot in
 * the plane normal to the axis, and its tip. The foot-to-tip leg runs along the axis, as long as
 * that component; the hypotenuse is the vector. A triangle exists only when both legs do, so a
 * vector lying in the plane or along the axis has none.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!Array.<!{axis: !string, foot: !Array.<!number>}>}
 */
function projectionTriangles(vec) {
    const tip = [vec.x, vec.y, vec.z];
    const triangles = [];
    for (const [i, axis] of ['x', 'y', 'z'].entries()) {
        const foot = tip.map((v, j) => j === i ? 0 : v);
        if (Math.abs(tip[i]) > DEGENERATE_LEG && Math.hypot(...foot) > DEGENERATE_LEG) {
            triangles.push({axis, foot});
        }
    }
    return triangles;
}

/**
 * The right triangles in the coordinate planes that resolve the vector's projection there into
 * its two components, x + iy in the equator among them: the centre, the foot on the first axis,
 * and the projection. Its hypotenuse is the base of the normal axis's projection triangle, which
 * draws it. When the normal component is zero the projection is the vector itself and the
 * triangle is that axis's own projection triangle, so it is left to it.
 * @param {!{x: !number, y: !number, z: !number}} vec
 * @returns {!Array.<!{axes: !Array.<!string>, normal: !string, foot: !Array.<!number>, tip: !Array.<!number>}>}
 */
function coordinatePlaneTriangles(vec) {
    return [['x', 'y', 'z'], ['x', 'z', 'y'], ['y', 'z', 'x']].flatMap(([a, b, normal]) => {
        if (['x', 'y', 'z'].some(axis => Math.abs(vec[axis]) <= DEGENERATE_LEG)) return [];
        return [{
            axes: [a, b],
            normal,
            foot: ['x', 'y', 'z'].map(axis => axis === a ? vec[axis] : 0),
            tip: ['x', 'y', 'z'].map(axis => axis === a || axis === b ? vec[axis] : 0),
        }];
    });
}

/** Construct the right-angle mark in 3D before projecting it with the triangle. */
function drawRightAngle(view, foot, tip, project, color, scale) {
    const aLength = Math.hypot(...foot);
    const b = tip.map((v, i) => v - foot[i]);
    const bLength = Math.hypot(...b);
    const length = Math.min(7 / scale, aLength / 4, bLength / 4);
    const aStep = foot.map(v => -v * length / aLength);
    const bStep = b.map(v => v * length / bLength);
    strokePath(view, [
        foot.map((v, i) => v + aStep[i]),
        foot.map((v, i) => v + aStep[i] + bStep[i]),
        foot.map((v, i) => v + bStep[i]),
    ].map(p => project(...p)), color, 1);
}

function drawAngles(view, vec, project) {
    const {r, theta, phi} = blochAngles(vec);
    const xy = Math.hypot(vec.x, vec.y);
    // At the poles the azimuth is undefined; at the origin both angles are undefined.
    if (r <= DEGENERATE_LEG || xy <= DEGENERATE_LEG) return;
    const arc = (angle, pointAt, label) => {
        if (Math.abs(angle) <= DEGENERATE_LEG) return;
        const points = Array.from({length: 41}, (_, i) => project(...pointAt(angle * i / 40, 1)));
        strokePath(view, points, CanvasTheme.text.primary, 1.5);
        const p = project(...pointAt(angle / 2, 1.3));
        drawText(view, label, {x: p.x, y: p.y, fill: CanvasTheme.text.primary,
            font: {fontSize: 13, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center', baseline: 'middle'});
    };
    const polarRadius = Math.min(0.28, r * 0.45);
    arc(theta, (t, k) => [
        k * polarRadius * Math.sin(t) * vec.x / xy,
        k * polarRadius * Math.sin(t) * vec.y / xy,
        k * polarRadius * Math.cos(t),
    ], 'θ');
    const azimuthRadius = Math.min(0.4, xy * 0.65);
    arc(phi, (t, k) => [k * azimuthRadius * Math.cos(t), k * azimuthRadius * Math.sin(t), 0], 'ϕ');
}

/** The three unit circles: each bounds a coordinate plane and wears the colour of its normal. */
const UNIT_CIRCLES = [
    {axis: 'z', pointAt: t => [Math.cos(t), Math.sin(t), 0]},
    {axis: 'y', pointAt: t => [Math.cos(t), 0, Math.sin(t)]},
    {axis: 'x', pointAt: t => [0, Math.cos(t), Math.sin(t)]},
];

/**
 * What the scene draws. Every construction at once is a thicket, so a reading of one qubit turns
 * the ones it does not need off; this is what the panel's switches set.
 */
const DEFAULT_LAYERS = Object.freeze(
    {circles: true, components: true, planes: true, angles: true, quaternion: true, trig: true});

function strokeGreatCircle(view, pointAt, cx, cy, scale, yaw, pitch, color) {
    for (const front of [false, true]) {
        let points = [];
        const flush = () => {
            strokePath(view, points, color, front ? 1.25 : 1, front ? [] : [4, 4]);
            points = [];
        };
        for (let i = 0; i <= 120; i++) {
            const p = projectPoint(...pointAt(i * Math.PI * 2 / 120), yaw, pitch);
            if ((p.depth >= 0) === front) points.push(new Point(cx + p.sx * scale, cy - p.sy * scale));
            else flush();
        }
        flush();
    }
}

/**
 * The quaternion, drawn rather than spelled: the axis n that q turns about, and the path |0⟩ takes
 * to the state along the great circle of that turn. The turn's size is the θ arc the angles draw.
 */
function drawQuaternion(view, vec, project) {
    const {r, theta, phi} = blochAngles(vec);
    if (r <= DEGENERATE_LEG || theta <= DEGENERATE_LEG) return;
    const axis = [-Math.sin(phi), Math.cos(phi), 0];
    strokePath(view, [project(...axis.map(v => -v)), project(...axis)], CanvasTheme.text.muted, 1, [3, 3]);
    const end = project(...axis.map(v => v * 1.1));
    drawText(view, 'n', {x: end.x, y: end.y, fill: CanvasTheme.text.muted,
        font: {fontSize: 11, fontFamily: Typography.MONO_FONT_FAMILY}, align: 'center', baseline: 'middle'});
    const along = (t, k) => project(k * Math.sin(t) * Math.cos(phi), k * Math.sin(t) * Math.sin(phi), k * Math.cos(t));
    strokePath(view, Array.from({length: 41}, (_, i) => along(theta * i / 40, 1)), CanvasTheme.text.muted, 1.5);
    const label = along(theta / 2, 1.1);
    drawText(view, 'q', {x: label.x, y: label.y, fill: CanvasTheme.text.muted,
        font: {fontSize: 12, fontFamily: Typography.MONO_FONT_FAMILY}, align: 'center', baseline: 'middle'});
}

/** Writes a leg's formula alongside it, on the side away from the centre it runs out from. */
function labelSegment(view, from, to, text, color, project, center) {
    const a = project(...from), b = project(...to);
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    // Two fifths along rather than half way, which keeps a leg's name off the vector's marker and
    // the equatorial base's name clear of the angle arcs at the centre.
    const [mx, my] = [a.x + dx * 0.4, a.y + dy * 0.4];
    const [nx, ny] = [-dy / length, dx / length];
    const away = (mx - center.x) * nx + (my - center.y) * ny >= 0 ? 1 : -1;
    const [x, y] = [mx + nx * 14 * away, my + ny * 14 * away];
    fitText(view, text, {
        x,
        y,
        align: 'center',
        baseline: 'middle',
        fill: color,
        font: {fontSize: 10, fontFamily: Typography.MONO_FONT_FAMILY},
        // A formula crosses whatever the leg crosses, so it reads off its own plate.
        beforeDraw: (w, h) => view.group('plate-' + text + x.toFixed(0) + y.toFixed(0), plate => {
            plate.alpha *= 0.72;
            rectangle(plate, new Rect(x - w / 2 - 2, y - h / 2, w + 4, h), {fill: CanvasTheme.bloch.background});
        }),
    });
}

/**
 * @param {!HTMLCanvasElement} canvas
 * @param {undefined|!{x: !number, y: !number, z: !number}} vec
 * @param {!number} yaw
 * @param {!number} pitch
 * @param {!{layers: (undefined|!Object), focusAxis: (undefined|!string)}=} options The
 *     constructions to draw, and the one axis to read, whose marks keep their full strength while
 *     the rest fade.
 */
function drawBlochScene(canvas, vec, yaw, pitch, {layers = DEFAULT_LAYERS, focusAxis} = {}) {
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    const view = RenderSurface.forCanvas(canvas).resize(size * dpr, size * dpr).beginFrame(undefined, dpr);
    rectangle(view, new Rect(0, 0, size, size), {fill: CanvasTheme.surface.background});
    const cx = size / 2, cy = size / 2, scale = size * 0.72 / 2;
    const center = new Point(cx, cy);
    const project = (x, y, z) => {
        const p = projectPoint(x, y, z, yaw, pitch);
        return {x: cx + p.sx * scale, y: cy - p.sy * scale, depth: p.depth};
    };
    // Off the axis being read, a mark fades instead of leaving: the frame it sits in stays whole.
    const forAxis = (key, axis, draw) => view.group(key, inner => {
        inner.alpha *= focusAxis === undefined || focusAxis === axis ? 1 : 0.15;
        draw(inner);
    });
    circle(view, center, scale, {fill: CanvasTheme.bloch.background});
    circle(view, center, scale, {stroke: {color: CanvasTheme.stroke.guide, width: 1}});
    if (layers.circles) {
        for (const {axis, pointAt} of UNIT_CIRCLES) {
            forAxis('circle-' + axis, axis, inner => {
                // The circles are the frame the components are read against, so they sit back.
                inner.alpha *= 0.55;
                strokeGreatCircle(inner, pointAt, cx, cy, scale, yaw, pitch, AXIS_COLOR[axis]);
            });
        }
    }
    // Both ends of an axis carry its letter, so a negative component reads as easily as a positive.
    for (const [dir, ket, letter] of [
        [[1,0,0], '|+⟩', 'x'], [[-1,0,0], '|−⟩', 'x'], [[0,1,0], '|+i⟩', 'y'],
        [[0,-1,0], '|−i⟩', 'y'], [[0,0,1], '|0⟩', 'z'], [[0,0,-1], '|1⟩', 'z']]) {
        const tip = project(...dir);

        strokePath(view, [center, tip], tip.depth >= 0 ? CanvasTheme.stroke.guide : CanvasTheme.stroke.faint, 1, tip.depth >= 0 ? [] : [4, 4]);

        const label = project(...dir.map(v => v * 1.22));
        drawText(view, ket, {
            x: label.x,
            y: label.y,
            fill: tip.depth >= 0 ? CanvasTheme.text.primary : CanvasTheme.text.muted,
            font: {fontSize: 13, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center',
            baseline: 'middle'
        });
        forAxis('letter-' + ket, letter, inner => drawText(inner, letter, {
            x: label.x,
            y: label.y + 14,
            fill: AXIS_COLOR[letter],
            font: {fontSize: 11, fontFamily: Typography.MONO_FONT_FAMILY},
            align: 'center',
            baseline: 'middle'
        }));
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
    const tip = project(vec.x, vec.y, vec.z);

    // A projection triangle is tinted in its axis's colour; the plane triangle under it, whose
    // hypotenuse is that projection triangle's base, in the same colour but fainter. A solid leg
    // is always a component, in the colour of the axis it runs along.
    const vector = [vec.x, vec.y, vec.z];
    const triangles = [
        ...(layers.components ? projectionTriangles(vec) : []).map(({axis, foot}) => ({
            key: 'projection-' + axis, foot, tip: vector, axis, fill: AXIS_COLOR[axis], alpha: 0.16,
            base: {axis, color: AXIS_COLOR[axis], dash: [4, 4]}, leg: {axis, color: AXIS_COLOR[axis]},
        })),
        ...(layers.planes ? coordinatePlaneTriangles(vec) : []).map(({axes: [a, b], normal, foot, tip}) => ({
            key: 'plane-' + a + b, foot, tip, axis: normal, fill: AXIS_COLOR[normal], alpha: 0.1,
            base: {axis: a, color: AXIS_COLOR[a], dash: []}, leg: {axis: b, color: AXIS_COLOR[b]},
        })),
    ];
    // Translucent faces are painted back to front, including after dragging the sphere.
    triangles.sort((a, b) =>
        project(...a.foot).depth + project(...a.tip).depth -
        project(...b.foot).depth - project(...b.tip).depth);
    // Every tint goes down before any leg, so each leg reads over the other triangles.
    for (const triangle of triangles) {
        forAxis(triangle.key, triangle.axis, inner => {
            inner.alpha *= triangle.alpha;
            polygon(inner, [center, project(...triangle.foot), project(...triangle.tip)], {fill: triangle.fill});
        });
    }
    // The xy and xz triangles stand on the same x component, so segments and corners are collected
    // before they are drawn and each one is drawn once. A corner belongs to the leg that ends there.
    const segments = new Map(), corners = new Map();
    for (const {foot, tip, base, leg} of triangles) {
        segments.set(`${foot} ${base.color}`, {from: ORIGIN, to: foot, ...base, width: 1});
        segments.set(`${foot} ${tip} ${leg.color}`, {from: foot, to: tip, ...leg, dash: [], width: 1.5});
        corners.set(`${foot} ${base.color}`, {at: foot, ...base});
    }
    for (const [key, {from, to, color, axis, width, dash}] of segments) {
        forAxis('segment-' + key, axis, inner =>
            strokePath(inner, [project(...from), project(...to)], color, width, dash));
    }
    for (const triangle of triangles) {
        forAxis('angle-' + triangle.key, triangle.leg.axis, inner =>
            drawRightAngle(inner, triangle.foot, triangle.tip, project, triangle.leg.color, scale));
    }
    for (const [key, {at, color, axis}] of corners) {
        forAxis('corner-' + key, axis, inner => circle(inner, project(...at), 2.5, {fill: color}));
    }

    // Each component's leg says which trigonometry it comes from; the z triangle's base is the
    // equatorial radius, which is where the sin θ in the other two comes from.
    if (layers.trig) {
        const formulas = componentFormulas(blochAngles(vec).r);
        for (const triangle of triangles.filter(t => t.key.startsWith('projection-'))) {
            forAxis('trig-' + triangle.key, triangle.axis, inner => labelSegment(inner, triangle.foot,
                triangle.tip, formulas[triangle.axis], AXIS_COLOR[triangle.axis], project, center));
        }
        const equatorial = triangles.find(t => t.key === 'projection-z');
        if (equatorial !== undefined) {
            forAxis('trig-radial', 'z', inner => labelSegment(inner, ORIGIN, equatorial.foot,
                formulas.radial, CanvasTheme.text.muted, project, center));
        }
    }
    if (layers.quaternion) drawQuaternion(view, vec, project);
    if (layers.angles) drawAngles(view, vec, project);
    strokePath(view, [center, tip], CanvasTheme.bloch.vector, 2);
    circle(view, tip, 5, {fill: CanvasTheme.bloch.vector});
    circle(view, tip, 5, {stroke: {color: CanvasTheme.text.primary, width: 1}});
}
export {drawBlochScene, projectPoint, projectionTriangles, coordinatePlaneTriangles};
