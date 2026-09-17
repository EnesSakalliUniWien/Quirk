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

import {rectangle, strokePath} from '../../draw/shapes/ShapeView.js';

import {RenderSurface} from '../../draw/surface/RenderSurface.js';
import {Point} from '../../geometry/Point.js';
import {Rect} from '../../geometry/Rect.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {circuitZoom, onCircuitZoomChanged} from './zoom.js';

/**
 * A schematic overview of the whole circuit with a box marking the visible part, shown only while
 * the circuit is wider than its scroll area. Clicking or dragging on it scrolls the circuit.
 *
 * Its size is the bar's to decide (see src/styles/circuit/viewport.css): the circuit is squeezed into it on each axis
 * separately, so a long circuit uses the overview's whole width instead of a sliver of it.
 *
 * The schematic is drawn from the same geometry the circuit itself uses — wires as lines, gates
 * as blocks — rather than a shrunken copy of the full painting, which would be illegible at this
 * size anyway.
 *
 * @param {!HTMLElement} container The circuit overlay to add the minimap to.
 * @param {!HTMLElement} canvasDiv The circuit's scroll container.
 * @param {import("zustand/vanilla").StoreApi<{value: !EditorState}>} displayed
 * @returns {void}
 */
function initMinimap(container, canvasDiv, displayed) {
    const canvas = document.createElement('canvas');
    canvas.className = 'circuit-minimap';
    canvas.setAttribute('aria-label', 'Circuit overview');
    container.appendChild(canvas);

    const repaint = () => {
        const inspector = displayed.getState().value;
        const geometry = inspector.displayedCircuit.geometry();
        const contentWidth = inspector.desiredWidth();
        const visibleWidth = canvasDiv.clientWidth / circuitZoom();
        if (contentWidth <= visibleWidth) {
            canvas.hidden = true;
            return;
        }
        canvas.hidden = false;

        const w = Math.max(1, canvas.clientWidth);
        const h = Math.max(1, canvas.clientHeight);
        const sx = w / contentWidth;
        // The overview shows the circuit band, excluding its viewport-centering offset.
        const sy = h / geometry.desiredHeight();
        // At least a pixel each way, so a narrow gate in a long circuit still shows.
        const squeezed = r => new Rect(r.x * sx, (r.y - geometry.top) * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
        const pixelRatio = window.devicePixelRatio || 1;
        const view = RenderSurface.forCanvas(canvas).resize(w * pixelRatio, h * pixelRatio)
            .beginFrame(undefined, pixelRatio);
        rectangle(view, new Rect(0, 0, w, h), {fill: CanvasTheme.surface.gate});

        // Wires.
        const circuitDefinition = geometry.circuitDefinition;
        const wireCount = geometry.importantWireCount();
        const wireEndX = geometry.outputWireEndX();

        for (let row = 0; row < wireCount; row++) {
            const y = (geometry.wireRect(row).center().y - geometry.top) * sy;
            strokePath(view, [new Point(0, y), new Point(wireEndX * sx, y)], CanvasTheme.stroke.faint, 1);
        }

        // Gates as blocks.
        for (let col = 0; col < circuitDefinition.columns.length; col++) {
            const gates = circuitDefinition.columns[col].gates;
            for (let row = 0; row < gates.length; row++) {
                const gate = gates[row];
                if (gate === undefined || gate === null) {
                    continue;
                }
                const r = geometry.gateRect(row, col, gate.width, gate.height);
                rectangle(view, squeezed(r), {fill: CanvasTheme.stroke.guide});
            }
        }

        // The output display block.
        const grid = geometry.rectForSuperpositionDisplay();
        rectangle(view, squeezed(grid), {stroke: {color: CanvasTheme.stroke.guide, width: 1}});

        // The visible part.
        const viewX = canvasDiv.scrollLeft / circuitZoom();
        rectangle(view, new Rect(viewX * sx, 0, visibleWidth * sx, h), {stroke: {color: CanvasTheme.interaction.outline, width: 2}});
    };

    const scrollTo = ev => {
        const b = canvas.getBoundingClientRect();
        const contentWidth = displayed.getState().value.desiredWidth();
        const scale = canvas.clientWidth / contentWidth;
        const visibleWidth = canvasDiv.clientWidth / circuitZoom();
        const centerX = (ev.clientX - b.left - canvas.clientLeft) / scale;
        canvasDiv.scrollLeft = (centerX - visibleWidth / 2) * circuitZoom();
    };
    // Pointer events rather than mouse events, so dragging the viewport box also works by touch.
    canvas.addEventListener('pointerdown', ev => {
        if (!ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) {
            return;
        }
        scrollTo(ev);
        canvas.setPointerCapture(ev.pointerId);
        ev.preventDefault();
    });
    canvas.addEventListener('pointermove', ev => {
        if (canvas.hasPointerCapture(ev.pointerId)) {
            scrollTo(ev);
        }
    });

    canvasDiv.addEventListener('scroll', repaint, {passive: true});
    // Sizes, including the jump from the pre-boot display:none to the real layout, arrive here.
    new ResizeObserver(repaint).observe(canvasDiv);
    displayed.subscribe(repaint);
    onCircuitZoomChanged(repaint);
}

export {initMinimap}
