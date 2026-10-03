import {renderInspector} from '../../editor/rendering/InspectorRendering.js';

/**
 * How many viewport widths of the circuit, either side of the viewport, a frame describes besides
 * what shows. A circuit wide enough to scroll is then described about three screens wide at most,
 * however many columns it has, and a scroll of up to one screen either way needs no new description.
 */
const DESCRIBED_MARGIN = 1;

/** Updates a retained circuit scene from editor state and already computed simulation results. */
export class CircuitViewport {
    constructor(surface) { this.surface = surface; }
    update(shown, stats, playheadStep, {rng, resolution, lineScale, scrollX, scrollY, breakpoints = [], selection = undefined, follow = undefined}) {
        const view = this.surface.beginFrame(rng, resolution, lineScale);
        // A pan since the last frame moved committed objects without React. Put them where this frame
        // describes them, since React leaves alone a property whose described value has not changed.
        view.native?.position.set(-scrollX, -scrollY);
        if (view.pan?.pinned?.native) view.pan.pinned.native.x = scrollX;
        view.pan = undefined;
        view.position.set(-scrollX, -scrollY);
        view.circuit = shown.snapshot();
        // A selection belongs to the circuit it was made on; mid-drag, the shown circuit is another.
        const range = selection !== undefined && selection.circuitJson === view.circuit ? selection.range : undefined;
        // The columns that draw beyond the margin are left out of the scene: the rest of the circuit
        // is not described, and costs nothing, until a scroll brings it near.
        const viewWidth = this.surface.size.width / resolution;
        const described = {left: scrollX - DESCRIBED_MARGIN * viewWidth, right: scrollX + (1 + DESCRIBED_MARGIN) * viewWidth};
        renderInspector(shown, view, stats, playheadStep, breakpoints, range, follow, scrollX, described);
        return view;
    }

    /**
     * Scrolls the drawn scene without describing it again. The scene is described well past the
     * viewport, so a scroll only moves the camera - the scene, and the pinned wire names back to the
     * viewport's edge - and draws once more, as Pixi's render groups guide suggests for panning.
     * Only as far as that goes, though: past the columns described, there is nothing to show.
     *
     * @param {!number} scrollX In circuit units.
     * @param {!number} scrollY In circuit units.
     * @param {!number} resolution The device pixels per circuit unit the scroll was measured at.
     * @returns {!boolean} Whether it scrolled; when not, the scene needs describing again: a frame is
     *     on its way, a tooltip follows what it points at, the zoom changed, the wire names start
     *     or stop pinning, or the viewport would leave the columns described.
     */
    pan(scrollX, scrollY, resolution) {
        const surface = this.surface;
        const view = surface.view;
        const pan = view.pan;
        if (pan === undefined || view.native === undefined || surface.app === undefined ||
                surface.pending || surface.rendering > 0 || view.pixelRatio !== resolution ||
                (view.tooltips?.pending.length ?? 0) > 0 ||
                (scrollX > pan.pinPast) !== (pan.scrollX > pan.pinPast) ||
                (pan.pinned === undefined) !== (scrollX <= 0) ||
                scrollX < pan.described.left || scrollX + surface.size.width / resolution > pan.described.right) {
            return false;
        }
        view.native.position.set(-scrollX, -scrollY);
        if (pan.pinned?.native) pan.pinned.native.x = scrollX;
        surface.app.render();
        return true;
    }
}
