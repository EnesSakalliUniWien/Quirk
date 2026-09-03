import {AppDialog} from "./app-dialog.jsx";

/**
 * The enlarged Bloch sphere overlay: a rotatable sphere plus the state as numbers. Its panel
 * markup ships in the page template's dialog stash and is wired up by src/app/blochSphereDialog.js.
 */
function BlochDialog({active, overlayState}) {
    return (
        <AppDialog
            name="bloch" divId="bloch-div" contentId="bloch-dialog-content"
            labelledBy="bloch-title" initialFocusId="bloch-close-button"
            active={active} overlayState={overlayState} />
    );
}

export {BlochDialog};
