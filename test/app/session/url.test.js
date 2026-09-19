import {Suite, assertThat} from "../../TestUtil.js"
import {parseBreakpoints, urlWithCircuitHash} from "../../../src/app/session/url.js"

const suite = new Suite("url");

suite.test("a link carries the breakpoints after the circuit, and leaves them out when there are none", () => {
    assertThat(urlWithCircuitHash('{"cols":[["H"]]}')).isEqualTo('#circuit={"cols":[["H"]]}');
    assertThat(urlWithCircuitHash('{"cols":[["H"]]}', [])).isEqualTo('#circuit={"cols":[["H"]]}');
    assertThat(urlWithCircuitHash('{"cols":[["H"]]}', [0, 3])).isEqualTo('#circuit={"cols":[["H"]]}&breakpoints=0,3');
});

suite.test("a link's breakpoints are read back, skipping whatever is no column", () => {
    assertThat(parseBreakpoints(undefined)).isEqualTo([]);
    assertThat(parseBreakpoints("")).isEqualTo([]);
    assertThat(parseBreakpoints("0,3")).isEqualTo([0, 3]);
    assertThat(parseBreakpoints(" 2 ,x,-1,1.5,7")).isEqualTo([2, 7]);
});
