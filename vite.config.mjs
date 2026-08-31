import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";
import {viteSingleFile} from "vite-plugin-singlefile";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const pages = {
    app: {
        input: "quirk.html",
        template: "html/quirk.template.html",
        entry: "/src/main.js",
        partials: {
            "<!-- INCLUDE MENU PART -->": "html/menu.partial.html",
            "<!-- INCLUDE ERROR PART -->": "html/error.partial.html",
            "<!-- INCLUDE FORGE PART -->": "html/forge.partial.html",
            "<!-- INCLUDE EXPORT PART -->": "html/export.partial.html",
            "<!-- INCLUDE STATE PART -->": "html/state.partial.html"
        }
    },
    test: {
        input: "test.html",
        template: "test_perf/test_page.template.html",
        entry: "/test/test-entry.js",
        partials: {}
    },
    perf: {
        input: "test_perf.html",
        template: "test_perf/test_page.template.html",
        entry: "/test_perf/test-entry.js",
        partials: {}
    }
};

function replaceExactlyOnce(text, marker, replacement, sourceName) {
    const firstIndex = text.indexOf(marker);
    if (firstIndex === -1 || text.indexOf(marker, firstIndex + marker.length) !== -1) {
        throw new Error(`Expected exactly one ${marker} marker in ${sourceName}.`);
    }
    return text.slice(0, firstIndex) + replacement + text.slice(firstIndex + marker.length);
}

function templateEntryPlugin(page) {
    return {
        name: "quirk-template-entry",
        transformIndexHtml: {
            order: "pre",
            handler() {
                let html = readFileSync(resolve(projectRoot, page.template), "utf8");
                for (const [marker, partialPath] of Object.entries(page.partials)) {
                    html = replaceExactlyOnce(
                        html,
                        marker,
                        readFileSync(resolve(projectRoot, partialPath), "utf8"),
                        page.template);
                }
                return replaceExactlyOnce(
                    html,
                    "<!-- INCLUDE SOURCE PART -->",
                    `<script type="module" src="${page.entry}"></script>`,
                    page.template);
            }
        }
    };
}

export default defineConfig(({mode}) => {
    const page = mode === "test" ? pages.test : mode === "perf" ? pages.perf : pages.app;
    return {
        plugins: [
            templateEntryPlugin(page),
            react(),
            tailwindcss(),
            viteSingleFile({removeViteModuleLoader: true})
        ],
        resolve: {
            alias: {
                "@": resolve(projectRoot, "src")
            }
        },
        build: {
            outDir: "out",
            emptyOutDir: page === pages.app,
            minify: page === pages.app,
            rollupOptions: {
                input: resolve(projectRoot, page.input),
                output: {
                    keepNames: true
                }
            }
        }
    };
});
