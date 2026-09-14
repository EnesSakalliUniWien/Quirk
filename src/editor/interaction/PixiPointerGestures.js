/** Track one gesture through Pixi's federated pointer events, including release outside. */
export function watchPixiPointerDrags(stage, handlers, position) {
    let active;
    const down = event => {
        if (active !== undefined || !event.isPrimary || event.button !== 0) return;
        active = event.pointerId;
        handlers.onGrab(position(event), event);
    };
    const move = event => {
        if (event.pointerId !== active) return;
        if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
            active = undefined;
            handlers.onDrop(undefined, event);
        } else handlers.onDrag(position(event), event);
    };
    const up = event => {
        if (event.pointerId !== active) return;
        active = undefined;
        handlers.onDrop(position(event), event);
    };
    const cancel = event => {
        if (event.pointerId !== active) return;
        active = undefined;
        handlers.onCancel(event);
    };
    stage.on('pointerdown', down).on('globalpointermove', move)
        .on('pointerup', up).on('pointerupoutside', up);
    const dispose = () => {
        active = undefined;
        stage.off('pointerdown', down).off('globalpointermove', move)
            .off('pointerup', up).off('pointerupoutside', up);
    };
    return {cancel, dispose};
}
