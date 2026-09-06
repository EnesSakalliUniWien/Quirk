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

import {rectangle, circle} from '../../draw/pixi/ShapeView.js';

import {CanvasTheme} from '../../config/CanvasTheme.js';
import {GateBuilder} from '../../circuit/model/Gate.js';
import {GatePainting} from '../../draw/GatePainting.js';
import {Rect} from '../../math/Rect.js';

let SpacerGate = new GateBuilder().
    setSerializedIdAndSymbol("…").
    setTitle("Spacer").
    setBlurb("A gate with no effect.").
    markAsNotInterestedInControls().
    promiseHasNoNetEffectOnStateVector().
    setDrawer(args => {
        // Drawn as an ellipsis.
        if (args.isHighlighted) {
            rectangle(args.painter, args.rect, {fill: CanvasTheme.gate.hover});
            GatePainting.paintOutline(args);
        } else {
            // Whitespace for the ellipsis.
            let {x, y} = args.rect.center();
            let r = new Rect(x - 14, y - 2, 28, 4);
            rectangle(args.painter, r, {fill: CanvasTheme.surface.background});
        }
        circle(args.painter, args.rect.center().offsetBy(7, 0), 2, {fill: CanvasTheme.text.primary});
        circle(args.painter, args.rect.center(), 2, {fill: CanvasTheme.text.primary});
        circle(args.painter, args.rect.center().offsetBy(-7, 0), 2, {fill: CanvasTheme.text.primary});
    }).
    gate;

export {SpacerGate}
