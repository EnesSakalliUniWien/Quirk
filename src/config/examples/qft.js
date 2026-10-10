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

const qftLink = {
  cols: [
    ["Counting8"],
    ["Chance8"],
    ["…", "…", "…", "…", "…", "…", "…", "…"],
    ["Swap", 1, 1, 1, 1, 1, 1, "Swap"],
    [1, "Swap", 1, 1, 1, 1, "Swap"],
    [1, 1, "Swap", 1, 1, "Swap"],
    [1, 1, 1, "Swap", "Swap"],
    ["H"],
    ["Z^½", "•"],
    [1, "H"],
    ["Z^¼", "Z^½", "•"],
    [1, 1, "H"],
    ["Z^⅛", "Z^¼", "Z^½", "•"],
    [1, 1, 1, "H"],
    ["Z^⅟₁₆", "Z^⅛", "Z^¼", "Z^½", "•"],
    [1, 1, 1, 1, "H"],
    ["Z^⅟₃₂", "Z^⅟₁₆", "Z^⅛", "Z^¼", "Z^½", "•"],
    [1, 1, 1, 1, 1, "H"],
    ["Z^⅟₆₄", "Z^⅟₃₂", "Z^⅟₁₆", "Z^⅛", "Z^¼", "Z^½", "•"],
    [1, 1, 1, 1, 1, 1, "H"],
    ["Z^⅟₁₂₈", "Z^⅟₆₄", "Z^⅟₃₂", "Z^⅟₁₆", "Z^⅛", "Z^¼", "Z^½", "•"],
    [1, 1, 1, 1, 1, 1, 1, "H"],
  ],
};

export { qftLink };
