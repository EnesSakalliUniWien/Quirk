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

import { Suite, assertThat, assertTrue, assertFalse, assertThrows } from "../../TestUtil.js";
import { isPowerOf2, ceilLg2, floorLg2, ceilingPowerOf2 } from "../../../src/engine/math/powersOfTwo.js";

const suite = new Suite("powersOfTwo");

suite.test("powers and adjacent integers across the safe integer range", () => {
    for (let exponent = 2; exponent <= 52; exponent++) {
        const power = 2 ** exponent;
        assertTrue(isPowerOf2(power));
        assertFalse(isPowerOf2(power - 1));
        assertFalse(isPowerOf2(power + 1));
        assertThat(floorLg2(power)).isEqualTo(exponent);
        assertThat(ceilLg2(power)).isEqualTo(exponent);
        assertThat(floorLg2(power - 1)).isEqualTo(exponent - 1);
        assertThat(ceilLg2(power - 1)).isEqualTo(exponent);
        assertThat(floorLg2(power + 1)).isEqualTo(exponent);
        assertThat(ceilLg2(power + 1)).isEqualTo(exponent + 1);
        assertThat(ceilingPowerOf2(power)).isEqualTo(power);
        assertThat(ceilingPowerOf2(power + 1)).isEqualTo(2 * power);
    }
    assertThat(floorLg2(Number.MAX_SAFE_INTEGER)).isEqualTo(52);
    assertThat(ceilLg2(Number.MAX_SAFE_INTEGER)).isEqualTo(53);
});

suite.test("finite fractional values and Number limits", () => {
    assertFalse(isPowerOf2(1.5));
    assertThat(floorLg2(1.5)).isEqualTo(0);
    assertThat(ceilLg2(1.5)).isEqualTo(1);
    assertThat(ceilingPowerOf2(1.5)).isEqualTo(2);
    assertThat(floorLg2(Number.MIN_VALUE)).isEqualTo(0);
    assertTrue(isPowerOf2(2 ** 1023));
    assertFalse(isPowerOf2(Number.MAX_VALUE));
    assertThat(floorLg2(Number.MAX_VALUE)).isEqualTo(1023);
    assertThat(ceilLg2(Number.MAX_VALUE)).isEqualTo(1024);
    assertThat(ceilingPowerOf2(Number.MAX_VALUE)).isEqualTo(Infinity);
});

suite.test("reject non-finite and non-number sizes", () => {
    for (const value of [NaN, Infinity, -Infinity, "2", undefined]) {
        assertFalse(isPowerOf2(value));
        assertThrows(() => floorLg2(value));
        assertThrows(() => ceilLg2(value));
        assertThrows(() => ceilingPowerOf2(value));
    }
});

suite.test("isPowerOf2", () => {
    assertFalse(isPowerOf2(-1));
    assertFalse(isPowerOf2(0));
    assertTrue(isPowerOf2(1));
    assertTrue(isPowerOf2(2));
    assertFalse(isPowerOf2(3));
    assertTrue(isPowerOf2(4));
    assertFalse(isPowerOf2(5));
});

suite.test("ceilLg2", () => {
    assertThat(ceilLg2(0)).isEqualTo(0);
    assertThat(ceilLg2(1)).isEqualTo(0);
    assertThat(ceilLg2(2)).isEqualTo(1);
    assertThat(ceilLg2(3)).isEqualTo(2);
    assertThat(ceilLg2(4)).isEqualTo(2);
    assertThat(ceilLg2(5)).isEqualTo(3);
    assertThat(ceilLg2(6)).isEqualTo(3);
    assertThat(ceilLg2(7)).isEqualTo(3);
    assertThat(ceilLg2(8)).isEqualTo(3);
    assertThat(ceilLg2(9)).isEqualTo(4);
    assertThat(ceilLg2((1<<20)-1)).isEqualTo(20);
    assertThat(ceilLg2((1<<20))).isEqualTo(20);
    assertThat(ceilLg2((1<<20)+1)).isEqualTo(21);
});

suite.test("floorLg2", () => {
    assertThat(floorLg2(0)).isEqualTo(0);
    assertThat(floorLg2(1)).isEqualTo(0);
    assertThat(floorLg2(2)).isEqualTo(1);
    assertThat(floorLg2(3)).isEqualTo(1);
    assertThat(floorLg2(4)).isEqualTo(2);
    assertThat(floorLg2(5)).isEqualTo(2);
    assertThat(floorLg2(6)).isEqualTo(2);
    assertThat(floorLg2(7)).isEqualTo(2);
    assertThat(floorLg2(8)).isEqualTo(3);
    assertThat(floorLg2(9)).isEqualTo(3);
    assertThat(floorLg2((1<<20)-1)).isEqualTo(19);
    assertThat(floorLg2((1<<20))).isEqualTo(20);
    assertThat(floorLg2((1<<20)+1)).isEqualTo(20);
});


suite.test("ceilingPowerOf2", () => {
    assertThat(ceilingPowerOf2(-1)).isEqualTo(1);
    assertThat(ceilingPowerOf2(0)).isEqualTo(1);
    assertThat(ceilingPowerOf2(1)).isEqualTo(1);
    assertThat(ceilingPowerOf2(2)).isEqualTo(2);
    assertThat(ceilingPowerOf2(3)).isEqualTo(4);
    assertThat(ceilingPowerOf2(4)).isEqualTo(4);
    assertThat(ceilingPowerOf2(5)).isEqualTo(8);
    assertThat(ceilingPowerOf2(6)).isEqualTo(8);
    assertThat(ceilingPowerOf2(7)).isEqualTo(8);
    assertThat(ceilingPowerOf2(8)).isEqualTo(8);
    assertThat(ceilingPowerOf2(9)).isEqualTo(16);
    assertThat(ceilingPowerOf2((1 << 20) - 1)).isEqualTo(1 << 20);
    assertThat(ceilingPowerOf2(1 << 20)).isEqualTo(1 << 20);
    assertThat(ceilingPowerOf2((1 << 20) + 1)).isEqualTo(1 << 21);
});
