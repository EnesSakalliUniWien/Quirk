// A visible canvas keeps its drawing buffer between renders, so what it last drew can still be read
// back - the browser tests check through it that a resize never shows a blank frame.
export const applicationOptions = {preference: 'webgl', autoStart: false, sharedTicker: false,
    antialias: true, backgroundAlpha: 0, preserveDrawingBuffer: true};

// The renderer shared by the surfaces that copy their pixels out (SharedRenderer) draws one scene
// after another into canvases of their own, each time copying the result in the same task
// (SharedRenderer.draw), so it needs no preserved buffer, and keeping one would cost a copy of it on
// every frame. It has no canvas in the page, so no pointer reaches it: without its event features,
// Pixi stops hit-testing its whole scene on every pointer move over the document. Its own canvas is
// never drawn to and the context's starts a pixel square, growing to the largest scene drawn.
export const sharedApplicationOptions = {...applicationOptions, preserveDrawingBuffer: false,
    multiView: true, width: 1, height: 1,
    eventFeatures: {move: false, globalMove: false, click: false, wheel: false}};
