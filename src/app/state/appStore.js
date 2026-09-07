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

import {createStore} from "zustand/vanilla"
import {Observable} from "../../base/Obs.js"

/**
 * The shell's UI state, in one zustand store that the React components read with `useStore` and
 * the plain modules read with `appStore.getState()` and `appStore.subscribe()`.
 *
 * The circuit itself is not here: it lives in the Revision and the DisplayedInspector observable.
 * This store holds what the chrome shows and which model instances its buttons act on.
 */
const appStore = createStore((set) => ({
    /** @type {undefined|!string} The overlay that is open, or undefined for none. */
    activeOverlay: "menu",
    /** @param {!string} name */
    openOverlay: name => set({activeOverlay: name}),
    closeOverlay: () => set({activeOverlay: undefined}),

    /** @type {!number} The circuit camera's zoom factor; 1 is the natural drawing size. */
    zoom: 1,
    /** @param {!number} zoom Already clamped by the camera. */
    setZoom: zoom => set({zoom}),

    /** @type {!Object.<!string, !string>} Overlay name -> the snap zone it is docked into. */
    dockModes: {},
    /** @param {!Object.<!string, !string>} dockModes */
    setDockModes: dockModes => set({dockModes}),

    /** What the circuit action buttons may do right now. Mirrored from CircuitActions. */
    circuitAvailability: {canUndo: false, canRedo: false, canClearCircuit: false, canClearAll: false},
    /** @type {undefined|!CircuitActions} Set once by startQuirk. */
    circuitActions: undefined,

    /** Where the transport is parked and what it may do. Mirrored from Playhead. */
    playheadState: {
        step: 0, columnCount: 0, playing: false, canPlay: false, canStepBack: false, canStepForward: false},
    /** @type {undefined|!Playhead} Set once by startQuirk. */
    playhead: undefined,
}));

/**
 * Exposes one field of the store as an Observable in the style of src/base/Obs.js: the current
 * value on subscribe, then every change. For the plain modules that still speak Observable.
 *
 * @param {!function(!Object): T} selector
 * @returns {!Observable.<T>}
 * @template T
 */
function observeAppStore(selector) {
    return new Observable(observer => {
        observer(selector(appStore.getState()));
        return appStore.subscribe((state, previous) => {
            let next = selector(state);
            if (next !== selector(previous)) {
                observer(next);
            }
        });
    });
}

export {appStore, observeAppStore}
