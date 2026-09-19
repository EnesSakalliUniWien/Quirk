import {Suite, assertThat} from "../TestUtil.js"
import {Clock} from "../../src/base/Clock.js"

const suite = new Suite("Clock");

/**
 * A clock wound by hand: frame(dMillis) lets the time pass and runs the frame that was requested.
 */
function handWound() {
    let millis = 1000;
    let requested = undefined;
    let requests = 0;
    const clock = new Clock(
        () => millis,
        callback => { requested = callback; return ++requests; },
        () => { requested = undefined; });
    return {
        clock,
        waiting: () => requested !== undefined,
        frame: dMillis => {
            millis += dMillis;
            const callback = requested;
            requested = undefined;
            callback();
        },
    };
}

suite.test("frames are requested only while something waits on them", () => {
    const {clock, waiting, frame} = handWound();
    assertThat(waiting()).isEqualTo(false);

    const seen = [];
    const stop = clock.onFrame(now => seen.push(now));
    assertThat(waiting()).isEqualTo(true);
    frame(16);
    frame(16);
    assertThat(seen).isEqualTo([1016, 1032]);

    stop();
    assertThat(waiting()).isEqualTo(false);
});

suite.test("every listener of a frame is told the same time, and one request serves them all", () => {
    const {clock, frame} = handWound();
    const seen = [];
    clock.onFrame(now => seen.push(["a", now]));
    clock.onFrame(now => seen.push(["b", now]));
    frame(20);
    assertThat(seen).isEqualTo([["a", 1020], ["b", 1020]]);
});

suite.test("after calls back once, on the first frame the wait has passed by, never at once", () => {
    const {clock, waiting, frame} = handWound();
    const seen = [];
    clock.after(0, now => seen.push(now));
    clock.after(30, now => seen.push(now));
    assertThat(seen).isEqualTo([]);
    frame(16);
    assertThat(seen).isEqualTo([1016]);
    frame(16);
    assertThat(seen).isEqualTo([1016, 1032]);
    assertThat(waiting()).isEqualTo(false);

    const cancel = clock.after(10, now => seen.push(now));
    cancel();
    assertThat(waiting()).isEqualTo(false);
});

suite.test("every calls back a period at a time and does not make up for periods missed whole", () => {
    const {clock, frame} = handWound();
    const seen = [];
    const stop = clock.every(100, now => seen.push(now));
    frame(60);
    frame(60);
    assertThat(seen).isEqualTo([1120]);
    frame(80);
    assertThat(seen).isEqualTo([1120, 1200]);
    // A long gap is one call, and the next is a full period later.
    frame(1000);
    frame(60);
    assertThat(seen).isEqualTo([1120, 1200, 2200]);
    frame(60);
    assertThat(seen).isEqualTo([1120, 1200, 2200, 2320]);
    stop();
});

suite.test("a listener added or removed during a frame takes effect from the next one", () => {
    const {clock, frame} = handWound();
    const seen = [];
    let stopB = undefined;
    clock.onFrame(() => {
        seen.push("a");
        if (stopB !== undefined) { stopB(); stopB = undefined; }
        if (seen.length === 1) clock.after(0, () => seen.push("late"));
    });
    stopB = clock.onFrame(() => seen.push("b"));
    frame(16);
    assertThat(seen).isEqualTo(["a"]);
    frame(16);
    assertThat(seen).isEqualTo(["a", "a", "late"]);
});
