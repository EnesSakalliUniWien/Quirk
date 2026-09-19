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
 * Limits and time constants for simulating a circuit. How the cycle animates is in Animation.js.
 */
const Simulation = Object.freeze({
  // Each additional qubit doubles the state size; raising this limit also needs accuracy checks.
  MAX_WIRE_COUNT: 16,
  MIN_WIRE_COUNT: 2,
  TIME_CACHE_GRANULARITY: 196,
  SEMI_STABLE_RANDOM_VALUE_LIFETIME_MILLIS: 300,
});

export { Simulation };
