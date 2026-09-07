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
  MAKE_HIGHLIGHTED_DRAWER,
  DEFAULT_DRAWER,
  LABEL_DRAWER,
  makeLocationIndependentGateDrawer,
  LOCATION_INDEPENDENT_GATE_DRAWER,
  SECTIONED_DRAWER_MAKER,
  makeDisplayDrawer,
  MATRIX_DRAWER,
  paintCycleState,
  makeCycleDrawer,
} from "./GateDrawers.js";
import { rectForResizeTab } from "../../editor/CircuitGeometry.js";

/**
 * The gate painting namespace, kept so the gate modules and the serializer can keep spelling their
 * drawers as GatePainting.X. The pieces live in GateFrame (outline, background, resize tab, gate
 * button), GateSymbol (the symbol typography) and GateDrawers (the composed drawers); new code
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
  MAKE_HIGHLIGHTED_DRAWER,
  DEFAULT_DRAWER,
  LABEL_DRAWER,
  makeLocationIndependentGateDrawer,
  LOCATION_INDEPENDENT_GATE_DRAWER,
  SECTIONED_DRAWER_MAKER,
  makeDisplayDrawer,
  MATRIX_DRAWER,
  paintCycleState,
  makeCycleDrawer,
};

export { GatePainting };
