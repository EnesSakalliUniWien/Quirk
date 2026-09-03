import {resolve} from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

const projectRoot = import.meta.dirname;
const pageForMode = {test: "test.html", perf: "test_perf.html"};

export default defineConfig(({mode}) => {
    const input = pageForMode[mode] ?? "quirk.html";
    const isApp = input === "quirk.html";
    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": resolve(projectRoot, "src")
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
