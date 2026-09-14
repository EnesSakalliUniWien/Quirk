import {renderCircuitTargets} from '../interaction/CircuitTargets.js';
import {paintCircuit} from './CircuitRendering.js';
import {rectangle} from '../../draw/shapes/ShapeView.js';
import {CanvasTheme} from '../../config/CanvasTheme.js';
import {GateRenderParams} from '../../draw/gate/GateRenderParams.js';
import {DEFAULT_RENDERER} from '../../draw/gate/GateRenderers.js';
import {heldGateRect} from '../geometry/InspectorLayout.js';

/** Compose the background, circuit and held gate from snapshot inputs. */
export function renderInspector({drawArea, displayedCircuit, hand}, view, stats, playheadStep) {
    rectangle(view, drawArea, {fill: CanvasTheme.surface.background});
    view.group('circuit', child => paintCircuit(displayedCircuit, child, hand, stats, false, true, playheadStep));
    view.group('held-gates', child => {
        if (hand.pos === undefined || hand.heldGate === undefined) return;
        const gate = hand.heldGate;
        const renderer = gate.customRenderer || DEFAULT_RENDERER;
        renderer(GateRenderParams.held(child, hand, heldGateRect(hand), gate, stats));
    });
    view.group('interaction', child => renderCircuitTargets(child, {definition: displayedCircuit.circuitDefinition, geometry: displayedCircuit.geometry()}, hand));
}
