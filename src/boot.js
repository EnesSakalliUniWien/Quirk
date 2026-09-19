// Static imports evaluate in order: the scheme is chosen before main.jsx loads any theme module,
// and the app still mounts synchronously, without waiting on a dynamic import.
import './browser/selectColourScheme.js';
import './main.jsx';
