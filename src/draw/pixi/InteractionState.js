/** Interaction output belongs to the editor frame, independently of the renderer. */
export class InteractionState {
    constructor() { this.reset(); }
    reset() { this.touchBlockers = []; this.cursor = undefined; this.ignored = 0; }
    block(blocker) { if (this.ignored === 0) this.touchBlockers.push(blocker); }
}
