import {createValueStore} from '../../../src/base/valueStore.js';
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

import {Suite, assertThat} from "../../TestUtil.js"
import {Layout} from "../../../src/config/Layout.js"
import {EditorState} from "../../../src/editor/state/EditorState.js"
import {Rect} from "../../../src/geometry/Rect.js"

const suite = new Suite("EditorState");

suite.test("centersTheCircuitVerticallyInATallArea", () => {
    const inspector = EditorState.empty(new Rect(0, 0, 1000, 800));

    const band = inspector.displayedCircuit.desiredHeight();
    assertThat(inspector.displayedCircuit.top).isEqualTo(Math.floor((800 - band) / 2));
});

suite.test("pinsTheCircuitToTheTopMarginWhenTheAreaIsShort", () => {
    const inspector = EditorState.empty(new Rect(0, 0, 1000, 100));

    assertThat(inspector.displayedCircuit.top).isEqualTo(Layout.CIRCUIT_TOP_MARGIN);
});

suite.test("wantsTheCircuitBandPlusSymmetricMargins", () => {
    const inspector = EditorState.empty(new Rect(0, 0, 1000, 800));

    assertThat(inspector.desiredHeight()).isEqualTo(
        inspector.displayedCircuit.desiredHeight() + 2 * Layout.CIRCUIT_TOP_MARGIN);
});

suite.test("endsOutputDisplaysAtTheRightEdgeOfASpaciousArea", () => {
    const wide = EditorState.empty(new Rect(0, 0, 1600, 800));
    const narrow = EditorState.empty(new Rect(0, 0, 1400, 800));

    // The circuit fills the available width instead of leaving dead space to its right. gateRect
    // snaps display columns to the pixel grid, so allow a pixel; the helper compares with a
    // strict <, which an epsilon of exactly the snap size would sit on the boundary of.
    assertThat(wide.displayedCircuit.desiredWidth()).isApproximatelyEqualTo(1600, 1);
    assertThat(narrow.displayedCircuit.desiredWidth()).isApproximatelyEqualTo(1400, 1);

    // Circuit columns stay put; only the output displays move right.
    assertThat(wide.displayedCircuit.opRect(0).x).isEqualTo(narrow.displayedCircuit.opRect(0).x);
    assertThat(wide.displayedCircuit.opRect(wide.displayedCircuit.clampedCircuitColCount() + 1).x).
        isGreaterThan(narrow.displayedCircuit.opRect(narrow.displayedCircuit.clampedCircuitColCount() + 1).x);
});

suite.test("growsPastTheAreaSoALongCircuitCanScroll", () => {
    const inspector = EditorState.empty(new Rect(0, 0, 400, 800));

    // Too narrow to right-align into, so the circuit keeps its natural width and the page scrolls.
    assertThat(inspector.displayedCircuit.desiredWidth()).isGreaterThan(400);
});

suite.test('area updates preserve the previous snapshot and cached geometry', () => {
    const area = new Rect(0, 0, 1000, 800);
    const original = EditorState.empty(area);
    const geometry = original.displayedCircuit.geometry();
    const resized = original.withArea(new Rect(0, 0, 1400, 1000));
    area.h = 1;
    assertThat(original.drawArea.h).isEqualTo(800);
    assertThat(original.displayedCircuit.geometry() === geometry).isEqualTo(true);
    assertThat(resized.drawArea.h).isEqualTo(1000);
    assertThat(resized.displayedCircuit.top).isEqualTo(Math.floor((1000 - resized.displayedCircuit.desiredHeight()) / 2));
    assertThat(resized.displayedCircuit.desiredWidth()).isApproximatelyEqualTo(1400, 1);
    assertThat(original.withArea(new Rect(0, 0, 1000, 800)) === original).isEqualTo(true);
    assertThat(Object.isFrozen(original)).isEqualTo(true);
});

suite.test('area changes notify state subscribers only when published', () => {
    const original = EditorState.empty(new Rect(0, 0, 1000, 800));
    const store = createValueStore(original);
    const notifications = [];
    const unsubscribe = store.subscribe(state => notifications.push(state.value));
    const resized = original.withArea(new Rect(0, 0, 1000, 500));
    assertThat(store.getState().value === original).isEqualTo(true);
    assertThat(notifications.length).isEqualTo(0);
    store.setState({value: resized});
    assertThat(notifications.length).isEqualTo(1);
    assertThat(notifications[0] === resized).isEqualTo(true);
    unsubscribe();
});
