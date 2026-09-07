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

import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "../../../TestUtil.js"
import {Complex} from "../../../../src/engine/math/complex/Complex.js"
import {ComplexFormula} from "../../../../src/engine/math/formula/ComplexFormula.js"

let suite = new Suite("ComplexFormula");

suite.test("parse_raw", () => {
    assertThrows(() => ComplexFormula.parse(""));
    assertThrows(() => ComplexFormula.parse("abc"));
    assertThrows(() => ComplexFormula.parse("1e_plus1"));
    assertThrows(() => ComplexFormula.parse("1e_minus1"));

    assertThat(ComplexFormula.parse("0")).isEqualTo(Complex.ZERO);
    assertThat(ComplexFormula.parse("1")).isEqualTo(Complex.ONE);
    assertThat(ComplexFormula.parse("-1")).isEqualTo(new Complex(-1, 0));
    assertThat(ComplexFormula.parse("i")).isEqualTo(Complex.I);
    assertThat(ComplexFormula.parse("-i")).isEqualTo(new Complex(0, -1));
    assertThat(ComplexFormula.parse("2")).isEqualTo(new Complex(2, 0));
    assertThat(ComplexFormula.parse("2i")).isEqualTo(new Complex(0, 2));
    assertThat(ComplexFormula.parse("-2i")).isEqualTo(new Complex(0, -2));

    assertThat(ComplexFormula.parse("3-2i")).isEqualTo(new Complex(3, -2));
    assertThat(ComplexFormula.parse("1-i")).isEqualTo(new Complex(1, -1));
    assertThat(ComplexFormula.parse("1+i")).isEqualTo(new Complex(1, 1));
    assertThat(ComplexFormula.parse("-5+2i")).isEqualTo(new Complex(-5, 2));
    assertThat(ComplexFormula.parse("-5-2i")).isEqualTo(new Complex(-5, -2));

    assertThat(ComplexFormula.parse("3/2i")).isEqualTo(new Complex(0, 1.5));

    assertThat(ComplexFormula.parse("\u221A2-\u2153i")).isEqualTo(new Complex(Math.sqrt(2), -1/3));

    assertThat(ComplexFormula.parse("1e-10")).isEqualTo(new Complex(0.0000000001, 0));
    assertThat(ComplexFormula.parse("1e+10")).isEqualTo(new Complex(10000000000, 0));
    assertThat(ComplexFormula.parse("2.5e-10")).isEqualTo(new Complex(0.00000000025, 0));
    assertThat(ComplexFormula.parse("2.5E-10")).isEqualTo(new Complex(0.00000000025, 0));
    assertThat(ComplexFormula.parse("2.5e+10")).isEqualTo(new Complex(25000000000, 0));
});

