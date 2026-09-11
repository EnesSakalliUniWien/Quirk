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

export {scheduleBoot}
