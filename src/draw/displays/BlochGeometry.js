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

import {CanvasTheme} from '../../config/CanvasTheme.js';

/**
 * What an axis's letter, its readout name, the projection triangle whose leg runs along it and the
 * plane triangle normal to it are all drawn in, on both the circuit's sphere and the enlarged one.
 */
export const AXIS_COLOR = {x: CanvasTheme.bloch.axisX, y: CanvasTheme.bloch.axisY, z: CanvasTheme.bloch.axisZ};

/**
 * How much of its square plot a Bloch figure's unit circle takes as its radius. The analyzer's
 * sphere and both its cross-sections use it, so figures of one width draw one unit circle.
 */
export const PLOT_RADIUS = 0.36;

/**
 * Where a Bloch figure's unit circle sits: centred in its square plot, so figures of one width
 * put their circles at one size and at one height.
 *
 * @param {!number} width
 * @param {!number=} plotHeight How tall the plot may be; a shorter plot shrinks the circle to fit.
 * @returns {!{cx: !number, cy: !number, radius: !number, plot: !number}} plot is the square's side.
 */
export function unitCircleOf(width, plotHeight = width) {
    const plot = Math.min(width, plotHeight);
    return {cx: width / 2, cy: plot / 2, radius: plot * PLOT_RADIUS, plot};
}
