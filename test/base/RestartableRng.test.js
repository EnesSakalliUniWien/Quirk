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

import {Suite, assertThat} from "../TestUtil.js"
import {RestartableRng} from "../../src/base/RestartableRng.js"

const suite = new Suite("RestartableRng");

suite.test("pre-repeat_multiple-copies", () => {
    const rng1 = new RestartableRng();
    const v1 = rng1.random();
    const v2 = rng1.random();

    const rng2 = rng1.restarted();
    assertThat(rng2.random()).isEqualTo(v1);
    assertThat(rng2.random()).isEqualTo(v2);

    const rng3 = rng2.restarted();
    assertThat(rng3.random()).isEqualTo(v1);
    assertThat(rng3.random()).isEqualTo(v2);

    const rng4 = rng1.restarted();
    assertThat(rng4.random()).isEqualTo(v1);
    assertThat(rng4.random()).isEqualTo(v2);
});

suite.test("post-repeat", () => {
    const rng1 = new RestartableRng();
    const rng2 = rng1.restarted();
    const v1 = rng1.random();
    assertThat(rng2.random()).isEqualTo(v1);
});

suite.test("reverse-repeat", () => {
    const rng1 = new RestartableRng();
    const rng2 = rng1.restarted();
    const v1 = rng2.random();
    assertThat(rng1.random()).isEqualTo(v1);
});
