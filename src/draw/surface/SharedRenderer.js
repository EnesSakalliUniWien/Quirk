import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {Application} from '@pixi/react';
import {getCanvasTexture, hasCachedCanvasTexture} from 'pixi.js';
import {useStore} from 'zustand';
import {createStore} from 'zustand/vanilla';
import {ReactScene} from '../scene/ReactScene.js';
import {reportBlockingIssue} from '../../diagnostics/errorReporter.js';
import {sharedApplicationOptions} from './applicationOptions.js';

/**
 * How large the context's canvas must be, in pixels, before it is cut down to what the frames being
 * drawn need. Every copy out of it costs the GPU a snapshot of the whole canvas: about a millisecond
 * for a canvas of up to half a megapixel, measured, and half as much again at two. Resizing the
 * canvas costs more than one such copy, so below this it is left alone, and a minimap and a panel of
 * figures drawn one after the other do not take it back and forth.
 */
const LARGE_CONTEXT_PIXELS = 1 << 20;
/** How many times the pixels the frames need a large context's canvas may have before it is cut down. */
const CONTEXT_ROOM = 4;

/** The renderer a new surface joins, until it has failed or begun to close. */
let current;
const reported = new WeakSet();

/** Tells the user once that rendering failed, however many surfaces ran into the same failure. */
export function reportRenderingFailure(error) {
    if (error instanceof Object) {
        if (reported.has(error)) return;
        reported.add(error);
    }
    reportBlockingIssue('Rendering failed: ' + error.message);
}

/**
 * Leaves the running renderer to the surfaces already on it, so that the next surface starts a new one.
 * Only a test that needs to see a renderer start has a use for it.
 */
export function startNewSharedRenderer() {
    current = undefined;
}

/**
 * Starts the renderer before any surface needs it, so that the first to draw - the minimap, as a
 * circuit loads - finds it running rather than waiting the frames it takes to start. It stays until a
 * surface has joined and the last one has left, like any other.
 * @returns {!SharedRenderer}
 */
export function warmSharedRenderer() {
    if (!current || current.failure || current.closing) current = new SharedRenderer();
    return current;
}

/** Mounts the scene of every surface on the renderer, each in a container of its own. */
function Scenes({scenes}) {
    const surfaces = useStore(scenes, state => state.surfaces);
    return surfaces.map(surface => createElement(ReactScene, {key: surface.id, surface}));
}

/**
 * The one renderer, and so the one WebGL context, that every surface copying its pixels out draws
 * with. A context duplicates its textures, shaders and fonts, and a browser keeps only a few alive
 * (Chrome sixteen, on Android eight) before it drops the least recently used, which can be the
 * circuit's own; Pixi's advice for several canvases is one renderer with `multiView`.
 *
 * It is one hidden Application. The scene of each surface is a container of its own under the
 * stage, mounted and unmounted by React as the surfaces come and go, and a frame request draws only
 * that container, into that surface's canvas. Disposing a surface therefore frees its scene alone;
 * the last one to go takes the renderer with it, and the next surface starts a new one.
 */
