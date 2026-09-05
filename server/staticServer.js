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

import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {createServer} from "node:http";
import {extname, join, normalize, resolve} from "node:path";

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".map": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
};

/**
 * Serves a directory of built files over http. Port 0 picks an ephemeral port, which is how the
 * Puppeteer runners host out/ for the duration of a suite.
 *
 * @param {!{root: !string, port: (!number|undefined), host: (!string|undefined)}} options
 * @returns {!Promise.<!{origin: !string, close: !function(): !Promise}>}
 */
function startStaticServer({root, port = 0, host = "127.0.0.1"}) {
    const rootDir = resolve(root);
    const server = createServer(async (req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (pathname === "/healthz") {
            res.writeHead(200, {"content-type": "text/plain"}).end("ok");
            return;
        }
        const filePath = normalize(join(rootDir, pathname === "/" ? "quirk.html" : pathname));
        const fileStat = filePath.startsWith(rootDir) && await stat(filePath).catch(() => undefined);
        if (!fileStat || !fileStat.isFile()) {
            res.writeHead(404, {"content-type": "text/plain"}).end("not found");
            return;
        }
        const ext = extname(filePath);
        res.writeHead(200, {
            "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
            // The page itself must always revalidate; the hashed assets never change.
            "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
        });
        createReadStream(filePath).pipe(res);
    });
    return new Promise((done, fail) => {
        server.once("error", fail);
        server.listen(port, host, () => done({
            origin: `http://${host}:${server.address().port}`,
            close: () => new Promise(resolveClose => server.close(resolveClose)),
        }));
    });
}

export {startStaticServer};
