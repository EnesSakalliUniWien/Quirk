import {Rectangle} from 'pixi.js';
import {Component, createElement, useLayoutEffect, useState} from 'react';
import {useStore} from 'zustand';

/** Effects run after Pixi refs commit. Tooltips need the committed source transforms. */
export function ReactScene({surface}) {
    useLayoutEffect(() => {
        surface.didMount?.();
        return () => queueMicrotask(() => surface.didUnmount?.());
    }, [surface]);
    return createElement(SceneErrorBoundary, {surface}, createElement(SceneContents, {surface}));
}

class SceneErrorBoundary extends Component {
    state = {error: null};
    static getDerivedStateFromError(error) { return {error}; }
    componentDidCatch(error) {
        this.props.surface.failure = error;
        this.props.surface.frames.getState().request?.reject(error);
    }
    render() { return this.state.error ? null : this.props.children; }
}

function SceneContents({surface}) {
    const request = useStore(surface.frames, state => state.request);
    const [overlay, setOverlay] = useState(null);
    useLayoutEffect(() => {
        if (!request) return;
        if (surface.disposed) {request.resolve(); return;}
        const app = surface.app;
        app.stage.scale.set(request.ratio);
        app.stage.eventMode = 'static';
        app.stage.hitArea = new Rectangle(0, 0, request.width / request.ratio, request.height / request.ratio);
        if (request.tooltips.length && overlay?.request !== request) {
            setOverlay({request, element: request.view.tooltips.element(request.tooltips, app.stage)});
            return;
        }
        try {
            if (app.canvas.width !== request.width || app.canvas.height !== request.height) {
                app.renderer.resize(request.width, request.height, 1);
            }
            app.render();
            if (surface.copyPixels) {
                // Resize and copy in the same commit, so a cleared canvas is never presented.
                if (surface.canvas.width !== request.width) surface.canvas.width = request.width;
                if (surface.canvas.height !== request.height) surface.canvas.height = request.height;
                const ctx = surface.canvas.getContext('2d');
                ctx.clearRect(0, 0, surface.canvas.width, surface.canvas.height);
                ctx.drawImage(app.canvas, 0, 0);
            }
            surface.presentation.setState({ready: true, circuit: request.circuit});
            request.resolve();
        } catch (error) { request.reject(error); }
    }, [request, overlay, surface]);
    return createElement('pixiSceneContainer', null,
        request?.element,
        request?.tooltips.length ? overlay?.element : null);
}
