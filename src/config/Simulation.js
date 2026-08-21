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

/**
 * Limits and time constants for simulating a circuit.
 */
class Simulation {}

// Each qubit (when actually used) doubles the cost of simulating each gate applied to the circuit.
// Also each qubit tends to increase the amount of accuracy required.
// I see obvious errors when I set this to 20, and things get pretty laggy past 16.
// Beware setting it too high.
Simulation.MAX_WIRE_COUNT = 16;
Simulation.MIN_WIRE_COUNT = 2;
Simulation.MIN_COL_COUNT = 5;
Simulation.SIMPLE_SUPERPOSITION_DRAWING_WIRE_THRESHOLD = 14;
// Time constants.
Simulation.CYCLE_DURATION_MS = 8000; // How long it takes for evolving gates to cycle, in milliseconds.
Simulation.TIME_CACHE_GRANULARITY = 196; // The number of buckets the cycle is divided into.
Simulation.SEMI_STABLE_RANDOM_VALUE_LIFETIME_MILLIS = 300;

export {Simulation}
