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
import { properMod, extended_gcd, modular_multiplicative_inverse } from "../../../src/engine/math/modularArithmetic.js";

const suite = new Suite("modularArithmetic");

suite.test("properMod", () => {
    assertThrows(() => properMod(0, 0));
    assertThrows(() => properMod(1, 0));
    assertThrows(() => properMod(1, -1));

    assertThat(properMod(502, 501)).isEqualTo(1);
    assertThat(properMod(-502, 501)).isEqualTo(500);

    assertThat(properMod(-2, 1.5)).isEqualTo(1);
    assertThat(properMod(-1.5, 1.5)).isEqualTo(0);
    assertThat(properMod(-1, 1.5)).isEqualTo(0.5);
    assertThat(properMod(-0.5, 1.5)).isEqualTo(1);
    assertThat(properMod(0, 1.5)).isEqualTo(0);
    assertThat(properMod(0.5, 1.5)).isEqualTo(0.5);
    assertThat(properMod(1, 1.5)).isEqualTo(1);
    assertThat(properMod(1.5, 1.5)).isEqualTo(0);
    assertThat(properMod(2, 1.5)).isEqualTo(0.5);
});

suite.test("extended_gcd", () => {
    assertThat(extended_gcd(2, 2)).isEqualTo({x: 0, y: 1, gcd: 2});
    assertThat(extended_gcd(2, 3)).isEqualTo({x: -1, y: 1, gcd: 1});
    assertThat(extended_gcd(3, 2)).isEqualTo({x: 1, y: -1, gcd: 1});
    assertThat(extended_gcd(11, 0)).isEqualTo({x: 1, y: 0, gcd: 11});
    assertThat(extended_gcd(11, 1)).isEqualTo({x: 0, y: 1, gcd: 1});
    assertThat(extended_gcd(240, 46)).isEqualTo({x: -9, y: 47, gcd: 2});
    assertThat(extended_gcd(3655, 3826)).isEqualTo({x: -179, y: 171, gcd: 1});
});

suite.test("modular_multiplicative_inverse", () => {
    assertThat(modular_multiplicative_inverse(10, 11)).isEqualTo(10);
    assertThat(modular_multiplicative_inverse(2, 4)).isEqualTo(undefined);
    assertThat(modular_multiplicative_inverse(2, 11)).isEqualTo(6);
    assertThat(modular_multiplicative_inverse(3, 1024)).isEqualTo(683);
    assertThat(modular_multiplicative_inverse(683, 1024)).isEqualTo(3);
});
