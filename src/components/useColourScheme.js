import { useSyncExternalStore } from "react";
import {
  colourScheme,
  onColourSchemeChange,
} from "../appearance/colourScheme.js";

/** Repaint presentation when its palette changes, preserving each component's local state. */
export function useColourScheme() {
  return useSyncExternalStore(onColourSchemeChange, colourScheme, colourScheme);
}
