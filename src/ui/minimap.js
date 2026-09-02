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

import {Palette} from "../config/Palette.js"
import {circuitZoom, onCircuitZoomChanged} from "./zoom.js"

const MINIMAP_WIDTH = 180;
const MINIMAP_MAX_HEIGHT = 110;

/**
 * A schematic overview of the whole circuit with a box marking the visible part, shown only while
 * the circuit is wider than its scroll area. Clicking or dragging on it scrolls the circuit.
 *
 * The schematic is drawn from the same geometry the circuit itself uses — wires as lines, gates
 * as blocks — rather than a shrunken copy of the full painting, which would be illegible at this
 * size anyway.
 *
 * @param {!HTMLElement} container The circuit overlay to add the minimap to.
 * @param {!HTMLElement} canvasDiv The circuit's scroll container.
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @returns {void}
 */
function initMinimap(container, canvasDiv, displayed) {
    const canvas = document.createElement('canvas');
    canvas.className = 'circuit-minimap';
    canvas.setAttribute('aria-label', 'Circuit overview');
    container.appendChild(canvas);

    const repaint = () => {
        const inspector = displayed.get();
        const geometry = inspector.displayedCircuit.geometry();
        const contentWidth = inspector.desiredWidth();
        const visibleWidth = canvasDiv.clientWidth / circuitZoom();
        if (contentWidth <= visibleWidth) {
            canvas.hidden = true;
            return;
        }
        canvas.hidden = false;

        const contentHeight = geometry.desiredHeight();
        const scale = Math.min(MINIMAP_WIDTH / contentWidth, MINIMAP_MAX_HEIGHT / contentHeight);
        const pixelRatio = window.devicePixelRatio || 1;
        const w = Math.round(contentWidth * scale);
        const h = Math.round(contentHeight * scale);
        canvas.width = w * pixelRatio;
        canvas.height = h * pixelRatio;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, 0, 0);
        ctx.fillStyle = Palette.SURFACE_COLOR;
        ctx.fillRect(0, 0, contentWidth, contentHeight);

        // Wires.
        const circuitDefinition = geometry.circuitDefinition;
        const wireCount = geometry.importantWireCount();
        const wireEndX = geometry.rectForSuperpositionDisplay().x - 4;
        ctx.strokeStyle = Palette.FAINT_LINE_COLOR;
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        for (let row = 0; row < wireCount; row++) {
            let y = geometry.wireRect(row).center().y;
            ctx.moveTo(0, y);
            ctx.lineTo(wireEndX, y);
        }
        ctx.stroke();

        // Gates as blocks.
        ctx.fillStyle = Palette.MID_LINE_COLOR;
        for (let col = 0; col < circuitDefinition.columns.length; col++) {
            let gates = circuitDefinition.columns[col].gates;
            for (let row = 0; row < gates.length; row++) {
                let gate = gates[row];
                if (gate === undefined || gate === null) {
                    continue;
                }
                let r = geometry.gateRect(row, col, gate.width, gate.height);
                ctx.fillRect(r.x, r.y, r.w, r.h);
            }
        }

        // The output display block.
        let grid = geometry.rectForSuperpositionDisplay();
        ctx.strokeStyle = Palette.MID_LINE_COLOR;
        ctx.strokeRect(grid.x, grid.y, grid.w, grid.h);

        // The visible part.
        let viewX = canvasDiv.scrollLeft / circuitZoom();
        ctx.strokeStyle = Palette.HIGHLIGHT_STROKE_COLOR;
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(viewX, 0, visibleWidth, contentHeight);
    };

    const scrollTo = ev => {
        const b = canvas.getBoundingClientRect();
        const contentWidth = displayed.get().desiredWidth();
        const scale = b.width / contentWidth;
        const visibleWidth = canvasDiv.clientWidth / circuitZoom();
        let centerX = (ev.clientX - b.left) / scale;
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
    displayed.observable().subscribe(repaint);
    onCircuitZoomChanged(repaint);
}

export {initMinimap}
