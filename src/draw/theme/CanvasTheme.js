import { appearanceFor } from "../../appearance/Appearance.js";
import {
  colourScheme,
  onColourSchemeChange,
} from "../../appearance/colourScheme.js";
import { colourString } from "../../appearance/formats/colour.js";

/** String-valued colours accepted by the existing drawing API; no Pixi objects are shared. */
export function canvasThemeFor(scheme) {
  const { colours } = appearanceFor(scheme);
  const groups = [
    "surface",
    "text",
    "iqp",
    "iqpText",
    "stroke",
    "gate",
    "probability",
    "amplitude",
    "operation",
    "bloch",
    "interaction",
    "error",
  ];
  return Object.freeze({
    ...Object.fromEntries(
      groups.map((group) => [
        group,
        Object.freeze(
          Object.fromEntries(
            Object.entries(colours[group]).map(([name, value]) => [
              name,
              colourString(value),
            ]),
          ),
        ),
      ]),
    ),
    transparent: colourString(colours.transparent),
  });
}

export let CanvasTheme = canvasThemeFor(colourScheme());
onColourSchemeChange(() => {
  CanvasTheme = canvasThemeFor(colourScheme());
});
