import {AppDialog} from "./app-dialog.jsx";

/**
 * The export overlay: circuit links, JSON, amplitudes, and the offline copy. Its panel markup
 * ships in quirk.html's dialog stash and is wired up by src/ui/exports.js.
 */
function ExportDialog({active, overlayState}) {
    return (
        <AppDialog
            name="export" divId="export-div" contentId="export-dialog-content"
            labelledBy="export-title" initialFocusId="export-link-copy-button"
            active={active} overlayState={overlayState} />
    );
}

export {ExportDialog};
