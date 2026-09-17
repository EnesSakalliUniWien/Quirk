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

import {CooldownThrottle} from '../../base/CooldownThrottle.js';
import {GateColumn} from '../../circuit/model/GateColumn.js';
import {Rendering} from '../../config/Rendering.js';
import {invalidateTextLayout} from '../../draw/text/TextLayout.js';
import {CircuitViewport} from './CircuitViewport.js';
import {RenderSurface} from '../../draw/surface/RenderSurface.js';
import {Point} from '../../geometry/Point.js';
import {RestartableRng} from '../../base/RestartableRng.js';
import {Rect} from '../../geometry/Rect.js';
import {invalidateCircuitLabelCache} from '../../editor/rendering/CircuitRendering.js';
import {circuitZoom, onCircuitZoomChanged} from './zoom.js';

/**
 * The app's frame pipeline: simulate the shown circuit, publish the stats, size the canvas, and
 * paint - rate-limited, and rescheduling itself while anything on screen is still animating.
 *
 * Redraws are triggered by everything that changes what a frame would show: the inspector, the
 * playhead, a window resize, the webfont arriving. Nothing draws before start(), because painting
 * during load is a huge source of false-positive circuit-load-failed errors during development.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!HTMLElement} canvasDiv The canvas's container; scroll blocking and sizing track it.
 * @param {!HTMLElement} scrollSpacer Carries the scroll extent, so the canvas stays viewport-sized.
 * @param {import("zustand/vanilla").StoreApi<{value: !EditorState}>} displayed
 * @param {!Simulator} simulator
 * @param {!Playhead} playhead
 * @param {import("zustand/vanilla").StoreApi<{value: !CircuitStats}>} mostRecentStats Written every frame.
 * @param {!function(!EditorState): !{w: !number, h: !number}} desiredCanvasSizeFor
 * @param {!function(!EditorState): !EditorState} syncArea
 * @param {!function(): !Object} captureCommitted Captures the committed circuit, separate from a drag preview.
 * @returns {!{start: !function(): void, trigger: !function(): void}} start paints the first frame
 *     and unlocks the loop; trigger asks for a redraw (cheap, rate-limited).
 */
