import {Application as PixiApplication} from 'pixi.js';
import {Application} from '@pixi/react';
import {createElement, useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Suite, assertThat} from '../../TestUtil.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {paintInto} from '../../../src/draw/surface/SharedPaintSurface.js';
import {rectangle} from '../../../src/draw/shapes/ShapeView.js';
import {Rect} from '../../../src/geometry/Rect.js';
import {installErrorReporter} from '../../../src/diagnostics/errorReporter.js';

const suite = new Suite('RenderSurface initialization');
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
/** Frames until the condition holds; wrapped in bounded, so a condition that never holds still fails. */
async function until(condition) {
    while (!condition()) await frame();
}
async function bounded(promise) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Rendering operation did not settle')), 2000);
        })]);
    } finally {clearTimeout(timer);}
}

suite.test('initialization failure rejects readiness and renders while disposal completes', async () => {
    const original = PixiApplication.prototype.init;
    const failure = new Error('Test renderer initialization failure');
    let app;
    const host = document.createElement('div');
    const uninstall = installErrorReporter(host);
    PixiApplication.prototype.init = async function() {app = this; throw failure;};
    const surface = new RenderSurface(document.createElement('canvas'));
    try {
        const results = await bounded(Promise.allSettled([surface.ready, surface.render(), surface.render()]));
        assertThat(results.map(result => result.reason)).isEqualTo([failure, failure, failure]);
        assertThat(host.textContent.includes('Rendering failed: ' + failure.message)).isEqualTo(true);
        assertThat(host.textContent.includes('×1')).isEqualTo(true);
        assertThat(host.textContent.includes('×2')).isEqualTo(false);
        await bounded(surface.destroy());
        await bounded(surface.destroy());
        assertThat(app.stage.destroyed).isEqualTo(true);
    } finally {
        PixiApplication.prototype.init = original;
        uninstall();
        void surface.destroy();
    }
});

suite.test('a later shared preview recovers after failed initialization', async () => {
    const original = PixiApplication.prototype.init;
    const failure = new Error('Test shared renderer failure');
    let attempts = 0;
    PixiApplication.prototype.init = async function(...args) {
        if (++attempts === 1) throw failure;
        return original.apply(this, args);
    };
    const canvas = document.createElement('canvas');
    const draw = view => rectangle(view, new Rect(0, 0, 10, 10), {fill: 'red'});
    try {
        const first = await bounded(Promise.allSettled([paintInto(canvas, 10, 10, draw)]));
        assertThat(first[0].reason).isEqualTo(failure);
        await bounded(paintInto(canvas, 10, 10, draw));
        assertThat(attempts).isEqualTo(2);
        assertThat([...canvas.getContext('2d').getImageData(5, 5, 1, 1).data]).isEqualTo([255, 0, 0, 255]);
    } finally {PixiApplication.prototype.init = original;}
});

suite.test('concurrent Application renders wait for one initialization', async () => {
    const original = PixiApplication.prototype.init;
    const entered = Promise.withResolvers();
    const proceed = Promise.withResolvers();
    const initialized = Promise.withResolvers();
    let attempts = 0;
    let ready = false;
    const mounted = [];
    const host = document.createElement('div');
    const root = createRoot(host);
    PixiApplication.prototype.init = async function(...args) {
        attempts++;
        entered.resolve();
        await proceed.promise;
        return original.apply(this, args);
    };
    function Child({value}) {
        useLayoutEffect(() => {mounted.push({value, ready});}, [value]);
        return null;
    }
    const render = value => createElement(Application, {
        autoStart: false, onInit: () => {ready = true; initialized.resolve();}
    }, createElement(Child, {value}));
    try {
        flushSync(() => root.render(render('first')));
        await bounded(entered.promise);
        flushSync(() => root.render(render('second')));
        await frame();
        assertThat(mounted).isEqualTo([]);
        proceed.resolve();
        await bounded(initialized.promise);
        // React commits the child after initialization, which takes more than one frame when earlier
        // suites have left the page busy; wait for the commit rather than assume a frame.
        await bounded(until(() => mounted.length > 0));
        assertThat(attempts).isEqualTo(1);
        assertThat(mounted).isEqualTo([{value: 'second', ready: true}]);
    } finally {
        proceed.resolve();
        PixiApplication.prototype.init = original;
        flushSync(() => root.unmount());
    }
});

suite.test('unmount during failed initialization reports once and destroys the stage', async () => {
    const original = PixiApplication.prototype.init;
    const entered = Promise.withResolvers();
    const proceed = Promise.withResolvers();
    const failed = Promise.withResolvers();
    const failure = new Error('Test unmounted renderer failure');
    let app;
    const errors = [];
    PixiApplication.prototype.init = async function() {
        app = this;
        entered.resolve();
        await proceed.promise;
        throw failure;
    };
    const root = createRoot(document.createElement('div'));
    try {
        flushSync(() => root.render(createElement(Application, {
            onInitError: error => {errors.push(error); failed.resolve();}
        })));
        await bounded(entered.promise);
        flushSync(() => root.unmount());
        proceed.resolve();
        await bounded(failed.promise);
        await frame();
        assertThat(errors).isEqualTo([failure]);
        assertThat(app.stage.destroyed).isEqualTo(true);
    } finally {
        proceed.resolve();
        PixiApplication.prototype.init = original;
    }
});

suite.test('another Application finishing initialization does not dispose a pending Application', async () => {
    const original = PixiApplication.prototype.init;
    const entered = Promise.withResolvers();
    const proceed = Promise.withResolvers();
    const disposed = Promise.withResolvers();
    const secondReady = Promise.withResolvers();
    let firstStage;
    let firstReady = false;
    PixiApplication.prototype.init = async function(...args) {
        if (!firstStage) {
            firstStage = this.stage;
            firstStage.once('destroyed', () => disposed.resolve());
            entered.resolve();
            await proceed.promise;
        }
        return original.apply(this, args);
    };
    const firstRoot = createRoot(document.createElement('div'));
    const secondRoot = createRoot(document.createElement('div'));
    try {
        flushSync(() => firstRoot.render(createElement(Application, {autoStart: false, onInit: () => {firstReady = true;}})));
        await bounded(entered.promise);
        flushSync(() => firstRoot.unmount());
        flushSync(() => secondRoot.render(createElement(Application, {autoStart: false, onInit: () => secondReady.resolve()})));
        await bounded(secondReady.promise);
        assertThat(firstStage.destroyed).isEqualTo(false);
        proceed.resolve();
        await bounded(disposed.promise);
        assertThat(firstReady).isEqualTo(false);
    } finally {
        proceed.resolve();
        PixiApplication.prototype.init = original;
        flushSync(() => secondRoot.unmount());
    }
});
