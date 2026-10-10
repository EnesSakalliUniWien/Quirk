import { setColourScheme } from "../appearance/colourScheme.js";
import { systemColourScheme } from "./systemColourScheme.js";

// Imported by boot.js before main.jsx, so the first render uses the system's scheme.
setColourScheme(systemColourScheme());

// The appearance choice an earlier version kept for the app alone; the system's is the one now.
try {
  localStorage.removeItem("shadow-quant.colour-scheme");
} catch {
  // A browser that refuses site data kept nothing to forget.
}
