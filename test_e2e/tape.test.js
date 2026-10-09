import assert from "node:assert/strict";
import {mkdtemp, readFile, writeFile, rm, readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test, withQuirkPage, waitForPanel, waitForQuirk, TEST_TIMEOUT_MILLIS} from "./harness.js";

async function records(page) {
    return page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open("shadow-quant-tape", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const read = db.transaction("takes").objectStore("takes").getAll();
            read.onsuccess = () => {db.close(); resolve(read.result);};
            read.onerror = () => {db.close(); reject(read.error);};
        };
    }));
}

/** Waits until the saved takes stop changing: a write still in flight has landed. */
async function settledRecords(page) {
    let previous = -1;
    let current = (await records(page)).length;
    const started = Date.now();
    while (current !== previous) {
        if (Date.now() - started > TEST_TIMEOUT_MILLIS) throw new Error("The takes never stopped changing");
        await new Promise(resolve => setTimeout(resolve, 600));
        previous = current;
        current = (await records(page)).length;
    }
    return current;
}

async function waitSaved(page, count) {
    await page.waitForFunction(expected => [...document.querySelectorAll('.take-card:not(.take-ghost)')].length === expected,
        {timeout: TEST_TIMEOUT_MILLIS}, count);
}

test("Tape records, compares, reloads, restores and downloads complete takes", async browser => {
    const context = await browser.createBrowserContext();
    const directory = await mkdtemp(join(tmpdir(), "quirk-tape-"));
    try {
        await withQuirkPage(context, {cols: [["H"], ["X"]]}, async page => {
            const client = await page.createCDPSession();
            await client.send("Browser.setDownloadBehavior", {behavior: "allow", downloadPath: directory, browserContextId: context.id});
            await page.click("#record-take");
            await waitForPanel(page, "tape", true);
            await waitSaved(page, 1);
            await page.click("#playhead-next-button");
            await page.click("#record-take");
            await waitSaved(page, 2);
            let saved = (await records(page)).filter(r => !r.ghost);
            assert.deepEqual(saved.map(r => r.take.step).sort(), [0,1]);
            const initial = saved.find(r => r.take.step === 0).take;
            await page.evaluate(() => document.querySelectorAll('.take-card input[type="checkbox"]').forEach(e => e.click()));
            await page.waitForSelector(".tape-differences");
            assert.match(await page.$eval(".tape-differences", e => e.textContent), /0: 1\.00000 → 0\.500000/);

            await page.reload();
            await waitForQuirk(page);
            await page.click("#tape-button");
            await waitSaved(page, 2);
            await page.click("#clear-circuit-button");
            await page.evaluate(id => [...document.querySelector(`[data-take-id="${id}"]`).querySelectorAll("button")].find(e => e.textContent === "Restore").click(), initial.id);
            await page.waitForFunction(() => document.querySelector("#playhead-position").textContent.includes("operation 0 / 2"));
            await page.click("#undo-button");
            await page.waitForFunction(() => document.querySelector("#playhead-position").textContent.includes("/ 0"));

            await page.evaluate(() => [...document.querySelectorAll("button")].find(e => e.textContent === "Download album").click());
            const started = Date.now();
            while (!(await readdir(directory)).includes("tape.json")) {
                if (Date.now()-started > TEST_TIMEOUT_MILLIS) throw new Error("Album download did not finish");
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            const album = JSON.parse(await readFile(join(directory, "tape.json"), "utf8"));
            assert.equal(album.format, "shadow-quant-album/1");
            assert.equal(album.takes.length, 2);
            assert.equal(album.takes[0].result.amplitudes.length, 8);
            saved = (await records(page)).filter(r => !r.ghost);
            assert.equal(saved.length, 2);
        });
    } finally {await context.close(); await rm(directory, {recursive: true, force: true});}
});

test("Tape whole run uses one phase and links import in a fresh browser context", async browser => {
    const context = await browser.createBrowserContext();
    let link;
    let first;
    try {
        await withQuirkPage(context, {cols: [["H"], ["ZDetector"], ["Sample1"]]}, async page => {
            await page.click("#record-run");
            await waitForPanel(page, "tape", true);
            await waitSaved(page, 4);
            const takes = (await records(page)).map(r => r.take).sort((a,b) => a.step-b.step);
            assert.deepEqual(takes.map(t => t.step), [0,1,2,3]);
            assert.equal(new Set(takes.map(t => t.phase)).size, 1);
            assert.equal(new Set(takes.map(t => t.seed)).size, 1);
            first = takes[3];
            link = `${page.url().split("#")[0]}#take=${encodeURIComponent(JSON.stringify(first))}`;
        });
    } finally {await context.close();}
    const fresh = await browser.createBrowserContext();
    const page = await fresh.newPage();
    try {
        await page.goto(link);
        await waitForQuirk(page);
        await waitForPanel(page, "tape", true);
        await page.waitForSelector(".take-linked");
        assert.match(await page.$eval("#playhead-position", e => e.textContent), /operation 2 \/ 2/);
        assert.match(await page.$eval(".take-card", e => e.textContent), /Sample 2:0:/);
        assert.match(await page.$eval(".take-card", e => e.textContent), /Measured 1024 shots/);
        // Opening the link recorded nothing; keeping the take saves it as it was.
        assert.deepEqual(await records(page), []);
        await page.evaluate(() => [...document.querySelector(".take-linked").querySelectorAll("button")].find(e => e.textContent === "Keep").click());
        await waitSaved(page, 1);
        assert.deepEqual((await records(page))[0].take, first);
        assert.equal(await page.$(".take-linked"), null);
    } finally {await fresh.close();}
});

test("Tape validates a whole import before saving any of it", async browser => {
    const context = await browser.createBrowserContext();
    const directory = await mkdtemp(join(tmpdir(), "quirk-import-"));
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            await page.click("#record-take");
            await waitSaved(page, 1);
            const take = (await records(page))[0].take;
            const path = join(directory, "album.json");
            await writeFile(path, JSON.stringify({format: "shadow-quant-album/1", takes: [
                {...take, id: "valid-first"}, {...take, id: "invalid-second", phase: 2},
            ]}));
            const input = await page.$('input[aria-label="Import takes"]');
            await input.uploadFile(path);
            await page.waitForFunction(() => document.querySelector('[data-panel-id="tape"] [role="alert"]')?.textContent.includes("phase"));
            assert.equal((await records(page)).length, 1);
            await writeFile(path, JSON.stringify({format: "shadow-quant-album/1", takes: [
                {...take, id: "valid-first"}, {...take, id: "valid-second"},
            ]}));
            await input.uploadFile(path);
            await waitSaved(page, 3);
            assert.equal((await records(page)).length, 3);
        });
    } finally {await context.close(); await rm(directory, {recursive: true, force: true});}
});

