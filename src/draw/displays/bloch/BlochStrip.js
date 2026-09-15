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

import {rectangle} from '../../shapes/ShapeView.js';
import {paintBlochScene} from './BlochScene.js';
import {CanvasTheme} from '../../../config/CanvasTheme.js';
import {RenderSurface} from '../../surface/RenderSurface.js';
import {Rect} from '../../../geometry/Rect.js';

/** One thumbnail's side, and the gap between two. */
const STRIP_CELL = 80;
const STRIP_GAP = 8;

/**
 * A qubit's state after every column, one small sphere each, all in one canvas.
 *
 * Every sphere is painted by paintBlochScene, the painter the large sphere uses, so a thumbnail and
 * the view it opens cannot disagree about which way an axis points. They share one canvas because
 * each canvas holds a WebGL context and a browser keeps only a few alive at once.
 *
 * @param {!HTMLCanvasElement} canvas As wide as the thumbnails and one cell tall.
 * @param {!Array.<undefined|!{x: !number, y: !number, z: !number}>} vecs
 * @param {!{selected: (undefined|!int), yaw: !number, pitch: !number}} options
 */
function drawBlochStrip(canvas, vecs, {selected, yaw, pitch}) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    const view = RenderSurface.forCanvas(canvas).resize(width * dpr, height * dpr).beginFrame(undefined, dpr);
    rectangle(view, new Rect(0, 0, width, height), {fill: CanvasTheme.surface.background});
    vecs.forEach((vec, index) => view.group('step-' + index, cell => {
        cell.position.set(index * (STRIP_CELL + STRIP_GAP), 0);
        paintBlochScene(cell, STRIP_CELL, vec, yaw, pitch);
        // The step being read wears the app's highlight, as whatever is in focus does elsewhere.
        if (index === selected) {
            rectangle(cell, new Rect(1, 1, STRIP_CELL - 2, STRIP_CELL - 2),
                {stroke: {color: CanvasTheme.interaction.outline, width: 2}}, 8);
        }
    }));
}

export {drawBlochStrip, STRIP_CELL, STRIP_GAP};
