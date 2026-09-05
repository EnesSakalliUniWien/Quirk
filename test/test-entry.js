import "./TestRunner.js";

import.meta.glob("./**/*.test.js", {eager: true});

// The suites are all registered by the eager globs above; run them.
document.getElementById("output").innerText = "Starting...";
__testRunner__.start();
