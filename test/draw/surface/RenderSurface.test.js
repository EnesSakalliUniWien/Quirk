import {Application as PixiApplication} from 'pixi.js';
import {Application} from '@pixi/react';
import {createElement, useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Suite, assertThat} from '../../TestUtil.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {paintInto} from '../../../src/draw/surface/SharedPaintSurface.js';
import {startNewSharedRenderer, warmSharedRenderer} from '../../../src/draw/surface/SharedRenderer.js';
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
    startNewSharedRenderer();
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
    startNewSharedRenderer();
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

const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
/** Counts the WebGL contexts the page creates while it is installed. */
function countWebglContexts() {
    const original = HTMLCanvasElement.prototype.getContext;
    const count = {created: 0, stop() {HTMLCanvasElement.prototype.getContext = original;}};
    HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
        if (typeof type === 'string' && type.startsWith('webgl')) count.created++;
        return original.call(this, type, ...rest);
    };
    return count;
}
/** A surface for a canvas of its own, painting one filled rectangle of the colour. */
async function paintedSurface(width, height, fill) {
    const surface = new RenderSurface(document.createElement('canvas'));
    rectangle(surface.resize(width, height).beginFrame(), new Rect(0, 0, width, height), {fill});
    await bounded(surface.render());
    return surface;
}

suite.test('surfaces that copy their pixels out share one renderer and one WebGL context', async () => {
    startNewSharedRenderer();
    const contexts = countWebglContexts();
    const surfaces = [];
    try {
        surfaces.push(await paintedSurface(40, 30, 'red'));
        const afterOne = contexts.created;
        assertThat(afterOne > 0).isEqualTo(true);
        // A tall figure after a wide one, and the other way round: neither may cost a context, or
        // reallocate what the others drew with.
        surfaces.push(await paintedSurface(20, 60, 'lime'));
        surfaces.push(await paintedSurface(100, 10, 'blue'));
        assertThat(contexts.created).isEqualTo(afterOne);
        assertThat(new Set(surfaces.map(surface => surface.app.renderer)).size).isEqualTo(1);
        assertThat(surfaces.map(surface => [surface.canvas.width, surface.canvas.height])).
            isEqualTo([[40, 30], [20, 60], [100, 10]]);
        assertThat(surfaces.map(({canvas}) => pixel(canvas, 5, 5))).
            isEqualTo([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]]);
        const glCanvas = surfaces[0].app.renderer.context.canvas;
        assertThat([glCanvas.width, glCanvas.height]).isEqualTo([100, 60]);
    } finally {
        contexts.stop();
        await bounded(Promise.all(surfaces.map(surface => surface.destroy())));
    }
});

suite.test('disposing a surface frees its scene and no other, and the last takes the renderer with it', async () => {
    startNewSharedRenderer();
    const first = await paintedSurface(200, 20, 'red');
    const second = await paintedSurface(20, 20, 'blue');
    try {
        const {renderer} = second.app;
        assertThat(renderer.context.canvas.width).isEqualTo(200);
        await bounded(first.destroy());
        // The room the larger surface needed goes with it.
        assertThat(renderer.context.canvas.width).isEqualTo(20);
        assertThat(first.app.stage.destroyed).isEqualTo(true);
        assertThat(second.app.stage.destroyed).isEqualTo(false);
        assertThat(second.app.renderer === renderer).isEqualTo(true);
        assertThat(pixel(second.canvas, 5, 5)).isEqualTo([0, 0, 255, 255]);
        // What is left still draws, and draws what it is now asked.
        rectangle(second.beginFrame(), new Rect(0, 0, 20, 20), {fill: 'lime'});
        await bounded(second.render());
        assertThat(pixel(second.canvas, 5, 5)).isEqualTo([0, 255, 0, 255]);
        await bounded(second.destroy());
        assertThat(second.app.stage.destroyed).isEqualTo(true);
        assertThat(second.app.renderer).isEqualTo(null);
    } finally {
        await bounded(Promise.all([first.destroy(), second.destroy()]));
    }
});

