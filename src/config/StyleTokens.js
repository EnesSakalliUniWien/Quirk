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

/**
 * Reads a custom property off the document root, so the canvas draws with the values the
 * stylesheet declares instead of a second copy of them.
 *
 * The fallback covers the cases with no document to read: the test page, which loads the modules
 * without the app's stylesheet, and a stylesheet that has not parsed yet.
 *
 * @param {!string} name The custom property, including its leading dashes.
 * @param {!string} fallback
 * @returns {!string}
 */
function readStyleToken(name, fallback) {
    if (typeof document === 'undefined' || document.documentElement === null) {
        return fallback;
    }
    let value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value === '' ? fallback : value;
}

export {readStyleToken}
