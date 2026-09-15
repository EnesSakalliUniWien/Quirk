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
 * Checks a precondition, throwing an exception containing the given message in the case of failure.
 * @param {!boolean|*} expression
 * @param {=string} message
 * @param {=Array} args
 */
export function need(expression, message, args) {
  if (expression !== true) {
    const argDesc =
      args === undefined
        ? "(not provided)"
        : `[${Array.prototype.slice.call(args).join(", ")}]`;
    const msgDesc = message === undefined ? "(not provided)" : message;
    const msg =
      "Precondition failed" +
      "\n\nMessage: " +
      msgDesc +
      "\n\nArgs: " +
      argDesc;
    throw new Error(msg);
  }
}

