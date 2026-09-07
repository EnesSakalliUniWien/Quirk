import { DisplayView } from "./DisplayView.js";
import { textLayoutVersion } from "./TextLayout.js";

/** A gate occurrence owns its display objects, independently of neighbouring circuit slots. */
export class GateView extends DisplayView {
  update(args, drawer) {
    const { rect, gate } = args;
    const inputs = [
      gate,
      drawer,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      args.isHighlighted,
      args.isResizeShowing,
      args.isResizeHighlighted,
      this.pixelRatio,
      textLayoutVersion,
    ];
    // The default static symbol does not read simulation data, focus points, or randomness.
    const staticSymbol =
      !gate.customDrawer && gate.stableDuration() === Infinity;
    if (
      staticSymbol &&
      this.inputs &&
      inputs.every((value, i) => Object.is(value, this.inputs[i]))
    ) {
      this.used = new Set(this.objects.keys());
      return;
    }
    drawer(args.withPainter(this));
    this.inputs = staticSymbol ? inputs : undefined;
  }
}

export function renderGateView(view, key, args, drawer) {
  return view.group(key, (child) => child.update(args, drawer), GateView);
}
