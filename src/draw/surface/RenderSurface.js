import {createStore} from 'zustand/vanilla';
import {TooltipLayer} from '../tooltips/TooltipView.js';
import {DisplayView} from '../scene/DisplayView.js';
import {SharedRenderer, reportRenderingFailure} from './SharedRenderer.js';

const surfaces = new WeakMap();
const sceneKeys = new WeakMap();
let nextSceneKey = 0;
let nextSurfaceId = 0;

/**
 * What a surface that copies its pixels out has as its `app`: the shared renderer and ticker, with
 * the surface's own scene for a stage. Code written for a surface that owns an Application - the
 * tooltip placement, the tests - reads them where it always has.
 */
class SceneApplication {
    constructor(surface, shared) {
        this.surface = surface;
        this.shared = shared;
    }
    get stage() { return this.surface.root; }
    get renderer() { return this.shared.app?.renderer ?? null; }
    get ticker() { return this.shared.app?.ticker; }
}

/**
 * Submits frame descriptions. @pixi/react owns Applications and all scene-object lifetimes.
 *
 * A surface made for a visible canvas is given the Application that canvas belongs to. One made without
 * an Application copies its pixels out instead: its scene is drawn by the one renderer all such
 * surfaces share (SharedRenderer) into the canvas it was made for, a 2D canvas the page can show.
 */
export class RenderSurface {
    static forCanvas(canvas) {
        if (!surfaces.has(canvas)) new RenderSurface(canvas);
        return surfaces.get(canvas);
    }
    /**
     * Destroys the surface forCanvas made for a canvas, if it made one. Until then the surface keeps
     * its scene, and the shared renderer its WebGL context, whether or not the canvas is shown.
     */
    static release(canvas) {
        return surfaces.get(canvas)?.destroy();
    }
    constructor(canvas, app) {
        this.canvas = canvas;
        this.id = nextSurfaceId++;
        this.size = {width: canvas.width, height: canvas.height};
        this.view = new DisplayView(this.size);
        this.view.tooltips = new TooltipLayer(this.view);
        this.presentation = createStore(() => ({ready: false}));
        this.frames = createStore(() => ({request: null}));
        this.queue = Promise.resolve();
        /** How many submitted frames have not committed yet. */
        this.rendering = 0;
        this.disposed = false;
        surfaces.set(canvas, this);
        if (app) {
            this.app = app;
            this.ready = Promise.resolve();
        } else {
            this.mounted = new Promise(resolve => {this.didMount = resolve;});
            this.shared = SharedRenderer.join(this);
            this.app = new SceneApplication(this, this.shared);
            this.ready = this.shared.ready.catch(error => {
                this.failure = error;
                throw error;
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
    /**
     * @param {!DisplayView=} view The frame to draw.
     * @param {function(): boolean=} isCurrent Asked just before a surface that copies its pixels out
     *     draws into its canvas: when it says no, the canvas is left as it is.
     * @returns {!Promise} Settles once the frame is committed.
     */
    render(view = this.view, isCurrent) {
        this.pending = false;
        if (!sceneKeys.has(view.canvas)) sceneKeys.set(view.canvas, nextSceneKey++);
        const request = {view, element: view.element(sceneKeys.get(view.canvas)), tooltips: [...(view.tooltips?.pending ?? [])],
            circuit: view.circuit, ratio: view.pixelRatio, width: view.canvas.width, height: view.canvas.height, isCurrent};
        this.rendering++;
        const task = this.queue.then(async () => {
            await this.ready;
            if (this.disposed) return;
            if (this.failure) throw this.failure;
            await new Promise((resolve, reject) => this.frames.setState({request: {...request, resolve, reject}}));
        }).finally(() => {this.rendering--;});
        this.queue = task.catch(error => this.reportFailure(error));
        return task;
    }
    reportFailure(error) {
        if (!this.disposed) reportRenderingFailure(error);
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
        // Attached surfaces are unmounted by their React Application owner.
        if (this.shared) await this.shared.release(this, initialized);
    }
}
