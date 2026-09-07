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

import { WglShader } from "../shader/WglShader.js";
import { WglConfiguredShader } from "../shader/WglConfiguredShader.js";
import { ShaderPart } from "./ShaderCoderTypes.js";
import { SHADER_CODER_FLOATS } from "./FloatsShaderCoder.js";

/**
 * The coder every shader is assembled with. WebGL2 guarantees float render targets, so there is
 * exactly one.
 * @returns {!ShaderCoder}
 */
function currentShaderCoder() {
  return SHADER_CODER_FLOATS;
}

class ShaderPartDescription {
  /**
   * @param {!function(!ShaderCoder) : !ShaderPart} partMaker
   * @param {!string} description
   */
  constructor(partMaker, description) {
    /**
     * @type {!(function(!ShaderCoder): !ShaderPart)}
     * @private
     */
    this._partMaker = partMaker;
    /**
     * @type {!string}
     */
    this.description = description;
  }

  /**
   * @param {!ShaderCoder} coder
   * @returns {!ShaderPart}
   */
  toConcretePart(coder = undefined) {
    return this._partMaker(coder || currentShaderCoder());
  }

  toString() {
    return `ShaderPartDescription(${this.description})`;
  }
}

class Inputs {
  /**
   * @param {!string} name
   * @returns {!ShaderPartDescription}
   */
  static bool(name) {
    return new ShaderPartDescription(
      (coder) => coder.bool.inputPartGetter(name),
      `Inputs.bool(${name})`,
    );
  }

  /**
   * @param {!string} name
   * @returns {!ShaderPartDescription}
   */
  static float(name) {
    return new ShaderPartDescription(
      (coder) => coder.float.inputPartGetter(name),
      `Inputs.float(${name})`,
    );
  }

  /**
   * @param {!string} name
   * @returns {!ShaderPartDescription}
   */
  static vec2(name) {
    return new ShaderPartDescription(
      (coder) => coder.vec2.inputPartGetter(name),
      `Inputs.vec2(${name})`,
    );
  }

  /**
   * @param {!string} name
   * @returns {!ShaderPartDescription}
   */
  static vec4(name) {
    return new ShaderPartDescription(
      (coder) => coder.vec4.inputPartGetter(name),
      `Inputs.vec4(${name})`,
    );
  }
}

class Outputs {
  /**
   * @returns {!ShaderPartDescription}
   */
  static bool() {
    return new ShaderPartDescription(
      (coder) => coder.bool.outputPart,
      `Outputs.bool()`,
    );
  }

  /**
   * @returns {!ShaderPartDescription}
   */
  static float() {
    return new ShaderPartDescription(
      (coder) => coder.float.outputPart,
      `Outputs.float()`,
    );
  }

  /**
   * @returns {!ShaderPartDescription}
   */
  static vec2() {
    return new ShaderPartDescription(
      (coder) => coder.vec2.outputPart,
      `Outputs.vec2()`,
    );
  }

  /**
   * @returns {!ShaderPartDescription}
   */
  static vec4() {
    return new ShaderPartDescription(
      (coder) => coder.vec4.outputPart,
      `Outputs.vec4()`,
    );
  }
}

/**
 * @param {!Array.<!ShaderPartDescription|!ShaderPart>} shaderPartsOrDescs
 * @param {!string} bodyCode
 * @returns {!WglShader}
 */
function combinedShaderPartsWithCode(shaderPartsOrDescs, bodyCode) {
  let shaderPartDescs = shaderPartsOrDescs.map((partOrDesc) =>
    partOrDesc instanceof ShaderPart
      ? new ShaderPartDescription((_) => partOrDesc, "fixed")
      : partOrDesc,
  );
  let sourceMaker = () => {
    let libs = new Set();
    for (let part of shaderPartDescs) {
      for (let lib of part.toConcretePart().libs) {
        libs.add(lib);
      }
    }
    let libCode = [
      ...libs,
      ...shaderPartDescs.map((e) => e.toConcretePart().code),
    ].join("");
    let afterLibCode = "\n//////// body ////////\n" + bodyCode + "\n";

    // The body defines outputFor, which the output part's main() calls, so the body has to come
    // before main() to satisfy GLSL's declare-before-use rule.
    let mainIndex = libCode.indexOf("void main()");
    if (mainIndex !== -1) {
      return (
        libCode.substring(0, mainIndex) +
        afterLibCode +
        libCode.substring(mainIndex)
      );
    }

    return libCode + afterLibCode;
  };

  return new WglShader(sourceMaker);
}

/**
 * @param {!Array.<ShaderPartDescription>} inputs
 * @param {!ShaderPartDescription} output
 * @param {!string} bodyCode
 * @returns {!function(args: ...(!!WglTexture|!WglArg)) : !WglConfiguredShader}
 */
function makePseudoShaderWithInputsAndOutputAndCode(inputs, output, bodyCode) {
  let shader = combinedShaderPartsWithCode([...inputs, output], bodyCode);
  return (...inputsAndArgs) => {
    let args = [];
    for (let i = 0; i < inputs.length; i++) {
      args.push(...inputs[i].toConcretePart().argsFor(inputsAndArgs[i]));
    }
    args.push(...inputsAndArgs.slice(inputs.length));
    return shaderWithOutputPartAndArgs(shader, output.toConcretePart(), args);
  };
}

/**
 * @param {!WglShader} shader
 * @param {!ShaderPart} outputShaderPart
 * @param {!Array.<!WglArg>} args
 * @returns {!WglConfiguredShader}
 */
function shaderWithOutputPartAndArgs(shader, outputShaderPart, args) {
  return new WglConfiguredShader((destinationTexture) =>
    shader
      .withArgs(...args, ...outputShaderPart.argsFor(destinationTexture))
      .renderTo(destinationTexture),
  );
}

export {
  combinedShaderPartsWithCode,
  shaderWithOutputPartAndArgs,
  currentShaderCoder,
  makePseudoShaderWithInputsAndOutputAndCode,
  Inputs,
  Outputs,
};
