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

// The panels the circuit and the toolbar open: export, gate forge, gate parameter, Bloch.

import assert from 'node:assert/strict';
import {circuitMetrics, test, withQuirkPage, waitForCircuit, waitForPanel, closePanel, TEST_TIMEOUT_MILLIS, circuitTopForWires, waitForCanvasViewport, currentCircuit, exportedCircuit} from './harness.js';
import {Matrix} from '../src/engine/math/matrix/Matrix.js';

test('density cell inspection supports keyboard selection without editing the circuit', async browser => {
    const circuit = {cols: [['H'], ['Density']]};
    await withQuirkPage(browser, circuit, async page => {
        await waitForCanvasViewport(page);
        const top = await circuitTopForWires(page, 2);
        const bounds = await page.$eval('#drawCanvas canvas', e => e.getBoundingClientRect().toJSON());
        await page.mouse.click(bounds.x + circuitMetrics.columnSpacing + circuitMetrics.firstColumnLeft + 10,
            bounds.y + top + circuitMetrics.wireSpacing / 2);
        await waitForPanel(page, 'complex-display', true);
        await page.waitForSelector('.complex-display-grid');
        await page.focus('.complex-display-grid');
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.complex-display-grid').getAttribute('aria-label').includes('column 1'));
        const text = await page.$eval('.complex-display-panel', e => e.innerText);
        assert.match(text, /Stored complex value/);
        assert.match(text, /0\.5 \+ 0i/);
        assert.match(text, /logarithmic scale/);
        assert.deepEqual(await currentCircuit(page), circuit);
        await closePanel(page, 'complex-display');
    });
});

async function openBlochAt(page, column) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await waitForCanvasViewport(page);
        const top = await circuitTopForWires(page, 2);
        const bounds = await page.$eval('#drawCanvas canvas', e => e.getBoundingClientRect().toJSON());
        await page.mouse.click(bounds.x + column * circuitMetrics.columnSpacing +
            circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2,
            bounds.y + top + circuitMetrics.wireSpacing / 2);
        if (await page.waitForSelector('#bloch-x', {visible: true, timeout: 2000}).then(() => true, () => false)) break;
    }
    await page.waitForFunction(() => document.querySelectorAll('.bloch-strip-step').length > 0 &&
        document.getElementById('bloch-x')?.textContent !== 'n/a');
}

test('Bloch Planes draws equatorial triangles independently and explains cos · sin', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Z^¼'], ['Bloch']]}, async page => {
        await openBlochAt(page, 2);
        const checks = await page.$$('.bloch-check');
        // Use the visible checkbox, not Base UI's hidden input carrying the supplied id.
        await checks[0].click();
        assert.equal(await checks[0].evaluate(e => e.getAttribute('aria-checked')), 'false');
        const settle = () => page.evaluate(() => new Promise(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
        await settle();
        const before = await page.$eval('#bloch-canvas', e => e.toDataURL());
        await checks[1].click();
        await page.waitForFunction(image => document.getElementById('bloch-canvas').toDataURL() !== image, {}, before);
        assert.equal(await checks[1].evaluate(e => e.getAttribute('aria-checked')), 'true');
        await checks[1].click();
        await page.waitForFunction(image => document.getElementById('bloch-canvas').toDataURL() === image, {}, before);
        assert.match(await checks[6].evaluate(e => document.getElementById(e.getAttribute('aria-describedby')).textContent),
            /sphere labels require Components/);
        const projection = await page.$eval('#bloch-equator-canvas', e => e.toDataURL());
        await checks[6].click();
        await page.waitForFunction(image => document.getElementById('bloch-equator-canvas').toDataURL() !== image, {}, projection);
        assert.equal(await checks[0].evaluate(e => e.getAttribute('aria-checked')), 'false');
    });
});

test('Bloch steps keep impossible postselection unavailable without losing earlier states', async browser => {
    await withQuirkPage(browser, {cols: [['Bloch'], ['|1⟩⟨1|']]}, async page => {
        await openBlochAt(page, 0);
        assert.equal(await page.$eval('#bloch-z', e => e.textContent), '+1.000');
        assert.equal(await page.$$eval('.bloch-strip-step', buttons => buttons.length), 3);
        await page.$$eval('.bloch-strip-step', buttons => buttons[2].click());
        await page.waitForFunction(() => document.getElementById('bloch-z')?.textContent === 'n/a');
        assert.equal(await page.$eval('#bloch-tr-rho2', e => e.textContent), 'n/a');
        await page.$$eval('.bloch-strip-step', buttons => buttons[0].click());
        await page.waitForFunction(() => document.getElementById('bloch-z')?.textContent === '+1.000');
        assert.equal(await page.$eval('#bloch-tr-rho2', e => e.textContent), '1.000');
    });
});

test('Bloch steps preserve deferred measurement across display columns', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Measure'], ['Bloch'], ['X']]}, async page => {
        await openBlochAt(page, 2);
        await page.$$eval('.bloch-strip-step', buttons => buttons[3].click());
        await page.waitForFunction(() => document.getElementById('bloch-subtitle').textContent.includes('after column 3'));
        assert.equal(await page.$eval('#bloch-x', e => e.textContent), '+0.000');
        assert.equal(await page.$eval('#bloch-tr-rho2', e => e.textContent), '0.500');
        await page.$$eval('.bloch-strip-step', buttons => buttons[1].click());
        await page.waitForFunction(() => document.getElementById('bloch-x').textContent === '+1.000');
    });
});