export class SharedRenderer {
    /** @returns {!SharedRenderer} The renderer the surface now shares: the running one, or a new one. */
    static join(surface) {
        warmSharedRenderer();
        current.scenes.setState(({surfaces}) => ({surfaces: [...surfaces, surface]}));
        return current;
    }
    constructor() {
        this.scenes = createStore(() => ({surfaces: []}));
        /** How many surfaces are on their way out, and so not yet done with the renderer. */
        this.releasing = 0;
        this.closing = false;
        /** The largest canvas drawn since the context's canvas was last fitted, if one is waiting to be. */
        this.drawn = undefined;
        this.host = document.createElement('div');
        this.reactRoot = createRoot(this.host);
        this.ready = new Promise((resolve, reject) => {
            this.reactRoot.render(createElement(Application, {...sharedApplicationOptions,
                onInit: application => {
                    this.app = application;
                    this.restoreLostContext();
                    resolve();
                },
                onInitError: error => {
                    this.failure = error;
                    if (current === this) current = undefined;
                    reportRenderingFailure(error);
                    reject(error);
                }},
            createElement(Scenes, {scenes: this.scenes})));
        });
        // A renderer can fail before any surface starts waiting for it.
        this.ready.catch(() => {});
    }
    /**
     * Pixi listens for a lost context on the renderer's view. With several views that is not the
     * canvas the context lives in, so a context the browser takes back would never be restored.
     */
    restoreLostContext() {
        const {context} = this.app.renderer;
        context.canvas.addEventListener('webglcontextlost', context.handleContextLost);
        context.canvas.addEventListener('webglcontextrestored', context.handleContextRestored);
    }
    /**
     * Draws a surface's scene into its canvas. The canvas is resized, cleared and drawn in this one
     * call, so that a cleared canvas is never presented.
     * @param {!import("./RenderSurface.js").RenderSurface} surface
     * @param {!number} width The canvas's backing width, in pixels.
     * @param {!number} height
     */
    draw(surface, width, height) {
        const {canvas} = surface;
        const {renderer} = this.app;
        // Pixi grows the context's canvas to the size of the target whenever either side falls
        // short, so a wide figure after a tall one would shrink it again, and every figure of a
        // frame would reallocate its drawing buffers. Growing it here first leaves nothing to grow.
        const glCanvas = renderer.context.canvas;
        if (glCanvas.width < width) glCanvas.width = width;
        if (glCanvas.height < height) glCanvas.height = height;
        this.noteDrawn(width, height);
        // Pixi sizes its render target by the canvas's texture, not by the canvas.
        getCanvasTexture(canvas).source.resize(width, height, 1);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        // Pixi draws over what the canvas holds, and a scene can leave pixels clear.
        canvas.getContext('2d').clearRect(0, 0, width, height);
        renderer.render({container: surface.root, target: canvas});
    }
    /**
     * Remembers how large a canvas this task's frames have drawn into, and fits the context's canvas
     * to them once they are all drawn: the frames of one commit are drawn one after the other in a
     * single task, so the end of its microtasks is the end of the frames.
     */
    noteDrawn(width, height) {
        if (this.drawn) {
            this.drawn.width = Math.max(this.drawn.width, width);
            this.drawn.height = Math.max(this.drawn.height, height);
            return;
        }
        this.drawn = {width, height};
        queueMicrotask(() => this.fitToFrames());
    }
    /**
     * Gives back the room the largest canvas ever drawn into took, once the frames being drawn need
     * a fraction of it. Pixi only ever grows the context's canvas, so a single large figure would
     * otherwise cost every copy after it, for as long as its surface lives, the size of the figure.
     */
    fitToFrames() {
        const {width, height} = this.drawn;
        this.drawn = undefined;
        const glCanvas = this.app.renderer?.context.canvas;
        if (!glCanvas || this.closing) return;
        const pixels = glCanvas.width * glCanvas.height;
        if (pixels < LARGE_CONTEXT_PIXELS || pixels < CONTEXT_ROOM * width * height) return;
        glCanvas.width = width;
        glCanvas.height = height;
    }
    /**
     * Gives back the room a surface needed. The context's canvas is as large as the largest canvas it
     * has drawn into, each surface's copy costs the GPU the size of it, and Pixi only ever grows it.
     */
    fitToSurfaces() {
        const glCanvas = this.app.renderer?.context.canvas;
        if (!glCanvas) return;
        const {surfaces} = this.scenes.getState();
        const width = Math.max(1, ...surfaces.map(({canvas}) => canvas.width));
        const height = Math.max(1, ...surfaces.map(({canvas}) => canvas.height));
        if (glCanvas.width > width) glCanvas.width = width;
        if (glCanvas.height > height) glCanvas.height = height;
    }
    /**
     * Takes the surface's scene out of the renderer and waits for it to be gone. Whoever was the last
     * to leave takes the renderer with them.
     * @param {!import("./RenderSurface.js").RenderSurface} surface
     * @param {!boolean} initialized Whether the renderer started: a scene is only mounted on one that did.
     */
    async release(surface, initialized) {
        this.releasing++;
        try {
            // A scene still on its way in leaves once it is in.
            if (initialized) await surface.mounted;
            const unmounted = initialized ? new Promise(resolve => {surface.didUnmount = resolve;}) : Promise.resolve();
            this.scenes.setState(({surfaces}) => ({surfaces: surfaces.filter(other => other !== surface)}));
            await unmounted;
            // Pixi keeps a texture, and a render target, for every canvas it has drawn into.
            if (initialized && hasCachedCanvasTexture(surface.canvas)) getCanvasTexture(surface.canvas).destroy(true);
            if (initialized) this.fitToSurfaces();
        } finally {this.releasing--;}
        if (this.releasing === 0 && this.scenes.getState().surfaces.length === 0) await this.close();
    }
    async close() {
        if (this.closing) return;
        this.closing = true;
        if (current === this) current = undefined;
        const destroyed = this.app && new Promise(resolve => this.app.stage.once('destroyed', resolve));
        this.reactRoot.unmount();
        await destroyed;
    }
}
