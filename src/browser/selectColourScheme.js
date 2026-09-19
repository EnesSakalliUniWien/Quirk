import { setColourScheme } from '../appearance/colourScheme.js';
import { readColourSchemePreference, resolveColourScheme } from './colourSchemePreference.js';

// Imported by boot.js before main.jsx, so every theme module evaluates with the stored scheme.
setColourScheme(resolveColourScheme(readColourSchemePreference()));
