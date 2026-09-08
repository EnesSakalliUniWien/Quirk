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

/**
 * The states a wire can be started in, in the order clicking the wire's initial-state area
 * cycles through them. undefined is the default |0>; the rest name the preparation applied on
 * top of it. Which gates realise each one is the catalogue's business (src/gates/AllGates.js).
 *
 * A leaf module with no imports, so the circuit model, the serializer and the gate catalogue
 * can all read it without any of them importing the others.
 *
 * @type {!Array.<undefined|!string>}
 */
const INITIAL_STATE_KEYS = [undefined, "1", "+", "-", "i", "-i"];

export { INITIAL_STATE_KEYS };