test('Bloch source selection cancels an unfinished preset transition', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        await openBlochAt(page, 1);
        for (const returnToCircuit of [true, false]) {
            await page.$eval('#bloch-preset-1', button => button.click());
            await page.waitForSelector('#bloch-back-to-circuit');
            await page.evaluate(returnToCircuit => {
                if (returnToCircuit) document.getElementById('bloch-back-to-circuit').click();
                else document.querySelector('.bloch-strip-step').click();
            }, returnToCircuit);
            // Past the preset's duration, no remaining animation may replace the new source.
            await new Promise(resolve => setTimeout(resolve, 400));
            assert.equal(await page.$eval('#bloch-subtitle', e => e.textContent),
                returnToCircuit ? 'Qubit 1 · at column 2' : 'Qubit 1 · before the first column');
            assert.equal(await page.$eval(returnToCircuit ? '#bloch-x' : '#bloch-z', e => e.textContent), '+1.000');
        }
    });
});

test('Bloch views are equally sized squares with controls reachable before the figures', async browser => {
    for (const viewport of [{width: 1440, height: 1000}, {width: 1024, height: 768}, {width: 390, height: 844}]) {
        await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
            await openBlochAt(page, 1);
            const layout = await page.$eval('[data-panel-id="bloch"]', panel => {
                const bounds = panel.getBoundingClientRect();
                const presets = panel.querySelector('.bloch-presets').getBoundingClientRect();
                const figure = panel.querySelector('#bloch-canvas').getBoundingClientRect();
                return {right: bounds.right, bottom: bounds.bottom,
                    presetsVisible: presets.top >= bounds.top && presets.bottom <= bounds.bottom,
                    sourceBeforeFigures: presets.bottom < figure.top,
                    overflow: panel.scrollWidth - panel.clientWidth,
                    views: [...panel.querySelectorAll('.bloch-figures canvas')].map(canvas => {
                        const rect = canvas.getBoundingClientRect();
                        return {width: rect.width, height: rect.height};
                    })};
            });
            assert.ok(layout.right <= viewport.width, JSON.stringify(layout));
            assert.ok(layout.bottom <= viewport.height, JSON.stringify(layout));
            assert.ok(layout.presetsVisible && layout.sourceBeforeFigures, JSON.stringify(layout));
            assert.equal(layout.overflow, 0);
            assert.equal(layout.views.length, 3);
            for (const view of layout.views) {
                assert.ok(Math.abs(view.width - view.height) < 1, JSON.stringify(layout.views));
                assert.ok(Math.abs(view.width - layout.views[0].width) < 1, JSON.stringify(layout.views));
            }
        }, viewport);
    }
});

test('Bloch sliders show an unfilled track at zero', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        await openBlochAt(page, 1);
        const tracks = await page.$$eval('.bloch-slider-track', elements => elements.map(e => ({
            track: getComputedStyle(e).backgroundColor,
            background: getComputedStyle(e.closest('.panel-section')).backgroundColor,
        })));
        for (const colors of tracks) assert.notEqual(colors.track, colors.background);
    });
});

test('opens a Bloch sphere from its enlarged edge at different zoom levels', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        for (const [button, zoom] of [['Zoom out', 0.8], ['Zoom in', 1.25]]) {
            await page.click('[aria-label="Reset zoom"]');
            await page.click(`[aria-label="${button}"]`);
            // Zoom preserves the viewport centre and can scroll the first columns out of view.
            await page.$eval('#canvasDiv', element => element.scrollTo({left: 0, top: 0, behavior: 'instant'}));
            await waitForCanvasViewport(page);
            const top = await circuitTopForWires(page, 2, zoom);
            const canvas = await page.$eval('#drawCanvas canvas', element => {
                const rect = element.getBoundingClientRect();
                return {x: rect.x, y: rect.y};
            });
            // This point is inside the enlarged sphere but outside the ordinary gate rectangle.
            const x = circuitMetrics.firstColumnLeft + circuitMetrics.columnSpacing +
                circuitMetrics.gateSize / 2 + circuitMetrics.blochRadius * 0.9;
            await page.mouse.click(canvas.x + x * zoom,
                canvas.y + (top + circuitMetrics.wireSpacing / 2) * zoom);
            await waitForPanel(page, 'bloch', true);
            await closePanel(page, 'bloch');
        }
    });
});

test('opens and closes the export and gate forge panels', async browser => {
    const circuit = {cols: [['H']]};
    await withQuirkPage(browser, circuit, async page => {
        await page.click('#export-button');
        // An open panel never disables the app: the rest of the chrome keeps working around it.
        assert.equal(await page.$eval('#gate-forge-button', button => button.disabled), false);
        await waitForPanel(page, 'export', true);
        const jsonText = await page.$eval('#export-circuit-json-pre', element => element.textContent);
        assert.deepEqual(JSON.parse(jsonText), circuit);
        // The offline-copy quine is gone; the panel must not offer the download any more.
        assert.equal(await page.$('#download-offline-copy-button'), null);
        await closePanel(page, 'export');

        await page.click('#gate-forge-button');
        await waitForPanel(page, 'forge', true);
        const forge = await page.$eval('.forge-panel', element => ({
            title: element.querySelector('.panel-title')?.textContent,
            methodCount: element.querySelectorAll('.forge-method').length
        }));
        assert.equal(forge.title, 'Make a gate');
        assert.equal(forge.methodCount, 1);
        assert.equal(await page.$$eval('.construction-tabs [role="tab"]', tabs => tabs.length), 3);
        await closePanel(page, 'forge');
    });
});

