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

import { Suite, assertThat } from "../../../TestUtil.js";
import { WglArg } from "../../../../src/engine/webgl/shader/WglArg.js";
import { WglShader } from "../../../../src/engine/webgl/shader/WglShader.js";
import { WglTexture } from "../../../../src/engine/webgl/texture/WglTexture.js";

const suite = new Suite("WglTexture");

suite.test("properties", () => {
  const t = new WglTexture(8, 16, WebGL2RenderingContext.UNSIGNED_BYTE);
  assertThat(t.width).isEqualTo(8);
  assertThat(t.height).isEqualTo(16);
  assertThat(t.pixelType).isEqualTo(WebGL2RenderingContext.UNSIGNED_BYTE);
  assertThat(t.sizePower()).isEqualTo(7);
  assertThat(t.toString()).isNotEqualTo(undefined);
});

suite.testUsingWebGL("readPixels_bytes", () => {
  const w = 2;
  const h = 2;
  const shader = new WglShader(`
        uniform float v;
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            fragColor = vec4(xy / 255.0, v, 128.0/255.0);
        }`);

  const texture = new WglTexture(w, h, WebGL2RenderingContext.UNSIGNED_BYTE);

  shader.withArgs(WglArg.float("v", 10 / 255)).renderTo(texture);
  assertThat(texture.readPixels()).isEqualTo(
    new Uint8Array([
      0, 0, 10, 128, 1, 0, 10, 128, 0, 1, 10, 128, 1, 1, 10, 128,
    ]),
  );
});

suite.testUsingWebGL(
  "readPixels reads only the rows holding the pixels asked for",
  () => {
    const shader = new WglShader(`
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            fragColor = vec4(xy / 255.0, 0.0, 1.0);
        }`);
    const texture = new WglTexture(4, 4, WebGL2RenderingContext.UNSIGNED_BYTE);
    shader.withArgs().renderTo(texture);
    // Five pixels lie in the first two rows of four: those rows are read, in index order.
    const rows = texture.readPixels(false, 5);
    assertThat(rows.length).isEqualTo(2 * 4 * 4);
    assertThat([...rows.subarray(4 * 4, 4 * 5)]).isEqualTo([0, 1, 0, 255]);
    assertThat(texture.readPixels(false, 0).length).isEqualTo(0);
    assertThat(texture.readPixels().length).isEqualTo(4 * 4 * 4);
  },
);

suite.testUsingWebGLFloatTextures("readPixels_floats", () => {
  const w = 2;
  const h = 2;
  const shader = new WglShader(`
        uniform float v;
        void main() {
            fragColor = vec4(gl_FragCoord.xy, v, 254.5);
        }`);

  const texture = new WglTexture(w, h);

  shader.withArgs(WglArg.float("v", 192.25)).renderTo(texture);
  assertThat(texture.readPixels()).isEqualTo(
    new Float32Array([
      0.5, 0.5, 192.25, 254.5, 1.5, 0.5, 192.25, 254.5, 0.5, 1.5, 192.25, 254.5,
      1.5, 1.5, 192.25, 254.5,
    ]),
  );
});

suite.testUsingWebGL("readPixels_empty", () => {
  assertThat(new WglTexture(0, 0).readPixels()).isEqualTo(new Float32Array([]));
});
