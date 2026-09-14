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

import {rectangle} from '../../../draw/shapes/ShapeView.js';
import {DEFAULT_RENDERER, makeCycleRenderer} from '../../../draw/gate/GateRenderers.js';
import {paintBackground, paintOutline} from '../../../draw/gate/GateFrame.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {CircuitGeometry} from '../../geometry/CircuitGeometry.js';
import {CircuitStats} from '../../../engine/simulation/CircuitStats.js';
import {PointerInteractionState} from '../../interaction/PointerInteractionState.js';
import {renderCircuit} from '../CircuitScene.js';

/** Renders circuit previews from a definition, without creating editor state. */
export function drawCircuitTooltip(painter, circuitDefinition, rect, showWires, time) {
    const geometry = new CircuitGeometry(0, circuitDefinition, undefined, undefined, 0);
    const neededWidth = geometry.desiredWidth(true);
    const neededHeight = geometry.desiredHeight(true);
    let scaleX = rect.w / neededWidth;
    let scaleY = rect.h / neededHeight;
    if (showWires) {
        const s = Math.min(scaleX, scaleY);
        scaleX = s;
        scaleY = s;
    }
    const stats = CircuitStats.withNanDataFromCircuitAtTime(circuitDefinition, time);
    painter.group('circuit-preview', painter => {
        painter.position.set(rect.x, rect.y);
        painter.scale.set(Math.min(1, scaleX), Math.min(1, scaleY));
        renderCircuit({definition: circuitDefinition, geometry,
            highlightedSlot: undefined,
            highlightStatusAt: () => ({isHighlighted: false, isResizeShowing: false, isResizeHighlighted: false})
        }, painter, PointerInteractionState.EMPTY, stats, true, showWires);
    });
    return {maxW: neededWidth*scaleX, maxH: neededHeight*scaleY};
}

/**
 * @param {!GateRenderParams} args
 */
export const GATE_CIRCUIT_RENDERER = args => {
    const circuit = args.gate.knownCircuit;
    if (circuit === undefined || args.gate.symbol !== '') {
        if (args.gate.stableDuration() === Infinity) {
            DEFAULT_RENDERER(args);
        } else {
            makeCycleRenderer()(args);
        }
        return;
    }

    const toolboxColor = args.gate.stableDuration() === Infinity ?
        CanvasTheme.surface.gate :
        CanvasTheme.gate.time;
    paintBackground(args, toolboxColor);
    drawCircuitTooltip(args.painter, args.gate.knownCircuitNested, args.rect, false, args.stats.time);
    paintOutline(args);
    if (args.isHighlighted) {
        args.painter.group('hover-' + args.painter.order, painter => {
            painter.alpha *= 0.9;
            rectangle(painter, args.rect, {
                fill: CanvasTheme.gate.hover
            });
        });
    }
    paintOutline(args);
};

