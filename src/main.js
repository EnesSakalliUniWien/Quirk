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

// The error reporter installs first, so a failure anywhere in startup still reaches the banner.
import {
  installErrorReporter,
  reportBlockingIssue,
} from "./diagnostics/errorReporter.js";
import { webGl2SupportProblem } from "./engine/webgl/context/issues.js";
import { startQuirk } from "./app/QuirkApp.js";
import { mountAppToolbar } from "./components/toolbar/app-toolbar.jsx";
import { mountTransportBar } from "./components/toolbar/transport-bar.jsx";
import "./styles/globals.css";

installErrorReporter();
const gpuProblem = webGl2SupportProblem();
if (gpuProblem !== undefined) {
  reportBlockingIssue("Can't simulate circuits. " + gpuProblem);
}
mountAppToolbar();
mountTransportBar();
// The gate toolbox mounts inside startQuirk: it needs the circuit's drag and place pipelines.
startQuirk();
