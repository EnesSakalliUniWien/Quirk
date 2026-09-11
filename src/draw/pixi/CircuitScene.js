/** Updates a retained circuit scene from editor state and already computed simulation results. */
export class CircuitScene {
    constructor(surface) { this.surface = surface; }
    update(shown, stats, playheadStep, {rng, resolution, lineScale, scrollX, scrollY}) {
        const view = this.surface.beginFrame(rng, resolution, lineScale);
        view.position.set(-scrollX, -scrollY);
        shown.paint(view, stats, playheadStep);
        return view;
    }
}
