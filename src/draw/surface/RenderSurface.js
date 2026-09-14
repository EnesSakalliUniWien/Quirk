import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {Application} from '@pixi/react';
import {createStore} from 'zustand/vanilla';
import {TooltipLayer} from '../tooltips/TooltipView.js';
import {DisplayView} from '../scene/DisplayView.js';
import {ReactScene} from '../scene/ReactScene.js';
import {reportBlockingIssue} from '../../diagnostics/errorReporter.js';

const surfaces = new WeakMap();
const sceneKeys = new WeakMap();
let nextSceneKey = 0;
export const applicationOptions = {preference: 'webgl', autoStart: false, sharedTicker: false,
    antialias: true, backgroundAlpha: 0, preserveDrawingBuffer: true};

/** Submits frame descriptions. @pixi/react owns Applications and all scene-object lifetimes. */
export class RenderSurface {
    static forCanvas(canvas) {
        if (!surfaces.has(canvas)) new RenderSurface(canvas);
        return surfaces.get(canvas);
    }
    constructor(canvas, app) {
        this.canvas = canvas;
        this.size = {width: canvas.width, height: canvas.height};
        this.view = new DisplayView(this.size);
        this.view.tooltips = new TooltipLayer(this.view);
        this.presentation = createStore(() => ({ready: false}));
        this.frames = createStore(() => ({request: null}));
        this.queue = Promise.resolve();
        this.disposed = false;
        surfaces.set(canvas, this);
        if (app) {
            this.app = app;
            this.ready = Promise.resolve();
        } else {
            // Shared/offscreen consumers copy pixels into their existing 2D canvases.
            this.copyPixels = true;
            this.mounted = new Promise(resolve => {this.didMount = resolve;});
            this.host = document.createElement('div');
            this.reactRoot = createRoot(this.host);
            this.ready = new Promise((resolve, reject) => {
                this.reactRoot.render(createElement(Application, {...applicationOptions,
                    onInit: application => {this.app = application; resolve();},
                    onInitError: error => {
                        this.failure = error;
                        this.reportFailure(error);
                        reject(error);
                    }},
                createElement(ReactScene, {surface: this})));
            });
            // A surface can fail before any frame or disposal starts awaiting readiness.
            this.ready.catch(() => {});
        }
        this.onPageHide = event => {if (!event.persisted) void this.destroy();};
        window.addEventListener('pagehide', this.onPageHide);
    }
    /** Record backing dimensions without clearing the visible canvas before the next commit. */
    resize(width, height) {
        this.size.width = Math.max(1, Math.round(width));
        this.size.height = Math.max(1, Math.round(height));
        return this;
    }
    beginFrame(rng, pixelRatio = 1, lineScale = 1) {
        this.view.begin(rng, pixelRatio, lineScale);
        this.view.tooltips.begin();
        if (!this.pending) {
            this.pending = true;
            queueMicrotask(() => {
                if (!this.pending || this.disposed) return;
                void this.render().catch(() => {});
            });
        }
        return this.view;
    }
    render(view = this.view) {
        this.pending = false;
        if (!sceneKeys.has(view.canvas)) sceneKeys.set(view.canvas, nextSceneKey++);
        const request = {view, element: view.element(sceneKeys.get(view.canvas)), tooltips: [...(view.tooltips?.pending ?? [])],
            circuit: view.circuit, ratio: view.pixelRatio, width: view.canvas.width, height: view.canvas.height};
        const task = this.queue.then(async () => {
            await this.ready;
            if (this.disposed) return;
            if (this.failure) throw this.failure;
            await new Promise((resolve, reject) => this.frames.setState({request: {...request, resolve, reject}}));
        });
        this.queue = task.catch(error => this.reportFailure(error));
        return task;
    }
    reportFailure(error) {
        if (this.reportedFailure === error || this.disposed) return;
        this.reportedFailure = error;
        reportBlockingIssue('Rendering failed: ' + error.message);
    }
    destroy() {
        if (this.disposal) return this.disposal;
        this.disposed = true;
        this.frames.getState().request?.resolve();
        window.removeEventListener('pagehide', this.onPageHide);
        surfaces.delete(this.canvas);
        this.disposal = this.disposeAfterInitialization();
        return this.disposal;
    }
    async disposeAfterInitialization() {
        const initialized = await this.ready.then(() => true, () => false);
        await this.queue;
        if (this.reactRoot) {
            if (initialized) await this.mounted;
            const unmounted = initialized ? new Promise(resolve => {this.didUnmount = resolve;}) : Promise.resolve();
            this.reactRoot.unmount();
            await unmounted;
        }
        // Attached surfaces are unmounted by their React Application owner.

    }
}
