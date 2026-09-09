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

import {initializedWglContext} from "../../engine/webgl/context/WglContext.js"

/**
 * Remembers that the welcome panel has been shown. Without it the panel is the app's starting
 * state on every load, which is a greeting the first time and an obstacle every time after.
 * @type {!string}
 */
const SEEN_WELCOME_STORAGE_KEY = 'shadow-quant.seen-welcome';

/**
 * @param {!Storage} storage
 * @returns {!boolean}
 */
function hasSeenWelcome(storage) {
    // Private windows and blocked site data throw rather than returning null, and a browser that
    // can't remember should still get the welcome rather than an error.
    try {
        return storage.getItem(SEEN_WELCOME_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * @param {!Storage} storage
 * @returns {void}
 */
function noteWelcomeSeen(storage) {
    try {
        storage.setItem(SEEN_WELCOME_STORAGE_KEY, 'true');
    } catch {
        // Nothing to do: the welcome simply shows again next time.
    }
}

/**
 * Whether this load should greet the user with the welcome panel, remembering a yes so the next
 * load doesn't repeat it. A load that already carries a circuit skips the greeting outright.
 *
 * @param {!boolean} circuitIsEmpty
 * @param {!Storage} storage
 * @returns {!boolean}
 */
function shouldShowWelcome(circuitIsEmpty, storage) {
    if (!circuitIsEmpty || hasSeenWelcome(storage)) {
        return false;
    }
    noteWelcomeSeen(storage);
    return true;
}

/**
 * Schedules the app's reveal: unhide the shell and paint the first frame. Deferred a tick so that
 * a WebGL initialization failure surfaces as a runtime error rather than killing the module
 * loading phase.
 *
 * @param {!{start: !function(): void, trigger: !function(): void}} redrawLoop
 * @param {!function(): void} onReady Reveals the shell, which renders hidden until the first
 *     frame is about to be painted.
 * @returns {void}
 */
function scheduleBoot(redrawLoop, onReady) {
    setTimeout(() => {
        onReady();
        redrawLoop.start();

        try {
            initializedWglContext().onContextRestored = () => redrawLoop.trigger();
        } catch (ex) {
            // If that failed, the user is already getting warnings about WebGL not being supported.
            // Just silently log it.
            console.error(ex);
        }
    }, 0);
}

export {scheduleBoot, shouldShowWelcome, SEEN_WELCOME_STORAGE_KEY}
