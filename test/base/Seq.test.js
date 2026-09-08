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

import {Suite, assertThat, assertThrows, assertTrue} from "../TestUtil.js"
import {seq, Seq} from "../../src/base/Seq.js"

const suite = new Suite("Seq");

suite.test("constructor_Array", () => {
    assertThat(new Seq([])).iteratesAs();
    assertThat(new Seq(["a"])).iteratesAs("a");
    assertThat(new Seq(["a", "b", 3])).iteratesAs("a", "b", 3);
    assertThat(seq([])).iteratesAs();
    assertThat(seq(["a"])).iteratesAs("a");
    assertThat(seq(["a", "b", 3])).iteratesAs("a", "b", 3);
});

suite.test("constructor_OtherArrays", () => {
    const candidates = [
        new Float32Array([1, 2, 3]),
        new Int16Array([-1, 2, 3]),
        new Int32Array([1, -2, 3]),
        new Int8Array([1, 2, -3]),
        new Uint8Array([1, 2, 3]),
        new Uint16Array([1, 2, 3]),
        new Uint32Array([1, 2, 3, 4, 5]),
        new Uint32Array([]),
        ["a", "b", 3]
    ];

    for (const candidate of candidates) {
        for (let runs = 0; runs < 2; runs++) {
            const seq1 = new Seq(candidate);
            const seq2 = seq(candidate);
            let n = 0;
            for (const e of seq1) {
                assertThat(e).isEqualTo(candidate[n]);
                n++;
            }
            assertThat(n).isEqualTo(candidate.length);
            let n2 = 0;
            for (const e of seq2) {
                assertThat(e).isEqualTo(candidate[n2]);
                n2++;
            }
            assertThat(n2).isEqualTo(candidate.length);
        }
    }
});

suite.test("constructor_RawGeneratorSinglePass", () => {
    const s = seq(function*() {
        yield 1;
        yield 2;
    }());

    assertThat(s).iteratesAs(1, 2);
    // now the generator is used up and would iterate as []...
});

suite.test("fromGenerator_MultipleUses", () => {
    const s = Seq.fromGenerator(function*() {
        yield 1;
        yield 2;
    });

    assertThat(s).iteratesAs(1, 2);
    assertThat(s).iteratesAs(1, 2);
    assertThat(s).iteratesAs(1, 2);
});

suite.test("toArray", () => {
    const a0 = Seq.fromGenerator(function*() {}).toArray();
    assertTrue(Array.isArray(a0));
    assertThat(a0).isEqualTo([]);

    const a2 = Seq.fromGenerator(function*() { yield 1; yield "a"; }).toArray();
    assertTrue(Array.isArray(a2));
    assertThat(a2).isEqualTo([1, "a"]);
});

suite.test("naturals", () => {
    let n = 0;
    for (const i of Seq.naturals()) {
        assertThat(i).isEqualTo(n);
        n++;
        if (n > 1000) {
            break;
        }
    }
});

suite.test("maxBy", () => {
    assertThrows(() => seq([]).maxBy(() => undefined));
    assertThat(seq([]).maxBy(() => undefined, "abc")).isEqualTo("abc");
    assertThat(seq(["abc"]).maxBy(() => { throw new Error(); })).isEqualTo("abc");

    assertThat(seq([1, 2]).maxBy(e => e)).isEqualTo(2);
    assertThat(seq([1, 2]).maxBy(e => -e)).isEqualTo(1);
    assertThat(seq([1, 2]).maxBy(e => e, undefined, (e1, e2) => e1 < e2)).isEqualTo(2);
    assertThat(seq([1, 2]).maxBy(e => e, undefined, (e1, e2) => e1 > e2)).isEqualTo(1);
    assertThat(seq([-2, -1, 0, 1, 2]).maxBy(e => e*(2 - e))).isEqualTo(1);
    assertThat(seq([-2, -1, 0, 1, 2]).maxBy(e => e*(e - 2))).isEqualTo(-2);
});

suite.test("minBy", () => {
    assertThrows(() => seq([]).minBy(() => undefined));
    assertThat(seq([]).minBy(() => undefined, "abc")).isEqualTo("abc");
    assertThat(seq(["abc"]).minBy(() => { throw new Error(); })).isEqualTo("abc");

    assertThat(seq([1, 2]).minBy(e => e)).isEqualTo(1);
    assertThat(seq([1, 2]).minBy(e => -e)).isEqualTo(2);
    assertThat(seq([1, 2]).minBy(e => e, undefined, (e1, e2) => e1 < e2)).isEqualTo(1);
    assertThat(seq([1, 2]).minBy(e => e, undefined, (e1, e2) => e1 > e2)).isEqualTo(2);
    assertThat(seq([-2, -1, 0, 1, 2]).minBy(e => e*(2 - e))).isEqualTo(-2);
    assertThat(seq([-2, -1, 0, 1, 2]).minBy(e => e*(e - 2))).isEqualTo(1);
});

suite.test("takeWhile", () => {
    assertThat(seq([]).takeWhile(() => { throw new Error(); })).iteratesAs();

    assertThat(seq([1]).takeWhile(e => e % 2 === 1)).iteratesAs(1);
    assertThat(seq([2]).takeWhile(e => e % 2 === 1)).iteratesAs();

    assertThat(seq([1, 3]).takeWhile(e => e % 2 === 1)).iteratesAs(1, 3);
    assertThat(seq([1, 4]).takeWhile(e => e % 2 === 1)).iteratesAs(1);
    assertThat(seq([2, 3]).takeWhile(e => e % 2 === 1)).iteratesAs();
    assertThat(seq([2, 4]).takeWhile(e => e % 2 === 1)).iteratesAs();

    assertThat(seq([1, 3, 5, 2, 4, 7]).takeWhile(e => e % 2 === 1)).iteratesAs(1, 3, 5);
});

suite.test("single", () => {
    assertThrows(() => seq([]).single());
    assertThat(seq([]).single("abc")).isEqualTo("abc");

    assertThat(seq([11]).single("abc")).isEqualTo(11);
    assertThat(seq([11]).single()).isEqualTo(11);

    assertThrows(() => seq([2, 3]).single());
    assertThat(seq([2, 3]).single("abc")).isEqualTo("abc");
});

suite.test("segmentBy", () => {
    assertThat(seq([]).segmentBy(() => { throw new Error(); })).iteratesAs();
    assertThat(seq([1]).segmentBy(e => e + 1)).iteratesAs([1]);
    assertThat(seq([2, 3, 5, 7, 11, 13]).segmentBy(e => e % 4)).iteratesAs([2], [3], [5], [7, 11], [13]);
    assertThat(seq([1, 2, 3, 4, 5, 6, 7, 8, 9]).segmentBy(e => e >> 2)).
        iteratesAs([1, 2, 3], [4, 5, 6, 7], [8, 9]);
    assertThat(seq([1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3]).segmentBy(e => e >> 2)).
        iteratesAs([1, 2, 3], [4, 5, 6, 7], [8, 9], [1, 2, 3]);
});
