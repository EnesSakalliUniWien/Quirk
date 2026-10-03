import {Suite, assertThat, assertTrue} from "../TestUtil.js";
import {jsonBytes} from "../../src/results/take/size.js";
import {randomFor} from "../../src/engine/simulation/random.js";

const suite = new Suite("Take size");
const exact = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

suite.test("values of up to 64 elements are measured exactly", () => {
    for (const value of [
        0, -0, 1.5, 1e21, -1.2345678e-7, NaN, Infinity, true, false, null, "", "plain",
        "quote \" backslash \\ newline \n tab \t control \u0001", "Z^½ é 中 \u{1f600}", "\ud800 lone",
        [], [1, 2, 3], [undefined, 1], {}, {a: undefined, b: 1}, {a: {b: [1, {c: "d"}]}, "k\"ey": [null]},
        {id: "x", take: {name: "é", amplitudes: Array.from({length: 64}, (_, i) => i / 7)}, ghost: true, order: 1.5},
    ]) {
        assertThat(jsonBytes(value)).withInfo({value}).isEqualTo(exact(value));
    }
});

suite.test("long lists are estimated within a percent of their serialised size", () => {
    // Seeded, so the sample the estimate takes is the same every run.
    const rng = randomFor("take size estimate");
    const random = Array.from({length: 131072}, () => Math.fround(rng() * 0.01 - 0.005));
    // Interleaved real and imaginary parts, as amplitudes are, with the imaginary ones all zero.
    const interleaved = Array.from({length: 131072}, (_, i) => i % 2 ? 0 : Math.fround(1 / 256));
    // The readable copy lists an object per amplitude.
    const objects = Array.from({length: 65536}, () => ({r: Math.fround(rng() - 0.5), i: 0}));
    // A basis state: one amplitude and then zeros.
    const basis = Array.from({length: 131072}, (_, i) => i === 40000 ? 1 : 0);
    for (const value of [random, interleaved, objects, basis, {take: {a: random, b: objects}}]) {
        const error = Math.abs(jsonBytes(value) / exact(value) - 1);
        assertThat(error).withInfo({error}).isLessThan(0.01);
    }
});

suite.test("sizing a take does not walk its amplitudes", () => {
    const amplitudes = new Array(131072).fill(0.25);
    let reads = 0;
    const watched = new Proxy(amplitudes, {get: (target, key) => {
        if (typeof key === "string" && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key);
    }});
    assertTrue(jsonBytes(watched) > 131072);
    assertTrue(reads < 200);
});
