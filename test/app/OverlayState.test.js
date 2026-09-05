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
import {OverlayState} from "../../src/app/OverlayState.js"

let suite = new Suite("OverlayState");

suite.test("starts with the menu active", () => {
    let overlays = new OverlayState();

    assertThat(overlays.active().snapshot()).isEqualTo(["menu"]);
});

suite.test("open replaces the active overlay", () => {
    let overlays = new OverlayState();

    overlays.open("export");
    overlays.open("forge");

    assertThat(overlays.active().snapshot()).isEqualTo(["forge"]);
});

suite.test("close clears the active overlay", () => {
    let overlays = new OverlayState();

    overlays.close();

    assertThat(overlays.active().snapshot()).isEqualTo([undefined]);
});

suite.test("active emits only changes", () => {
    let overlays = new OverlayState();
    let seen = [];
    overlays.active().subscribe(active => seen.push(active));

    overlays.open("menu");
    overlays.open("export");
    overlays.open("export");
    overlays.close();
    overlays.close();

    assertThat(seen).isEqualTo(["menu", "export", undefined]);
});
