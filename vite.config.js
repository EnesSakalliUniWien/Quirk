import {resolve} from "node:path";

import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

const projectRoot = import.meta.dirname;
const pageForMode = {test: "test/test.html", perf: "test_perf/test_perf.html"};
const EMPTY_MODULE_ID = "\0empty-pixi-layout";

/** Resolves the side-effect-only `@pixi/layout` import to an empty module. */
const withoutPixiLayout = () => ({
    name: "without-pixi-layout",
    enforce: "pre",
    resolveId: id => (id === "@pixi/layout" ? EMPTY_MODULE_ID : null),
    load: id => (id === EMPTY_MODULE_ID ? "export {};" : null)
});

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
            // It draws nothing, so it leaves out Pixi Layout's Container mixins and Yoga WASM.
            plugins: () => [withoutPixiLayout()],
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