suite.test('a context canvas grown past a megapixel is cut down once the frames drawn need a fraction of it', async () => {
    startNewSharedRenderer();
    const large = await paintedSurface(1200, 1000, 'red');
    const small = await paintedSurface(40, 30, 'blue');
    try {
        const glCanvas = large.app.renderer.context.canvas;
        // Fitted in the microtask after the frame that did not need the room.
        await frame();
        assertThat([glCanvas.width, glCanvas.height]).isEqualTo([40, 30]);
        // The scene still draws what it is asked, into a canvas that has to grow again.
        rectangle(large.beginFrame(), new Rect(0, 0, 1200, 1000), {fill: 'lime'});
        await bounded(large.render());
        assertThat([pixel(large.canvas, 5, 5), pixel(large.canvas, 1195, 995)]).isEqualTo([[0, 255, 0, 255], [0, 255, 0, 255]]);
        assertThat(pixel(small.canvas, 5, 5)).isEqualTo([0, 0, 255, 255]);
    } finally {await bounded(Promise.all([large.destroy(), small.destroy()]));}
});

suite.test('a context canvas under a megapixel is left as large as the largest frame drawn into it', async () => {
    startNewSharedRenderer();
    const large = await paintedSurface(600, 500, 'red');
    const small = await paintedSurface(40, 30, 'blue');
    try {
        const glCanvas = large.app.renderer.context.canvas;
        await frame();
        // Resizing a context's canvas costs more than the copies the room would save.
        assertThat([glCanvas.width, glCanvas.height]).isEqualTo([600, 500]);
        assertThat([pixel(large.canvas, 5, 5), pixel(small.canvas, 5, 5)]).isEqualTo([[255, 0, 0, 255], [0, 0, 255, 255]]);
    } finally {await bounded(Promise.all([large.destroy(), small.destroy()]));}
});

suite.test('a surface made as the last one leaves shares the renderer it was on', async () => {
    startNewSharedRenderer();
    const first = await paintedSurface(20, 20, 'red');
    const {renderer} = first.app;
    const leaving = first.destroy();
    const second = await paintedSurface(20, 20, 'blue');
    try {
        await bounded(leaving);
        assertThat(second.app.renderer === renderer).isEqualTo(true);
        assertThat(pixel(second.canvas, 5, 5)).isEqualTo([0, 0, 255, 255]);
    } finally {await bounded(second.destroy());}
});

suite.test('the first surface after the last has left starts a renderer of its own', async () => {
    startNewSharedRenderer();
    const first = await paintedSurface(20, 20, 'red');
    const {renderer} = first.app;
    await bounded(first.destroy());
    const second = await paintedSurface(20, 20, 'blue');
    try {
        assertThat(second.app.renderer === renderer).isEqualTo(false);
        assertThat(pixel(second.canvas, 5, 5)).isEqualTo([0, 0, 255, 255]);
    } finally {await bounded(second.destroy());}
});

suite.test('a renderer started before any surface is the one the first surface joins', async () => {
    startNewSharedRenderer();
    const warmed = warmSharedRenderer();
    await bounded(warmed.ready);
    assertThat(warmSharedRenderer() === warmed).isEqualTo(true);
    const surface = await paintedSurface(20, 20, 'red');
    try {
        assertThat(surface.app.renderer === warmed.app.renderer).isEqualTo(true);
        assertThat(pixel(surface.canvas, 5, 5)).isEqualTo([255, 0, 0, 255]);
    } finally {await bounded(surface.destroy());}
    assertThat(warmed.closing).isEqualTo(true);
});

suite.test('initialization failure is reported once, however many surfaces waited for the renderer', async () => {
    const original = PixiApplication.prototype.init;
    const failure = new Error('Test shared renderer failure for several surfaces');
    const host = document.createElement('div');
    const uninstall = installErrorReporter(host);
    PixiApplication.prototype.init = async function() {throw failure;};
    startNewSharedRenderer();
    const surfaces = [1, 2, 3].map(() => new RenderSurface(document.createElement('canvas')));
    try {
        const results = await bounded(Promise.allSettled(surfaces.map(surface => surface.beginFrame() && surface.render())));
        assertThat(results.map(result => result.reason)).isEqualTo([failure, failure, failure]);
        assertThat(host.textContent.includes('Rendering failed: ' + failure.message)).isEqualTo(true);
        assertThat(host.textContent.includes('×1')).isEqualTo(true);
        assertThat(host.textContent.includes('×2')).isEqualTo(false);
    } finally {
        PixiApplication.prototype.init = original;
        uninstall();
        await bounded(Promise.all(surfaces.map(surface => surface.destroy())));
    }
});

