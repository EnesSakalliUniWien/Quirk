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

import {Suite, assertThat} from "../../../TestUtil.js"
import {WglShader} from "../../../../src/engine/webgl/shader/WglShader.js"
import {WglTexture} from "../../../../src/engine/webgl/texture/WglTexture.js"
import {initializedWglContext} from "../../../../src/engine/webgl/context/WglContext.js"

const suite = new Suite("WglShader");

suite.testUsingWebGL("renderTo_large", () => {
    const tex = new WglTexture(256, 256, WebGL2RenderingContext.UNSIGNED_BYTE);
    new WglShader("void main(){fragColor=vec4(3.0,3.0,3.0,3.0)/255.0;}").withArgs().renderTo(tex);
    const expected = new Uint8Array(4 * tex.width * tex.height).fill(3);
    assertThat(tex.readPixels()).isEqualTo(expected);
});

suite.testUsingWebGLFloatTextures("renderTo_empty", () => {
    const tex = new WglTexture(0, 0);
    new WglShader("void main(){fragColor=vec4(0.0,0.0,0.0,0.0);}").withArgs().renderTo(tex);
    assertThat(tex.readPixels()).isEqualTo(new Float32Array([]));
});

suite.testUsingWebGL("readPixels_bytes_all", () => {
    const shader = new WglShader(`
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            float s = (xy.y*8.0 + xy.x)*4.0;
            fragColor = vec4(
                (s+0.0)/255.0,
                (s+1.0)/255.0,
                (s+2.0)/255.0,
                (s+3.0)/255.0);
        }`).withArgs();

    const tex = new WglTexture(8, 8, WebGL2RenderingContext.UNSIGNED_BYTE);
    shader.renderTo(tex);
    assertThat(tex.readPixels()).isEqualTo(new Uint8Array(
        Array.from({length: 256}, (_, i) => i)
    ));
    tex.ensureDeinitialized();
});

suite.testUsingWebGLFloatTextures("changeSourceAfterInvalidate", () => {
    const tex = new WglTexture(1, 1);
    let flag = true;
    const shader = new WglShader(() => flag ?
        "void main(){fragColor=vec4(-5.0,-6.0,7.0,8.0);}" :
        "void main(){fragColor=vec4(1.0,2.0,3.0,4.0);}");

    shader.withArgs().renderTo(tex);
    assertThat(tex.readPixels()).isEqualTo(new Float32Array([-5, -6, 7, 8]));

    flag = false;
    initializedWglContext().invalidateExistingResources();

    shader.withArgs().renderTo(tex);
    assertThat(tex.readPixels()).isEqualTo(new Float32Array([1, 2, 3, 4]));
});