/**
 * The amber the playhead band paints across one column, counted over the strip between the two
 * wire rows. Gate boxes stop at the rows, so that strip is band or background and nothing else.
 */

test('edits a rotation gate angle through the parameter dialog', async browser => {
    await withQuirkPage(browser, {cols: [[{id: 'Rx', arg: 'pi/2'}]]}, async page => {
        const canvasBounds = await page.$eval('#drawCanvas canvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });

        // The change button is the bottom half of the gate in the first column on the first wire.
        // The state table fills in asynchronously and can shift the centered circuit between the
        // position sample and the click, so retry until the dialog actually opens.
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
            await waitForCanvasViewport(page);
            const circuitTop = await circuitTopForWires(page, 2);
            await page.mouse.move(canvasBounds.x + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2, canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2 + 13);
            await page.mouse.down();
            await page.mouse.up();
            opened = await page.waitForSelector('[data-panel-id="gate-param"]', {visible: true, timeout: 2000}).
                then(() => true, () => false);
        }
        assert.ok(opened, 'The parameter panel must open.');
        await page.waitForFunction(
            () => document.activeElement?.id === 'gate-param-input',
            {timeout: TEST_TIMEOUT_MILLIS});

        // Focusing selects the current value, so typing replaces it; Enter applies.
        await page.keyboard.type('3pi/4');
        await page.keyboard.press('Enter');
        await waitForPanel(page, 'gate-param', false);
        await waitForCircuit(page, {cols: [[{id: 'Rx', arg: '3pi/4'}]]});
    });
});

test('opens the enlarged Bloch sphere view from a Bloch display gate', async browser => {
    await withQuirkPage(browser, {cols: [['H'], ['Bloch']]}, async page => {
        const canvasBounds = await page.$eval('#drawCanvas canvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });

        // The Bloch display gate sits in the second column on the first wire. Retried for the
        // same layout-shift race the parameter dialog test guards against.
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
            await waitForCanvasViewport(page);
            const circuitTop = await circuitTopForWires(page, 2);
            await page.mouse.click(canvasBounds.x + circuitMetrics.columnSpacing + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2, canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2);
            opened = await page.waitForSelector('[data-panel-id="bloch"]', {visible: true, timeout: 2000}).
                then(() => true, () => false);
        }
        assert.ok(opened, 'The Bloch sphere panel must open.');
        await page.waitForFunction(
            () => document.getElementById('bloch-subtitle').textContent !== '' &&
                document.getElementById('bloch-x').textContent !== 'n/a',
            {timeout: TEST_TIMEOUT_MILLIS});

        // After the Hadamard the qubit is |+⟩: on the +x axis, pure, at θ 90°.
        const readout = await page.evaluate(() => ({
            subtitle: document.getElementById('bloch-subtitle').textContent,
            x: document.getElementById('bloch-x').textContent,
            z: document.getElementById('bloch-z').textContent,
            theta: document.getElementById('bloch-theta').textContent,
            purity: document.getElementById('bloch-purity').textContent,
            quaternion: document.getElementById('bloch-quaternion').textContent,
            vector: document.getElementById('bloch-vector-quaternion').textContent,
        }));
        assert.equal(readout.subtitle, 'Qubit 1 · at column 2');
        assert.equal(readout.x, '+1.000');
        assert.equal(readout.z, '+0.000');
        assert.equal(readout.theta, '90.0°');
        assert.equal(readout.purity, '1.000');
        // |+⟩ is |0⟩ turned a quarter turn about +y: q = cos 45° + sin 45° j, and q k q̄ = i.
        assert.equal(readout.quaternion, '0.707 +0.000i +0.707j +0.000k');
        assert.equal(readout.vector, '+1.000i +0.000j +0.000k');

        // Sample the visible canvases between browser frames throughout layout changes and rotation.
        await page.waitForFunction(() => {
            const canvas = document.getElementById('bloch-canvas');
            return canvas.getContext('2d').getImageData(1, 1, 1, 1).data[3] > 0;
        });
        await page.evaluate(() => {
            const copy = document.createElement('canvas');
            copy.width = copy.height = 1;
            const ctx = copy.getContext('2d', {willReadFrequently: true});
            const samples = {drawCanvas: {frames: 0, blank: 0}, 'bloch-canvas': {frames: 0, blank: 0}};
            let active = true;
            const sample = () => {
                if (!active) return;
                for (const [id, counts] of Object.entries(samples)) {
                    const canvas = id === 'drawCanvas' ? document.querySelector('#drawCanvas canvas') : document.getElementById(id);
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.drawImage(canvas, 1, 1, 1, 1, 0, 0, 1, 1);
                    counts.frames++;
                    if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) counts.blank++;
                }
                requestAnimationFrame(sample);
            };
            window.stopCanvasSampling = () => {active = false; return samples;};
            requestAnimationFrame(sample);
        });
        for (const deviceScaleFactor of [1, 2]) {
            for (const width of [1180, 1300, 1200]) {
                await page.setViewport({width, height: 760, deviceScaleFactor});
                await waitForCanvasViewport(page);
            }
            const sphere = await page.$eval('#bloch-canvas', canvas => {
                const r = canvas.getBoundingClientRect();
                return {x: r.x + r.width / 2, y: r.y + r.height / 2};
            });
            await page.mouse.move(sphere.x, sphere.y);
            await page.mouse.down();
            await page.mouse.move(sphere.x + 70, sphere.y + 35, {steps: 15});
            await page.mouse.up();
        }
        const samples = await page.evaluate(() => window.stopCanvasSampling());
        for (const [id, counts] of Object.entries(samples)) {
            assert.ok(counts.frames > 0, id + ' must be sampled during interaction');
            assert.equal(counts.blank, 0, id + ' must keep its previous frame until the next render');
        }

        await closePanel(page, 'bloch');
    });
});

