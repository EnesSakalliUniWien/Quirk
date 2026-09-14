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

import {rectForResizeTab} from '../../draw/gate/GateRects.js';

/** Shared hover/resize rules. Queries explicit inputs; does not edit state or render. */
export function highlightStatusAt({definition, geometry, highlightedSlot, findGateAt}, col, row, focusPosPts) {
    if (highlightedSlot !== undefined) {
        if (highlightedSlot.col === col && highlightedSlot.row === row) {
            return {
                isResizeShowing: true,
                isResizeHighlighted: highlightedSlot.resizeStyle,
                isHighlighted: !highlightedSlot.resizeStyle
            };
        }
    }

    const gate = definition.gateInSlot(col, row);
    if (gate === undefined || highlightedSlot !== undefined) {
        return {
            isResizeShowing: false,
            isResizeHighlighted: false,
            isHighlighted: false
        };
    }

    const gateRect = geometry.gateRect(row, col, gate.width, gate.height);
    const resizeTabRect = rectForResizeTab(gateRect);

    const isOverGate = pos => {
        const overGate = findGateAt(pos);
        return overGate !== undefined && overGate.col === col && overGate.row === row;
    };
    const isNotCoveredAt = pos => {
        const g = findGateAt(pos);
        return g === undefined || (g.col === col && g.row === row);
    };
    const isOverGateResizeTab = pos => isNotCoveredAt(pos) && resizeTabRect.containsPoint(pos);

    const isResizeHighlighted = gate.canChangeInSize() && focusPosPts.some(isOverGateResizeTab);
    const isHighlighted = !isResizeHighlighted && focusPosPts.some(isOverGate);
    const isResizeShowing = gate.canChangeInSize() && (isResizeHighlighted || isHighlighted);

    return {isHighlighted, isResizeShowing, isResizeHighlighted};
}