suite.test('a context the browser takes back is restored, and the surfaces draw again', async () => {
    startNewSharedRenderer();
    const surface = await paintedSurface(20, 20, 'red');
    try {
        const {renderer} = surface.app;
        renderer.context.forceContextLoss();
        await bounded(until(() => !renderer.gl.isContextLost()));
        rectangle(surface.beginFrame(), new Rect(0, 0, 20, 20), {fill: 'blue'});
        await bounded(surface.render());
        assertThat(pixel(surface.canvas, 5, 5)).isEqualTo([0, 0, 255, 255]);
    } finally {await bounded(surface.destroy());}
});

suite.test('a panel that repaints reuses its Pixi objects, whichever panel painted in between', async () => {
    const [first, second] = [document.createElement('canvas'), document.createElement('canvas')];
    document.body.append(first, second);
    let mark;
    const draw = view => {mark = rectangle(view, new Rect(0, 0, 10, 10), {fill: 'red'});};
    const natives = [];
    const paint = async canvas => {
        await bounded(paintInto(canvas, 10, 10, draw));
        natives.push(mark.native);
    };
    try {
        await paint(first);
        await paint(second);
        await paint(first);
        await paint(second);
        assertThat(natives.map(native => native.destroyed)).isEqualTo([false, false, false, false]);
        assertThat(natives[2] === natives[0]).isEqualTo(true);
        assertThat(natives[3] === natives[1]).isEqualTo(true);
        assertThat(natives[1] === natives[0]).isEqualTo(false);
        assertThat([pixel(first, 5, 5), pixel(second, 5, 5)]).isEqualTo([[255, 0, 0, 255], [255, 0, 0, 255]]);
    } finally {
        first.remove();
        second.remove();
        await bounded(Promise.all([RenderSurface.release(first), RenderSurface.release(second)]));
    }
});

suite.test('a painting that is no longer wanted leaves its canvas as it was', async () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    let wanted = true;
    try {
        await bounded(paintInto(canvas, 10, 10, view => rectangle(view, new Rect(0, 0, 10, 10), {fill: 'red'})));
        const stale = paintInto(canvas, 10, 10, view => rectangle(view, new Rect(0, 0, 10, 10), {fill: 'blue'}),
            () => wanted);
        wanted = false;
        assertThat(await bounded(stale)).isEqualTo(false);
        assertThat(pixel(canvas, 5, 5)).isEqualTo([255, 0, 0, 255]);
    } finally {
        canvas.remove();
        await bounded(RenderSurface.release(canvas));
    }
});

suite.test('the scene of a canvas that has left the page is freed soon after the last painting', async () => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    await bounded(paintInto(canvas, 10, 10, view => rectangle(view, new Rect(0, 0, 10, 10), {fill: 'red'})));
    const surface = RenderSurface.forCanvas(canvas);
    canvas.remove();
    // No painting follows, so nothing but the clock can free it.
    await Promise.race([until(() => surface.disposal !== undefined),
        new Promise((_, reject) => setTimeout(() => reject(new Error('The scene was not freed')), 4000))]);
    await bounded(surface.disposal);
    assertThat(surface.app.stage.destroyed).isEqualTo(true);
});

suite.test('the scene of a canvas that has left the page is freed by the next painting', async () => {
    const [gone, shown] = [document.createElement('canvas'), document.createElement('canvas')];
    document.body.append(gone, shown);
    const draw = view => rectangle(view, new Rect(0, 0, 10, 10), {fill: 'red'});
    try {
        await bounded(paintInto(gone, 10, 10, draw));
        const surface = RenderSurface.forCanvas(gone);
        gone.remove();
        await bounded(paintInto(shown, 10, 10, draw));
        await bounded(surface.disposal);
        assertThat(surface.app.stage.destroyed).isEqualTo(true);
        assertThat(RenderSurface.forCanvas(shown).app.stage.destroyed).isEqualTo(false);
    } finally {
        shown.remove();
        await bounded(RenderSurface.release(shown));
    }
});
