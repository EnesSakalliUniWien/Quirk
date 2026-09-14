import assert from "node:assert/strict";
import {test, withQuirkPage, waitForPanel, TEST_TIMEOUT_MILLIS} from "./harness.js";

async function openAlgebra(page) {
    await page.click("#algebra-button");
    await waitForPanel(page, "algebra", true);
    await page.waitForSelector('.algebra-steps[data-layout-ready="true"]');
    await page.evaluate(() => document.fonts.ready);
}

async function geometry(page) {
    return page.evaluate(() => {
        const track = document.querySelector(".algebra-steps");
        const bounds = element => {
            const b = element.getBoundingClientRect();
            return {left: b.left, top: b.top, width: b.width, height: b.height};
        };
        return {
            cards: [...track.children].map(bounds),
            rows: [...track.querySelectorAll("mtable")].map(table => [...table.querySelectorAll("mtr")].map(bounds)),
            factors: [...track.querySelectorAll("math")].map(m => ({...bounds(m), overflow: getComputedStyle(m).overflowX,
                clipped: m.scrollWidth > m.clientWidth + 1})),
            captions: [...track.querySelectorAll("figcaption")].map(bounds),
            cardTables: [...track.children].map(c => c.querySelectorAll("mtable").length),
            scroll: track.scrollLeft,
        };
    });
}

function assertAligned(g) {
    for (const card of g.cards) {
        assert.ok(Math.abs(card.width - g.cards[0].width) <= 1, "Cards share width");
        assert.ok(Math.abs(card.height - g.cards[0].height) <= 1, "Cards share height");
        assert.ok(Math.abs(card.top - g.cards[0].top) <= 1, "Headers share a row");
    }
    for (const rows of g.rows) rows.forEach((row, i) => {
        assert.ok(Math.abs(row.top - g.rows[0][i].top) <= 1, "Corresponding matrix/vector rows align");
        assert.ok(Math.abs(row.height - g.rows[0][i].height) <= 1, "Fractional entries do not shift rows");
    });
    assert.ok(g.factors.every(f => !f.clipped && f.overflow === "visible"), "No independently clipped or scrolling factors");
    assert.ok(g.captions.every(c => Math.abs(c.top - g.captions[0].top) <= 1), "No wrapped equation factors");
    assert.equal(g.cardTables[0], 1);
    assert.ok(g.cardTables.slice(1).every(n => n === 3), "Operator, expanded input and expanded output");
}

test("matrix equations align across fractions, complex entries, resizing and zoom", async browser => {
    await withQuirkPage(browser, {cols: [["H"], ["•", 1, "X"], [{id: "Rx", arg: "pi/4"}]]}, async page => {
        await openAlgebra(page);
        assertAligned(await geometry(page));
        assert.equal(await page.$eval('.operator-matrix mtable', e => e.querySelectorAll('mtr').length), 8);
        assert.ok(await page.$eval('.algebra-steps', e => e.querySelectorAll('mfrac').length > 0 && e.querySelectorAll('msqrt').length > 0));
        await page.$eval('.algebra-steps', e => {e.scrollLeft = 300;});
        await page.setViewport({width: 900, height: 720});
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assertAligned(await geometry(page));
        assert.ok(Math.abs((await geometry(page)).scroll - 300) <= 1, "Resize preserves manual scrolling");
        await page.evaluate(() => {document.documentElement.style.zoom = "1.5"; window.dispatchEvent(new Event("resize"));});
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assertAligned(await geometry(page));
        // Reach both ends of a wide operator without any factor gaining its own scrollbar.
        for (const last of [false, true]) {
            const visible = await page.evaluate(last => {
                const track = document.querySelector('.algebra-steps');
                const entries = document.querySelector('[data-step="3"] .operator-matrix').querySelectorAll('mtd');
                const entry = last ? [...entries].at(-1) : entries[0];
                const scale = track.getBoundingClientRect().width / track.offsetWidth;
                track.scrollLeft += (entry.getBoundingClientRect().left - track.getBoundingClientRect().left) / scale;
                const a = entry.getBoundingClientRect(), b = track.getBoundingClientRect();
                return a.left >= b.left - 1 && a.right <= b.right + 1;
            }, last);
            assert.ok(visible, "First and last matrix entries remain reachable");
        }
    });
});

test("plain wheels remain vertical and Shift+wheel alone converts to horizontal scrolling", async browser => {
    await withQuirkPage(browser, {cols: [["H"], ["X"], ["H"]]}, async page => {
        await openAlgebra(page);
        const result = await page.evaluate(() => {
            const track = document.querySelector('.algebra-steps');
            track.scrollLeft = 100;
            const plain = new WheelEvent('wheel', {deltaY: 80, bubbles: true, cancelable: true});
            track.dispatchEvent(plain);
            const before = track.scrollLeft;
            const shift = new WheelEvent('wheel', {deltaY: 80, shiftKey: true, bubbles: true, cancelable: true});
            track.dispatchEvent(shift);
            return {plainPrevented: plain.defaultPrevented, before, after: track.scrollLeft, shiftPrevented: shift.defaultPrevented};
        });
        assert.equal(result.plainPrevented, false);
        assert.equal(result.before, 100);
        assert.equal(result.after, 180);
        assert.equal(result.shiftPrevented, true);
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
        assert.ok(Math.abs((await geometry(page)).scroll - 180) <= 1, "Rendering does not reset manual scroll");
    });
});

