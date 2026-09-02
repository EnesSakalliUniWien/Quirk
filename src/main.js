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
import {installErrorReporter, reportBlockingIssue} from "./ui/errorReporter.js"
import {detectWebGlNotSupported} from "./issues.js"
import {startQuirk} from "./QuirkApp.js"
import {mountAppToolbar} from "./components/app-toolbar.jsx"
import {mountTransportBar} from "./components/transport-bar.jsx"
import {mountGateToolbox} from "./components/gate-toolbox.jsx"
import "./styles/globals.css"

installErrorReporter();
if (detectWebGlNotSupported()) {
    reportBlockingIssue("Can't simulate circuits. Your browser doesn't support WebGL, or has it disabled.");
}
mountAppToolbar();
mountTransportBar();
mountGateToolbox();
startQuirk();
