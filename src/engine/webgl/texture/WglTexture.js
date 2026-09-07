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
import { Util } from "../../../base/Util.js";
import { WglMortalValueSlot } from "../context/WglMortalValueSlot.js";
import { initializedWglContext } from "../context/WglContext.js";
import {
  checkGetErrorResult,
  checkFrameBufferStatusResult,
} from "../context/WglUtil.js";
// Both of these import WglTexture back. The cycle is safe: each side only uses the other inside
// methods, never while the modules are being evaluated.
import { WglTexturePool } from "./WglTexturePool.js";
import { WglTextureTrader } from "./WglTextureTrader.js";

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

    if (!Util.isPowerOf2(width) || !Util.isPowerOf2(height)) {
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
   * Applies a series of shaders to the texture through a trader, returning the final texture.
   * @param {!function(!WglTextureTrader) : void} traderFunc
   * @param {!boolean=} keepInput Determines if the receiving texture is deallocated by the trading process.
   * @returns {!WglTexture}
   */
  tradeThrough(traderFunc, keepInput = false) {
    let t = new WglTextureTrader(this);
    if (keepInput) {
      t.dontDeallocCurrentTexture();
    }
    traderFunc(t);
    return t.currentTexture;
  }

  /**
   * For catching use-after-free bugs, despite texture pooling.
   * Moves the underlying WebGLTexture to a new instance, and marks this instance as invalidated.
   * @param {*} details
   * @returns {!WglTexture}
   */
  invalidateButMoveToNewInstance(details) {
    let result = new WglTexture(this.width, this.height, this.pixelType);
    result._textureAndFrameBufferSlot = this._textureAndFrameBufferSlot;
    let invalidated = () => {
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
    let gl = initializedWglContext().gl;
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
    let gl = initializedWglContext().gl;

    let result = {
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
   * Performs a blocking read of the pixel color data in this texture.
   * @param {!boolean=} checkErrors Whether to run the (slow) GL error checks around the read.
   *     Defaults to the diagnostics setting for hot paths.
   * @returns {!Uint8Array|!Float32Array}
   */
  readPixels(checkErrors = false) {
    const GL = WebGL2RenderingContext;
    if (!this._hasBeenRenderedTo) {
      throw new Error(
        "Called readPixels on a texture that hasn't been rendered to.",
      );
    }

    let outputBuffer;
    switch (this.pixelType) {
      case GL.UNSIGNED_BYTE:
        outputBuffer = new Uint8Array(this.width * this.height * 4);
        break;
      case GL.FLOAT:
        outputBuffer = new Float32Array(this.width * this.height * 4);
        break;
      default:
        throw new Error("Unrecognized pixel type.");
    }

    if (this.width === 0 || this.height === 0) {
      return outputBuffer;
    }

    let isOnHotPath = !checkErrors;
    let gl = initializedWglContext().gl;
    gl.bindFramebuffer(GL.FRAMEBUFFER, this.initializedFramebuffer());
    checkGetErrorResult(gl, "framebufferTexture2D", isOnHotPath);
    checkFrameBufferStatusResult(gl, isOnHotPath);
    gl.readPixels(
      0,
      0,
      this.width,
      this.height,
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
