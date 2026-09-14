import {setCustomGateCircuitRenderer} from '../src/draw/gate/CustomGateCircuitRenderer.js';
import {GATE_CIRCUIT_RENDERER} from '../src/editor/rendering/previews/CircuitPreview.js';

import "./TestRunner.js";

import.meta.glob("./**/*.test.js", {eager: true});

setCustomGateCircuitRenderer(GATE_CIRCUIT_RENDERER);

// The suites are all registered by the eager globs above; run them.
document.getElementById("output").innerText = "Starting...";
__testRunner__.start();
