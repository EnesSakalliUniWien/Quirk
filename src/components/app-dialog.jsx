import {Dialog} from "@base-ui/react/dialog";

/**
 * One overlay, wrapped in Base UI's Dialog so focus trapping, Escape, backdrop dismissal, and the
 * dialog ARIA come from the primitive instead of hand-rolled listeners.
 *
 * The panel content is singleton DOM that ships in the page's hidden #dialog-stash. The vanilla
 * modules in src/ui wire its elements up by id once at startup, so the nodes must never be
 * re-created: the popup ADOPTS the stashed node while open and returns it on close, which keeps
 * every id and listener alive no matter how often the popup itself is rebuilt.
 */
function AppDialog({name, divId, contentId, labelledBy, initialFocusId, active, overlayState}) {
    const adoptContent = popupElement => {
        if (popupElement === null) {
            return undefined;
        }
        const content = document.getElementById(contentId);
        popupElement.appendChild(content);
        return () => {
            document.getElementById("dialog-stash").appendChild(content);
        };
    };

    return (
        <Dialog.Root
            open={active === name}
            onOpenChange={open => {
                if (!open) {
                    overlayState.close();
                }
            }}
            modal>
            <Dialog.Portal>
                <Dialog.Backdrop className="dialog-overlay" />
                <Dialog.Popup
                    id={divId}
                    className="dialog-layout"
                    aria-labelledby={labelledBy}
                    initialFocus={initialFocusId === undefined ?
                        undefined :
                        () => document.getElementById(initialFocusId)}
                    ref={adoptContent} />
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export {AppDialog};
