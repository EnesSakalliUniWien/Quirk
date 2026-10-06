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

import { DetailedError } from "../../../base/DetailedError.js";
import { initializedWglContext } from "../context/WglContext.js";
import { WglPackBufferRing } from "./WglPackBufferRing.js";

/**
 * Pixels on their way from the GPU, read without waiting for the GPU to finish.
 *
 * `readPixels` into an array makes the browser wait for every command queued before it. Read into a
 * buffer instead, it returns at once, and a fence queued after the read says when the GPU has got
 * that far, so the buffer can be fetched then without a wait. WebGL never signals a fence in the task
 * that made it, so the pixels come a frame after they were asked for at the soonest.
 *
 * Make one with `WglTexture.startReadPixels`, then ask `poll` until it has the pixels, or `cancel`
 * when they are no longer wanted. Commands run in the order they were issued, so the texture the pixels
 * come from can go back to the pool as soon as the read has started. The buffer the pixels are written
 * to comes from a `WglPackBufferRing` and goes back to it when the read is over; the fence is the read's
 * own.
 */
class WglPixelReadback {
  /**
   * @param {undefined|!PackBuffer} pack Holds the pixels once the GPU has written them.
   * @param {undefined|!WebGLSync} sync Signals once it has.
   * @param {!function(new:(Float32Array|Uint8Array), !int)} ArrayType
   * @param {!int} length How many channel values the buffer holds.
   */
  constructor(pack, sync, ArrayType, length) {
    /** @private */
    this._pack = pack;
    /** @private */
    this._sync = sync;
    /** @private */
    this._ArrayType = ArrayType;
    /** @private */
    this._length = length;
    /**
     * The context's lifetime that made the buffer. Once the context is lost the buffer is gone, and
     * the restored context cannot answer for it.
     * @type {!int}
     * @private
     */
    this._lifetime = initializedWglContext().lifetimeCounter;
    /**
     * @type {undefined|!Float32Array|!Uint8Array}
     * @private
     */
    this._pixels = undefined;
  }

  /**
   * A read with nothing to wait for, as of a texture with no pixels.
   * @param {!function(new:(Float32Array|Uint8Array), !int)} ArrayType
   * @returns {!WglPixelReadback}
   */
  static empty(ArrayType) {
    const result = new WglPixelReadback(undefined, undefined, ArrayType, 0);
    result._pixels = new ArrayType(0);
    return result;
  }

  /**
   * Fetches the pixels if the GPU has written them, without waiting if it has not.
   *
   * @returns {undefined|!Float32Array|!Uint8Array} The pixels once they have arrived, and the same
   *     ones if asked again; undefined while the GPU is still at work.
   * @throws {!DetailedError} If the read was cancelled, or the context was lost while the pixels were
   *     on their way.
   */
  poll() {
    if (this._pixels !== undefined) {
      return this._pixels;
    }
    if (this._pack === undefined) {
      throw new DetailedError("The pixel read was cancelled.", {});
    }
    const context = initializedWglContext();
    if (this._lifetime !== context.lifetimeCounter) {
      this.cancel();
      throw new DetailedError(
        "The WebGL context was lost while pixels were being read.",
        {},
      );
    }

    const GL = WebGL2RenderingContext;
    const gl = context.gl;
    const status = gl.clientWaitSync(this._sync, 0, 0);
    if (status === GL.TIMEOUT_EXPIRED) {
      return undefined;
    }
    if (status === GL.WAIT_FAILED) {
      this.cancel();
      throw new DetailedError("Waiting for a pixel read failed.", {});
    }

    const pixels = new this._ArrayType(this._length);
    gl.bindBuffer(GL.PIXEL_PACK_BUFFER, this._pack.buffer);
    try {
      gl.getBufferSubData(GL.PIXEL_PACK_BUFFER, 0, pixels);
    } finally {
      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
    }
    this.cancel();
    this._pixels = pixels;
    return pixels;
  }

  /**
   * Gives the buffer back to the ring and lets go of the fence. The pixels are no longer to be had,
   * unless they have already been fetched. A read made before the context was last lost is only
   * dropped: the restored context did not create its buffer or fence, and deleting them there would
   * record an error.
   */
  cancel() {
    const pack = this._pack;
    const sync = this._sync;
    this._pack = undefined;
    this._sync = undefined;
    if (pack === undefined) {
      return;
    }
    const context = initializedWglContext();
    if (this._lifetime > context.lostAtLifetime) {
      context.gl.deleteSync(sync);
    }
    WglPackBufferRing.give(pack);
  }
}

export { WglPixelReadback };
