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

import {drawPath, frame, highlightRing, lineWidth, rectangle} from '../../../draw/shapes/ShapeView.js';
import {fitText} from '../../../draw/text/TextLayout.js';
import {Layout} from '../../../config/Layout.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {Typography} from '../../../config/Typography.js';
import {wireLabel} from '../../../circuit/registerLabels.js';
import {Rect} from '../../../geometry/Rect.js';

// A register's brace: drawn down its wires' labels, stopping short of the first and last so
// neighbouring registers read apart, with its tip pointing at the name.
const REGISTER_BRACE_INSET = 4;
const REGISTER_BRACE_CURVE = 6;
const REGISTER_BRACE_GAP = 3;

/**
 * A register in the gutter: a curly brace down its wires' labels in the bright ink, with its name at
 * the brace's tip - the way a paper labels a register - and the input it feeds under the name.
 * Registers are told apart by name and brace rather than colour, so no hue here competes with the
 * gates' and the displays'; the brace is a hairline, so it wears the bright ink rather than the
 * frame's.
 * Clicking it opens the Registers panel; a double click renames it; a right click opens its menu
 * (src/app/canvas/canvasPointer.js).
 *
 * @param {!Object} context Rendering inputs supplied by CircuitRendering.
 * @param {!DisplayView} painter
 * @param {!PointerInteractionState} hand
 * @param {!Register} register
 */
function drawRegisterGutter(context, painter, hand, register) {
    const geometry = context.geometry;
    const box = geometry.registerNameRect(register.start, register.length);
    const top = box.y + REGISTER_BRACE_INSET;
    const bottom = box.bottom() - REGISTER_BRACE_INSET;
    const mid = (top + bottom) / 2;
    const x = box.right() - REGISTER_BRACE_GAP;
    const r = Math.min(REGISTER_BRACE_CURVE, (bottom - top) / 4);

    // The whole column down the register's wires answers the pointer.
    const labelsRight = geometry.wireIndexRect(register.start).right();
    const target = new Rect(0, box.y, labelsRight, box.h);

    if (context.highlightedSlot === undefined && hand.pos !== undefined && target.containsPoint(hand.pos)) {
        rectangle(painter, target, {fill: CanvasTheme.gate.hover});
    }

    drawPath(painter, trace => {
        trace.moveTo(x + r, top);
        trace.quadraticCurveTo(x, top, x, top + r);
        trace.lineTo(x, mid - r);
        trace.quadraticCurveTo(x, mid, x - r, mid);
        trace.quadraticCurveTo(x, mid, x, mid + r);
        trace.lineTo(x, bottom - r);
        trace.quadraticCurveTo(x, bottom, x + r, bottom);
    }, [{stroke: {color: CanvasTheme.stroke.bright, width: lineWidth(painter, 1)}}]);

    const nameWidth = x - r - 2 * REGISTER_BRACE_GAP;
    const feeds = register.input !== undefined;
    fitText(painter, register.name, {
        x: x - r - REGISTER_BRACE_GAP,
        y: feeds ? mid - Layout.REGISTER_FONT_SIZE * 0.45 : mid,
        align: 'right',
        baseline: 'middle',
        fill: CanvasTheme.text.primary,
        font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.MONO_FONT_FAMILY},
        width: nameWidth,
        height: Layout.REGISTER_HEIGHT
    });
    if (feeds) {
        fitText(painter, `→${register.input}`, {
            x: x - r - REGISTER_BRACE_GAP,
            y: mid + Layout.REGISTER_FONT_SIZE * 0.5,
            align: 'right',
            baseline: 'middle',
            fill: CanvasTheme.text.muted,
            font: {fontSize: Layout.REGISTER_FONT_SIZE * 0.75, fontFamily: Typography.MONO_FONT_FAMILY},
            width: nameWidth,
            height: Layout.REGISTER_HEIGHT
        });
    }
}

/** Renders wire labels and their interaction regions using the shared circuit geometry. */
function drawWireLabels(context, painter, hand, drawnWireCount) {
    // Initial value labels. A wire in a register is named by it - a₀ rather than q0 - and every
    // wire keeps its own starting ket. Every label wears the primary ink: a wire outside every
    // register is not a lesser wire, and muted would say it was.
    const {registers} = context.definition;
    // The gutter's hover fill extends behind the wire labels, so paint it first.
    registers.list.forEach(register => {
        if (register.start < drawnWireCount) {
            drawRegisterGutter(context, painter, hand, register);
        }
    });
    for (let row = 0; row < drawnWireCount; row++) {
        const wireRect = context.geometry.wireRect(row);
        const y = wireRect.center().y;
        const indexRect = context.geometry.wireIndexRect(row);
        fitText(painter, wireLabel(registers, row), {
            x: indexRect.x,
            y,
            align: 'left',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.MONO_FONT_FAMILY},
            width: indexRect.w,
            height: indexRect.h
        });
        let v = context.definition.customInitialValues.get(row);
        if (v === undefined) {
            v = '0';
        }
        const rect = context.geometry.wireInitialStateRect(row);

        // A quiet fill marks the ket as clickable before the pointer ever finds it.
        rectangle(painter, rect, {fill: CanvasTheme.surface.quiet});
        const hovered = context.highlightedSlot === undefined && hand.pos !== undefined && rect.containsPoint(hand.pos);
        if (hovered) {
            rectangle(painter, rect, {fill: CanvasTheme.gate.hover});
        }
        // Its fill is as dark as the canvas, so the frame is what gives the ket an edge.
        frame(painter, rect);
        if (hovered) {
            highlightRing(painter, rect);
        }
        fitText(painter, `|${v}⟩`, {
            x: rect.center().x,
            y,
            align: 'center',
            baseline: 'middle',
            fill: CanvasTheme.text.primary,
            font: {fontSize: Layout.REGISTER_FONT_SIZE, fontFamily: Typography.DEFAULT_FONT_FAMILY},
            width: rect.w - Layout.REGISTER_MARGIN,
            height: rect.h
        });
    }

}

export {drawWireLabels};
