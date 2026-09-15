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

import { createStore } from "zustand/vanilla";

/**
 * The shell's UI state, in one zustand store that the React components read with `useStore` and
 * the plain modules read with `appStore.getState()` and `appStore.subscribe()`.
 *
 * The circuit itself is not here: it lives in the Revision and the EditorState store.
 * Panel layout is not here either: it belongs to the layout manager.
 */
const appStore = createStore((set) => ({
  /** @type {!number} The circuit camera's zoom factor; 1 is the natural drawing size. */
  zoom: 1,
  /** @param {!number} zoom Already clamped by the camera. */
  setZoom: (zoom) => set({ zoom }),

  /** What the circuit action buttons may do right now. Mirrored from CircuitActions. */
  circuitAvailability: {
    canUndo: false,
    canRedo: false,
    canClearCircuit: false,
    canClearAll: false,
  },
  /** @type {undefined|!CircuitActions} Set once by startQuirk. */
  circuitActions: undefined,
  /** @type {undefined|!RegisterActions} Edits to the registers, each one commit. Set once by startQuirk. */
  registerActions: undefined,

  /** Where the transport is parked and what it may do. Mirrored from Playhead. */
  playheadState: {
    step: 0,
    columnCount: 0,
    playing: false,
    canPlay: false,
    canStepBack: false,
    canStepForward: false,
  },
  /** @type {undefined|!Playhead} Set once by startQuirk. */
  playhead: undefined,
  /** @type {undefined|!Object} Records and restores completed simulation results. */
  recorder: undefined,

  /** The gate palette's pipelines, read by the gates panel. Undefined until the circuit panel has
   *  started the circuit.
   *  @type {undefined|!{obsCustomGateSet: !Observable, mostRecentStats: import("zustand/vanilla").StoreApi,
   *      onGrab: !function(!Gate, !PointerEvent): void, onPlace: !function(!Gate): void}} */
  gateToolbox: undefined,

  /** @type {!boolean} False until the first frame is about to be painted; the shell hides itself
   *  until then rather than showing a half-built app. */
  booted: false,

  /** @type {undefined|!Object} The dock's api, set once the layout manager is ready. Panels are
   *  opened and closed through src/components/dock.jsx, which reads it from here. */
  dock: undefined,

  /** What the panels read the circuit through. Published once by startQuirk.
   *  @type {undefined|!{revision: !Revision, displayed: import("zustand/vanilla").StoreApi,
   *      mostRecentStats: import("zustand/vanilla").StoreApi, completed: import("zustand/vanilla").StoreApi, recorder: !Object,
   *      cycleTime: !function(): !number}} */
  panelDeps: undefined,

  /** @type {undefined|!{col: !int, row: !int, gate: !Gate}} The gate the parameter panel edits,
   *  set by the click that opens it. Transient, so it is not part of the dock's layout. */
  gateParamTarget: undefined,
  forgeRange: undefined,
  customGateFocus: undefined,

  /** @type {undefined|!{row: !int, col: (undefined|!int)}} The sphere the Bloch panel enlarges. */
  blochTarget: undefined,

  /** @type {undefined|!string} The register the Registers panel should show and focus, by name.
   *  Transient, like the targets above. */
  registerTarget: undefined,

  /** @type {undefined|!{name: !string, rect: !{x: !number, y: !number, w: !number, h: !number}}}
   *  The register being renamed in place on the canvas, and where its name is, in circuit
   *  coordinates. */
  registerRename: undefined,

  /** @type {undefined|!{wire: !int, register: (undefined|!string),
   *      rect: (undefined|!{x: !number, y: !number, w: !number, h: !number}), x: !number, y: !number}}
   *  The wire label whose menu is open, its register's name rect in circuit coordinates when it
   *  has one, and where the pointer was, in client coordinates. */
  gutterMenu: undefined,
}));

export { appStore };
