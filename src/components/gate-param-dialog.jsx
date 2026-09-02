import {AppDialog} from "./app-dialog.jsx";

/**
 * The gate parameter overlay: title, explanation, one text field, apply/cancel. Its panel markup
 * ships in the page template's dialog stash and is wired up by src/ui/gateParamDialog.js.
 */
function GateParamDialog({active, overlayState}) {
    return (
        <AppDialog
            name="gate-param" divId="gate-param-div" contentId="gate-param-dialog-content"
            labelledBy="gate-param-title" initialFocusId="gate-param-input"
            active={active} overlayState={overlayState} />
    );
}

export {GateParamDialog};
