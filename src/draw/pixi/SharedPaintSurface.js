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

import {autoDetectRenderer, Container} from "pixi.js";
import {DisplayView} from "./DisplayView.js";

/**
 * One GPU renderer for every data view outside the circuit.
 *
 * Browsers cap how many WebGL contexts a page may hold, and a panel of step cards can show dozens
 * of matrices. So no view gets a context of its own: each draws on this one shared renderer and
 * copies the finished pixels into its own plain 2D canvas. The page then holds three contexts
 * however many views are open - the simulator's, the circuit's, and this one.
 */

/** @type {undefined|!Promise.<!Renderer>} */
let shared = undefined;

/** @returns {!Promise.<!Renderer>} */
function sharedRenderer() {
    shared ??= autoDetectRenderer({
        preference: "webgl",
        width: 1,
        height: 1,
        antialias: true,
        backgroundAlpha: 0,
        // The pixels are copied out right after rendering, so they must still be there.
        preserveDrawingBuffer: true,
    });
    return shared;
}

/**
 * Draws into `canvas` at `width` x `height` CSS pixels.
 *
 * The render and the copy happen in one synchronous stretch after the renderer is ready, so views
 * painting at the same time never see each other's pixels.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!number} width
 * @param {!number} height
 * @param {!function(!DisplayView): void} draw Fills the view, in CSS pixels.
 * @param {!function(): !boolean=} isCurrent Whether this paint is still wanted once the renderer is
 *     ready; a caller that repaints the same canvas passes it so an older paint never lands last.
 * @returns {!Promise.<(void|false)>} False when the paint was dropped as no longer current.
 */
async function paintInto(canvas, width, height, draw, isCurrent = () => true) {
    const renderer = await sharedRenderer();
    // A newer paint of the same canvas may have finished while this one waited for the GPU; the
    // rest is synchronous, so checking here is enough to never overwrite newer pixels.
    if (!isCurrent()) {
        return false;
    }
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));

    const stage = new Container();
    const view = new DisplayView({width: pixelWidth, height: pixelHeight}, undefined, ratio);
    stage.addChild(view);
    stage.scale.set(ratio);
    draw(view);
    view.finish();

    renderer.resize(pixelWidth, pixelHeight, 1);
    renderer.render({container: stage, clear: true});
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.drawImage(renderer.canvas, 0, 0);
    stage.destroy({children: true});
}

export {paintInto};
