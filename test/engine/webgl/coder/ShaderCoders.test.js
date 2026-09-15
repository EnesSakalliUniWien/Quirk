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
import {combinedShaderPartsWithCode, shaderWithOutputPartAndArgs} from "../../../../src/engine/webgl/coder/ShaderCoders.js"
import {currentShaderCoder} from "../../../../src/engine/webgl/coder/ShaderCoders.js"
import {Shaders} from "../../../../src/engine/webgl/operations/Shaders.js"

const suite = new Suite("ShaderCoders");

/**
 * @param {!int} length
 * @returns {!Float32Array}
 */
function randomFloat32Array(length) {
    const floats = new Float32Array(length);
    for (let i = 0; i < floats.length; i++) {
        floats[i] = (Math.random() - 0.5)*Math.pow(2, 16) +
            (Math.random() - 0.5) +
            (Math.random() - 0.5) / Math.pow(2, 16);
    }
    return floats;
}

suite.testUsingWebGLFloatTextures("packUnpack", () => {
    const data = randomFloat32Array(64);
    for (const coder of [currentShaderCoder().float, currentShaderCoder().vec2, currentShaderCoder().vec4]) {
        const packed = coder.dataToPixels(data);
        const unpacked = coder.pixelsToData(packed);
        assertThat(unpacked).isEqualTo(data);
    }
});

suite.testUsingWebGLFloatTextures("floatInput", () => {
    const param = currentShaderCoder().float.inputPartGetter('fancy');
    const shader = combinedShaderPartsWithCode([param], `
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            float k = xy.y * 4.0 + xy.x;
            fragColor = vec4(
                read_fancy(k * 4.0),
                read_fancy(k * 4.0 + 1.0),
                read_fancy(k * 4.0 + 2.0),
                read_fancy(k * 4.0 + 3.0));
        }`);

    const floats = randomFloat32Array(64);
    const spread = currentShaderCoder().float.dataToPixels(floats);

    const texSquare = Shaders.data(spread).toVecFloatTexture(6);
    assertThat(shader.withArgs(...param.argsFor(texSquare)).readRawFloatOutputs(4)).isEqualTo(floats);
    texSquare.deallocByDepositingInPool();
});
suite.testUsingWebGLFloatTextures("vec2Input", () => {
    const param = currentShaderCoder().vec2.inputPartGetter('fancy');
    const shader = combinedShaderPartsWithCode([param], `
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            float k = xy.y * 4.0 + xy.x;
            vec2 a1 = read_fancy(k * 2.0);
            vec2 a2 = read_fancy(k * 2.0 + 1.0);
            fragColor = vec4(a1, a2);
        }`);

    const floats = randomFloat32Array(64);
    const spread = currentShaderCoder().vec2.dataToPixels(floats);

    const texSquare = Shaders.data(spread).toVec2Texture(5);
    assertThat(shader.withArgs(...param.argsFor(texSquare)).readRawFloatOutputs(4)).isEqualTo(floats);
    texSquare.deallocByDepositingInPool();
});

suite.testUsingWebGLFloatTextures("vec4Input", () => {
    const param = currentShaderCoder().vec4.inputPartGetter('test_input');
    const shader = combinedShaderPartsWithCode([param], `
        void main() {
            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
            float k = xy.y * 4.0 + xy.x;
            fragColor = read_test_input(k);
        }`);

    const floats = randomFloat32Array(64);
    const spread = currentShaderCoder().vec4.dataToPixels(floats);

    const texSquare = Shaders.data(spread).toVec4Texture(4);
    assertThat(shader.withArgs(...param.argsFor(texSquare)).readRawFloatOutputs(4)).isEqualTo(floats);
    texSquare.deallocByDepositingInPool();
});

suite.testUsingWebGL("floatOutput", () => {
    const output = currentShaderCoder().float.outputPart;
    const shader = combinedShaderPartsWithCode([output], `
        float outputFor(float k) {
            return k + 0.75;
        }`);

    assertThat(shaderWithOutputPartAndArgs(shader, output, []).readVecFloatOutputs(2)).isEqualTo(new Float32Array([
        0.75, 1.75, 2.75, 3.75
    ]));
});

suite.testUsingWebGL("vec2Output", () => {
    const output = currentShaderCoder().vec2.outputPart;
    const shader = combinedShaderPartsWithCode([output], `
        vec2 outputFor(float k) {
            return vec2(k, k + 0.5);
        }`);

    assertThat(shaderWithOutputPartAndArgs(shader, output, []).readVec2Outputs(1)).isEqualTo(new Float32Array([
        0, 0.5,
        1, 1.5
    ]));

    assertThat(shaderWithOutputPartAndArgs(shader, output, []).readVec2Outputs(2)).isEqualTo(new Float32Array([
        0, 0.5,
        1, 1.5,
        2, 2.5,
        3, 3.5
    ]));
});

suite.testUsingWebGL("vec4Output", () => {
    const output = currentShaderCoder().vec4.outputPart;
    const shader = combinedShaderPartsWithCode([output], `
        vec4 outputFor(float k) {
            return vec4(k, k + 0.25, k + 0.5, k + 0.75);
        }`);

    assertThat(shaderWithOutputPartAndArgs(shader, output, []).readVec4Outputs(1)).isEqualTo(new Float32Array([
        0, 0.25, 0.5, 0.75,
        1, 1.25, 1.5, 1.75
    ]));

    assertThat(shaderWithOutputPartAndArgs(shader, output, []).readVec4Outputs(2)).isEqualTo(new Float32Array([
        0, 0.25, 0.5, 0.75,
        1, 1.25, 1.5, 1.75,
        2, 2.25, 2.5, 2.75,
        3, 3.25, 3.5, 3.75
    ]));
});
