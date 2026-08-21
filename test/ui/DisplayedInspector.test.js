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

import {Suite, assertThat} from "../TestUtil.js"
import {Layout} from "../../src/config/Layout.js"
import {DisplayedInspector} from "../../src/ui/DisplayedInspector.js"
import {Rect} from "../../src/math/Rect.js"

let suite = new Suite("DisplayedInspector");

suite.test("laysOutCircuitDirectlyUnderStackedToolboxes", () => {
    let inspector = DisplayedInspector.empty(new Rect(0, 0, 1000, 800));

    assertThat(inspector.displayedToolboxTop.top).isEqualTo(0);
    assertThat(inspector.displayedToolboxBottom.top).
        isEqualTo(inspector.displayedToolboxTop.desiredHeight());
    assertThat(inspector.displayedToolboxTop.desiredHeight()).isEqualTo(128);
    assertThat(inspector.displayedToolboxBottom.desiredHeight()).isEqualTo(164);
    assertThat(inspector.displayedCircuit.top).isEqualTo(
        inspector.displayedToolboxBottom.top +
        inspector.displayedToolboxBottom.desiredHeight() +
        Layout.TOOLBOX_CIRCUIT_MARGIN);
});

suite.test("keepsCircuitBelowToolboxesWhenAreaIsShort", () => {
    let inspector = DisplayedInspector.empty(new Rect(0, 0, 1000, 100));
    let toolboxesBottom =
        inspector.displayedToolboxBottom.top + inspector.displayedToolboxBottom.desiredHeight();

    assertThat(inspector.displayedCircuit.top).isEqualTo(toolboxesBottom + Layout.TOOLBOX_CIRCUIT_MARGIN);
});

suite.test("endsOutputDisplaysAtTheRightEdgeOfASpaciousArea", () => {
    let wide = DisplayedInspector.empty(new Rect(0, 0, 1600, 800));
    let narrow = DisplayedInspector.empty(new Rect(0, 0, 900, 800));

    // The circuit fills the available width instead of leaving dead space to its right. gateRect
    // snaps display columns to the pixel grid, so allow a pixel; the helper compares with a
    // strict <, which an epsilon of exactly the snap size would sit on the boundary of.
    assertThat(wide.displayedCircuit.desiredWidth()).isApproximatelyEqualTo(1600, 1);
    assertThat(narrow.displayedCircuit.desiredWidth()).isApproximatelyEqualTo(900, 1);

    // Circuit columns stay put; only the output displays move right.
    assertThat(wide.displayedCircuit.opRect(0).x).isEqualTo(narrow.displayedCircuit.opRect(0).x);
    assertThat(wide.displayedCircuit.opRect(wide.displayedCircuit.clampedCircuitColCount() + 1).x).
        isGreaterThan(narrow.displayedCircuit.opRect(narrow.displayedCircuit.clampedCircuitColCount() + 1).x);
});

suite.test("growsPastTheAreaSoALongCircuitCanScroll", () => {
    let inspector = DisplayedInspector.empty(new Rect(0, 0, 400, 800));

    // Too narrow to right-align into, so the circuit keeps its natural width and the page scrolls.
    assertThat(inspector.displayedCircuit.desiredWidth()).isGreaterThan(400);
});
