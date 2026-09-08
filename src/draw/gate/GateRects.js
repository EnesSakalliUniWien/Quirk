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

import { Layout } from "../../config/Layout.js";
import { Rect } from "../../geometry/Rect.js";

/**
 * The lower part of a gate's box that acts as its button, for gates that open a dialog.
 * @param {!Rect} wholeRect
 * @returns {!Rect}
 */
function gateButtonRect(wholeRect) {
  if (wholeRect.h > 50) {
    return wholeRect.bottomHalf().skipTop(6).paddedBy(-7);
  }
  return wholeRect.bottomHalf().paddedBy(+2);
}

/**
 * The strip along a gate's bottom edge that drags to change its height.
 * @param {!Rect} gateRect
 * @returns {!Rect}
 */
function rectForResizeTab(gateRect) {
  let overlap = Math.min(Layout.GATE_RADIUS, gateRect.h / 4);
  return new Rect(
    gateRect.x,
    gateRect.bottom() - overlap,
    gateRect.w,
    Layout.GATE_RADIUS * 2,
  );
}

export { gateButtonRect, rectForResizeTab };
