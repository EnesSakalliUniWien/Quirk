import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {Theme, gateStyle} from "../src/config/Theme.js";
import {domFor} from "../src/browser/theme/dom.js";
import {test, withQuirkPage, waitForQuirk, waitForPanel, waitForCircuit} from "./harness.js";

test("shared appearance imports no renderer, browser, or CSS implementation", () => {
    const seen = new Set();
    const visit = (url, allowed = ['/src/appearance/']) => {
        if (seen.has(url.href)) return;
        seen.add(url.href);
        const source = readFileSync(url, 'utf8');
        for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
            assert.ok(dependency.startsWith('.'), `Shared appearance imports a package: ${dependency}`);
            const next = new URL(dependency, url);
            assert.ok(allowed.some(directory => next.pathname.includes(directory)), `Appearance imports implementation: ${next}`);
            assert.ok(next.pathname.endsWith('.js'), `Shared appearance imports a stylesheet: ${next}`);
            visit(next, allowed);
        }
    };
    visit(new URL('../src/appearance/Appearance.js', import.meta.url));
    assert.ok(seen.size >= 5);
    // The drawing entry point must also remain independent of browser theme application.
    visit(new URL('../src/config/CanvasTheme.js', import.meta.url), ['/src/appearance/', '/src/draw/theme/']);
    const root = new URL('../src/', import.meta.url);
    for (const path of readdirSync(root, {recursive: true}).filter(path => /\.[jt]sx?$/.test(path))) {
        if (/\.module\.css['"]/.test(readFileSync(new URL(path, root), 'utf8'))) {
            assert.ok(path.startsWith('components/'), `CSS Module imported outside HTML components: ${path}`);
        }
    }
});

test("JavaScript owns theme assignments at startup and across panels and gate chips", async browser => {
    // Prevent a second theme definition from creeping back into the app's own CSS.
    const styles = new URL("../src/", import.meta.url);
    for (const path of readdirSync(styles, {recursive: true}).filter(path => path.endsWith(".css"))) {
        const source = readFileSync(new URL(path, styles), "utf8");
        assert.doesNotMatch(source, /--[\w-]+\s*:/, `${path}: theme properties belong in JavaScript`);
        assert.doesNotMatch(source, /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|color-mix)\(/i,
            `${path}: theme colour values belong in JavaScript`);
    }
    await withQuirkPage(browser, {cols: [["H"]]}, async page => {
        await page.evaluateOnNewDocument(() => {
            const observer = new MutationObserver(() => {
                if (document.querySelector("#root > *") !== null) {
                    window.themeAtMount = document.documentElement.style.getPropertyValue("--card");
                    observer.disconnect();
                }
            });
            observer.observe(document, {childList: true, subtree: true});
        });
        await page.reload();
        await waitForQuirk(page);
        assert.equal(await page.evaluate(() => window.themeAtMount), Theme.dom["--card"]);
        const assignments = await page.evaluate(keys => Object.fromEntries(keys.map(key =>
            [key, document.documentElement.style.getPropertyValue(key)])),
        Object.keys({...Theme.dom, ...Theme.dockProperties}));
        assert.deepEqual(assignments, {...Theme.dom, ...Theme.dockProperties});

        const chips = await page.$$eval(".gate-tile", tiles => tiles.map(tile => ({
            id: tile.dataset.gateId,
            fill: tile.querySelector(".gate-chip").style.backgroundColor,
        })));
        assert.ok(chips.length > 90);
        const rgb = hex => `rgb(${hex.slice(1).match(/../g).map(v => Number.parseInt(v, 16)).join(", ")})`;
        for (const chip of chips) assert.equal(chip.fill, rgb(gateStyle({serializedId: chip.id}).fill));

        for (const [trigger, panel] of [["export-button", "export"], ["gate-forge-button", "forge"], ["tape-button", "tape"]]) {
            await page.click(`#${trigger}`);
            await waitForPanel(page, panel, true);
            const surface = await page.$eval(`[data-panel-id="${panel}"]`, root =>
                getComputedStyle(root.closest(".dv-groupview")).backgroundColor);
            assert.equal(surface, rgb(Theme.dom["--card"]));
        }
        // The Examples popup is portalled outside the dock and must still inherit the theme.
        await page.click("#examples-button");
        await page.waitForSelector(".app-menu", {visible: true});
        assert.equal(await page.$eval(".app-menu", e => getComputedStyle(e).backgroundColor), rgb(Theme.dom["--popover"]));
    });
});

test("looks the way the system does, and follows it when it changes while the app runs", async browser => {
    await withQuirkPage(browser, {cols: [["H"]]}, async page => {
        const shown = () => page.evaluate(() => ({
            dark: document.documentElement.classList.contains("dark"),
            card: document.documentElement.style.getPropertyValue("--card"),
        }));
        // The harness starts every page on a system set to dark. The app has no appearance setting
        // of its own to disagree with it.
        assert.deepEqual(await shown(), {dark: true, card: Theme.dom["--card"]});
        assert.equal(await page.$("#colour-scheme-button"), null);

        // While a text field has the focus the new appearance waits, so typing is never cut short.
        await page.focus("#gate-search");
        await page.emulateMediaFeatures([{name: "prefers-color-scheme", value: "light"}]);
        await new Promise(resolve => setTimeout(resolve, 400));
        assert.equal((await shown()).dark, true);

        // Once nothing is being typed, the app starts again in the light palette, on the same circuit.
        await Promise.all([page.waitForNavigation(), page.evaluate(() => document.activeElement.blur())]);
        await waitForQuirk(page);
        assert.deepEqual(await shown(), {dark: false, card: domFor("light")["--card"]});
        await waitForCircuit(page, {cols: [["H"]]});

        // And back, as when an automatic appearance turns dark in the evening.
        await Promise.all([page.waitForNavigation(),
            page.emulateMediaFeatures([{name: "prefers-color-scheme", value: "dark"}])]);
        await waitForQuirk(page);
        assert.deepEqual(await shown(), {dark: true, card: Theme.dom["--card"]});
    });
});
