import {RenderSurface} from './RenderSurface.js';
import {DisplayView} from '../scene/DisplayView.js';

let surface;
let queue = Promise.resolve();

/** One React-managed Pixi Application serves every scientific panel without multiplying GPU contexts. */
function paintInto(canvas, width, height, draw, isCurrent = () => true) {
    const task = queue.then(async () => {
        if (!isCurrent()) return false;
        if (!surface) {
            surface = new RenderSurface(document.createElement('canvas'));
            surface.copyPixels = false;
        }
        const ratio = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(width * ratio));
        const pixelHeight = Math.max(1, Math.round(height * ratio));
        const view = new DisplayView({width: pixelWidth, height: pixelHeight}, undefined, ratio);
        try {
            draw(view);
            await surface.render(view);
        } catch (error) {
            const failed = surface;
            surface = undefined;
            failed.reportFailure(error);
            await failed.destroy();
            throw error;
        }
        if (!isCurrent()) return false;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, pixelWidth, pixelHeight);
        ctx.drawImage(surface.app.canvas, 0, 0);
    });
    queue = task.catch(() => {});
    return task;
}

export {paintInto};