suite.test("parse_expressions", () => {
    assertThat(ComplexFormula.parse("1/3")).isEqualTo(1/3);
    assertThat(ComplexFormula.parse("2/3/5")).isEqualTo((2/3)/5);
    assertThat(ComplexFormula.parse("2/3/5*7/13")).isEqualTo(((((2/3)/5))*7)/13);
    assertThat(ComplexFormula.parse("2-3-5")).isEqualTo(-6);
    assertThat(ComplexFormula.parse("1/3+2i")).isEqualTo(new Complex(1/3, 2));
    assertThat(ComplexFormula.parse("(1/3)+2i")).isEqualTo(new Complex(1/3, 2));
    assertThat(ComplexFormula.parse("1/(3+2i)")).isEqualTo(Complex.ONE.dividedBy(new Complex(3, 2)));
    assertThat(ComplexFormula.parse("1/sqrt(3+2i)")).isEqualTo(Complex.ONE.dividedBy(new Complex(3, 2).raisedTo(0.5)));

    assertThat(ComplexFormula.parse("i^i")).isEqualTo(0.20787957635076193);
    assertThat(ComplexFormula.parse("√i")).isEqualTo(new Complex(Math.sqrt(0.5), Math.sqrt(0.5)));
    assertThat(ComplexFormula.parse("√4i")).isEqualTo(new Complex(0, 2));
    assertThat(ComplexFormula.parse("sqrt4i")).isEqualTo(new Complex(0, 2));
    assertThat(ComplexFormula.parse("sqrt√4i")).isEqualTo(new Complex(0, Math.sqrt(2)));
    assertThat(ComplexFormula.parse("sqrt√4-i")).isEqualTo(new Complex(Math.sqrt(2), -1));
    assertThat(ComplexFormula.parse("----------1")).isEqualTo(1);
    assertThat(ComplexFormula.parse("---------1")).isEqualTo(-1);
    assertThat(ComplexFormula.parse("---+--+--1")).isEqualTo(-1);
    assertThat(ComplexFormula.parse("0---+--+--1")).isEqualTo(-1);

    assertThat(ComplexFormula.parse("0---+--+--1*")).isEqualTo(-1);
    assertThat(ComplexFormula.parse("2+3^")).isEqualTo(5);
    assertThat(ComplexFormula.parse("cos(45) + i sin(45)")).isApproximatelyEqualTo(
        new Complex(Math.sqrt(0.5), Math.sqrt(0.5)));
    assertThat(ComplexFormula.parse("cos(45) + i (sin 45)")).isApproximatelyEqualTo(
        new Complex(Math.sqrt(0.5), Math.sqrt(0.5)));
    assertThat(ComplexFormula.parse("e^(pi i)")).isApproximatelyEqualTo(-1);
    assertThat(ComplexFormula.parse("exp(ln(2))")).isApproximatelyEqualTo(2);
    assertThat(ComplexFormula.parse("sin(arcsin(0.5))")).isApproximatelyEqualTo(0.5);
    assertThat(ComplexFormula.parse("cos(arccos(0.5))")).isApproximatelyEqualTo(0.5);
    assertThat(ComplexFormula.parse("sin(asin(0.5))")).isApproximatelyEqualTo(0.5);
    assertThat(ComplexFormula.parse("cos(acos(0.5))")).isApproximatelyEqualTo(0.5);
});suite.test("angleUnit", () => {
    assertThat(ComplexFormula.parse("cos(180)")).isApproximatelyEqualTo(-1);
    assertThat(ComplexFormula.parse("cos(180)", {angleUnit: ComplexFormula.DEGREES})).isApproximatelyEqualTo(-1);
    assertThat(ComplexFormula.parse("cos(pi)", {angleUnit: ComplexFormula.RADIANS})).isApproximatelyEqualTo(-1);
    assertThat(ComplexFormula.parse("tan(0)", {angleUnit: ComplexFormula.RADIANS})).isApproximatelyEqualTo(0);
    assertThrows(() => ComplexFormula.parse("tan(0)", {angleUnit: ComplexFormula.DEGREES}));
    assertThrows(() => ComplexFormula.parse("1", {angleUnit: "gradians"}));
});

suite.test("variables", () => {
    assertThrows(() => ComplexFormula.parse("2*t"));
    assertThat(ComplexFormula.parse("2*t", {variables: {t: 0.25}})).isEqualTo(0.5);
    assertThat(ComplexFormula.parse("t*i", {variables: {t: new Complex(0, 1)}})).isEqualTo(-1);

    // A fresh token map each time, so callers can extend it without leaking into the shared one.
    let tokens = ComplexFormula.tokenMap({angleUnit: ComplexFormula.RADIANS});
    tokens.set("z", 7);
    assertThrows(() => ComplexFormula.parse("z", {angleUnit: ComplexFormula.RADIANS}));
    assertTrue(ComplexFormula.tokenMap({angleUnit: ComplexFormula.RADIANS}).has("tan"));
    assertFalse(ComplexFormula.tokenMap().has("tan"));
});
