import {renderInspector} from '../../editor/rendering/InspectorRendering.js';

/** Updates a retained circuit scene from editor state and already computed simulation results. */
export class CircuitViewport {
    constructor(surface) { this.surface = surface; }
    update(shown, stats, playheadStep, {rng, resolution, lineScale, scrollX, scrollY, breakpoints = [], selection = undefined}) {
        const view = this.surface.beginFrame(rng, resolution, lineScale);
        view.position.set(-scrollX, -scrollY);
        view.circuit = shown.snapshot();
        // A selection belongs to the circuit it was made on; mid-drag, the shown circuit is another.
        const range = selection !== undefined && selection.circuitJson === view.circuit ? selection.range : undefined;
        renderInspector(shown, view, stats, playheadStep, breakpoints, range);
        return view;
    }
}