test("large operators support keyboard entry selection without scrolling during zoom", async browser => {
    await withQuirkPage(browser, {cols: [["inc12"]]}, async page => {
        await openAlgebra(page);
        const operator = '[data-step="1"] .operator-view';
        await page.waitForSelector(operator + ' canvas[data-painted="true"]');
        await page.focus(operator + ' input[aria-label="Output row"]');
        await page.keyboard.press('ArrowUp');
        await page.waitForFunction(selector => /\|U\|.*= 1/.test(document.querySelector(selector).textContent),
            {timeout: TEST_TIMEOUT_MILLIS}, operator + ' .operator-view-readout');
        const unchanged = await page.evaluate(selector => {
            const track = document.querySelector('.algebra-steps');
            const x = track.scrollLeft;
            document.querySelector(selector).dispatchEvent(new WheelEvent('wheel', {
                deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true}));
            return track.scrollLeft === x;
        }, operator + ' canvas');
        assert.ok(unchanged);
        await page.waitForFunction(selector => document.querySelector(selector).textContent !== '×1', {}, operator + ' .operator-view-zoom');
        assert.ok(await page.$eval('[data-step="1"]', e => e.textContent.includes('reshaped grid')));
    });
});

test("Forge shares written matrices, preserves parsing and previews non-unitary operators", async browser => {
    await withQuirkPage(browser, {cols: [["H"]]}, async page => {
        await page.click('#gate-forge-button');
        await waitForPanel(page, 'forge', true);
        await page.$$eval('.construction-tabs [role="tab"]', tabs => tabs.find(tab => tab.textContent === 'Matrix').click());
        await page.waitForSelector('#gate-forge-matrix-canvas mtable');
        assert.equal(await page.$$eval('.forge-operation-preview .rotation-figure', e => e.length), 1);
        await page.$$eval('.entry-modes button', buttons => buttons.find(button => button.textContent === 'Raw text').click());
        await page.$eval('#gate-forge-matrix',element=>{element.focus();element.select();});
        await page.type('#gate-forge-matrix', '1, 0, 0, 2');
        await page.waitForFunction(() => document.querySelector('#gate-forge-matrix-canvas').textContent.includes('Nonunitary operation'));
        assert.equal(await page.$eval('#gate-forge-matrix-button', e => e.disabled), false);
        await page.$eval('#gate-forge-matrix',element=>{element.focus();element.select();});
        await page.keyboard.press('Backspace');
        await page.type('#gate-forge-matrix', 'invalid');
        await page.waitForFunction(() => document.querySelector('#gate-forge-matrix-button').disabled);
        await page.waitForSelector('#gate-forge-matrix-canvas [role="alert"]');
    });
});

test("gate details write out a complete eight-by-eight operator", async browser => {
    const circuit = {cols: [['~three']], gates: [{id: '~three', name: 'Three', circuit: {cols: [['inc3']]}}]};
    await withQuirkPage(browser, circuit, async page => {
        const point = await page.evaluate(() => {
            const tile = [...document.querySelectorAll('.gate-tile')].find(e => e.getAttribute('aria-label') === 'Three Gate [three]');
            tile.scrollIntoView({block: 'center'});
            const b = tile.getBoundingClientRect();
            return {x: b.left + b.width / 2, y: b.top + b.height / 2};
        });
        await page.mouse.move(point.x, point.y);
        await page.waitForSelector('.gate-hover .operator-matrix mtable');
        assert.equal(await page.$$eval('.gate-hover .operator-matrix mtd', cells => cells.length), 64);
        assert.match(await page.$eval('.gate-hover figcaption', e => e.textContent), /8×8/);
    });
});

test("measurement steps retain simulated states without claiming a matrix equality", async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Measure'], ['ZDetector']]}, async page => {
        await openAlgebra(page);
        const detector = await page.$eval('[data-step="3"]', card => ({
            tables: card.querySelectorAll('mtable').length,
            operator: card.querySelector('.operator-matrix') !== null,
            relation: card.querySelector('.equation-sign').textContent,
            note: card.querySelector('.algebra-step-note').textContent,
        }));
        assert.equal(detector.tables, 2);
        assert.equal(detector.operator, false);
        assert.equal(detector.relation, '→');
        assert.match(detector.note, /measures at random/);
        assert.match(await page.$eval('.algebra-panel', e => e.textContent), /density matrices for the physical state/);
    });
});
