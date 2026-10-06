import { Suite, assertThat } from "../../TestUtil.js";
import {
  DIAL_RADIUS,
  sectorPath,
} from "../../../src/components/toolbar/cycleDial.js";

const suite = new Suite("cycleDial");

suite.test(
  "the dial sweeps anticlockwise from twelve o'clock, as an X^t gate's does",
  () => {
    const r = DIAL_RADIUS;
    assertThat(sectorPath(0)).isEqualTo("");
    // A quarter turn ends at nine o'clock; past a half turn the arc takes the long way round.
    assertThat(sectorPath(0.25)).isEqualTo(
      `M0 0V${-r}A${r} ${r} 0 0 0 ${-r} 0Z`,
    );
    assertThat(sectorPath(0.5)).isEqualTo(`M0 0V${-r}A${r} ${r} 0 0 0 0 ${r}Z`);
    assertThat(sectorPath(0.75)).isEqualTo(
      `M0 0V${-r}A${r} ${r} 0 1 0 ${r} 0Z`,
    );
  },
);

suite.test("the dial drops whole turns and wraps below zero", () => {
  assertThat(sectorPath(1)).isEqualTo("");
  assertThat(sectorPath(1.25)).isEqualTo(sectorPath(0.25));
  assertThat(sectorPath(-0.25)).isEqualTo(sectorPath(0.75));
});
