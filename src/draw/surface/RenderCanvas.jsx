import {Application} from '@pixi/react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useStore} from 'zustand';
import {createStore} from 'zustand/vanilla';
const emptyPresentation = createStore(() => ({}));
import {RenderSurface, applicationOptions} from './RenderSurface.js';
import {ReactScene} from '../scene/ReactScene.js';
import {reportBlockingIssue} from '../../diagnostics/errorReporter.js';

const reportInitializationFailure = error => reportBlockingIssue('Rendering failed: ' + error.message);

/** React owns presentation attributes; Pixi owns canvas sizing, events and scene objects. */
export function RenderCanvas({canvasRef, id, className, style, label, onReady}) {
    const [surface, setSurface] = useState(null);
    const ready = useRef(onReady);
    ready.current = onReady;
    const init = useCallback(app => {
        if (canvasRef) canvasRef.current = app.canvas;
        setSurface(new RenderSurface(app.canvas, app));
    }, [canvasRef]);
    useEffect(() => {
        if (!surface) return;
        ready.current?.(surface.canvas);
        return () => {void surface.destroy();};
    }, [surface]);
    return <CanvasPresentation surface={surface} id={id} className={className} style={style} label={label}>
        <Application {...applicationOptions} onInit={init} onInitError={reportInitializationFailure}>
            {surface && <ReactScene surface={surface} />}
        </Application>
    </CanvasPresentation>;
}

function CanvasPresentation({surface, ...props}) {
    const size = useStore(surface?.presentation ?? emptyPresentation);
    return <Presentation {...props} size={size} />;
}
function Presentation({id, className, style, label, size, children}) {
    return <div id={id} className={`render-canvas ${className ?? ''}`} role={label ? 'img' : undefined}
        aria-label={label} data-renderer={size?.ready ? 'pixijs' : undefined} data-circuit={size?.circuit}
        style={{...style, width: size?.width ?? style?.width, height: size?.height ?? style?.height}}
        onContextMenu={event => event.preventDefault()}>{children}</div>;
}
