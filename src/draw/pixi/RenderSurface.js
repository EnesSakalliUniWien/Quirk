import { TooltipLayer } from "./TooltipView.js";
import { Application } from "pixi.js";
import { DisplayView } from "./DisplayView.js";
import { reportBlockingIssue } from "../../diagnostics/errorReporter.js";

const surfaces = new WeakMap();

/** Owns a Pixi renderer for one canvas. Frames update retained objects, then render once. */
export class RenderSurface {
  static forCanvas(canvas) {
    if (!surfaces.has(canvas)) surfaces.set(canvas, new RenderSurface(canvas));
    return surfaces.get(canvas);
  }
  constructor(canvas) {
    this.canvas = canvas;
    this.view = new DisplayView(canvas);
    this.app = new Application();
    this.view.tooltips = new TooltipLayer(this.view);
    this.app.stage.addChild(this.view, this.view.tooltips);
    this.disposed = false;
    this.onPageHide = (event) => {
      if (!event.persisted) void this.destroy();
    };
    window.addEventListener("pagehide", this.onPageHide);
    this.ready = this.app
      .init({
        canvas,
        width: Math.max(1, canvas.width),
        height: Math.max(1, canvas.height),
        preference: "webgl",
        autoStart: false,
        sharedTicker: false,
        antialias: true,
        backgroundAlpha: 0,
        preserveDrawingBuffer: true,
      })
      .then(() => {
        if (this.disposed) return;
        canvas.dataset.renderer = "pixijs";
      });
  }
  beginFrame(rng, pixelRatio = 1) {
    this.width = Math.max(1, this.canvas.width);
    this.height = Math.max(1, this.canvas.height);
    this.view.begin(rng, pixelRatio);
    this.view.interaction.reset();
    this.view.tooltips.begin();
    this.app.stage.scale.set(pixelRatio);
    if (!this.pending) {
      this.pending = true;
      queueMicrotask(() =>
        this.render().catch((error) =>
          reportBlockingIssue(`Rendering failed: ${error.message}`),
        ),
      );
    }
    return this.view;
  }
  async render() {
    await this.ready;
    if (this.disposed) return;
    this.pending = false;
    this.view.tooltips.flush();
    this.view.finish();
    this.app.renderer.resize(
      this.width || this.canvas.width,
      this.height || this.canvas.height,
      1,
    );
    this.app.stage.scale.set(this.view.pixelRatio);
    this.app.render();
  }
  async destroy() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("pagehide", this.onPageHide);
    surfaces.delete(this.canvas);
    delete this.canvas.dataset.renderer;
    await this.ready;
    if (this.app.renderer) {
      this.app.destroy(false, { children: true });
    }
  }
}
