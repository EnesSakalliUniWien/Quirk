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
            await page.waitForFunction(() => document.querySelector("#playhead-position").textContent.includes("gate 0 / 2"));
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
            link = page.url().split("#")[0] + "#take=" + encodeURIComponent(JSON.stringify(first));
        });
    } finally {await context.close();}
    const fresh = await browser.createBrowserContext();
    const page = await fresh.newPage();
    try {
        await page.goto(link);
        await waitForQuirk(page);
        await waitForPanel(page, "tape", true);
        await waitSaved(page, 1);
        assert.deepEqual((await records(page))[0].take, first);
        assert.match(await page.$eval("#playhead-position", e => e.textContent), /gate 3 \/ 3/);
        assert.match(await page.$eval(".take-card", e => e.textContent), /Sample 2:0:/);
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