function initRedrawLoop(canvas,
                        canvasDiv,
                        scrollSpacer,
                        displayed,
                        simulator,
                        playhead,
                        mostRecentStats,
                        desiredCanvasSizeFor,
                        syncArea, captureCommitted) {
    let hasStarted = false;
    const viewport = new CircuitViewport(RenderSurface.forCanvas(canvas));
    // The scroll extent lives on this spacer, not the canvas: the canvas stays viewport-sized
    // while the spacer stretches to the content, so a wide circuit scrolls without the canvas's
    // backing store ever growing.
    const spacer = scrollSpacer;

    // Decorative randomness is stable across redraws. Measurement outcomes live in CircuitStats.
    const graphicsRng = new RestartableRng();

    /** @type {!CooldownThrottle} */

    const redrawNow = () => {
        if (!hasStarted) {
            return;
        }

        let shown = syncArea(displayed.getState().value).previewDrop();
        if (displayed.getState().value.hand.isHoldingSomething() && !shown.hand.isHoldingSomething()) {
            shown = shown.withHand(shown.hand.withHeldGateColumn(new GateColumn([]), new Point(0, 0)))
        }
        const circuitDefinition = shown.displayedCircuit.circuitDefinition;
        const committed = captureCommitted();
        // A preview runs at the simulator's own phase, so a spinning gate held over a still circuit spins.
        const stats = committed.circuit.withMinimumWireCount().isEqualTo(circuitDefinition.withMinimumWireCount()) ?
            committed.fullStats : simulator.simulate(circuitDefinition);
        mostRecentStats.setState({value: stats});

        // The canvas keeps showing the whole circuit; the playhead only says which column comes
        // next, and what the state looks like up to there.
        const playheadStep = Math.min(playhead.step(), circuitDefinition.columns.length);

        const size = desiredCanvasSizeFor(shown);
        const pixelRatio = window.devicePixelRatio || 1;
        const zoom = circuitZoom();

        // The canvas is a fixed viewport pinned to the container's visible corner: its CSS size
        // is the container's (an integer), and its backing store is that times the device pixel
        // ratio, so nothing is ever rescaled by a fractional pixel. The spacer under it carries
        // the content's extent, which is what actually scrolls.
        const cssW = canvasDiv.clientWidth;
        const cssH = canvasDiv.clientHeight;
        const backingW = Math.round(cssW * pixelRatio);
        const backingH = Math.round(cssH * pixelRatio);
        viewport.surface.resize(backingW, backingH);
        viewport.surface.presentation.setState({width: cssW, height: cssH});
        spacer.style.width = Math.round(size.w * zoom) + 'px';
        spacer.style.height = Math.round(size.h * zoom) + 'px';

        // The camera: the painter scales into circuit units, then shifts by the scroll so the
        // fixed viewport shows the scrolled-to part of the scene.
        shown = shown.withArea(new Rect(0, 0, size.w, size.h));
        viewport.update(shown, stats, playheadStep, {
            rng: graphicsRng.restarted(), resolution: pixelRatio * zoom,
            // Zoomed out, the circuit's lines widen in circuit units so they stay a CSS pixel wide.
            lineScale: 1 / Math.min(zoom, 1),
            scrollX: canvasDiv.scrollLeft / zoom, scrollY: canvasDiv.scrollTop / zoom,
        });

        const hand = displayed.getState().value.hand;
        viewport.surface.app.renderer.events.setCursor(hand.isHoldingSomething() ? 'move' :
            hand.isBusy() ? 'ns-resize' : viewport.surface.app.renderer.events.rootBoundary.cursor || 'auto');

        // Time-dependent gates animate whenever the cycle runs, not only while the transport plays.
        const dt = displayed.getState().value.stableDuration();
        if (dt < Infinity && simulator.clockRunning()) {
            window.requestAnimationFrame(() => redrawThrottle.trigger());
        }
    };

    const redrawThrottle = new CooldownThrottle(redrawNow, Rendering.REDRAW_COOLDOWN_MILLIS, 0.1, true);
    window.addEventListener('resize', () => redrawThrottle.trigger(), false);
    // The container can resize without the window (the sidebar folding, the state table growing),
    // and the fixed viewport must follow it.
    new ResizeObserver(() => redrawThrottle.trigger()).observe(canvasDiv);
    // The camera shifts with the scroll, so the fixed viewport needs a repaint per scroll step.
    canvasDiv.addEventListener('scroll', () => redrawThrottle.trigger(), {passive: true});
    // A monitor change or browser-zoom change alters the device pixel ratio without any resize;
    // each firing re-registers against the new ratio.
    const watchPixelRatio = () => {
        const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        query.addEventListener('change', () => {
            redrawThrottle.trigger();
            watchPixelRatio();
        }, {once: true});
    };
    watchPixelRatio();
    let lastZoom = circuitZoom();
    onCircuitZoomChanged(() => {
        // Keep the scene point at the viewport's center fixed while the zoom changes around it.
        // The spacer is rescaled first so the new scroll position isn't clamped to the old extent.
        const factor = circuitZoom() / lastZoom;
        lastZoom = circuitZoom();
        spacer.style.width = (Number.parseFloat(spacer.style.width) || 0) * factor + 'px';
        spacer.style.height = (Number.parseFloat(spacer.style.height) || 0) * factor + 'px';
        canvasDiv.scrollLeft = (canvasDiv.scrollLeft + canvasDiv.clientWidth / 2) * factor -
            canvasDiv.clientWidth / 2;
        canvasDiv.scrollTop = (canvasDiv.scrollTop + canvasDiv.clientHeight / 2) * factor -
            canvasDiv.clientHeight / 2;
        redrawThrottle.trigger();
    });
    if (document.fonts !== undefined) {
        // Canvas text starts out on a fallback font; repaint once the webfont is ready.
        document.fonts.ready.then(() => {
            invalidateTextLayout();
            invalidateCircuitLabelCache();
            redrawThrottle.trigger();
        });
    }
    displayed.subscribe(() => redrawThrottle.trigger());
    // Moving the playhead changes the band on the canvas and the state the panel reports, neither of
    // which the circuit itself knows about.
    playhead.state().subscribe(() => redrawThrottle.trigger());

    return {
        start: () => {
            hasStarted = true;
            redrawNow();
        },
        trigger: () => redrawThrottle.trigger()
    };
}

export {initRedrawLoop}
