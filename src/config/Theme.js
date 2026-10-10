/** Compatibility entry point for browser consumers. Shared data lives in appearance/Appearance.js. */
import { appearanceFor, colourScheme } from "../appearance/Appearance.js";
import { colourString } from "../appearance/formats/colour.js";
import { CanvasTheme } from "../draw/theme/CanvasTheme.js";
import { Typography } from "../appearance/formats/typography.js";
import { domFor } from "../browser/theme/dom.js";
import { dockPropertiesFor } from "../browser/theme/dock.js";

import { onColourSchemeChange } from "../appearance/colourScheme.js";

function themeFor(scheme) {
  const appearance = appearanceFor(scheme);
  const colorScheme = appearance.colorScheme;
  return Object.freeze({
    colorScheme,
    canvas: CanvasTheme,
    typography: Typography,
    dom: domFor(scheme),
    dockProperties: dockPropertiesFor(scheme),
    dock: Object.freeze({
      name: "shadow-quant",
      className: "dockview-theme-shadow-quant",
      colorScheme,
    }),
    tape: Object.freeze(appearance.colours.tape.map(colourString)),
  });
}

export let Theme = themeFor(colourScheme());
onColourSchemeChange(() => {
  Theme = themeFor(colourScheme());
});
export { CanvasTheme };
export { phaseColor } from "../appearance/formats/phase.js";
export { gateStyle } from "../draw/theme/gateStyle.js";
