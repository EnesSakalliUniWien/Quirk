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

import { Suite, assertThat, assertTrue } from "../../../TestUtil.js";
import { KetTextureUtil } from "../../../../src/engine/simulation/gpu/KetTextureUtil.js";
import { Shaders } from "../../../../src/engine/webgl/operations/Shaders.js";
import { WglTexture } from "../../../../src/engine/webgl/texture/WglTexture.js";
import { WglTexturePool } from "../../../../src/engine/webgl/texture/WglTexturePool.js";

const suite = new Suite("KetTextureUtil");

/** Textures of several sizes, one of them empty, each a colour of its own. */
const textures = () => [
  Shaders.color(1, 2, 3, 4).toVec4Texture(0),
  new WglTexture(0, 0),
  Shaders.color(5, 6, 7, 8).toVec4Texture(3),
  Shaders.color(9, 10, 11, 12).toVec4Texture(1),
  Shaders.color(13, 14, 15, 16).toVec4Texture(5),
];

suite.testUsingWebGL(
  "mergedReadFloats cuts the merged pixels back into each texture's own",
  () => {
    const read = KetTextureUtil.mergedReadFloats(textures());
    assertThat(read.map((e) => e.length)).isEqualTo([4, 0, 32, 8, 128]);
    assertThat([...read[0]]).isEqualTo([1, 2, 3, 4]);
    assertThat([...read[3]]).isEqualTo([9, 10, 11, 12, 9, 10, 11, 12]);
    assertThat(read[4].every((e, i) => e === 13 + (i % 4))).isEqualTo(true);
  },
);

suite.test(
  "a merged read that does not wait gives the arrays a waiting one does",
  async () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    const expected = KetTextureUtil.mergedReadFloats(textures());
    const pending = KetTextureUtil.startMergedReadFloats(textures());
    // Every texture is already back in the pool, though no pixel has been read.
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
    assertThat(pending.poll()).isEqualTo(undefined);

    let read = undefined;
    for (let i = 0; i < 1000 && read === undefined; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      read = pending.poll();
    }
    assertTrue(read !== undefined);
    assertThat(read).isEqualTo(expected);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.test(
  "a merged read that is cancelled gives nothing, and holds nothing",
  async () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    const pending = KetTextureUtil.startMergedReadFloats(textures());
    pending.cancel();
    let threw = false;
    try {
      pending.poll();
    } catch {
      threw = true;
    }
    assertTrue(threw);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);
