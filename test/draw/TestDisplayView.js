import {TooltipLayer} from '../../src/draw/pixi/TooltipView.js';
import {Application} from 'pixi.js';
import {DisplayView as ProductionDisplayView} from '../../src/draw/pixi/DisplayView.js';
const views = new Map();
let app;
let ready;
let queue = Promise.resolve();
export class DisplayView extends ProductionDisplayView {
    begin(...args) { super.begin(...args); this.interaction?.reset(); this.tooltips?.begin(); return this; }
    constructor(...args) { super(...args); this.tooltips = new TooltipLayer(this); views.set(this.canvas, this); }
}
/** One test renderer, serialised so concurrent tests cannot overwrite each other's pixels. */
export function scenePixels(canvas, x = 0, y = 0, width = canvas.width, height = canvas.height) {
    const task = queue.then(async () => {
        if (!app) {
            app = new Application();
            ready = app.init({width: 1, height: 1, preference: 'webgl', autoStart: false,
                antialias: true, backgroundAlpha: 0, preserveDrawingBuffer: true});
        }
        await ready;
        const view = views.get(canvas);
        if (!view) throw new Error('No test scene for canvas');
        view.finish();
        app.stage.removeChildren();
        app.stage.addChild(view, view.tooltips);
        app.stage.scale.set(view.pixelRatio);
        view.tooltips.flush();
        app.renderer.resize(canvas.width, canvas.height, 1);
        app.render();
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(app.canvas, 0, 0);
        return ctx.getImageData(x, y, width, height);
    });
    queue = task.catch(() => {});
    return task;
}
export async function disposeTestScenes() {
    await queue;
    for (const view of views.values()) { view.tooltips.destroy({children: true}); view.destroy(); }
    views.clear();
    if (app) { await ready; app.destroy(true); app = undefined; }
}
