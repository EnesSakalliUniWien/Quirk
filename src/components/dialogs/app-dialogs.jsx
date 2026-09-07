import {useEffect, useMemo, useState} from "react";
import {flushSync} from "react-dom";
import {createRoot} from "react-dom/client";
import {useStore} from "zustand";

import {appStore} from "../../app/state/appStore.js";

import {BlochDialog} from "./bloch-dialog.jsx";
import {ExportDialog} from "./export-dialog.jsx";
import {ForgeDialog} from "./forge-dialog.jsx";
import {GateParamDialog} from "./gate-param-dialog.jsx";
import {MenuDialog} from "./menu-dialog.jsx";

/**
 * Composes the app's overlays and keeps them in step with the one OverlayState.
 *
 * @param {!OverlayState} overlayState
 * @param {!function(!string, !HTMLElement): void} onDialogOpened
 */
function AppDialogs({overlayState, onDialogOpened}) {
    const [active, setActive] = useState(() => overlayState.current());
    useEffect(() => overlayState.active().subscribe(setActive), [overlayState]);
    // Overlay name -> docked snap zone, published by src/app/dialogs/dialogSnap.js.
    const docked = useStore(appStore, s => s.dockModes);

    // Stable per-dialog handlers: a fresh closure each render would change the popup's callback
    // ref identity, making React re-adopt the dialog content on every re-render.
    const onOpenedHandlers = useMemo(() => {
        const handlers = {};
        for (const name of ['menu', 'export', 'forge', 'gate-param', 'bloch']) {
            handlers[name] = popupElement => onDialogOpened(name, popupElement);
        }
        return handlers;
    }, [onDialogOpened]);

    const dialogProps = name => ({
        active,
        overlayState,
        docked: docked[name],
        onOpened: onOpenedHandlers[name],
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
 * @param {!function(!string, !HTMLElement): void} onDialogOpened
 */
function mountAppDialogs(overlayState, onDialogOpened) {
    if (appDialogsRoot !== undefined) {
        throw new Error("The app dialogs have already been mounted.");
    }

    const container = document.createElement("div");
    container.id = "app-dialogs-root";
    document.body.appendChild(container);

    flushSync(() => {
        appDialogsRoot = createRoot(container);
        appDialogsRoot.render(<AppDialogs overlayState={overlayState} onDialogOpened={onDialogOpened} />);
    });
}

export {AppDialogs, mountAppDialogs};
