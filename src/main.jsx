/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {setCustomGateCircuitRenderer} from './draw/gate/CustomGateCircuitRenderer.js';
import {GATE_CIRCUIT_RENDERER} from './editor/rendering/previews/CircuitPreview.js';

import { createRoot } from "react-dom/client";
import { applyTheme } from "./browser/applyTheme.js";

// The error reporter installs first, so a failure anywhere in startup still reaches the banner.
// It has nowhere to paint one until the shell mounts and hands it a host; a report raised before
// that is remembered and painted then.
import {
  installErrorReporter,
  reportBlockingIssue,
} from "./diagnostics/errorReporter.js";
import { webGl2SupportProblem } from "./engine/webgl/context/issues.js";
import { App } from "./components/app.jsx";
import "./styles/globals.css";

setCustomGateCircuitRenderer(GATE_CIRCUIT_RENDERER);
applyTheme();
installErrorReporter();
const gpuProblem = webGl2SupportProblem();
if (gpuProblem !== undefined) {
  reportBlockingIssue("Can't simulate circuits. " + gpuProblem);
}

// The app's one React root. Everything the app shows is rendered under it, and the circuit starts
// from inside it, once its canvas exists.
createRoot(document.getElementById("root")).render(<App />);
