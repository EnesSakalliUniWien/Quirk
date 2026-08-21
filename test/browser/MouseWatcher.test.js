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

import {Suite, assertTrue, assertFalse} from "../TestUtil.js"
import {isLeftClicking, isLeftButtonHeld, isMiddleClicking} from "../../src/browser/MouseWatcher.js"

let suite = new Suite("MouseWatcher");

suite.test("isLeftClicking reads the button that changed", () => {
    // 'button' is 0 for left, 1 for middle, 2 for right.
    assertTrue(isLeftClicking(new MouseEvent('mousedown', {button: 0, buttons: 1})));
    assertFalse(isLeftClicking(new MouseEvent('mousedown', {button: 1, buttons: 4})));
    assertFalse(isLeftClicking(new MouseEvent('mousedown', {button: 2, buttons: 2})));

    // On mouseup the released button is still named by 'button', even though 'buttons' no longer includes it.
    assertTrue(isLeftClicking(new MouseEvent('mouseup', {button: 0, buttons: 0})));
    assertFalse(isLeftClicking(new MouseEvent('mouseup', {button: 1, buttons: 0})));
});

suite.test("isLeftButtonHeld reads the buttons still pressed", () => {
    // 'buttons' is a mask: 1 for left, 2 for right, 4 for middle.
    assertTrue(isLeftButtonHeld(new MouseEvent('mousemove', {button: 0, buttons: 1})));
    assertTrue(isLeftButtonHeld(new MouseEvent('mousemove', {button: 0, buttons: 3})));
    assertFalse(isLeftButtonHeld(new MouseEvent('mousemove', {button: 0, buttons: 0})));
    assertFalse(isLeftButtonHeld(new MouseEvent('mousemove', {button: 0, buttons: 2})));

    // A move with no button held reports button 0, which is why the held check cannot use 'button'.
    assertTrue(isLeftClicking(new MouseEvent('mousemove', {button: 0, buttons: 0})));
});

suite.test("isMiddleClicking reads the button that changed", () => {
    assertTrue(isMiddleClicking(new MouseEvent('mousedown', {button: 1, buttons: 4})));
    assertFalse(isMiddleClicking(new MouseEvent('mousedown', {button: 0, buttons: 1})));
    assertFalse(isMiddleClicking(new MouseEvent('mousedown', {button: 2, buttons: 2})));
});