test('panel controls remain distinct from their surfaces across panels', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        for (const [trigger, panel] of [['export-button', 'export'], ['gate-forge-button', 'forge'], ['tape-button', 'tape']]) {
            await page.click(`#${trigger}`);
            await waitForPanel(page, panel, true);
            const appearance = await page.$eval(`[data-panel-id="${panel}"]`, root => {
                const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
                const luminance = color => rgb(color).map(value => {
                    const channel = value / 255;
                    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
                }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
                const contrast = (a, b) => {
                    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
                    return (values[0] + 0.05) / (values[1] + 0.05);
                };
                const content = root.closest('.dv-groupview');
                const surface = getComputedStyle(content).backgroundColor;
                return {
                    ownTheme: root.closest('.dockview-theme-shadow-quant') !== null,
                    stockTheme: root.closest('.dockview-theme-dark') !== null,
                    controls: [...root.querySelectorAll('button:not([class])')].map(button => {
                        const style = getComputedStyle(button);
                        return {text: contrast(style.color, style.backgroundColor), surface: contrast(style.backgroundColor, surface)};
                    })
                };
            });
            assert.equal(appearance.ownTheme, true);
            assert.equal(appearance.stockTheme, false);
            assert.ok(appearance.controls.length > 0);
            for (const control of appearance.controls) {
                assert.ok(control.text >= 4.5, `${panel}: readable button text`);
                assert.ok(control.surface >= 1.5, `${panel}: button surface distinguishable from panel`);
            }
        }
    });
});

