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
import { isPowerOf2 } from "../../math/powersOfTwo.js";
import { WglMortalValueSlot } from "../context/WglMortalValueSlot.js";
import { initializedWglContext } from "../context/WglContext.js";
import {
  checkGetErrorResult,
  checkFrameBufferStatusResult,
} from "../context/WglUtil.js";
import { WglPackBufferRing } from "./WglPackBufferRing.js";
import { WglPixelReadback } from "./WglPixelReadback.js";
// Both of these import WglTexture back. The cycle is safe: each side only uses the other inside
// methods, never while the modules are being evaluated.
import { WglTexturePool } from "./WglTexturePool.js";

/**
 * Stores pixel data for/from the gpu.
 * You can render to and pull data out of it.
 */
class WglTexture {
  /**
   * @param {!int} width
   * @param {!int} height
   * @param {!int} pixelType FLOAT (an RGBA32F texture) or UNSIGNED_BYTE (an RGBA8 texture).
   */
  constructor(width, height, pixelType = WebGL2RenderingContext.FLOAT) {
    if (width === 0 && height === 0) {
      this.width = 0;
      this.height = 0;
      this.pixelType = pixelType;
      this._hasBeenRenderedTo = true;
      this._textureAndFrameBufferSlot = new WglMortalValueSlot(
        () => {
          throw new DetailedError("Touched a zero-size texture.", this);
        },
        () => {
          throw new DetailedError("Touched a zero-size texture.", this);
        },
      );
      return;
    }

    if (!isPowerOf2(width) || !isPowerOf2(height)) {
      throw new DetailedError("Sizes must be a power of 2.", {
        width,
        height,
        pixelType,
      });
    }

    /** @type {!int} */
    this.width = width;
    /** @type {!int} */
    this.height = height;
    /** @type {!number} */
    this.pixelType = pixelType;
    /**
     * @type {!boolean}
     * @private
     */
    this._hasBeenRenderedTo = false;
    /**
     * @type {!WglMortalValueSlot.<!{texture: !WebGLTexture, framebuffer: !WebGLFramebuffer}>}
     * @private
     */
    this._textureAndFrameBufferSlot = new WglMortalValueSlot(
      () => this._textureAndFramebufferInitializer(),
      (e) => WglTexture._deinitialize(e),
    );
  }

  /**
   * @param {!int} sizePower
   * @returns {{w: !int, h: !int}}
   */
  static preferredWidthHeightForSizePower(sizePower) {
    let w = 1 << Math.ceil(sizePower / 2);
    let h = 1 << Math.floor(sizePower / 2);
    if (w === 2 && h === 2) {
      w = 4;
      h = 1;
    }
    return { w, h };
  }

  /**
   * Returns the base-2 logarithm of the texture's area.
   * @returns {!int}
   */
  sizePower() {
    if (this.width === 0) {
      return -Infinity;
    }
    return Math.round(Math.log2(this.width * this.height));
  }

  /**
   * @returns {!string}
   */
  toString() {
    return (
      "Texture(" +
      [
        this.width + "x" + this.height,
        this.pixelType === WebGL2RenderingContext.FLOAT
          ? "FLOAT"
          : this.pixelType === WebGL2RenderingContext.UNSIGNED_BYTE
            ? "UNSIGNED_BYTE"
            : this.pixelType,
        this._hasBeenRenderedTo ? "rendered" : "not rendered",
      ].join(", ") +
      ")"
    );
  }

  markRendered() {
    this._hasBeenRenderedTo = true;
  }

  /**
   * Puts the texture back into the texture pool. The texture must not be used afterwards.
   * @param {undefined|!string=} detailsShownWhenUsedAfterDone
   */
  deallocByDepositingInPool(detailsShownWhenUsedAfterDone = undefined) {
    WglTexturePool.deposit(this, detailsShownWhenUsedAfterDone);
  }

  /**
   * For catching use-after-free bugs, despite texture pooling.
   * Moves the underlying WebGLTexture to a new instance, and marks this instance as invalidated.
   * @param {*} details
   * @returns {!WglTexture}
   */
  invalidateButMoveToNewInstance(details) {
    const result = new WglTexture(this.width, this.height, this.pixelType);
    result._textureAndFrameBufferSlot = this._textureAndFrameBufferSlot;
    const invalidated = () => {
      throw new DetailedError(
        "WglTexture's value accessed after invalidation.",
        details,
      );
    };
    this._textureAndFrameBufferSlot = new WglMortalValueSlot(
      invalidated,
      invalidated,
    );
    return result;
  }

  /**
   * @returns {!WebGLTexture}
   */
  initializedTexture() {
    if (!this._hasBeenRenderedTo) {
      throw new Error(
        "Called initializedTexture on a texture that hasn't been rendered to.",
      );
    }
    return this._textureAndFrameBufferSlot.initializedValue(
      initializedWglContext().lifetimeCounter,
    ).texture;
  }

  /**
   * @returns {!WebGLFramebuffer}
   */
  initializedFramebuffer() {
    return this._textureAndFrameBufferSlot.initializedValue(
      initializedWglContext().lifetimeCounter,
    ).framebuffer;
  }

  /**
   * @private
   */
  static _deinitialize({ texture, framebuffer }) {
    const gl = initializedWglContext().gl;
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
  }

  ensureDeinitialized() {
    this._textureAndFrameBufferSlot.ensureDeinitialized();
  }