test("Keeping a ghost immediately after editing preserves metadata and results on reload", async browser => {
    for (const field of ["name", "notes"]) {
        const context = await browser.createBrowserContext();
        try {
            await withQuirkPage(context, {cols: [["H"]]}, async page => {
                await page.click("#record-take");
                await waitSaved(page, 1);
                await page.click("#record-ghosts");
                await page.click("#clear-circuit-button");
                await page.waitForSelector(".take-ghost");
                const original = (await records(page)).find(r => r.ghost).take;
                const selector = `[data-take-id="${original.id}"]`;
                if (field === "notes") await page.click(`${selector} summary`);
                const input = `${selector} ${field === "name" ? 'input[aria-label^="Name"]' : 'textarea'}`;
                await page.focus(input);
                await page.$eval(input, e => e.select());
                const value = `Edited ghost ${field}`;
                await page.keyboard.type(value);
                // Keep runs before the asynchronous blur write can refresh the card's props.
                await page.evaluate(({selector, input}) => {
                    document.querySelector(input).blur();
                    [...document.querySelector(selector).querySelectorAll("button")].find(e => e.textContent === "Keep").click();
                }, {selector, input});
                await waitSaved(page, 2);
                await page.reload();
                await waitForQuirk(page);
                const kept = (await records(page)).find(r => r.id === original.id);
                assert.equal(kept.ghost, false);
                assert.deepEqual(kept.take, {...original, [field]: value});
            });
        } finally {await context.close();}
    }
});

