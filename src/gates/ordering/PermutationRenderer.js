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

import {strokePath} from '../../draw/shapes/ShapeView.js';

import {Layout} from '../../config/Layout.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {Point} from '../../geometry/Point.js';
import {DEFAULT_RENDERER} from '../../draw/gate/GateRenderers.js';
import {paintBackground, paintOutline, paintResizeTab} from '../../draw/gate/GateFrame.js';

/** @typedef {import('../../draw/gate/GateRenderParams.js').GateRenderParams} GateRenderParams */

/**
 * @param {!GateRenderParams} args
 * @param {!int} offset
 * @returns {!number}
 */
function wireY(args, offset) {
    return args.rect.center().y + (offset - args.gate.height/2 + 0.5) * Layout.WIRE_SPACING;
}

/**
 * @param {!GateRenderParams} args
 */
function eraseWiresForPermutation(args) {
    for (let i = 0; i < args.gate.height; i++) {
        const y = wireY(args, i);
        const p = new Point(args.rect.x, y);
        const c = new Point(args.rect.x + Layout.GATE_RADIUS, y);
        const q = new Point(args.rect.right(), y);
        const loc = new Point(args.positionInCircuit.col, args.positionInCircuit.row + i);
        const isMeasured1 = args.stats.circuitDefinition.locIsMeasured(loc);
        const isMeasured2 = args.stats.circuitDefinition.locIsMeasured(loc.offsetBy(1, 0));

        for (const dy of isMeasured1 ? [-1, +1] : [0]) {
            strokePath(args.painter, [p.offsetBy(0, dy), c.offsetBy(1, dy)], CanvasTheme.surface.background, 1);
        }
        for (const dy of isMeasured2 ? [-1, +1] : [0]) {
            strokePath(args.painter, [c.offsetBy(-1, dy), q.offsetBy(0, dy)], CanvasTheme.surface.background, 1);
        }
    }
}

/**
 * Draws the gate as a re-arrangement of wires.
 * @param {!GateRenderParams} args
 */
const PERMUTATION_RENDERER = args => {
    if (args.positionInCircuit === undefined) {
        DEFAULT_RENDERER(args);
        return;
    }

    if (args.isHighlighted ||
            args.isResizeHighlighted ||
            args.stats.circuitDefinition.colHasControls(args.positionInCircuit.col)) {
        paintBackground(args, CanvasTheme.surface.quiet);
        paintOutline(args);
        paintResizeTab(args);
    } else {
        eraseWiresForPermutation(args);
    }

    // Draw wires.
    const x1 = args.rect.x;
    const x2 = args.rect.right();
    for (let i = 0; i < args.gate.height; i++) {
        const j = args.gate.knownBitPermutationFunc(i);

        const pt = new Point(args.positionInCircuit.col, args.positionInCircuit.row + i);
        const isMeasured = args.stats.circuitDefinition.locIsMeasured(pt);
        const y1 = wireY(args, i);
        const y2 = wireY(args, j);
        const path = args.painter.graphics();
        for (const [dx, dy] of isMeasured ? [[j > i ? +1 : -1, -1], [0, +1]] : [[0, 0]]) {
            path.moveTo(Math.min(x1, x1 + dx), y1 + dy);
            path.lineTo(x1 + dx, y1 + dy);
            path.lineTo(x2 + dx, y2 + dy);
            path.lineTo(Math.max(x2, x2 + dx), y2 + dy);
        }
        path.stroke({color: CanvasTheme.text.primary, width: 1});
    }
};

export {PERMUTATION_RENDERER}
