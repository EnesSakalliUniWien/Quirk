import {useEffect, useState} from "react";
import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";

import {BlochDialog} from "./bloch-dialog.jsx";
import {ExportDialog} from "./export-dialog.jsx";
import {ForgeDialog} from "./forge-dialog.jsx";
import {GateParamDialog} from "./gate-param-dialog.jsx";
import {MenuDialog} from "./menu-dialog.jsx";

/**
 * Composes the app's overlays and keeps them in step with the one OverlayState.
 *
 * @param {!OverlayState} overlayState
 */
function AppDialogs({overlayState}) {
    const [active, setActive] = useState(() => overlayState.current());
    useEffect(() => overlayState.active().subscribe(setActive), [overlayState]);

    return (
        <>
            <MenuDialog active={active} overlayState={overlayState} />
            <ExportDialog active={active} overlayState={overlayState} />
            <ForgeDialog active={active} overlayState={overlayState} />
            <GateParamDialog active={active} overlayState={overlayState} />
            <BlochDialog active={active} overlayState={overlayState} />
        </>
    );
}

let appDialogsRoot;

/**
 * Mounts the app overlays. Rendered synchronously, because the src/ui modules that run next look
 * the dialogs' elements up by id.
 *
 * @param {!OverlayState} overlayState
 */
function mountAppDialogs(overlayState) {
    if (appDialogsRoot !== undefined) {
        throw new Error("The app dialogs have already been mounted.");
    }

    const container = document.createElement("div");
    container.id = "app-dialogs-root";
    document.body.appendChild(container);

    flushSync(() => {
        appDialogsRoot = createRoot(container);
        appDialogsRoot.render(<AppDialogs overlayState={overlayState} />);
    });
}

export {AppDialogs, mountAppDialogs};