test("Tape rejects an album with missing detector data without partial writes", async browser => {
    const context = await browser.createBrowserContext();
    const directory = await mkdtemp(join(tmpdir(), "quirk-missing-detector-"));
    try {
        await withQuirkPage(context, {cols: [["H"], ["ZDetector"]]}, async page => {
            await page.click("#playhead-end-button");
            await page.click("#record-take");
            await waitSaved(page, 1);
            const before = await records(page);
            const take = before[0].take;
            const bad = structuredClone(take);
            bad.id = "missing-detector";
            bad.fullResult.custom = [];
            const path = join(directory, "album.json");
            await writeFile(path, JSON.stringify({format: "shadow-quant-album/1", takes: [
                {...take, id: "valid-first"}, bad,
            ]}));
            await (await page.$('input[aria-label="Import takes"]')).uploadFile(path);
            await page.waitForFunction(() => document.querySelector('[data-panel-id="tape"] [role="alert"]')?.textContent.includes("Missing ZDetector"));
            assert.deepEqual(await records(page), before);
        });
    } finally {await context.close(); await rm(directory, {recursive: true, force: true});}
});

test("Nothing records until asked, and a started recording samples at the set rate until stopped", async browser => {
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            // Edits and an example record nothing.
            await page.click("#clear-circuit-button");
            await page.click("#examples-button");
            await page.waitForSelector(".app-menu-item");
            await page.click(".app-menu-item");
            await page.click("#undo-button");
            // Longer than three periods of the default sampling rate: a recording that had started
            // by itself would have saved a take by now.
            await new Promise(resolve => setTimeout(resolve, 1600));
            assert.deepEqual(await records(page), []);
            assert.equal(await page.$eval("#recording-indicator", e => e.hidden), true);

            await page.click("#record-toggle");
            await waitForPanel(page, "tape", true);
            assert.equal(await page.$eval("#record-toggle", e => e.textContent), "Stop");
            assert.match(await page.$eval("#recording-status", e => e.textContent), /Recording started, a take 2 per second/);
            assert.equal(await page.$eval("#recording-indicator", e => e.hidden), false);
            assert.match(await page.$eval("#recording-indicator", e => e.textContent), /Recording · 2\/s/);
            // The buttons that cannot be used while recording give their place to the indicator.
            assert.equal(await page.$eval("#record-run", e => e.hidden), true);
            assert.equal(await page.$eval("#record-take", e => e.hidden), true);
            await page.waitForFunction(() => document.querySelectorAll(".take-card").length >= 3, {timeout: TEST_TIMEOUT_MILLIS});
            await page.click("#record-toggle");
            assert.equal(await page.$eval("#recording-indicator", e => e.hidden), true);
            assert.equal(await page.$eval("#record-toggle", e => e.textContent), "Record");
            // A sample being written when Stop was pressed may still land; after that, nothing does.
            const count = await settledRecords(page);
            await new Promise(resolve => setTimeout(resolve, 1600));
            assert.equal((await records(page)).length, count);
            assert.match(await page.$eval("#recording-status", e => e.textContent), /Recording stopped/);
            for (const {take} of await records(page)) {
                assert.equal(take.measurement.shots, 1024);
                assert.equal(take.measurement.counts.reduce((sum, [, n]) => sum + n, 0), 1024);
            }
        });
    } finally {await context.close();}
});

