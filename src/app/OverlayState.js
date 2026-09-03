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

import {ObservableValue} from "../base/Obs.js"

/**
 * Tracks the one overlay that is currently active.
 */
class OverlayState {
    constructor() {
        this._activeOverlay = new ObservableValue("menu");
        this._active = this._activeOverlay.observable().whenDifferent();
    }

    /**
     * @returns {!Observable.<undefined|!string>}
     */
    active() {
        return this._active;
    }

    /**
     * @returns {undefined|!string} The overlay that is showing right now.
     */
    current() {
        return this._activeOverlay.get();
    }

    /**
     * @param {!string} name
     * @returns {void}
     */
    open(name) {
        this._activeOverlay.set(name);
    }

    /**
     * @returns {void}
     */
    close() {
        this._activeOverlay.set(undefined);
    }
}

export {OverlayState}
