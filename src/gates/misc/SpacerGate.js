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

import { rectangle, circle } from "../../draw/shapes/ShapeView.js";

import { CanvasTheme } from "../../config/CanvasTheme.js";
import { GateBuilder } from "../../circuit/model/Gate.js";
import {paintOutline} from '../../draw/gate/GateFrame.js';
import { Rect } from "../../geometry/Rect.js";

const SpacerGate = new GateBuilder()
  .setSerializedIdAndSymbol("…")
  .setTitle("Spacer")
  .setBlurb("A gate with no effect.")
  .markAsNotInterestedInControls()
  .promiseHasNoNetEffectOnStateVector()
  .setRenderer((args) => {
    // Drawn as an ellipsis.
    if (args.isHighlighted) {
      rectangle(args.painter, args.rect, { fill: CanvasTheme.gate.hover });
      paintOutline(args);
    } else {
      // Whitespace for the ellipsis.
      const { x, y } = args.rect.center();
      const r = new Rect(x - 14, y - 2, 28, 4);
      rectangle(args.painter, r, { fill: CanvasTheme.surface.background });
    }
    circle(args.painter, args.rect.center().offsetBy(7, 0), 2, {
      fill: CanvasTheme.text.primary,
    });
    circle(args.painter, args.rect.center(), 2, {
      fill: CanvasTheme.text.primary,
    });
    circle(args.painter, args.rect.center().offsetBy(-7, 0), 2, {
      fill: CanvasTheme.text.primary,
    });
  }).gate;

export { SpacerGate };
