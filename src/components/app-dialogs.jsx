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
 * @param {!Observable.<!Object.<!string, !string>>} dockModes Overlay name -> docked snap zone.
 * @param {!function(!string, !HTMLElement): void} onDialogOpened
 */
function AppDialogs({overlayState, dockModes, onDialogOpened}) {
    const [active, setActive] = useState(() => overlayState.current());
    useEffect(() => overlayState.active().subscribe(setActive), [overlayState]);
    const [docked, setDocked] = useState({});
    useEffect(() => dockModes.subscribe(setDocked), [dockModes]);

    const dialogProps = name => ({
        active,
        overlayState,
        docked: docked[name],
        onOpened: popupElement => onDialogOpened(name, popupElement),
    });

    return (
        <>
            <MenuDialog {...dialogProps('menu')} />
            <ExportDialog {...dialogProps('export')} />
            <ForgeDialog {...dialogProps('forge')} />
            <GateParamDialog {...dialogProps('gate-param')} />
            <BlochDialog {...dialogProps('bloch')} />
        </>
    );
}

let appDialogsRoot;

/**
 * Mounts the app overlays. Rendered synchronously, because the src/app modules that run next look
 * the dialogs' elements up by id.
 *
 * @param {!OverlayState} overlayState
 * @param {!Observable.<!Object.<!string, !string>>} dockModes
 * @param {!function(!string, !HTMLElement): void} onDialogOpened
 */
function mountAppDialogs(overlayState, dockModes, onDialogOpened) {
    if (appDialogsRoot !== undefined) {
        throw new Error("The app dialogs have already been mounted.");
    }

    const container = document.createElement("div");
    container.id = "app-dialogs-root";
    document.body.appendChild(container);

    flushSync(() => {
        appDialogsRoot = createRoot(container);
        appDialogsRoot.render(<AppDialogs
            overlayState={overlayState}
            dockModes={dockModes}
            onDialogOpened={onDialogOpened} />);
    });
}

export {AppDialogs, mountAppDialogs};
