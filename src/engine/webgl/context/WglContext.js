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

import { sharedCanvas, sharedContext, webGl2SupportProblem } from "./issues.js";

/**
 * A WebGL2RenderingContext wrapped with metadata helpers, lifetime information, and utility methods.
 */
class WglContext {
  /**
   * Wraps a WebGL2RenderingContext. Throws when the context is missing a capability the engine needs.
   * @param {!HTMLCanvasElement} canvas
   * @param {!WebGL2RenderingContext} context
   */
  constructor(canvas, context) {
    let problem = webGl2SupportProblem();
    if (problem !== undefined) {
      throw new Error("Error creating WebGL2 context: " + problem);
    }

    /**
     * A hidden canvas backing the WglContext.
     * @type {!HTMLCanvasElement}
     */
    this.canvas = canvas;

    /**
     * The WebGL2RenderingContext instance associated with the WglContext.
     * @type {!WebGL2RenderingContext}
     */
    this.gl = context;

    // Float render targets and float readPixels. Checked above; calling getExtension enables it.
    this.gl.getExtension("EXT_color_buffer_float");

    /** @type {undefined|!function():void} */
    this.onContextRestored = undefined;

    /**
     * Changed when the wrapped context is lost/restored and things need to be re-created.
     * @type {!int}
     */
    this.lifetimeCounter = 0;

    // Wire lifetime updates.
    this.canvas.addEventListener(
      "webglcontextrestored",
      (event) => {
        event.preventDefault();
        this._recomputeProperties();
        if (this.onContextRestored !== undefined) {
          this.onContextRestored();
        }
      },
      false,
    );
    this.canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        this.lifetimeCounter++;
      },
      false,
    );

    this._recomputeProperties();
  }

  /**
   * Forces every context-bound resource (shaders, textures, buffers) to be rebuilt on next use.
   */
  invalidateExistingResources() {
    this.lifetimeCounter++;
  }

  /**
   * @private
   */
  _recomputeProperties() {
    this.lifetimeCounter++;
    const GL = WebGL2RenderingContext;
    /** @type {!int} */
    this.maxTextureUnits = this.gl.getParameter(GL.MAX_TEXTURE_IMAGE_UNITS);
    /** @type {!int} */
    this.maxTextureSize = this.gl.getParameter(GL.MAX_TEXTURE_SIZE);
  }
}

// We really only ever want one instance to exist.
// Having more of them just causes problems (e.g. eventually tests start failing).
let __sharedInstance = undefined;

/**
 * @returns {!WglContext} The application's single WebGL2 context, created on first use.
 */
function initializedWglContext() {
  if (__sharedInstance === undefined) {
    __sharedInstance = new WglContext(sharedCanvas, sharedContext);
  }
  return __sharedInstance;
}

export { initializedWglContext };
