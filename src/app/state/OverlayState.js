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

import {appStore, observeAppStore} from "../../state/appStore.js"

/**
 * Tracks the one overlay that is currently active.
 *
 * The value lives in the app store, where the React chrome reads it; this class is the
 * Observable-flavoured view of it that the dialog modules and the models subscribe to.
 */
class OverlayState {
    constructor() {
        appStore.setState({activeOverlay: "menu"});
        this._active = observeAppStore(state => state.activeOverlay).whenDifferent();
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
        return appStore.getState().activeOverlay;
    }

    /**
     * @param {!string} name
     * @returns {void}
     */
    open(name) {
        appStore.getState().openOverlay(name);
    }

    /**
     * @returns {void}
     */
    close() {
        appStore.getState().closeOverlay();
    }
}

export {OverlayState}
