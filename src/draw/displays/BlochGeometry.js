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
import {Point} from '../../geometry/Point.js';

/**
 * What an axis's letter, its readout name, the projection triangle whose leg runs along it and the
 * plane triangle normal to it are all drawn in, on both the circuit's sphere and the enlarged one.
 */
export const AXIS_COLOR = {x: CanvasTheme.bloch.axisX, y: CanvasTheme.bloch.axisY, z: CanvasTheme.bloch.axisZ};

export function coordinateSystem(unit) {
    return {
        dx: new Point(unit / 3, -unit / 3),
        dy: new Point(unit, 0),
        dz: new Point(0, unit)
    };
}
