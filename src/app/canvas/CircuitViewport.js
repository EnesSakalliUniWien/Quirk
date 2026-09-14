import {renderInspector} from '../../editor/rendering/InspectorRendering.js';

/** Updates a retained circuit scene from editor state and already computed simulation results. */
export class CircuitViewport {
    constructor(surface) { this.surface = surface; }
    update(shown, stats, playheadStep, {rng, resolution, lineScale, scrollX, scrollY}) {
        const view = this.surface.beginFrame(rng, resolution, lineScale);
        view.position.set(-scrollX, -scrollY);
        view.circuit = shown.snapshot();
        renderInspector(shown, view, stats, playheadStep);
        return view;
    }
}
