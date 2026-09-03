import {AppDialog} from "./app-dialog.jsx";

/**
 * The gate forge overlay: defining a custom gate from a rotation, a matrix, or part of the current
 * circuit. Its panel markup ships in quirk.html's dialog stash and is wired up by src/ui/forge.js.
 */
function ForgeDialog({active, overlayState}) {
    return (
        <AppDialog
            name="forge" divId="gate-forge-div" contentId="forge-dialog-content"
            labelledBy="forge-title" initialFocusId="gate-forge-rotation-axis"
            active={active} overlayState={overlayState} />
    );
}

export {ForgeDialog};