async function chooseConstruction(page, name) {
    await page.$$eval('.construction-tabs [role="tab"]',(tabs,name) => tabs.find(tab => tab.textContent === name).click(),name);
}
async function replaceField(page, selector, text) {
    await page.$eval(selector,element=>{element.focus();element.select();});
    await page.keyboard.press('Backspace');
    await page.type(selector,text);
}
async function namedButton(page, selector, text) {
    await page.$$eval(selector,(buttons,text) => buttons.find(button => button.textContent.trim() === text).click(),text);
}
async function insertAndReopen(page, created) {
    const id=created.gates[0].id;
    await page.$eval(`[data-gate-id="${id}"]`,element=>element.focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(id=>JSON.parse(document.querySelector('#drawCanvas').dataset.circuit).cols.some(c=>c.includes(id)),{},id);
    const inserted=await currentCircuit(page);
    assert.deepEqual(await exportedCircuit(page),inserted);
    await page.click('#undo-button');await waitForCircuit(page,created);
    await page.click('#redo-button');await waitForCircuit(page,inserted);
    await page.reload();await waitForCircuit(page,inserted);
}

test('custom gate windows preserve drafts and fit docked panel widths', async browser => {
    await withQuirkPage(browser,{cols:[['H']]},async page => {
        await page.click('#gate-forge-button');
        await page.waitForSelector('#gate-forge-rotation-button:not([disabled])');
        await replaceField(page,'#gate-forge-rotation-angle','60');
        await replaceField(page,'#gate-forge-rotation-name','Sixty');
        await chooseConstruction(page,'Matrix');
        await namedButton(page,'.entry-modes button','Raw text');
        await replaceField(page,'#gate-forge-matrix','invalid');
        await chooseConstruction(page,'Rotation');
        assert.equal(await page.$eval('#gate-forge-rotation-angle',e=>e.value),'60');
        assert.equal(await page.$eval('#gate-forge-rotation-name',e=>e.value),'Sixty');
        for (const width of [340,419,720,830]) {
            const rect = await page.$eval('[data-panel-id="forge"]',e=>e.getBoundingClientRect().toJSON());
            await page.mouse.move(rect.left,rect.top+80);
            await page.mouse.down();
            await page.mouse.move(rect.right-width,rect.top+80,{steps:12});
            await page.mouse.up();
            await page.waitForFunction(width=>Math.abs(document.querySelector('[data-panel-id="forge"]').clientWidth-width)<3,{},width);
            const layout = await page.$eval('[data-panel-id="forge"]',root => {
                root.querySelector('.construction-scroll').scrollTop=10000;
                const panel=root.getBoundingClientRect(),footer=root.querySelector('.construction-actions').getBoundingClientRect();
                return {width:root.clientWidth,scroll:root.scrollWidth,footerInside:footer.bottom<=panel.bottom+1&&footer.top>=panel.top};
            });
            assert.ok(layout.scroll<=layout.width+1);
            assert.ok(layout.footerInside);
        }
        await chooseConstruction(page,'Matrix');
        assert.equal(await page.$eval('#gate-forge-matrix',e=>e.value),'invalid');
        assert.equal(await page.$eval('#gate-forge-matrix-button',e=>e.disabled),true);
    },{width:1600,height:900,deviceScaleFactor:1});
});

test('parameter validation and typing undo preserve circuit history', async browser => {
    const initial={cols:[[{id:'Rx',arg:'pi/2'}]]};
    await withQuirkPage(browser,initial,async page=>{
        const open = async () => {
            await page.click('#gate-parameter-button');
            await page.waitForSelector('.parameter-targets button');
            await page.click('.parameter-targets button');
            await page.waitForSelector('#gate-param-input');
        };
        await open();
        await replaceField(page,'#gate-param-input','not_an_angle');
        assert.equal(await page.$eval('#gate-param-apply-button',e=>e.disabled),true);
        assert.deepEqual(await currentCircuit(page),initial);
        await replaceField(page,'#gate-param-input','3pi/4');
        await page.keyboard.press('Enter');
        const changed={cols:[[{id:'Rx',arg:'3pi/4'}]]};
        await waitForCircuit(page,changed);
        await open();
        await replaceField(page,'#gate-param-input','pi/8');
        const modifier=process.platform==='darwin'?'Meta':'Control';
        await page.keyboard.down(modifier); await page.keyboard.press('z'); await page.keyboard.up(modifier);
        assert.deepEqual(await currentCircuit(page),changed);
        const footer = await page.$eval('[data-panel-id="gate-param"]',root=>root.querySelector('.construction-actions').getBoundingClientRect().bottom<=root.getBoundingClientRect().bottom+1);
        assert.ok(footer);
        await page.click('#gate-param-cancel-button');
        await page.click('#undo-button');
        await waitForCircuit(page,initial);
    });
});

test('matrix creation preserves entered values unless correction is accepted', async browser => {
    for(const correct of [false,true]) await withQuirkPage(browser,{cols:[['H']]},async page=>{
        await page.click('#gate-forge-button'); await chooseConstruction(page,'Matrix');
        await namedButton(page,'.entry-modes button','Raw text');
        await replaceField(page,'#gate-forge-matrix','1,i,i,1');
        await replaceField(page,'#gate-forge-matrix-name','Matrix example');
        await page.waitForSelector('#gate-forge-matrix-button:not([disabled])');
        if(correct) {
            await namedButton(page,'.construction-preview button','Make unitary');
            await page.waitForSelector('.matrix-correction');
            await namedButton(page,'.matrix-correction button','Use corrected matrix');
            await page.waitForSelector('#gate-forge-matrix-button:not([disabled])');
        }
        await page.click('#gate-forge-matrix-button'); await waitForPanel(page,'forge',false);
        const created=await currentCircuit(page);
        assert.equal(created.gates.length,1);
        const matrix=Matrix.parse(created.gates[0].matrix);
        assert.equal(matrix.isUnitary(0.00001),correct);
        if(!correct) assert.equal(matrix.cell(0,0).real,1);
        await page.waitForFunction(id=>document.activeElement?.dataset.gateId===id,{},created.gates[0].id);
        await page.click('#undo-button'); await waitForCircuit(page,{cols:[['H']]});
        await page.click('#redo-button'); await waitForCircuit(page,created);
        await page.reload(); await page.waitForSelector(`[data-gate-id="${created.gates[0].id}"]`);
        assert.deepEqual(await currentCircuit(page),created);
        await insertAndReopen(page,created);
    });
});

test('matrix grids keep dimension drafts and invalidate accepted corrections on edits', async browser=>{
    await withQuirkPage(browser,{cols:[['H']]},async page=>{
        await page.click('#gate-forge-button'); await chooseConstruction(page,'Matrix');
        await replaceField(page,'.matrix-input-grid [aria-label="Row 1, column 1"]','2');
        await page.select('[aria-label="Matrix dimension"]','4');
        await page.waitForSelector('#gate-forge-matrix-button:not([disabled])');
        assert.equal(await page.$$eval('.matrix-input-grid input',es=>es.length),16);
        await page.select('[aria-label="Matrix dimension"]','2');
        assert.equal(await page.$eval('.matrix-input-grid [aria-label="Row 1, column 1"]',e=>e.value),'2');
        await page.waitForSelector('#gate-forge-matrix-button:not([disabled])');
        await namedButton(page,'.construction-preview button','Make unitary');
        await page.waitForSelector('.matrix-correction');
        await namedButton(page,'.matrix-correction button','Use corrected matrix');
        await replaceField(page,'.matrix-input-grid [aria-label="Row 1, column 1"]','3');
        await page.waitForSelector('#gate-forge-matrix-button:not([disabled])');
        assert.equal(await page.$('.matrix-correction'),null);
        await replaceField(page,'.matrix-input-grid [aria-label="Row 1, column 1"]','');
        await page.waitForFunction(()=>document.querySelector('#gate-forge-matrix-button').disabled);
    });
});

test('circuit construction includes wide trailing gates and clears selection on method changes', async browser=>{
    const initial={cols:[[{id:'Ry',arg:'pi/3'}],[],[{id:'Rz',arg:'pi/4'}]]};
    await withQuirkPage(browser,initial,async page=>{
        await page.click('#gate-forge-button'); await chooseConstruction(page,'Circuit');
        await page.waitForSelector('#gate-forge-circuit-button:not([disabled])');
        await page.waitForSelector('.forge-range-highlight');
        for (const [zoom,buttons] of [[0.8,['Zoom out']],[1,[]],[1.5,['Zoom in','Zoom in']]]) {
            await page.click('[aria-label="Reset zoom"]');
            for (const label of buttons) await page.click(`[aria-label="${label}"]`);
            await page.$eval('#canvasDiv',e=>e.scrollTo(0,0));
            await waitForCanvasViewport(page);
            const top=await circuitTopForWires(page,2,zoom);
            const expected=(top+circuitMetrics.wireSpacing/2-circuitMetrics.gateSize/2+0.5)*zoom;
            await page.waitForFunction(expected=>{
                const host=document.querySelector('#canvasDiv'),rect=document.querySelector('.forge-range-highlight').getBoundingClientRect();
                return Math.abs(rect.top-host.getBoundingClientRect().top+host.scrollTop-expected)<1;
            },{},expected);
        }
        await replaceField(page,'#gate-forge-circuit-cols','1:1');
        await page.waitForSelector('#gate-forge-circuit-canvas [role="alert"]');
        assert.match(await page.$eval('#gate-forge-circuit-canvas',e=>e.textContent),/whole/);
        assert.equal(await page.$('.forge-range-highlight'),null);
        await replaceField(page,'#gate-forge-circuit-cols','1:∞');
        await replaceField(page,'#gate-forge-circuit-name','Whole circuit');
        await page.waitForSelector('#gate-forge-circuit-button:not([disabled])');
        await chooseConstruction(page,'Rotation');
        await page.waitForSelector('.forge-range-highlight',{hidden:true});
        await chooseConstruction(page,'Circuit');
        await page.waitForSelector('#gate-forge-circuit-button:not([disabled])');
        await page.click('#gate-forge-circuit-button'); await waitForPanel(page,'forge',false);
        const created=await currentCircuit(page);
        assert.equal(created.gates.length,1);
        assert.deepEqual(created.cols,initial.cols);
        assert.deepEqual(created.gates[0].circuit.cols.filter(c=>c.length),initial.cols.filter(c=>c.length));
        await insertAndReopen(page,created);
    });
});

test('mathematical entry preserves raw expressions and validates rich edits', async browser=>{
    await withQuirkPage(browser,{cols:[[{id:'Ry',arg:'pi/3'}]]},async page=>{
        const requests=[]; page.on('request',request=>requests.push(request.url()));
        await page.click('#gate-parameter-button'); await page.waitForSelector('.parameter-targets button'); await page.click('.parameter-targets button');
        await namedButton(page,'[data-panel-id="gate-param"] .math-entry-actions button','Math input');
        await page.waitForSelector('math-field#gate-param-input');
        await namedButton(page,'[data-panel-id="gate-param"] .math-entry-actions button','Raw expression');
        assert.equal(await page.$eval('#gate-param-input',e=>e.value),'pi/3');
        await namedButton(page,'[data-panel-id="gate-param"] .math-entry-actions button','Math input');
        await page.waitForSelector('math-field#gate-param-input');
        await page.$eval('math-field',e=>{e.setValue(String.raw`\int_0^1 x`,{silenceNotifications:true});e.dispatchEvent(new InputEvent('input',{bubbles:true}));});
        await page.waitForFunction(()=>document.querySelector('#gate-param-apply-button').disabled);
        await page.$eval('math-field',e=>{e.setValue(String.raw`\frac{\pi}{4}`,{silenceNotifications:true});e.dispatchEvent(new InputEvent('input',{bubbles:true}));});
        await page.waitForFunction(()=>!document.querySelector('#gate-param-apply-button').disabled);
        await namedButton(page,'[data-panel-id="gate-param"] .math-entry-actions button','Math keyboard');
        await page.waitForFunction(()=>window.mathVirtualKeyboard.visible);
        await page.waitForFunction(()=>{
            const keyboard=window.mathVirtualKeyboard.boundingRect;
            const scroll=document.querySelector('.gate-param-panel .construction-scroll').getBoundingClientRect();
            return keyboard.top>=scroll.top && keyboard.bottom<=scroll.bottom;
        });
        assert.ok(await page.$eval('[data-panel-id="gate-param"]',root=>root.querySelector('.construction-actions').getBoundingClientRect().bottom<=root.getBoundingClientRect().bottom+1));
        await page.focus('math-field'); await page.keyboard.press('Escape');
        assert.ok(await page.$('[data-panel-id="gate-param"]'));
        await page.click('#gate-param-apply-button'); await waitForPanel(page,'gate-param',false);
        const saved=await currentCircuit(page);
        assert.match(saved.cols[0][0].arg,/pi/);
        assert.ok(requests.every(url=>new URL(url).origin===new URL(page.url()).origin || url.startsWith('data:') || url.startsWith('blob:')),'Rich entry assets must be served locally.');
    });
});

test('failed mathematical input loading retains usable raw entry',async browser=>{
    await withQuirkPage(browser,{cols:[[{id:'Ry',arg:'pi/3'}]]},async page=>{
        await page.setRequestInterception(true);
        page.on('request',request=>/math-live-runtime.*\.js/.test(request.url()) ? request.abort() : request.continue());
        await page.click('#gate-parameter-button');await page.waitForSelector('.parameter-targets button');await page.click('.parameter-targets button');
        await namedButton(page,'.math-entry-actions button','Math input');
        await page.waitForFunction(()=>document.querySelector('.math-entry').textContent.includes('could not load'));
        assert.equal(await page.$eval('#gate-param-input',e=>e.value),'pi/3');
        await replaceField(page,'#gate-param-input','pi/4');await page.click('#gate-param-apply-button');
        await waitForCircuit(page,{cols:[[{id:'Ry',arg:'pi/4'}]]});
    },undefined,[/Failed to load resource: net::ERR_FAILED/]);
});

test('rotation construction commits the inspected operation and places the new gate',async browser=>{
    await withQuirkPage(browser,{cols:[['H']]},async page=>{
        await page.click('#gate-forge-button');
        await namedButton(page,'.axis-presets button','Y');
        await replaceField(page,'#gate-forge-rotation-angle','60');
        await replaceField(page,'#gate-forge-rotation-name','Y sixty');
        await page.waitForSelector('#gate-forge-rotation-button:not([disabled])');
        await page.click('#gate-forge-rotation-button');await waitForPanel(page,'forge',false);
        const created=await currentCircuit(page),matrix=Matrix.parse(created.gates[0].matrix);
        assert.ok(Math.abs(matrix.cell(0,0).real-Math.sqrt(3)/2)<0.00001);
        assert.ok(Math.abs(matrix.cell(0,1).real-0.5)<0.00001);
        await insertAndReopen(page,created);
    });
});

test('parameter units, composition and stale targets preserve the current circuit',async browser=>{
    const initial={cols:[[{id:'Ry',arg:'pi/3'}]]};
    await withQuirkPage(browser,initial,async page=>{
        const open=async()=>{await page.click('#gate-parameter-button');await page.waitForSelector('.parameter-targets button');await page.click('.parameter-targets button');await page.waitForSelector('#gate-param-input');};
        await open();
        await page.select('[aria-label="Angle unit"]','degrees');
        assert.ok(Math.abs(Number(await page.$eval('#gate-param-input',e=>e.value))-60)<1e-10);
        await page.select('[aria-label="Angle unit"]','radians');
        assert.equal(await page.$eval('#gate-param-input',e=>e.value),'pi/3');
        const prevented=await page.$eval('#gate-param-input',e=>!e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));
        assert.equal(prevented,true);
        await page.select('[aria-label="Angle unit"]','degrees');
        await page.click('#gate-param-apply-button');await waitForPanel(page,'gate-param',false);
        assert.deepEqual(await currentCircuit(page),initial);
        await open();await page.select('[aria-label="Angle unit"]','degrees');
        await replaceField(page,'#gate-param-input','90');await page.click('#gate-param-apply-button');
        await waitForPanel(page,'gate-param',false);
        assert.ok(Math.abs(Number((await currentCircuit(page)).cols[0][0].arg)-Math.PI/2)<1e-10);
        await open();await replaceField(page,'#gate-param-input','pi/8');
        await page.click('#undo-button');await waitForCircuit(page,initial);
        await page.click('#gate-param-apply-button');await waitForPanel(page,'gate-param',false);
        assert.deepEqual(await currentCircuit(page),initial);
    });
});

