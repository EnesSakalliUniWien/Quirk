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

import { Suite, assertThat, assertThrows } from "../../TestUtil.js";
import { popcnt, numberOfSetBits } from "../../../src/engine/math/bitOperations.js";

const suite = new Suite("bitOperations");

suite.test("popcnt", () => {
    assertThat(popcnt(-2)).isEqualTo(Math.POSITIVE_INFINITY);
    assertThat(popcnt(-1)).isEqualTo(Math.POSITIVE_INFINITY);
    assertThat(popcnt(0)).isEqualTo(0);
    assertThat(popcnt(1)).isEqualTo(1);
    assertThat(popcnt(2)).isEqualTo(1);
    assertThat(popcnt(3)).isEqualTo(2);
    assertThat(popcnt(4)).isEqualTo(1);
    assertThat(popcnt(5)).isEqualTo(2);
    assertThat(popcnt(6)).isEqualTo(2);
    assertThat(popcnt(7)).isEqualTo(3);
    assertThat(popcnt(8)).isEqualTo(1);
    assertThat(popcnt(9)).isEqualTo(2);
    assertThat(popcnt((1<<20)-1)).isEqualTo(20);
    assertThat(popcnt((1<<20))).isEqualTo(1);
    assertThat(popcnt((1<<20)+1)).isEqualTo(2);
});

suite.test("numberOfSetBits", () => {
    assertThrows(() => numberOfSetBits(-1));
    assertThrows(() => numberOfSetBits("what"));
    assertThrows(() => numberOfSetBits(NaN));
    assertThrows(() => numberOfSetBits(Infinity));
    assertThrows(() => numberOfSetBits(Math.pow(2, 32)));
    assertThrows(() => numberOfSetBits(0.1));

    assertThat(numberOfSetBits(0)).isEqualTo(0);
    assertThat(numberOfSetBits(1)).isEqualTo(1);
    assertThat(numberOfSetBits(2)).isEqualTo(1);
    assertThat(numberOfSetBits(3)).isEqualTo(2);
    assertThat(numberOfSetBits(4)).isEqualTo(1);
    assertThat(numberOfSetBits(5)).isEqualTo(2);
    assertThat(numberOfSetBits(6)).isEqualTo(2);
    assertThat(numberOfSetBits(7)).isEqualTo(3);
    assertThat(numberOfSetBits(8)).isEqualTo(1);
    assertThat(numberOfSetBits(9)).isEqualTo(2);
    assertThat(numberOfSetBits(10)).isEqualTo(2);
    assertThat(numberOfSetBits(11)).isEqualTo(3);
    assertThat(numberOfSetBits(12)).isEqualTo(2);
    assertThat(numberOfSetBits(13)).isEqualTo(3);
    assertThat(numberOfSetBits(14)).isEqualTo(3);
    assertThat(numberOfSetBits(15)).isEqualTo(4);
    assertThat(numberOfSetBits(16)).isEqualTo(1);
    assertThat(numberOfSetBits(17)).isEqualTo(2);

    assertThat(numberOfSetBits(0x11111111)).isEqualTo(8);
    assertThat(numberOfSetBits(0x22222222)).isEqualTo(8);
    assertThat(numberOfSetBits(0x01234567)).isEqualTo(12);
    assertThat(numberOfSetBits(0x89ABCDEF)).isEqualTo(20);
    assertThat(numberOfSetBits(0xFFFFFFFF)).isEqualTo(32);
});
