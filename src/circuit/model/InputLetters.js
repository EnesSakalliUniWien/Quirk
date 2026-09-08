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
 * The registers an input gate can feed: the model keys its "Input Range A" statistics by these
 * letters, and the input gates in src/gates/inputs/ are built one per letter.
 * @type {!Array.<!string>}
 */
const INPUT_LETTERS = ["A", "B", "R"];

export { INPUT_LETTERS };
