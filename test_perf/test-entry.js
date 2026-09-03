import "./PerfTestRunner.js";

import.meta.glob("./**/*.perf.js", {eager: true});

// The suites are all registered by the eager globs above; run them.
document.getElementById("output").innerText = "Starting...";
__testRunner__.start();
