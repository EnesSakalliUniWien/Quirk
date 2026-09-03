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

import {CooldownThrottle} from "../base/CooldownThrottle.js"
import {GateColumn} from "../circuit/GateColumn.js"
import {Layout} from "../config/Layout.js"
import {Painter} from "../draw/Painter.js"
import {Point} from "../math/Point.js"
import {RestartableRng} from "../base/RestartableRng.js"
import {Rect} from "../math/Rect.js"
import {Simulation} from "../config/Simulation.js"
import {TouchScrollBlocker} from "../browser/TouchScrollBlocker.js"
import {circuitZoom, onCircuitZoomChanged} from "./zoom.js"

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
 * @param {!ObservableValue.<!DisplayedInspector>} displayed
 * @param {!Simulator} simulator
 * @param {!Playhead} playhead
 * @param {!ObservableValue.<!CircuitStats>} mostRecentStats Written every frame.
 * @param {!ObservableValue.<!{stats: !CircuitStats, wireCount: !int}>} playheadStats Written every
 *     frame with the stats as far as the playhead has run.
 * @param {!function(!DisplayedInspector): !{w: !number, h: !number}} desiredCanvasSizeFor
 * @param {!function(!DisplayedInspector): !DisplayedInspector} syncArea
 * @returns {!{start: !function(): void, trigger: !function(): void}} start paints the first frame
 *     and unlocks the loop; trigger asks for a redraw (cheap, rate-limited).
 */
function initRedrawLoop(canvas,
                        canvasDiv,
                        displayed,
                        simulator,
                        playhead,
                        mostRecentStats,
                        playheadStats,
                        desiredCanvasSizeFor,
                        syncArea) {
    let hasStarted = false;
    // The scroll extent lives on this spacer, not the canvas: the canvas stays viewport-sized
    // while the spacer stretches to the content, so a wide circuit scrolls without the canvas's
    // backing store ever growing.
    const spacer = document.getElementById('canvas-scroll-spacer');

    // Some drawn values dither with randomness. Keeping one rng for a fraction of a second, and
    // restarting it each frame, keeps them stable enough to read while still visibly noisy.
    const semiStableRng = (() => {
        const target = {cur: new RestartableRng()};
        let cycleRng;
        cycleRng = () => {
            target.cur = new RestartableRng();
            //noinspection DynamicallyGeneratedCodeJS
            setTimeout(cycleRng, Simulation.SEMI_STABLE_RANDOM_VALUE_LIFETIME_MILLIS*0.99);
        };
        cycleRng();
        return target;
    })();

    /** @type {!CooldownThrottle} */
    let redrawThrottle;
    const scrollBlocker = new TouchScrollBlocker(canvasDiv);
    const redrawNow = () => {
        if (!hasStarted) {
            return;
        }

        let shown = syncArea(displayed.get()).previewDrop();
        if (displayed.get().hand.isHoldingSomething() && !shown.hand.isHoldingSomething()) {
            shown = shown.withHand(shown.hand.withHeldGateColumn(new GateColumn([]), new Point(0, 0)))
        }
        let circuitDefinition = shown.displayedCircuit.circuitDefinition;
        let stats = simulator.simulate(circuitDefinition);
        mostRecentStats.set(stats);

        // The canvas keeps showing the whole circuit; the playhead only says which column comes
        // next, and what the state looks like up to there.
        let playheadStep = Math.min(playhead.step(), circuitDefinition.columns.length);
        playheadStats.set({
            stats: playheadStep >= circuitDefinition.columns.length ?
                stats :
                simulator.simulateAtStep(circuitDefinition, playheadStep, stats.time),
            wireCount: shown.displayedCircuit.importantWireCount()
        });

        let size = desiredCanvasSizeFor(shown);
        let pixelRatio = window.devicePixelRatio || 1;
        let zoom = circuitZoom();

        // The canvas is a fixed viewport pinned to the container's visible corner: its CSS size
        // is the container's (an integer), and its backing store is that times the device pixel
        // ratio, so nothing is ever rescaled by a fractional pixel. The spacer under it carries
        // the content's extent, which is what actually scrolls.
        let cssW = canvasDiv.clientWidth;
        let cssH = canvasDiv.clientHeight;
        let backingW = Math.round(cssW * pixelRatio);
        let backingH = Math.round(cssH * pixelRatio);
        if (canvas.width !== backingW || canvas.height !== backingH) {
            canvas.width = backingW;
            canvas.height = backingH;
        }
        let cssWidthStyle = cssW + 'px';
        let cssHeightStyle = cssH + 'px';
        if (canvas.style.width !== cssWidthStyle || canvas.style.height !== cssHeightStyle) {
            canvas.style.width = cssWidthStyle;
            canvas.style.height = cssHeightStyle;
        }
        spacer.style.width = Math.round(size.w * zoom) + 'px';
        spacer.style.height = Math.round(size.h * zoom) + 'px';

        // The camera: the painter scales into circuit units, then shifts by the scroll so the
        // fixed viewport shows the scrolled-to part of the scene.
        let painter = new Painter(canvas, semiStableRng.cur.restarted(), pixelRatio * zoom);
        painter.ctx.translate(-canvasDiv.scrollLeft / zoom, -canvasDiv.scrollTop / zoom);
        shown.updateArea(new Rect(0, 0, size.w, size.h));
        shown.paint(painter, stats, playheadStep);
        painter.paintDeferred();

        displayed.get().hand.paintCursor(painter);
        // The blockers live in the scroll container's CSS pixels, so they shrink with the zoom.
        scrollBlocker.setBlockers(
            painter.touchBlockers.map(b => ({
                rect: new Rect(b.rect.x * zoom, b.rect.y * zoom, b.rect.w * zoom, b.rect.h * zoom),
                cursor: b.cursor
            })),
            painter.desiredCursorStyle);
        canvas.style.cursor = painter.desiredCursorStyle || 'auto';

        let dt = displayed.get().stableDuration();
        if (dt < Infinity) {
            window.requestAnimationFrame(() => redrawThrottle.trigger());
        }
    };

    redrawThrottle = new CooldownThrottle(redrawNow, Layout.REDRAW_COOLDOWN_MILLIS, 0.1, true);
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
        let factor = circuitZoom() / lastZoom;
        lastZoom = circuitZoom();
        spacer.style.width = (parseFloat(spacer.style.width) || 0) * factor + 'px';
        spacer.style.height = (parseFloat(spacer.style.height) || 0) * factor + 'px';
        canvasDiv.scrollLeft = (canvasDiv.scrollLeft + canvasDiv.clientWidth / 2) * factor -
            canvasDiv.clientWidth / 2;
        canvasDiv.scrollTop = (canvasDiv.scrollTop + canvasDiv.clientHeight / 2) * factor -
            canvasDiv.clientHeight / 2;
        redrawThrottle.trigger();
    });
    if (document.fonts !== undefined) {
        // Canvas text starts out on a fallback font; repaint once the webfont is ready.
        document.fonts.ready.then(() => redrawThrottle.trigger());
    }
    displayed.observable().subscribe(() => redrawThrottle.trigger());
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
