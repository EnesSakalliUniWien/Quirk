import {Suite, assertThat} from "../../TestUtil.js"
import {numberForm} from "../../../src/components/math/numberForm.js"

const suite = new Suite("numberForm");

suite.test("the familiar exact forms come first", () => {
    assertThat(numberForm(0)).isEqualTo({kind: "integer", value: 0});
    assertThat(numberForm(0.5)).isEqualTo({kind: "fraction", numerator: 1, denominator: 2});
    assertThat(numberForm(1.25)).isEqualTo({kind: "fraction", numerator: 5, denominator: 4});
    // cos(π/4) is also 1/√2, and a reader knows it better as the radical.
    assertThat(numberForm(Math.SQRT1_2)).isEqualTo({kind: "overRoot", numerator: 1, root: 2});
});

suite.test("a rotation's entries are named as cosines and sines of fractions of pi", () => {
    assertThat(numberForm(Math.cos(Math.PI / 8))).
        isEqualTo({kind: "trig", fn: "cos", numerator: 1, denominator: 8});
    assertThat(numberForm(Math.sin(Math.PI / 8), "sin")).
        isEqualTo({kind: "trig", fn: "sin", numerator: 1, denominator: 8});
    // The same number, asked for as a sine, is the sine of the complementary angle.
    assertThat(numberForm(Math.cos(Math.PI / 8), "sin")).
        isEqualTo({kind: "trig", fn: "sin", numerator: 3, denominator: 8});
    // √3/2 has no radical form here, so it is the cosine it is.
    assertThat(numberForm(Math.sqrt(3) / 2)).
        isEqualTo({kind: "trig", fn: "cos", numerator: 1, denominator: 6});
});

suite.test("single-precision noise from the simulator does not defeat the recognition", () => {
    const float32 = v => Math.fround(v);
    assertThat(numberForm(float32(Math.cos(Math.PI / 16)))).
        isEqualTo({kind: "trig", fn: "cos", numerator: 1, denominator: 16});
});

suite.test("an arbitrary value stays a decimal", () => {
    assertThat(numberForm(0.4123).kind).isEqualTo("decimal");
    assertThat(numberForm(0.1).kind).isEqualTo("decimal");
});
