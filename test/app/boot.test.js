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
import {shouldShowWelcome, SEEN_WELCOME_STORAGE_KEY} from "../../src/app/boot.js"

let suite = new Suite("boot");

/**
 * @returns {!Storage} Enough of the Storage interface for the welcome flag.
 */
function fakeStorage() {
    let items = new Map();
    return {
        getItem: key => items.has(key) ? items.get(key) : null,
        setItem: (key, value) => items.set(key, String(value))
    };
}

suite.test("shows the welcome exactly once for an empty circuit", () => {
    let storage = fakeStorage();

    assertTrue(shouldShowWelcome(true, storage));
    assertFalse(shouldShowWelcome(true, storage));
    assertFalse(shouldShowWelcome(true, storage));
});

suite.test("a load that carries a circuit never greets, and doesn't spend the greeting", () => {
    let storage = fakeStorage();

    assertFalse(shouldShowWelcome(false, storage));
    // The greeting is still owed to the first empty-circuit load.
    assertTrue(shouldShowWelcome(true, storage));
});

suite.test("a storage that throws still gets the welcome instead of an error", () => {
    let storage = {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); }
    };

    // Nothing can be remembered, so every load greets; the app must not crash over it.
    assertTrue(shouldShowWelcome(true, storage));
    assertTrue(shouldShowWelcome(true, storage));
});

suite.test("respects a flag written by an earlier session", () => {
    let storage = fakeStorage();
    storage.setItem(SEEN_WELCOME_STORAGE_KEY, 'true');

    assertFalse(shouldShowWelcome(true, storage));
});
