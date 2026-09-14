import {resolve} from "node:path";

import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

const projectRoot = import.meta.dirname;
const pageForMode = {test: "test/test.html", perf: "test_perf/test_perf.html"};

export default defineConfig(({mode}) => {
    const input = pageForMode[mode] ?? "index.html";
    const isApp = input === "index.html";
    return {
        // Serve actual entry documents; removed URLs must not fall back to the app.
        appType: 'mpa',
        plugins: [react()],
        resolve: {
            alias: {
                "@": resolve(projectRoot, "src")
            }
        },
        worker: {
            // The operator tile worker loads the gate catalogue, which splits into chunks, and
            // only module workers can load chunks.
            format: "es",
            rollupOptions: {
                output: {
                    keepNames: true
                }
            }
        },
        build: {
            outDir: "out",
            // The test and perf builds sit beside a previously built app page, unminified so
            // their stack traces stay readable.
            emptyOutDir: isApp,
            minify: isApp,
            rollupOptions: {
                input: resolve(projectRoot, input),
                output: {
                    // Describe.js reads constructor.name, so minification must keep names.
                    keepNames: true
                }
            }
        }
    };
});