test('Escape closes the formula help before the parameter window', async browser => {
    await withQuirkPage(browser, {cols: [[{id: 'Ry', arg: 'pi/3'}]]}, async page => {
        await page.click('#gate-parameter-button');
        await page.waitForSelector('.parameter-targets button');
        await page.click('.parameter-targets button');
        await page.waitForSelector('#gate-param-input');
        await page.click('.formula-help summary');
        assert.equal(await page.$eval('.formula-help', element => element.open), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.$eval('.formula-help', element => element.open), false);
        assert.ok(await page.$('[data-panel-id="gate-param"]'), 'The first Escape must leave the window open.');
        await page.keyboard.press('Escape');
        await waitForPanel(page, 'gate-param', false);
    });
});

test('creating a gate keeps a toolbox search that shows it and clears one that hides it', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        for (const [search, name, kept] of [['kept', 'Kept', true], ['fourier', 'Cleared', false]]) {
            const before = new Set(((await currentCircuit(page)).gates ?? []).map(gate => gate.id));
            await replaceField(page, '#gate-search', search);
            await page.click('#gate-forge-button');
            await replaceField(page, '#gate-forge-rotation-name', name);
            await page.waitForSelector('#gate-forge-rotation-button:not([disabled])');
            await page.click('#gate-forge-rotation-button');
            await waitForPanel(page, 'forge', false);
            const id = (await currentCircuit(page)).gates.map(gate => gate.id).find(id => !before.has(id));
            await page.waitForFunction(id => document.activeElement?.dataset.gateId === id, {}, id);
            assert.equal(await page.$eval('#gate-search', element => element.value), kept ? search : '');
        }
    });
});

