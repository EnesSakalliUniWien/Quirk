import { Suite, assertThat } from "../../../TestUtil.js";
import { menuAnchorStyle } from "../../../../src/components/panels/circuit/menuAnchorStyle.js";

const suite = new Suite("menuAnchorStyle");

suite.test(
  "menu anchors account for the host offset and both scroll axes",
  () => {
    const position = { x: 125.5, y: 87.25 };
    const host = {
      getBoundingClientRect: () => ({ left: 100, top: 50 }),
      scrollLeft: 240,
      scrollTop: 30,
    };
    assertThat(menuAnchorStyle(host, position)).isEqualTo({
      left: "265.5px",
      top: "67.25px",
    });
    assertThat(menuAnchorStyle(null, position)).isEqualTo({
      left: "125.5px",
      top: "87.25px",
    });
  },
);
