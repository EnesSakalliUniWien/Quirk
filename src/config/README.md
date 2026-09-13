# Theme assignments

`Theme.js` defines the application's theme values: canvas colours, gate assignments, DOM
surfaces and controls, fonts, Dockview properties and Tape colours. Change values there and
reload the app. Related DOM and canvas roles read the same value; the phase legend is generated
from the same `phaseColor()` function as the scientific displays.

`browser/applyTheme.js` assigns the DOM and Dockview properties to the document before React
mounts. Floating panels and body-level popovers inherit those assignments. It also assigns the
browser colour scheme and theme-colour metadata. Stylesheets consume the assigned properties
for layout and interaction states; they do not define theme values or override a stock theme.

`CanvasTheme.js` and `Typography.js` keep the existing canvas import paths and read `Theme.js`.
The canvas, toolbox chips and drag previews use the same `gateStyle()` function. Tape keeps its
saved numeric colour indices; their presentation values come from `Theme.tape`.