test("The animation, sampling and measurement settings apply to what is recorded and are remembered", async browser => {
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            await page.click("#tape-button");
            await waitForPanel(page, "tape", true);
            await page.click(".motion-settings summary");
            const setValue = (selector, value) => page.$eval(selector, (e, v) => {
                const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), "value").set;
                setter.call(e, v);
                e.dispatchEvent(new Event("input", {bubbles: true}));
                e.dispatchEvent(new Event("change", {bubbles: true}));
                e.blur();
            }, value);
            await setValue("#setting-shots", "64");
            await setValue("#setting-sample-rate", "5");
            await setValue("#setting-cycle", "2");
            await page.waitForFunction(() => document.querySelector("#setting-cycle + output").textContent === "2 s");
            await page.click("#record-take");
            await waitSaved(page, 1);
            assert.equal((await records(page))[0].take.measurement.shots, 64);
            await page.click("#record-toggle");
            assert.match(await page.$eval("#recording-indicator", e => e.textContent), /5\/s/);
            await page.click("#record-toggle");

            await page.reload();
            await waitForQuirk(page);
            await page.click("#tape-button");
            await waitForPanel(page, "tape", true);
            assert.equal(await page.$eval("#setting-shots", e => e.value), "64");
            assert.equal(await page.$eval("#setting-cycle", e => e.value), "2");
            await page.evaluate(() => [...document.querySelectorAll(".motion-settings button")].find(e => e.textContent === "Reset to defaults").click());
            await page.waitForFunction(() => document.querySelector("#setting-shots").value === "1024");
        });
    } finally {await context.close();}
});

test("With ghosts on, an edit keeps a ghost and loading an example keeps none", async browser => {
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            await page.click("#tape-button");
            await waitForPanel(page, "tape", true);
            await page.click("#record-ghosts");
            await page.click("#clear-circuit-button");
            await page.waitForSelector(".take-ghost");
            await page.click("#examples-button");
            await page.waitForSelector(".app-menu-item");
            await page.click(".app-menu-item");
            await new Promise(resolve => setTimeout(resolve, 600));
            assert.equal((await records(page)).filter(r => r.ghost).length, 1);
        });
    } finally {await context.close();}
});

test("A broken take link says why and saves nothing, and leaving a take link drops its unsaved take", async browser => {
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            const base = page.url().split("#")[0];
            await page.goto(`${base}#take=${encodeURIComponent(JSON.stringify({format: "shadow-quant-take/1", id: "x"}))}`);
            await waitForQuirk(page);
            await page.click("#tape-button");
            await waitForPanel(page, "tape", true);
            await page.waitForFunction(() => document.querySelector('[data-panel-id="tape"] [role="alert"]')?.textContent.includes("Invalid take"));
            assert.deepEqual(await records(page), []);

            await page.goto(`${base}#circuit=${encodeURIComponent(JSON.stringify({cols: [["H"], ["X"]]}))}`);
            await waitForQuirk(page);
            await page.click("#record-take");
            await waitForPanel(page, "tape", true);
            await waitSaved(page, 1);
            const take = (await records(page))[0].take;
            await page.evaluate(link => {location.hash = link;}, `take=${encodeURIComponent(JSON.stringify({...take, id: "linked"}))}`);
            await page.waitForSelector(".take-linked");
            await page.goBack();
            await page.waitForFunction(() => document.querySelector(".take-linked") === null);
            assert.equal((await records(page)).length, 1);
        });
    } finally {await context.close();}
});

test("The settings say so while Reduce Motion is on", async browser => {
    const context = await browser.createBrowserContext();
    try {
        await withQuirkPage(context, {cols: [["H"]]}, async page => {
            await page.click("#tape-button");
            await waitForPanel(page, "tape", true);
            await page.click(".motion-settings summary");
            assert.doesNotMatch(await page.$eval(".motion-settings", e => e.textContent), /Reduce Motion is on/);
            await page.emulateMediaFeatures([{name: "prefers-color-scheme", value: "dark"}, {name: "prefers-reduced-motion", value: "reduce"}]);
            await page.waitForFunction(() => document.querySelector(".motion-settings").textContent.includes("Reduce Motion is on"));
        });
    } finally {await context.close();}
});
