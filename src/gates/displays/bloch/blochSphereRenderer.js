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

import { makeDisplayRenderer } from "../../../draw/gate/GateRenderers.js";
import { paintBlochSphereDisplay } from "../../../draw/displays/bloch/BlochView.js";

import {fitText} from "../../../draw/text/TextLayout.js";
import {CanvasTheme} from "../../../config/CanvasTheme.js";

const BLOCH_SPHERE_RENDERER = makeDisplayRenderer(args => {
        const {row, col} = args.positionInCircuit;
        const ρ = args.stats.qubitDensityMatrix(col, row);
        paintBlochSphereDisplay(args.painter, ρ, args.rect, args.focusPoints);
        fitText(args.painter, '↗', {x: args.rect.right()-2, y: args.rect.y+2,
            align: 'right', baseline: 'top', width: 10, height: 10,
            fill: CanvasTheme.text.muted});
    });

export { BLOCH_SPHERE_RENDERER };
