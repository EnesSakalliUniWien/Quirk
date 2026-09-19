const STORAGE_KEY = 'shadow-quant.colour-scheme';
const PREFERENCES = ['system', 'light', 'dark'];

/** The saved choice: 'system', 'light' or 'dark'. Dark when nothing valid is saved. */
export function readColourSchemePreference() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (PREFERENCES.includes(stored)) return stored;
    } catch {
        // Private browsing or storage disabled — fall through to the default
    }
    return 'dark';
}

/** The scheme a preference shows: 'system' follows the browser, and is dark when the browser can't say. */
export function resolveColourScheme(preference) {
    if (preference !== 'system') return preference;
    try {
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

export function writeColourSchemePreference(preference) {
    try {
        localStorage.setItem(STORAGE_KEY, preference);
    } catch {
        // Silently ignore — preference is best-effort
    }
}
