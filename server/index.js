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

// The production entry: serves the built app in out/. Run `npm run build` first, or use
// `npm run serve` which does both.

import {join} from "node:path";

import {startStaticServer} from "./staticServer.js";

const {origin, close} = await startStaticServer({
    root: join(import.meta.dirname, "..", "out"),
    port: Number(process.env.PORT ?? 8080),
    host: process.env.HOST ?? "0.0.0.0",
});
console.log(`Shadow-Quant serving out/ at ${origin}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
        await close();
        process.exit(0);
    });
}
