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

import {Suite, assertThat, assertTrue} from "../../../TestUtil.js"
import {Shaders} from "../../../../src/engine/webgl/operations/Shaders.js"
import {WglArg} from "../../../../src/engine/webgl/shader/WglArg.js"
import {WglPackBufferRing} from "../../../../src/engine/webgl/texture/WglPackBufferRing.js"
import {WglShader} from "../../../../src/engine/webgl/shader/WglShader.js"
import {WglTexture} from "../../../../src/engine/webgl/texture/WglTexture.js"
import {WglTexturePool} from "../../../../src/engine/webgl/texture/WglTexturePool.js"
import {initializedWglContext} from "../../../../src/engine/webgl/context/WglContext.js"

const suite = new Suite("WglPixelReadback");

/** Writes the pixel's own coordinates, and a value, into every pixel of a float texture. */
const FILL = new WglShader(`
    uniform float v;
    void main() {
        fragColor = vec4(gl_FragCoord.xy, v, 254.5);
    }`);

/**
 * Asks for the pixels a frame at a time, as the app does. A fence cannot signal in the task that made
 * it, so this has to leave the task to get an answer.
 */
async function settled(readback) {
    const deadline = performance.now() + 10000;
    for (;;) {
        const pixels = readback.poll();
        if (pixels !== undefined) {
            return pixels;
        }
        if (performance.now() > deadline) {
            throw new Error("The GPU never answered.");
        }
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

/** The pixels FILL writes into a texture of the given size, four channels to a pixel. */
function filled(width, height, v) {
    return Float32Array.from({length: width * height * 4}, (_, i) =>
        [(Math.floor(i / 4) % width) + 0.5, Math.floor(i / (4 * width)) + 0.5, v, 254.5][i % 4]);
}

/**
 * Runs an action and counts the calls the context gets to the functions that make and free the buffers
 * and fences of reads, and the allocations of buffers made for packing pixels.
 *
 * @param {!function(): !Promise} action
 * @returns {!Promise.<!Object.<!string, !int>>}
 */
async function countingBufferCalls(action) {
    const prototype = WebGL2RenderingContext.prototype;
    const names = ["createBuffer", "bufferData", "deleteBuffer", "fenceSync", "deleteSync"];
    const originals = names.map(name => prototype[name]);
    const counts = Object.fromEntries(names.map(name => [name, 0]));
    names.forEach((name, i) => {
        prototype[name] = function (...args) {
            // Other buffers are made too, such as the corners every shader draws between.
            if (name !== "bufferData" || args[0] === WebGL2RenderingContext.PIXEL_PACK_BUFFER) {
                counts[name]++;
            }
            return originals[i].apply(this, args);
        };
    });
    try {
        await action();
    } finally {
        names.forEach((name, i) => {
            prototype[name] = originals[i];
        });
    }
    return counts;
}

suite.test("startReadPixels gives the pixels readPixels does, floats and bytes, whole or in part", async () => {
    const floats = new WglTexture(4, 4);
    FILL.withArgs(WglArg.float("v", 192.25)).renderTo(floats);
    const bytes = new WglTexture(4, 2, WebGL2RenderingContext.UNSIGNED_BYTE);
    new WglShader(`
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            fragColor = vec4(xy / 255.0, 10.0 / 255.0, 128.0 / 255.0);
        }`).withArgs().renderTo(bytes);

    for (const [texture, count] of [[floats, undefined], [floats, 5], [floats, 0], [bytes, undefined], [bytes, 3]]) {
        const read = texture.startReadPixels(count);
        // The fence has not been given the chance to signal yet, unless there is nothing to wait for.
        assertThat(read.poll() === undefined).isEqualTo(count !== 0);
        const pixels = await settled(read);
        const expected = count === undefined ? texture.readPixels() : texture.readPixels(false, count);
        assertThat(pixels).isEqualTo(expected);
        assertTrue(pixels.constructor === expected.constructor);
        // Once there, the pixels stay.
        assertTrue(read.poll() === pixels);
    }
    // A texture with nothing in it has nothing to wait for.
    assertThat(new WglTexture(0, 0).startReadPixels().poll()).isEqualTo(new Float32Array(0));
    // A read into a buffer leaves reads into arrays working.
    assertThat(floats.readPixels().length).isEqualTo(4 * 4 * 4);
});

suite.test("a texture can go back to the pool, and be drawn into again, as soon as its read has started", async () => {
    // The read is queued behind the drawing, and the next drawing is queued behind the read.
    const before = WglTexturePool.getUnReturnedTextureCount();
    const first = WglTexturePool.takeRawFloatTex(4);
    FILL.withArgs(WglArg.float("v", 1)).renderTo(first);
    // Nothing waits for the GPU before the read starts, so the drawing is still queued behind it.
    const read = first.startReadPixels();
    const expected = Float32Array.from({length: 4 * 16}, (_, i) =>
        [(Math.floor(i / 4) % 4) + 0.5, Math.floor(i / 16) + 0.5, 1, 254.5][i % 4]);
    first.deallocByDepositingInPool("while its pixels are on their way");

    // The pool hands the same texture out again, to be drawn over before the pixels have been fetched.
    const second = WglTexturePool.takeRawFloatTex(4);
    Shaders.color(9, 9, 9, 9).renderTo(second);
    for (let i = 0; i < 20; i++) {
        FILL.withArgs(WglArg.float("v", 100 + i)).renderTo(second);
    }
    const overwritten = second.readPixels();
    second.deallocByDepositingInPool();

    assertThat(await settled(read)).isEqualTo(expected);
    assertTrue(overwritten[2] === 119);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
});

suite.test("a cancelled read frees its buffer, and cannot be asked for pixels", async () => {
    const texture = new WglTexture(2, 2);
    FILL.withArgs(WglArg.float("v", 3)).renderTo(texture);
    const read = texture.startReadPixels();
    read.cancel();
    read.cancel();
    let message = undefined;
    try {
        read.poll();
    } catch (ex) {
        message = String(ex);
    }
    assertTrue(message !== undefined && /cancelled/.test(message), message);
    // Nothing was left bound or recorded as an error.
    assertThat(texture.readPixels(true).length).isEqualTo(16);
    assertThat(initializedWglContext().gl.getError()).isEqualTo(WebGL2RenderingContext.NO_ERROR);
});

suite.test("reads one after another write to one buffer, each with a fence of its own", async () => {
    WglPackBufferRing.release();
    const texture = new WglTexture(4, 4);
    const fill = v => FILL.withArgs(WglArg.float("v", v)).renderTo(texture);
    // The first read makes the buffer, and gives it back when its pixels have been fetched.
    fill(0);
    assertThat(await settled(texture.startReadPixels())).isEqualTo(filled(4, 4, 0));

    const counts = await countingBufferCalls(async () => {
        for (let v = 1; v <= 12; v++) {
            fill(v);
            const read = texture.startReadPixels();
            // The texture is drawn over before the pixels are fetched, as the next frame does.
            fill(v + 1000);
            assertThat(await settled(read)).isEqualTo(filled(4, 4, v));
        }
    });
    assertThat(counts).isEqualTo({createBuffer: 0, bufferData: 0, deleteBuffer: 0, fenceSync: 12, deleteSync: 12});
});

suite.test("reads under way together have buffers of their own, and only a few are kept", async () => {
    WglPackBufferRing.release();
    const texture = new WglTexture(4, 4);
    const fill = v => FILL.withArgs(WglArg.float("v", v)).renderTo(texture);
    const counts = await countingBufferCalls(async () => {
        const reads = [];
        for (let v = 1; v <= 5; v++) {
            fill(v);
            reads.push(texture.startReadPixels());
        }
        for (const [i, read] of reads.entries()) {
            assertThat(await settled(read)).withInfo({i}).isEqualTo(filled(4, 4, i + 1));
        }
    });
    // None could share a buffer while all five were under way. Three wait for the next read; the two
    // that have waited longest are deleted.
    assertThat(counts.createBuffer).isEqualTo(5);
    assertThat(counts.deleteBuffer).isEqualTo(2);

    const later = await countingBufferCalls(async () => {
        fill(9);
        assertThat(await settled(texture.startReadPixels())).isEqualTo(filled(4, 4, 9));
    });
    assertThat(later.createBuffer).isEqualTo(0);
    WglPackBufferRing.release();
});

suite.test("a cancelled read hands its buffer on, and the read after it gets its own pixels", async () => {
    WglPackBufferRing.release();
    const texture = new WglTexture(4, 4);
    const fill = v => FILL.withArgs(WglArg.float("v", v)).renderTo(texture);
    const counts = await countingBufferCalls(async () => {
        for (let v = 1; v <= 10; v++) {
            // The GPU has not got to the first read when its buffer is taken for the second.
            fill(v);
            texture.startReadPixels().cancel();
            fill(v + 100);
            assertThat(await settled(texture.startReadPixels())).withInfo({v}).isEqualTo(filled(4, 4, v + 100));
        }
    });
    assertThat(counts.createBuffer).isEqualTo(1);
    assertThat(counts.deleteBuffer).isEqualTo(0);
    WglPackBufferRing.release();
});

suite.test("buffers are kept apart by size", async () => {
    WglPackBufferRing.release();
    const big = new WglTexture(4, 4);
    const small = new WglTexture(2, 2);
    for (const [texture, v] of [[big, 1], [small, 2]]) {
        FILL.withArgs(WglArg.float("v", v)).renderTo(texture);
    }
    // Reading part of a texture makes a read of a size of its own.
    const reads = [[big, undefined, 4, 4, 1], [small, undefined, 2, 2, 2], [big, 5, 4, 2, 1]];
    for (const [texture, count] of reads) {
        await settled(texture.startReadPixels(count));
    }
    const counts = await countingBufferCalls(async () => {
        for (let i = 0; i < 3; i++) {
            for (const [texture, count, width, height, v] of reads) {
                const pixels = await settled(texture.startReadPixels(count));
                assertThat(pixels).isEqualTo(filled(width, height, v));
            }
        }
    });
    assertThat(counts.createBuffer).isEqualTo(0);
    assertThat(counts.deleteBuffer).isEqualTo(0);
    WglPackBufferRing.release();
});

suite.test("a buffer from before the resources were invalidated is deleted, not reused", async () => {
    WglPackBufferRing.release();
    const context = initializedWglContext();
    const texture = new WglTexture(4, 4);
    FILL.withArgs(WglArg.float("v", 7)).renderTo(texture);
    await settled(texture.startReadPixels());

    // Every value made in the context's last lifetime is rebuilt on next use, but nothing was lost: the
    // waiting buffer is still the context's to delete.
    context.invalidateExistingResources();
    FILL.withArgs(WglArg.float("v", 8)).renderTo(texture);
    const counts = await countingBufferCalls(async () => {
        assertThat(await settled(texture.startReadPixels())).isEqualTo(filled(4, 4, 8));
    });
    assertThat(counts.createBuffer).isEqualTo(1);
    assertThat(counts.deleteBuffer).isEqualTo(1);
    assertThat(context.gl.getError()).isEqualTo(WebGL2RenderingContext.NO_ERROR);
    WglPackBufferRing.release();
});

suite.test("a read that was under way when the context was lost says so, and the next read works", async () => {
    const context = initializedWglContext();
    const lose = context.gl.getExtension("WEBGL_lose_context");
    if (lose === null) {
        assertThat(undefined);
        return;
    }
    const texture = new WglTexture(2, 2);
    FILL.withArgs(WglArg.float("v", 3)).renderTo(texture);
    const read = texture.startReadPixels();
    const finished = texture.startReadPixels();
    const done = await settled(finished);
    assertThat(done.length).isEqualTo(16);

    const event = name => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${name} event`)), 5000);
        context.canvas.addEventListener(name, () => {clearTimeout(timer); resolve();}, {once: true});
    });
    const lost = event("webglcontextlost");
    lose.loseContext();
    await lost;
    let message = undefined;
    try {
        read.poll();
    } catch (ex) {
        message = String(ex);
    }
    assertTrue(message !== undefined && /lost/.test(message), message);
    await new Promise(resolve => setTimeout(resolve, 0));
    const restored = event("webglcontextrestored");
    lose.restoreContext();
    await restored;

    // A read made before the loss is only dropped, since the restored context did not create its buffer;
    // nor did it create the one that `finished` gave back to the ring, which is dropped too.
    const counts = await countingBufferCalls(async () => {
        read.cancel();
        finished.cancel();
        const fresh = new WglTexture(2, 2);
        FILL.withArgs(WglArg.float("v", 4)).renderTo(fresh);
        assertThat(await settled(fresh.startReadPixels())).isEqualTo(fresh.readPixels());
    });
    assertThat(counts.deleteBuffer).isEqualTo(0);
    assertThat(counts.deleteSync).isEqualTo(1);
    assertThat(context.gl.getError()).isEqualTo(WebGL2RenderingContext.NO_ERROR);
    WglPackBufferRing.release();
});