  /**
   * @returns {!{texture: !WebGLTexture, framebuffer: !WebGLFramebuffer}}
   * @private
   */
  _textureAndFramebufferInitializer() {
    const GL = WebGL2RenderingContext;
    const gl = initializedWglContext().gl;

    const result = {
      texture: gl.createTexture(),
      framebuffer: gl.createFramebuffer(),
    };

    gl.bindTexture(GL.TEXTURE_2D, result.texture);
    gl.bindFramebuffer(GL.FRAMEBUFFER, result.framebuffer);
    try {
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
      gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
      gl.texImage2D(
        GL.TEXTURE_2D,
        0,
        this.pixelType === GL.FLOAT ? GL.RGBA32F : GL.RGBA8,
        this.width,
        this.height,
        0,
        GL.RGBA,
        this.pixelType,
        null,
      );
      checkGetErrorResult(gl, "texImage2D");
      gl.framebufferTexture2D(
        GL.FRAMEBUFFER,
        GL.COLOR_ATTACHMENT0,
        GL.TEXTURE_2D,
        result.texture,
        0,
      );
      checkGetErrorResult(gl, "framebufferTexture2D");
      checkFrameBufferStatusResult(gl);
    } finally {
      gl.bindTexture(GL.TEXTURE_2D, null);
      gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    }

    return result;
  }

  /**
   * The rows a read of the first `pixelCount` pixels covers, and the array type that holds them.
   * @param {!int} pixelCount
   * @returns {!{rows: !int, ArrayType: !function(new:(Uint8Array|Float32Array), !int)}}
   * @private
   */
  _readLayout(pixelCount) {
    const GL = WebGL2RenderingContext;
    if (!this._hasBeenRenderedTo) {
      throw new Error(
        "Called readPixels on a texture that hasn't been rendered to.",
      );
    }

    const rows = this.width === 0 ? 0 : Math.min(this.height, Math.ceil(pixelCount / this.width));
    switch (this.pixelType) {
      case GL.UNSIGNED_BYTE:
        return { rows, ArrayType: Uint8Array };
      case GL.FLOAT:
        return { rows, ArrayType: Float32Array };
      default:
        throw new Error("Unrecognized pixel type.");
    }
  }

  /**
   * Starts reading the pixel color data in this texture without waiting for the GPU. The data comes
   * later, from the returned read. Commands run in the order they were issued, so rendering to the
   * texture again, or giving it back to the pool, once this has returned does not disturb the data.
   *
   * @param {!int=} pixelCount How many of the texture's pixels, in index order, the caller needs, as
   *     for readPixels.
   * @returns {!WglPixelReadback} Whose pixels are those of the rows read, four channels each, as
   *     readPixels would have returned them.
   */
  startReadPixels(pixelCount = this.width * this.height) {
    const GL = WebGL2RenderingContext;
    const { rows, ArrayType } = this._readLayout(pixelCount);
    if (this.width === 0 || rows === 0) {
      return WglPixelReadback.empty(ArrayType);
    }

    const length = this.width * rows * 4;
    const gl = initializedWglContext().gl;
    // The buffer is from the ring of those reads give back, as every frame reads the same size.
    const pack = WglPackBufferRing.take(length * ArrayType.BYTES_PER_ELEMENT);
    try {
      // A buffer bound for packing takes the pixels where readPixels would write an array. Unbinding
      // it matters: a later readPixels into an array would otherwise fail.
      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, pack.buffer);
      try {
        gl.bindFramebuffer(GL.FRAMEBUFFER, this.initializedFramebuffer());
        checkGetErrorResult(gl, "framebufferTexture2D", true);
        checkFrameBufferStatusResult(gl, true);
        gl.readPixels(0, 0, this.width, rows, GL.RGBA, this.pixelType, 0);
        checkGetErrorResult(gl, `readPixels(..., RGBA, ${this.pixelType}, 0)`, true);
      } finally {
        gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
      }
      const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0);
      // The fence is only queued until the commands before it have been sent on.
      gl.flush();
      return new WglPixelReadback(pack, sync, ArrayType, length);
    } catch (ex) {
      // Not given back to the ring: a read that failed may have left the buffer without its storage.
      gl.deleteBuffer(pack.buffer);
      throw ex;
    }
  }

  /**
   * Performs a blocking read of the pixel color data in this texture.
   * @param {!boolean=} checkErrors Whether to run the (slow) GL error checks around the read.
   *     Defaults to the diagnostics setting for hot paths.
   * @param {!int=} pixelCount How many of the texture's pixels, in index order, the caller needs. Only
   *     the rows holding them are read: the read waits on the GPU and copies every byte it covers,
   *     so a texture sized up to a power of two need not be read past its data.
   * @returns {!Uint8Array|!Float32Array} The pixels of the rows read, four channels each.
   */
  readPixels(checkErrors = false, pixelCount = this.width * this.height) {
    const GL = WebGL2RenderingContext;
    const { rows, ArrayType } = this._readLayout(pixelCount);
    const outputBuffer = new ArrayType(this.width * rows * 4);

    if (this.width === 0 || rows === 0) {
      return outputBuffer;
    }

    const isOnHotPath = !checkErrors;
    const gl = initializedWglContext().gl;
    gl.bindFramebuffer(GL.FRAMEBUFFER, this.initializedFramebuffer());
    checkGetErrorResult(gl, "framebufferTexture2D", isOnHotPath);
    checkFrameBufferStatusResult(gl, isOnHotPath);
    gl.readPixels(
      0,
      0,
      this.width,
      rows,
      GL.RGBA,
      this.pixelType,
      outputBuffer,
    );
    checkGetErrorResult(
      gl,
      `readPixels(..., RGBA, ${this.pixelType}, ...)`,
      isOnHotPath,
    );

    return outputBuffer;
  }
}

export { WglTexture };
