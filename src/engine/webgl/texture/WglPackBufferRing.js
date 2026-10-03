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

import { initializedWglContext } from "../context/WglContext.js";

/**
 * A buffer for a read to write its pixels into, and what it is made of.
 *
 * @typedef {!{buffer: !WebGLBuffer, byteLength: !int, lifetime: !int}} PackBuffer
 *     `lifetime` is the context's lifetime counter when the buffer was made, which says whether the
 *     buffer is still any use: the context's `lifetimeCounter` has moved on if it was lost.
 */

/**
 * How many buffers are kept waiting between reads. A read in the background is one at a time, so a
 * frame gives its buffer back just before the next asks for one; a few more cover a cancelled read
 * and an edit that changes the size, without holding a megabyte for every size the circuit has been.
 */
const IDLE_LIMIT = 3;

/**
 * Buffers waiting to be read into again, the one given back longest ago first.
 * @type {!Array.<!PackBuffer>}
 */
const idle = [];

/**
 * The buffers that reads into `PIXEL_PACK_BUFFER` write their pixels to, kept for the next read.
 *
 * A read in the background (`WglTexture.startReadPixels`) runs on every animation frame, with the
 * same size of data frame after frame. Making a buffer for each, with `bufferData`, and deleting it
 * once its pixels were fetched, allocated and freed up to a megabyte of GPU memory a frame. This
 * hands a buffer out, and takes it back when its read is over, so that the next read of that size
 * writes into the same one. Only the buffers are shared: every read still has a fence of its own.
 *
 * A buffer is out of the ring from `take` to `give`, so two reads under way never write to one buffer.
 * Reusing a buffer whose read was cancelled before the GPU got to it is safe too: the GPU runs
 * commands in the order it was given them, so the first read finishes before the next one starts.
 */
class WglPackBufferRing {
  /**
   * Hands out a buffer of exactly the given size, from those waiting if one is, else a new one.
   *
   * @param {!int} byteLength
   * @returns {!PackBuffer} The caller's until it is given back.
   */
  static take(byteLength) {
    const context = initializedWglContext();
    WglPackBufferRing._dropStale(context);
    const waiting = idle.findLastIndex((e) => e.byteLength === byteLength);
    if (waiting !== -1) {
      return idle.splice(waiting, 1)[0];
    }

    const GL = WebGL2RenderingContext;
    const gl = context.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(GL.PIXEL_PACK_BUFFER, buffer);
    try {
      gl.bufferData(GL.PIXEL_PACK_BUFFER, byteLength, GL.STREAM_READ);
    } finally {
      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
    }
    return { buffer, byteLength, lifetime: context.lifetimeCounter };
  }

  /**
   * Takes a buffer back once its pixels have been fetched or are no longer wanted, to be handed out
   * again. The one that has waited longest is deleted if too many are waiting, and so is a buffer
   * that the context no longer has a use for. A buffer made before the context was lost is only
   * dropped: the restored context did not create it, and deleting it there would be an error.
   *
   * @param {!PackBuffer} pack
   */
  static give(pack) {
    const context = initializedWglContext();
    if (pack.lifetime !== context.lifetimeCounter) {
      WglPackBufferRing._delete(pack, context);
      return;
    }
    idle.push(pack);
    while (idle.length > IDLE_LIMIT) {
      WglPackBufferRing._delete(idle.shift(), context);
    }
  }

  /** Deletes every buffer that is waiting, to give the GPU memory back. */
  static release() {
    const context = initializedWglContext();
    for (const pack of idle.splice(0)) {
      WglPackBufferRing._delete(pack, context);
    }
  }

  /**
   * Lets go of the waiting buffers that were made in an earlier lifetime of the context.
   *
   * @param {!WglContext} context
   * @private
   */
  static _dropStale(context) {
    for (let i = idle.length - 1; i >= 0; i--) {
      if (idle[i].lifetime !== context.lifetimeCounter) {
        WglPackBufferRing._delete(idle.splice(i, 1)[0], context);
      }
    }
  }

  /**
   * @param {!PackBuffer} pack
   * @param {!WglContext} context
   * @private
   */
  static _delete(pack, context) {
    if (pack.lifetime > context.lostAtLifetime) {
      context.gl.deleteBuffer(pack.buffer);
    }
  }
}

export { WglPackBufferRing };
