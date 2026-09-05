import {useCallback} from "react";

import {Dialog} from "@base-ui/react/dialog";
import {XIcon} from "lucide-react";

/**
 * One overlay, wrapped in Base UI's Dialog so focus trapping, Escape, backdrop dismissal, and the
 * dialog ARIA come from the primitive instead of hand-rolled listeners.
 *
 * The panel content is singleton DOM that ships in the page's hidden #dialog-stash. The vanilla
 * modules in src/app wire its elements up by id once at startup, so the nodes must never be
 * re-created: the popup ADOPTS the stashed node while open and returns it on close, which keeps
 * every id and listener alive no matter how often the popup itself is rebuilt.
 *
 * The popup itself renders a window title bar above the adopted content: the full-width drag
 * handle for src/app/dialogSnap.js (moving and docking the window) plus a close button. It is
 * React-owned and never touched by the vanilla modules, so re-rendering it is safe.
 */
function AppDialog({name, title, divId, contentId, labelledBy, initialFocusId, active, overlayState, docked, onOpened}) {
    // Stable identity: React re-invokes a changed callback ref on every render, which would
    // bounce the adopted content through the stash and re-announce the open to the snap module.
    const adoptContent = useCallback(popupElement => {
        if (popupElement === null) {
            return undefined;
        }
        const content = document.getElementById(contentId);
        popupElement.appendChild(content);
        onOpened(popupElement);
        return () => {
            document.getElementById("dialog-stash").appendChild(content);
        };
    }, [contentId, onOpened]);

    // Every dialog is a floating window, not a modal: no focus trap, no scroll lock, no pointer
    // blocking (modal={false}), no backdrop, and no outside-press/focus-out dismissal
    // (disablePointerDismissal), so the circuit stays editable while a dialog is open, docked
    // or not. Escape and the panel's own close button still close it.
    return (
        <Dialog.Root
            open={active === name}
            onOpenChange={open => {
                if (!open) {
                    overlayState.close();
                }
            }}
            modal={false}
            disablePointerDismissal>
            <Dialog.Portal>
                <Dialog.Popup
                    id={divId}
                    className="dialog-layout"
                    data-docked={docked}
                    aria-labelledby={labelledBy}
                    initialFocus={initialFocusId === undefined ?
                        undefined :
                        () => document.getElementById(initialFocusId)}
                    ref={adoptContent}>
                    <div className="dialog-titlebar" data-snap-handle>
                        <span className="dialog-titlebar-title">{title}</span>
                        <button
                            type="button"
                            className="dialog-titlebar-close"
                            aria-label={`Close ${title}`}
                            title="Close"
                            onClick={() => overlayState.close()}>
                            <XIcon strokeWidth={1.5} aria-hidden="true" />
                        </button>
                    </div>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export {AppDialog};
