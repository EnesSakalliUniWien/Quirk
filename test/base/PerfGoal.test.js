import { Suite, assertThat, assertThrows } from "../TestUtil.js";
import {
  getKnownPerfTests,
  millis,
  perfGoal,
} from "../../test_perf/TestPerfUtil.js";

const suite = new Suite("PerfGoal");

function runPerfGoal(method, arg, cleanup) {
  const tests = getKnownPerfTests();
  const originalLength = tests.length;
  try {
    perfGoal("cleanup test", millis(1000), method, arg, cleanup);
    return tests[originalLength].method();
  } finally {
    tests.length = originalLength;
  }
}

suite.test("cleanup runs once after successful measurement", () => {
  const arg = {};
  let cleanupCount = 0;

  const result = runPerfGoal(
    () => {},
    arg,
    (cleanedArg) => {
      assertThat(cleanedArg === arg).isEqualTo(true);
      cleanupCount++;
    },
  );

  assertThat(result.pass).isEqualTo(true);
  assertThat(cleanupCount).isEqualTo(1);
});

suite.test(
  "cleanup runs once after a warmup failure and preserves the error",
  () => {
    const arg = {};
    const error = new Error("warmup failed");
    let cleanupCount = 0;

    const thrown = assertThrows(() =>
      runPerfGoal(
        () => {
          throw error;
        },
        arg,
        () => cleanupCount++,
      ),
    );

    assertThat(thrown.subject === error).isEqualTo(true);
    assertThat(cleanupCount).isEqualTo(1);
  },
);

suite.test(
  "cleanup runs once after a timed iteration failure and preserves the error",
  () => {
    const arg = {};
    const error = new Error("timed iteration failed");
    let calls = 0;
    let cleanupCount = 0;

    const thrown = assertThrows(() =>
      runPerfGoal(
        () => {
          calls++;
          if (calls === 3) {
            throw error;
          }
        },
        arg,
        () => cleanupCount++,
      ),
    );

    assertThat(thrown.subject === error).isEqualTo(true);
    assertThat(cleanupCount).isEqualTo(1);
  },
);
