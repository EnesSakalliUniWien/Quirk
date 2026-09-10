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

import {
  paintOutline,
  paintBackground,
  paintResizeTab,
  traceLocationIndependentOutline,
  paintLocationIndependentFrame,
  paintGateButton,
} from "./GateFrame.js";
import { paintGateSymbol } from "./GateSymbol.js";
import {
  MAKE_HIGHLIGHTED_RENDERER,
  DEFAULT_RENDERER,
  LABEL_RENDERER,
  makeLocationIndependentGateRenderer,
  LOCATION_INDEPENDENT_GATE_RENDERER,
  SECTIONED_RENDERER_MAKER,
  makeDisplayRenderer,
  MATRIX_RENDERER,
  paintCycleState,
  makeCycleRenderer,
} from "./GateRenderers.js";
import { rectForResizeTab } from "./GateRects.js";

/**
 * The gate painting namespace, kept so the gate modules and the serializer can keep spelling their
 * renderers as GatePainting.X. The pieces live in GateFrame (outline, background, resize tab, gate
 * button), GateSymbol (the symbol typography) and GateRenderers (the composed renderers); new code
 * imports those directly.
 */
const GatePainting = {
  paintOutline,
  paintBackground,
  paintResizeTab,
  traceLocationIndependentOutline,
  paintLocationIndependentFrame,
  paintGateButton,
  paintGateSymbol,
  rectForResizeTab,
  MAKE_HIGHLIGHTED_RENDERER,
  DEFAULT_RENDERER,
  LABEL_RENDERER,
  makeLocationIndependentGateRenderer,
  LOCATION_INDEPENDENT_GATE_RENDERER,
  SECTIONED_RENDERER_MAKER,
  makeDisplayRenderer,
  MATRIX_RENDERER,
  paintCycleState,
  makeCycleRenderer,
};

export { GatePainting };
