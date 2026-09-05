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
import {
    safeRectFor,
    zoneForPointer,
    rectForZone,
    SNAP_EDGE_PX,
    setDockMode,
    clearDockMode,
    resetDockModes,
    dockModes,
} from "../../src/app/dialogSnap.js"

let suite = new Suite("dialogSnap");

const SAFE = safeRectFor(1200, 800, 100);

suite.test("safeRectFor excludes the chrome strip", () => {
    assertThat(SAFE).isEqualTo({x: 0, y: 100, w: 1200, h: 700});
});

suite.test("pointer near the left edge hits the left zone", () => {
    assertThat(zoneForPointer(SNAP_EDGE_PX - 1, 400, SAFE)).isEqualTo('left');
    assertThat(zoneForPointer(SNAP_EDGE_PX + 1, 400, SAFE)).isEqualTo(undefined);
});

suite.test("pointer near the right edge hits the right zone", () => {
    assertThat(zoneForPointer(1200 - SNAP_EDGE_PX + 1, 400, SAFE)).isEqualTo('right');
    assertThat(zoneForPointer(1200 - SNAP_EDGE_PX - 1, 400, SAFE)).isEqualTo(undefined);
});

suite.test("pointer near the safe-area top hits the max zone", () => {
    assertThat(zoneForPointer(600, 100 + SNAP_EDGE_PX - 1, SAFE)).isEqualTo('max');
    assertThat(zoneForPointer(600, 100 + SNAP_EDGE_PX + 1, SAFE)).isEqualTo(undefined);
});

suite.test("corners prefer the side zones over max", () => {
    assertThat(zoneForPointer(2, 101, SAFE)).isEqualTo('left');
    assertThat(zoneForPointer(1198, 101, SAFE)).isEqualTo('right');
});

suite.test("rectForZone splits the safe area", () => {
    assertThat(rectForZone('left', SAFE)).isEqualTo({x: 0, y: 100, w: 600, h: 700});
    assertThat(rectForZone('right', SAFE)).isEqualTo({x: 600, y: 100, w: 600, h: 700});
    assertThat(rectForZone('max', SAFE)).isEqualTo({x: 0, y: 100, w: 1200, h: 700});
});

suite.test("dock modes are remembered per dialog and observable", () => {
    resetDockModes();
    let seen = [];
    let unsub = dockModes().subscribe(modes => seen.push(modes));

    setDockMode('bloch', 'right');
    setDockMode('menu', 'max');
    clearDockMode('bloch');
    resetDockModes();
    unsub();

    assertThat(seen).isEqualTo([
        {},
        {bloch: 'right'},
        {bloch: 'right', menu: 'max'},
        {menu: 'max'},
        {},
    ]);
});

suite.test("resetDockModes does not emit when already empty", () => {
    resetDockModes();
    let seen = [];
    let unsub = dockModes().subscribe(modes => seen.push(modes));

    resetDockModes();
    resetDockModes();
    unsub();

    assertThat(seen).isEqualTo([{}]);
});
