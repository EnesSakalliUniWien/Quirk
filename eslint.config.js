import js from "@eslint/js";
import globals from "globals";
import unicorn from "eslint-plugin-unicorn";

// The harness pages define these on window for the browser-run suites and the Puppeteer runners.
const harnessGlobals = {
  __testRunner__: "readonly",
  __error__: "readonly",
  __unstable__: "readonly",
  __any_failures: "readonly",
  __total_done: "readonly",
  __total_tests: "readonly",
};

export default [
  { ignores: ["out/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { unicorn },
    rules: {
      // Modern-syntax floor.
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "no-unused-vars": [
        "error",
        { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" },
      ],
      // Hand-rolled forms of things the platform now has. Math.hypot is deliberately not
      // among them: it is not bit-identical to sqrt(a*a + b*b), and the engine has tolerance tests.
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-array-flat": "error",
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/prefer-at": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/prefer-optional-catch-binding": "error",
      "unicorn/prefer-number-properties": "error",
    },
  },
  // Browser code, and the suites the harness pages run in the browser.
  {
    files: ["src/**", "test/**", "test_perf/**"],
    languageOptions: { globals: { ...globals.browser, ...harnessGlobals } },
  },
  // Node tooling. The Puppeteer runners and end-to-end specs also hand functions to
  // page.evaluate, which run in the browser, so they see both sets of globals.
  {
    files: [
      "scripts/**",
      "test_e2e/**",
      "vite.config.js",
      "eslint.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...harnessGlobals },
    },
  },
];
