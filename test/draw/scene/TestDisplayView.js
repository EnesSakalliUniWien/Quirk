import {TooltipLayer} from '../../../src/draw/tooltips/TooltipView.js';
import {RenderSurface} from '../../../src/draw/surface/RenderSurface.js';
import {DisplayView as ProductionDisplayView} from '../../../src/draw/scene/DisplayView.js';
const views = new Map();
let surface;
let queue = Promise.resolve();
export class DisplayView extends ProductionDisplayView {
    begin(...args) { super.begin(...args); this.tooltips?.begin(); return this; }
    constructor(...args) { super(...args); this.tooltips = new TooltipLayer(this); views.set(this.canvas, this); }
    commit() { return scenePixels(this.canvas); }
}
/** One React-managed renderer, serialised so tests cannot overwrite each other's pixels. */
export function scenePixels(canvas, x = 0, y = 0, width = canvas.width, height = canvas.height) {
    const task = queue.then(async () => {
        if (!surface) {
            surface = new RenderSurface(document.createElement('canvas'));
            surface.copyPixels = false;
        }
        const view = views.get(canvas);
        if (!view) throw new Error('No test scene for canvas');
        await surface.render(view);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(surface.app.canvas, 0, 0);
        return ctx.getImageData(x, y, width, height);
    });
    queue = task.catch(() => {});
    return task;
}
export async function disposeTestScenes() {
    await queue;
    views.clear();
    if (surface) { await surface.destroy(); surface = undefined; }
}