test('construction tabs move focus with the arrow keys and activate with Enter or Space', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        const selected = () => page.$eval('.construction-tabs [aria-selected="true"]', tab => tab.textContent);
        await page.click('#gate-forge-button');
        await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab');
        assert.equal(await selected(), 'Rotation');
        // The selected tab is the list's one tab stop, so the first arrow key already moves.
        assert.deepEqual(await page.$$eval('.construction-tabs [role="tab"]', tabs => tabs.map(tab => tab.tabIndex)), [0, -1, -1]);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Matrix');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.construction-tabs [aria-selected="true"]').textContent === 'Matrix');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press(' ');
        await page.waitForFunction(() => document.querySelector('.construction-tabs [aria-selected="true"]').textContent === 'Circuit');
        assert.ok(await page.$('#gate-forge-circuit-cols'));
    });
});

test('a renamed draft waits for its own preview and a double submit creates one gate', async browser => {
    await withQuirkPage(browser, {cols: [['H']]}, async page => {
        await page.click('#gate-forge-button');
        await page.waitForSelector('#gate-forge-rotation-button:not([disabled])');
        // Rename inside the page, then look before the 100ms debounce can settle.
        const pending = await page.$eval('#gate-forge-rotation-name', async input => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Renamed');
            input.dispatchEvent(new Event('input', {bubbles: true}));
            await new Promise(resolve => setTimeout(resolve, 0));
            return {
                disabled: document.getElementById('gate-forge-rotation-button').disabled,
                updating: document.getElementById('gate-forge-rotation-canvas').textContent.includes('Updating preview'),
            };
        });
        assert.deepEqual(pending, {disabled: true, updating: true});
        await page.waitForSelector('#gate-forge-rotation-button:not([disabled])');
        await page.$eval('#gate-forge-rotation-button', button => {button.click(); button.click();});
        await waitForPanel(page, 'forge', false);
        assert.equal((await currentCircuit(page)).gates.length, 1);
    });
});

test('editing Ry through a keyboard-chosen target moves the Bloch vector to the new angle', async browser => {
    // Ry and Rz are each two columns wide, so the Bloch display sits in the fifth column.
    const cols = rotation => [[{id: 'Ry', arg: rotation}], [], [{id: 'Rz', arg: 'pi/4'}], [], ['Bloch']];
    await withQuirkPage(browser, {cols: cols('pi/3')}, async page => {
        const canvasBounds = await page.$eval('#drawCanvas canvas', element => {
            const bounds = element.getBoundingClientRect();
            return {x: bounds.x, y: bounds.y};
        });
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
            await waitForCanvasViewport(page);
            const circuitTop = await circuitTopForWires(page, 2);
            await page.mouse.click(canvasBounds.x + 4 * circuitMetrics.columnSpacing + circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2, canvasBounds.y + circuitTop + circuitMetrics.wireSpacing / 2);
            opened = await page.waitForSelector('[data-panel-id="bloch"]', {visible: true, timeout: 2000}).
                then(() => true, () => false);
        }
        assert.ok(opened, 'The Bloch sphere panel must open.');
        await page.waitForFunction(() => document.getElementById('bloch-theta').textContent === '60.0°', {timeout: TEST_TIMEOUT_MILLIS});
        const phi = await page.$eval('#bloch-phi', element => element.textContent);

        // The toolbar opens the target list; the keyboard chooses Ry, the first parameter gate.
        await page.$eval('#gate-parameter-button', button => button.click());
        await page.waitForSelector('.parameter-targets button');
        await page.focus('.parameter-targets button');
        await page.keyboard.press('Enter');
        await page.waitForSelector('#gate-param-input');
        assert.equal(await page.$eval('#gate-param-input', element => element.value), 'pi/3');
        await replaceField(page, '#gate-param-input', 'pi/2');
        await page.keyboard.press('Enter');
        await waitForCircuit(page, {cols: cols('pi/2')});
        await page.waitForFunction(() => document.getElementById('bloch-theta').textContent === '90.0°', {timeout: TEST_TIMEOUT_MILLIS});
        assert.equal(await page.$eval('#bloch-phi', element => element.textContent), phi);
    });
});

test('a rotation gate edits from its indicator and not from its body at each zoom step', async browser => {
    const circuit = {cols: [[{id: 'Rx', arg: 'pi/2'}]]};
    await withQuirkPage(browser, circuit, async page => {
        for (const [zoom, buttons] of [[0.8, ['Zoom out']], [1, []], [1.5, ['Zoom in', 'Zoom in']]]) {
            await page.click('[aria-label="Reset zoom"]');
            for (const label of buttons) await page.click(`[aria-label="${label}"]`);
            await page.$eval('#canvasDiv', element => element.scrollTo(0, 0));
            const gatePoint = async offsetFromWire => {
                await waitForCanvasViewport(page);
                const canvas = await page.$eval('#drawCanvas canvas', element => element.getBoundingClientRect().toJSON());
                const top = await circuitTopForWires(page, 2, zoom);
                return {x: canvas.x + (circuitMetrics.firstColumnLeft + circuitMetrics.gateSize / 2) * zoom,
                        y: canvas.y + (top + circuitMetrics.wireSpacing / 2 + offsetFromWire) * zoom};
            };
            // Pressing the body, even with a small wobble, grabs the gate and puts it back.
            const body = await gatePoint(-10);
            await page.mouse.move(body.x, body.y);
            await page.mouse.down();
            await page.mouse.move(body.x + 3, body.y, {steps: 3});
            await page.mouse.move(body.x, body.y, {steps: 3});
            await page.mouse.up();
            await waitForCircuit(page, circuit);
            assert.equal(await page.$('[data-panel-id="gate-param"]'), null, `The body must not edit at ${zoom}x.`);
            let opened = false;
            for (let attempt = 0; attempt < 3 && !opened; attempt++) {
                const indicator = await gatePoint(13);
                await page.mouse.click(indicator.x, indicator.y);
                opened = await page.waitForSelector('[data-panel-id="gate-param"]', {visible: true, timeout: 2000}).
                    then(() => true, () => false);
            }
            assert.ok(opened, `The indicator must edit at ${zoom}x.`);
            await closePanel(page, 'gate-param');
        }
    });
});
