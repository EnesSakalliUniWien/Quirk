# Async Functions Rewrite Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Track the checkboxes. Commits, pushes, and subagent execution are outside this plan.

**Goal:** Rewrite every function in this repository into an async function wherever JavaScript, React and PixiJS allow it, and record in the code why each remaining synchronous function stays synchronous.

**Architecture:** The rewrite runs in phases, and each phase leaves the app working and measured. Phase 0 adds guard rails: a classifier and lint rules that enforce async functions folder by folder, an async-aware test harness, and a repeatable frame-rate measurement. Phase 1 converts the simulation-to-screen path, starting from the only real asynchronous source on it, reading results back from the GPU. Phases 2 to 5 convert the rest of `src/` one folder group at a time, from the application edges inward to the math engine, and each gets its own detailed plan after the previous gate.

**Tech stack:** Existing React 19.2.8, PixiJS 8.20.1, patched @pixi/react 8.0.5, dockview-react 8.2.0, Vite 8.2.2, ESLint 10, TypeScript 7.0.2, Puppeteer 25.8.0 and WebGL2 with `EXT_color_buffer_float`. No new dependencies.

## Global constraints

- This document is a plan. No application changes are part of this planning task.
- Preserve the existing uncommitted work on branch `custom-gates`, including the change in `src/components/panels/shared/` that pauses hidden dock panels.
- Add no dependencies. TypeScript 7.0.2 ships only the `tsc` executable and no compiler API, so type-aware ESLint rules would need a second TypeScript installation. That needs separate approval.
- Keep the Google copyright and Apache headers in modified existing files.
- Keep `@pixi/react` pinned to 8.0.5 with its tracked patch and postinstall enforcement.
- React components, hooks, constructors, getters, setters and the other categories under "Functions that stay synchronous" remain synchronous. They start async work and receive its results; they never await.
- An async result never replaces a newer one. Every async publisher uses a run token (`LatestRun`) or a one-at-a-time runner (`CooldownThrottle`, `useAsyncResult`).
- An event handler calls `preventDefault()`, `stopPropagation()` and `setPointerCapture()` before its first `await`.
- A promise that nothing awaits ends in `.catch(...)` that reports through `reportRecoveredError`, unless the page's unhandled-rejection reporting is the intended handler.
- Painting and decorative randomness keep their order. Never paint, or draw from a `RestartableRng`, inside `Promise.all`.
- A simulation's GPU commands, from `collectCircuitStatsTextures` until its readback is queued, contain no `await`. Another simulation interleaving there would share the texture pool mid-run.
- Every task ends with `npm run lint` and the tests it names. From Task 1 on, `npm run test:async-rules` passes too. Every phase ends with `npm run check` and a gate measurement.

## What async functions can and cannot change here

An async function still runs on the main thread. Awaiting splits one task into several, so input and painting can run between the parts. It does not move work to another thread, and it does not make work cheaper.

Measured on 16 and 17 September 2026 with the teleportation example:

| Setup | Frames per second | Where the main thread went |
|---|---|---|
| Production build, Algebra panel open | 7 | 100% busy, 65% of it in `useMatrixLayout` measuring layout |
| Dev server, Algebra panel open | 2 | `useMatrixLayout` 41%, including `getBoundingClientRect` 31%; MathML matrices 14%; `readPixels` 5%; `circuitAlgebra` 4.5% |
| Dev server, Algebra panel mounted behind Probabilities | 75 | 50% busy, after the uncommitted change that pauses hidden panels |

Async functions can remove two of those costs from long tasks. Phase 1 stops `readPixels` from blocking on the GPU, and it splits the Algebra and Probabilities panels' per-step simulations into separate tasks. Async functions cannot change the layout measurement or the MathML rendering, which are most of the Algebra panel's cost. Those need a change to `useMatrixLayout` and the step cards, which is outside this plan.

Awaiting also costs time on every call. Measured with Node 24.10.0 and the repository's own `Complex` and `Matrix`, over two rounds:

| Work | Synchronous | Every call awaited |
|---|---|---|
| 1,000,000 calls to `Complex.plus` | 5–8 ms | 41–44 ms |
| 20 products of 32×32 matrices | 2–3 ms | 99–100 ms |

**Recommendation:** Execute Phase 0 and Phase 1, then decide at Gate 1 with the measurements it records. Phases 3 to 5 put awaits on the drawing and math code that runs every frame, where the table above predicts slower frames. Their performance goals in `test_perf/` are the stop signal.

## Inventory at planning time

`scripts/async/inventory.js` from Task 1 counts 3,158 functions in 403 files under `src/`:

| Classification | Functions | What happens to them |
|---|---|---|
| Convertible: ordinary function | 1,681 | Become async functions |
| Convertible: JSX event handler | 137 | Become async functions |
| Convertible: fire-and-forget callback | 84 | Become async functions with a rejection handler |
| Restructure: iteration callback | 444 | Stay synchronous unless they need to await; then the loop becomes `for...of`, or `Promise.all` over `map` for independent work |
| Review: callback to another function | 458 | Follow their receiver, and become async when the receiver awaits them |
| Review: generator | 4 | Stay generators unless their consumer becomes async |
| Blocked: React synchronous callback | 122 | Stay synchronous |
| Blocked: React component | 96 | Stay synchronous |
| Blocked: constructor | 56 | Stay synchronous |
| Blocked: protocol method | 30 | Stay synchronous |
| Blocked: React hook | 19 | Stay synchronous |
| Blocked: getter or setter | 12 | Stay synchronous |
| Blocked: Pixi draw callback | 1 | Stays synchronous |
| Already async | 14 | Unchanged |

The classifier sees syntax, not callers. A name-based call graph estimates that 280 to 540 of the 1,902 convertible functions run while React renders or while Pixi's reconciler applies props. Each of those gets its result computed ahead of render, or an `async-exempt` comment.

`test/` and `test_perf/` hold another 1,770 functions in 155 files, 99 of them async already.

| Phase | Folders | Files | Functions | Convertible |
|---|---|---|---|---|
| 2 | `src/app` except `canvas`; `src/components`; `src/results`; `src/browser`; `src/diagnostics`; `src/state`; `Revision.js`, `Obs.js`, `valueStore.js` and `CooldownThrottle.js` in `src/base` | 125 | 1,064 | 588 |
| 3 | `src/draw`; `src/editor`; `src/app/canvas`; `src/appearance`; `src/geometry` | 85 | 725 | 487 |
| 4 | `src/circuit`; `src/gates`; `src/serialization`; `src/config`; `src/resources` | 82 | 785 | 381 |
| 5 | the rest of `src/engine` and `src/base` | 58 | 584 | 446 |

Phase 1 converts the functions its tasks name, across these folders. Their folders' remaining functions wait for their own phase.

## Execution preflight

- [ ] Recheck the working tree, `package.json`, `package-lock.json`, `.nvmrc`, the Node and npm versions, and the test runners before the first edit. At planning time Node was 24.10.0 and npm 11.6.0; `.nvmrc` names 22.12.0 and `engines` allows `>=22.12.0`.
- [ ] Run `npm run check` as the baseline and record its counts. On 16 September 2026, `npm test` completed 809 of 809 tests and `npm run test:e2e` completed 82 of 82.

---

## Phase 0: Guard rails

### Task 1: Classify every function and lint the rewrite

**Create:** `scripts/async/classify.js`, `scripts/async/eslint-plugin.js`, `scripts/async/eslint-plugin.test.js`, `scripts/async/inventory.js`, `scripts/async/async-names.json` (generated).

**Modify:** `eslint.config.js`, `package.json`, `CONTRIBUTING.md`.

**Test:** `scripts/async/eslint-plugin.test.js` (ESLint `RuleTester`, run by Node).

**Interfaces:**

- `classifyFunction(node) -> {kind, name, reason}` in `classify.js`, where `kind` is `"async"`, `"convertible"`, `"blocked"`, `"restructure"` or `"review"`. It also exports `calleeName(call)`, `functionName(node)` and `ITERATION_METHODS`.
- ESLint plugin `quirk-async` with rules `require-async`, `no-async-iteration-callback` and `await-async-calls`. The last takes `{asyncOnly: string[]}` and otherwise reads `async-names.json`.
- `ASYNC_COMPLETE` in `eslint.config.js`: the folder globs whose rewrite is done. Every later task that finishes a folder appends its glob.
- The comment `// async-exempt: <reason>`, directly before a function, keeps `require-async` quiet for that function. An empty reason does not count.
- npm scripts `test:async-rules` and `async:inventory`.

- [ ] **Step 1: Write the rule tests**

```js
// scripts/async/eslint-plugin.test.js
import {RuleTester} from "eslint";
import plugin from "./eslint-plugin.js";

const tester = new RuleTester({
    languageOptions: {ecmaVersion: "latest", sourceType: "module", parserOptions: {ecmaFeatures: {jsx: true}}},
});

tester.run("require-async", plugin.rules["require-async"], {
    valid: [
        "async function load() {}",
        "class Take { constructor() {} get size() { return 1; } set size(v) {} toString() { return ''; } }",
        "function Panel() { return <div />; }",
        "function Scene() { return createElement('pixiContainer'); }",
        "function useSample() { return 1; }",
        "useEffect(() => {}, []);",
        "useMemo(() => 1, []);",
        "[1, 2].map(x => x * 2);",
        "const shape = {draw: graphics => graphics.clear()};",
        "items.reduce((sum, x) => sum + x, 0);",
        "// async-exempt: Pixi's reconciler reads the result synchronously\nfunction paint() {}",
        "/** Paints. */\n// async-exempt: called while React renders\nexport function label() {}",
        "class Take {\n    // async-exempt: a zustand selector\n    pick() {}\n}",
    ],
    invalid: [
        {code: "function load() {}", errors: [{messageId: "sync", data: {name: "load"}}]},
        {code: "const load = () => 1;", errors: [{messageId: "sync", data: {name: "load"}}]},
        {code: "class Recorder { save() {} }", errors: [{messageId: "sync", data: {name: "save"}}]},
        {code: "const button = <button onClick={() => save()} />;", errors: [{messageId: "sync", data: {name: "This function"}}]},
        {code: "setTimeout(() => tick(), 0);", errors: [{messageId: "sync"}]},
        {code: "// async-exempt:\nfunction load() {}", errors: [{messageId: "sync"}]},
    ],
});

tester.run("no-async-iteration-callback", plugin.rules["no-async-iteration-callback"], {
    valid: [
        "await Promise.all(items.map(async item => load(item)));",
        "await Promise.allSettled(Array.from(items, async item => load(item)));",
        "items.forEach(item => load(item));",
        "async function all(items) { for (const item of items) await load(item); }",
    ],
    invalid: [
        {code: "items.filter(async item => isReady(item));", errors: [{messageId: "asyncCallback", data: {method: "filter"}}]},
        {code: "items.forEach(async item => { await load(item); });", errors: [{messageId: "asyncCallback", data: {method: "forEach"}}]},
        {code: "const loads = items.map(async item => load(item));", errors: [{messageId: "asyncCallback", data: {method: "map"}}]},
    ],
});

tester.run("await-async-calls", plugin.rules["await-async-calls"], {
    valid: [
        {code: "async function f() { await save(); }", options: [{asyncOnly: ["save"]}]},
        {code: "function f() { return save(); }", options: [{asyncOnly: ["save"]}]},
        {code: "save().catch(report);", options: [{asyncOnly: ["save"]}]},
        {code: "store.load();", options: [{asyncOnly: ["save"]}]},
    ],
    invalid: [
        {code: "save();", options: [{asyncOnly: ["save"]}], errors: [{messageId: "floating", data: {name: "save"}}]},
        {code: "recorder.save(takes);", options: [{asyncOnly: ["save"]}], errors: [{messageId: "floating", data: {name: "save"}}]},
    ],
});

console.log("quirk-async rules: all cases pass.");
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node scripts/async/eslint-plugin.test.js`
Expected: exits with an error, `ERR_MODULE_NOT_FOUND`, for `scripts/async/eslint-plugin.js`.

- [ ] **Step 3: Write the classifier**

```js
// scripts/async/classify.js
/**
 * Whether a function can be an async function, and if it cannot, why. The ESLint rules in
 * eslint-plugin.js and the report in inventory.js share this one definition, so the lint gate and
 * the counts never disagree. Nodes must carry `parent` links, as ESLint's do.
 */

/** Array and iterable methods that use their callback's return value synchronously. */
export const ITERATION_METHODS = new Set(["map", "filter", "reduce", "reduceRight", "some", "every",
    "find", "findIndex", "findLast", "findLastIndex", "sort", "toSorted", "flatMap", "forEach", "from"]);

/** React APIs that call their function argument during render or use its return value directly. */
const REACT_SYNC_CALLEES = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect", "useMemo",
    "useState", "useReducer", "useSyncExternalStore", "useImperativeHandle", "useStore", "useShallow",
    "startTransition", "flushSync", "createContext", "forwardRef", "memo"]);

/** Methods that the runtime, or a synchronous equality callback, calls and uses the result of directly. */
const PROTOCOL_METHODS = new Set(["toString", "valueOf", "toJSON", "isEqualTo", "equals", "hashCode", "describe"]);

/** Receivers that ignore a callback's return value, so the callback may return a promise. */
const FIRE_AND_FORGET_CALLEES = new Set(["requestAnimationFrame", "setTimeout", "setInterval", "queueMicrotask",
    "addEventListener", "subscribe", "then", "catch", "finally", "observe", "onDidVisibilityChange",
    "onDidLayoutChange", "useCallback"]);

/** @returns {undefined|string} The name a call's callee is known by: `f` for f() and x.f(). */
export function calleeName(call) {
    const callee = call.callee;
    if (callee.type === "Identifier") return callee.name;
    if (callee.type === "MemberExpression" && !callee.computed) return callee.property.name;
    return undefined;
}

/** @returns {undefined|string} The name a function is declared, assigned or keyed under. */
export function functionName(node) {
    const parent = node.parent;
    if (node.id) return node.id.name;
    switch (parent.type) {
        case "VariableDeclarator":
            return parent.id.type === "Identifier" ? parent.id.name : undefined;
        case "MethodDefinition":
        case "Property":
        case "PropertyDefinition":
            return parent.computed ? undefined : parent.key.name ?? String(parent.key.value);
        case "AssignmentExpression":
            if (parent.left.type === "Identifier") return parent.left.name;
            if (parent.left.type === "MemberExpression" && !parent.left.computed) return parent.left.property.name;
            return undefined;
        default:
            return undefined;
    }
}

/** Whether a function body makes React elements, with JSX or createElement. */
function rendersElements(fn) {
    let found = false;
    const visit = node => {
        if (found || node === null || typeof node !== "object" || typeof node.type !== "string") return;
        if (node.type === "JSXElement" || node.type === "JSXFragment" ||
                (node.type === "CallExpression" && calleeName(node) === "createElement")) {
            found = true;
            return;
        }
        for (const key of Object.keys(node)) {
            if (key === "parent") continue;
            const child = node[key];
            if (Array.isArray(child)) child.forEach(visit);
            else visit(child);
        }
    };
    visit(fn.body);
    return found;
}

/**
 * @returns {!{kind: ("async"|"convertible"|"blocked"|"restructure"|"review"), name: (undefined|string),
 *     reason: string}} async: already an async function. convertible: can become one where it stands.
 *     blocked: cannot, because a language or framework rule calls it synchronously. restructure: an
 *     iteration callback; its loop becomes for...of or Promise.all when it needs to await. review: a
 *     callback whose receiver decides; it follows its receiver.
 */
export function classifyFunction(node) {
    const name = functionName(node);
    const parent = node.parent;
    const result = (kind, reason) => ({kind, name, reason});
    if (node.async) return result("async", "async function");
    if (node.generator) return result("review", "generator");
    const holder = parent.type === "MethodDefinition" || (parent.type === "Property" && parent.value === node) ?
        parent : undefined;
    if (holder?.kind === "constructor") return result("blocked", "constructor");
    if (holder?.kind === "get" || holder?.kind === "set") return result("blocked", "getter or setter");
    if (holder?.computed && holder.key.type === "MemberExpression" && holder.key.object.name === "Symbol") {
        return result("blocked", "protocol method");
    }
    if (name !== undefined && /^use[A-Z]/.test(name)) return result("blocked", "React hook");
    if (name !== undefined && /^[A-Z]/.test(name) && rendersElements(node)) return result("blocked", "React component");
    if (name !== undefined && PROTOCOL_METHODS.has(name)) return result("blocked", "protocol method");
    if (parent.type === "Property" && parent.value === node && !parent.computed && parent.key.name === "draw") {
        return result("blocked", "Pixi draw callback");
    }
    const call = parent.type === "CallExpression" && parent.arguments.includes(node) ? parent : undefined;
    const callee = call === undefined ? undefined : calleeName(call);
    if (REACT_SYNC_CALLEES.has(callee)) return result("blocked", "React synchronous callback");
    if (ITERATION_METHODS.has(callee)) return result("restructure", "iteration callback");
    if (parent.type === "JSXExpressionContainer") return result("convertible", "JSX event handler");
    if (FIRE_AND_FORGET_CALLEES.has(callee)) return result("convertible", "fire-and-forget callback");
    if (call !== undefined) return result("review", "callback to another function");
    return result("convertible", "ordinary function");
}
```

- [ ] **Step 4: Write the rules**

```js
// scripts/async/eslint-plugin.js
import {existsSync, readFileSync} from "node:fs";
import {ITERATION_METHODS, calleeName, classifyFunction} from "./classify.js";

/**
 * Rules for the async functions rewrite (docs/superpowers/plans/2026-09-17-async-functions.md).
 *
 * require-async reports a synchronous function that could be an async function. A function that
 * must stay synchronous for a reason the classifier cannot see carries a comment directly before it:
 *     // async-exempt: <the reason>
 * no-async-iteration-callback reports an async callback whose promise an iteration method would
 * treat as a value, such as a truthy filter predicate.
 * await-async-calls reports a statement that calls an async function and drops its promise.
 */

const NAMES_FILE = new URL("./async-names.json", import.meta.url);
const EXEMPTION = /^\s*async-exempt:\s*\S/;

function loadAsyncOnlyNames() {
    return existsSync(NAMES_FILE) ? JSON.parse(readFileSync(NAMES_FILE, "utf8")).asyncOnly : [];
}

/** The node a leading comment for this function sits before. */
function commentTarget(node) {
    let target = node;
    const parent = node.parent;
    if (["MethodDefinition", "Property", "PropertyDefinition"].includes(parent.type)) target = parent;
    else if (parent.type === "VariableDeclarator") target = parent.parent;
    if (target.parent?.type === "ExportNamedDeclaration" || target.parent?.type === "ExportDefaultDeclaration") {
        target = target.parent;
    }
    return target;
}

const functionVisitors = check => ({FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check});

const requireAsync = {
    meta: {
        type: "suggestion",
        docs: {description: "Require async functions wherever JavaScript, React and PixiJS allow them"},
        messages: {sync: "{{name}} can be an async function. Make it async, or explain why not in a comment before it: // async-exempt: <reason>"},
        schema: [],
    },
    create(context) {
        const sourceCode = context.sourceCode;
        return functionVisitors(node => {
            const verdict = classifyFunction(node);
            if (verdict.kind !== "convertible") return;
            if (sourceCode.getCommentsBefore(commentTarget(node)).some(comment => EXEMPTION.test(comment.value))) return;
            context.report({node, messageId: "sync", data: {name: verdict.name ?? "This function"}});
        });
    },
};

const isPromiseAllArgument = call => {
    const outer = call.parent;
    return outer.type === "CallExpression" && outer.arguments[0] === call &&
        outer.callee.type === "MemberExpression" && outer.callee.object.type === "Identifier" &&
        outer.callee.object.name === "Promise" && ["all", "allSettled"].includes(outer.callee.property.name);
};

const noAsyncIterationCallback = {
    meta: {
        type: "problem",
        docs: {description: "Disallow async callbacks whose promise an iteration method uses as a value"},
        messages: {asyncCallback: "{{method}} uses this callback's return value synchronously, and a promise is always truthy. Use a for...of loop with await, or Promise.all over map."},
        schema: [],
    },
    create(context) {
        return functionVisitors(node => {
            if (!node.async || node.parent.type !== "CallExpression" || !node.parent.arguments.includes(node)) return;
            const method = calleeName(node.parent);
            if (!ITERATION_METHODS.has(method)) return;
            if ((method === "map" || method === "from") && isPromiseAllArgument(node.parent)) return;
            context.report({node, messageId: "asyncCallback", data: {method}});
        });
    },
};

const awaitAsyncCalls = {
    meta: {
        type: "problem",
        docs: {description: "Disallow statements that call an async function and drop its promise"},
        messages: {floating: "{{name}}() returns a promise that nothing awaits. Await it, return it, or chain .catch to handle its rejection."},
        schema: [{
            type: "object",
            properties: {asyncOnly: {type: "array", items: {type: "string"}}},
            additionalProperties: false,
        }],
    },
    create(context) {
        const asyncOnly = new Set(context.options[0]?.asyncOnly ?? loadAsyncOnlyNames());
        return {
            "ExpressionStatement > CallExpression"(call) {
                const name = calleeName(call);
                if (name !== undefined && asyncOnly.has(name)) context.report({node: call, messageId: "floating", data: {name}});
            },
        };
    },
};

export default {
    meta: {name: "quirk-async"},
    rules: {
        "require-async": requireAsync,
        "no-async-iteration-callback": noAsyncIterationCallback,
        "await-async-calls": awaitAsyncCalls,
    },
};
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `node scripts/async/eslint-plugin.test.js`
Expected: `quirk-async rules: all cases pass.`

- [ ] **Step 6: Write the inventory**

```js
// scripts/async/inventory.js
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import path from "node:path";
import {Linter} from "eslint";
import {classifyFunction} from "./classify.js";

/**
 * Reports how far the async functions rewrite has come, per folder, using the same classifier as
 * the lint rules. With --write-names it also regenerates async-names.json, the names that are only
 * ever async functions, which await-async-calls checks statements against.
 *
 * Usage: node scripts/async/inventory.js [--write-names] [folder ...]   (default folders: src)
 */

const root = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const folders = args.filter(arg => !arg.startsWith("--"));

function* sourceFiles(dir) {
    for (const entry of readdirSync(dir).sort()) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) yield* sourceFiles(full);
        else if (/\.jsx?$/.test(entry)) yield full;
    }
}

const rows = [];
let currentFile;
const collect = {
    create: () => {
        const record = node => rows.push({file: currentFile, line: node.loc.start.line, ...classifyFunction(node)});
        return {FunctionDeclaration: record, FunctionExpression: record, ArrowFunctionExpression: record};
    },
};
const linter = new Linter({configType: "flat", cwd: root});
const config = [{
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: {ecmaVersion: "latest", sourceType: "module", parserOptions: {ecmaFeatures: {jsx: true}}},
    plugins: {inventory: {rules: {collect}}},
    rules: {"inventory/collect": "error"},
}];
let fileCount = 0;
for (const folder of folders.length === 0 ? ["src"] : folders) {
    for (const file of sourceFiles(path.join(root, folder))) {
        currentFile = path.relative(root, file);
        fileCount++;
        const fatal = linter.verify(readFileSync(file, "utf8"), config, {filename: file}).find(message => message.fatal);
        if (fatal) throw new Error(`${currentFile}:${fatal.line}: ${fatal.message}`);
    }
}

const tally = (list, keyOf) => [...list.reduce((map, row) => map.set(keyOf(row), (map.get(keyOf(row)) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]);
console.log(`${rows.length} functions in ${fileCount} files`);
for (const [key, count] of tally(rows, row => `${row.kind.padEnd(12)} ${row.reason}`)) {
    console.log(`${String(count).padStart(6)}  ${key}`);
}
const remaining = rows.filter(row => row.kind === "convertible");
if (remaining.length > 0) {
    console.log("\nSynchronous functions that can be async functions, by folder:");
    for (const [folder, count] of tally(remaining, row => row.file.split("/").slice(0, 3).join("/"))) {
        console.log(`${String(count).padStart(6)}  ${folder}`);
    }
}

if (args.includes("--write-names")) {
    const kinds = new Map();
    for (const row of rows) {
        if (row.name !== undefined) kinds.set(row.name, [...(kinds.get(row.name) ?? []), row.kind]);
    }
    const asyncOnly = [...kinds].filter(([, list]) => list.every(kind => kind === "async")).map(([name]) => name).sort();
    writeFileSync(new URL("./async-names.json", import.meta.url), JSON.stringify({asyncOnly}, null, 2) + "\n");
    console.log(`\nWrote ${asyncOnly.length} async-only names to scripts/async/async-names.json.`);
}
```

- [ ] **Step 7: Add the npm scripts**

In `package.json`, add these two entries to `scripts`, and put `npm run test:async-rules` into `check` after `npm run lint`:

```json
"test:async-rules": "node scripts/async/eslint-plugin.test.js",
"async:inventory": "node scripts/async/inventory.js",
"check": "npm run lint && npm run test:async-rules && npm run knip && npm run test && npm run test:e2e && npm run test:perf",
```

- [ ] **Step 8: Generate the names and check the counts**

Run: `npm run async:inventory -- --write-names src test test_perf`
Expected: the first line reads `4928 functions in 558 files`, and the last reads `Wrote 20 async-only names to scripts/async/async-names.json.`

Run: `npm run async:inventory`
Expected: `3158 functions in 403 files`, with the counts in this plan's inventory table. If the working tree has changed since planning, update that table from this output.

- [ ] **Step 9: Register the plugin**

```diff
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -1,6 +1,7 @@
 import js from "@eslint/js";
 import globals from "globals";
 import unicorn from "eslint-plugin-unicorn";
+import quirkAsync from "./scripts/async/eslint-plugin.js";
 
 // The harness pages define these on window for the browser-run suites and the Puppeteer runners.
 const harnessGlobals = {
@@ -12,6 +13,10 @@
   __total_tests: "readonly",
 };
 
+// Folders whose async functions rewrite is complete (docs/superpowers/plans/2026-09-17-async-functions.md).
+// Each phase adds its folders; require-async then keeps them async.
+const ASYNC_COMPLETE = [];
+
 export default [
   { ignores: ["out/**", "node_modules/**"] },
   js.configs.recommended,
@@ -63,4 +68,18 @@
       globals: { ...globals.node, ...globals.browser, ...harnessGlobals },
     },
   },
+  // Promise misuse that types cannot catch, everywhere.
+  {
+    files: ["**/*.{js,jsx}"],
+    plugins: { "quirk-async": quirkAsync },
+    rules: {
+      "quirk-async/no-async-iteration-callback": "error",
+      "quirk-async/await-async-calls": "error",
+    },
+  },
+  ...(ASYNC_COMPLETE.length === 0 ? [] : [{
+    files: ASYNC_COMPLETE,
+    plugins: { "quirk-async": quirkAsync },
+    rules: { "quirk-async/require-async": "error" },
+  }]),
 ];
```

- [ ] **Step 10: Lint the repository**

Run: `npm run lint`
Expected: no findings. At planning time the code had no async iteration callbacks and dropped no promise from an async-only name.

- [ ] **Step 11: Confirm `require-async` reports a finished folder**

Temporarily set `const ASYNC_COMPLETE = ["src/app/state/**"];` and run `npm run lint -- src/app/state`.
Expected: 53 `quirk-async/require-async` findings. Set `ASYNC_COMPLETE` back to `[]`.

- [ ] **Step 12: Document the checks**

In `CONTRIBUTING.md`, replace `lints, runs knip, then builds each page` with `lints, tests the async lint rules, runs knip, then builds each page`. After the `npm run typecheck` bullet, add:

```markdown
- `npm run async:inventory` — reports how many functions under `src/` are async functions, can
  become async functions, or must stay synchronous, by folder. `--write-names src test test_perf`
  also regenerates `scripts/async/async-names.json`, which the `quirk-async/await-async-calls`
  lint rule reads. A function that must stay synchronous for a reason the classifier cannot see
  carries `// async-exempt: <reason>` directly before it.
```

In the paragraph that begins `` `scripts/` holds the Node tooling``, after `` `screenshot-circuit.js` renders the README screenshot.``, add: `` `async/` holds the function classifier, the `quirk-async` ESLint rules and the inventory report.``

- [ ] **Step 13: Run the static checks**

Run: `npm run lint && npm run test:async-rules && npm run knip`
Expected: all three pass.

### Task 2: Let WebGL tests and performance goals await

**Create:** `test/TestUtil.test.js`.

**Modify:** `test/TestUtil.js`, `test_perf/TestPerfUtil.js`.

**Interfaces:**

- Produces: `Suite.testUsingWebGL(name, method)` accepts an async `method` and counts unreturned textures after it settles. It still warns about a WebGL test without assertions.
- Produces: `perfGoal(name, target, method, arg, cleanup)` accepts an async `method` and times it including its awaits.

- [ ] **Step 1: Write the failing test**

```js
// test/TestUtil.test.js
import {Suite, assertThat} from "./TestUtil.js";
import {WglTexturePool} from "../src/engine/webgl/texture/WglTexturePool.js";

const suite = new Suite("TestUtil");

suite.testUsingWebGL("a WebGL test's textures are counted after its async work finishes", async () => {
    const texture = WglTexturePool.takeRawFloatTex(0);
    await new Promise(resolve => setTimeout(resolve, 0));
    texture.deallocByDepositingInPool("TestUtil async WebGL test");
    assertThat(texture.width).isEqualTo(1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: `FAILED: TestUtil a WebGL test's textures are counted after its async work finishes`, with `Error: Unreturned textures.`

- [ ] **Step 3: Await the test method in the harness**

```diff
--- a/test/TestUtil.js
+++ b/test/TestUtil.js
@@ -386,7 +386,7 @@
      * @param {!function(!{ warn_only: !boolean|!string })} method
      */
     testUsingWebGL(name, method) {
-        this.test(name, status => {
+        this.test(name, async status => {
             const caseName = name;
             if (!isWebGLSupportPresent()) {
                 const msg = `Skipping ${this.name}.${caseName} due to lack of WebGL support.`;
@@ -397,7 +397,7 @@
             }
 
             const preTexCount = WglTexturePool.getUnReturnedTextureCount();
-            method(status);
+            await method(status);
             const gain = WglTexturePool.getUnReturnedTextureCount() - preTexCount;
             if (gain > 0) {
                 throw new DetailedError("Unreturned textures.", {unreturned_increase: gain});
@@ -405,6 +405,9 @@
             if (gain < 0) {
                 throw new DetailedError("Extra returned textures.", {extra_returns: -gain});
             }
+            if (assertionSubjectIndexForNextTest === 1) {
+                console.warn(`No assertions in test '${name}' of suite '${this.name}'.`);
+            }
 
             status.wasWebGLTest = true;
         });
```

- [ ] **Step 4: Await performance goals**

```diff
--- a/test_perf/TestPerfUtil.js
+++ b/test_perf/TestPerfUtil.js
@@ -34,8 +34,8 @@
  * @param {!function(*):void} cleanup
  */
 function perfGoal(name, targetDuration, method, arg=undefined, cleanup=undefined) {
-    _knownPerfTests.push({name, method: () => {
-        const dt = _measureDuration(method, arg, targetDuration.duration_nanos);
+    _knownPerfTests.push({name, method: async () => {
+        const dt = await _measureDuration(method, arg, targetDuration.duration_nanos);
         if (cleanup !== undefined) {
             cleanup(arg);
         }
@@ -68,17 +68,17 @@
     return '#'.repeat(n) + ' '.repeat(length - n);
 }
 
-function _measureDuration(method, arg, expected_nanos_hint) {
+async function _measureDuration(method, arg, expected_nanos_hint) {
     const ms = 1.0e6;
     const repeats = expected_nanos_hint < 5 * ms ? 100 :
         expected_nanos_hint < 30 * ms ? 50 :
         10;
     // Dry run to get any one-time initialization done.
-    method(arg);
+    await method(arg);
 
     const t0 = window.performance.now();
     for (let i = 0; i < repeats; i++) {
-        method(arg);
+        await method(arg);
     }
     const t1 = window.performance.now();
     return {duration_nanos: (t1 - t0) / repeats * ms};
```

- [ ] **Step 5: Run the suites**

Run: `npm test`
Expected: every test passes, one more than the baseline.

Run: `npm run test:perf`
Expected: the same goals pass as in the baseline.

### Task 3: Measure the example the same way at every gate

**Create:** `scripts/profile-example.js`.

**Modify:** `package.json`, `CONTRIBUTING.md`.

**Interfaces:**

- Produces: `npm run profile -- "<example name>" [action ...] [--seconds=5] [--url=<origin>]`. An action `#id` clicks that element, and `play` presses Play. It prints frames per second, frame intervals, long tasks, main-thread busy share and the busiest functions.

- [ ] **Step 1: Write the script**

```js
// scripts/profile-example.js
import path from "node:path";

import puppeteer from "puppeteer";

import { preview } from "vite";

/**
 * Loads an example circuit in a visible Chrome window, performs the given actions, and reports the
 * frame rate, long tasks and busiest functions over a few seconds. The window has to be visible: a
 * hidden or background page throttles its frames, and would measure the throttling instead.
 *
 * Usage: node scripts/profile-example.js "<example name>" [action ...] [--seconds=5] [--url=<origin>]
 *   An action "#some-id" clicks that element, such as a toolbar panel button; "play" presses Play.
 *   Without --url the build in out/ is served, so run npm run build first.
 */

const args = process.argv.slice(2);
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const [example, ...actions] = args.filter(arg => !arg.startsWith("--"));
if (example === undefined) {
  console.error('Usage: node scripts/profile-example.js "<example name>" [action ...] [--seconds=5] [--url=<origin>]');
  process.exit(2);
}
const seconds = Number(option("seconds", "5"));

let server;
let browser;
try {
  let url = option("url", undefined);
  if (url === undefined) {
    server = await preview({
      root: path.join(import.meta.dirname, ".."),
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
    url = server.resolvedUrls.local[0];
  }
  browser = await puppeteer.launch({ headless: false, args: ["--window-size=1600,1000"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 880 });
  page.on("pageerror", (error) => console.error("Page error: " + error.message));
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#examples-button", { timeout: 30000 });
  await page.click("#examples-button");
  const item = await page.waitForSelector(`::-p-xpath(//*[@role="menuitem"][normalize-space()="${example}"])`);
  await item.click();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const action of actions) {
    await (action === "play" ? page.click("#playhead-play-button") : page.click(action));
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  await page.evaluate(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__longTasks.push(entry.duration);
    }).observe({ type: "longtask" });
  });
  const cdp = await page.createCDPSession();
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
  await cdp.send("Profiler.start");
  const intervals = await page.evaluate((ms) => new Promise((resolve) => {
    const gaps = [];
    const start = performance.now();
    let last = start;
    const tick = (now) => {
      gaps.push(now - last);
      last = now;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve(gaps.slice(1));
    };
    requestAnimationFrame(tick);
  }), seconds * 1000);
  const { profile } = await cdp.send("Profiler.stop");
  const longTasks = await page.evaluate(() => window.__longTasks);

  const sorted = [...intervals].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? NaN;
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
  const total = profile.endTime - profile.startTime;
  const selfTime = new Map();
  profile.samples.forEach((id, i) => selfTime.set(id, (selfTime.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const label = (node) => `${node.callFrame.functionName || "(anonymous)"} ${node.callFrame.url.replace(/^https?:\/\/[^/]+\//, "").replace(/\?.*$/, "")}:${node.callFrame.lineNumber + 1}`;
  const inclusive = new Map();
  let idle = 0;
  for (const [id, time] of selfTime) {
    if (nodes.get(id).callFrame.functionName === "(idle)") idle += time;
    const counted = new Set();
    for (let at = id; at !== undefined; at = parents.get(at)) {
      const key = label(nodes.get(at));
      if (!counted.has(key)) {
        counted.add(key);
        inclusive.set(key, (inclusive.get(key) ?? 0) + time);
      }
    }
  }

  console.log(`${example}${actions.length === 0 ? "" : ", " + actions.join(", ")}, ${seconds} s`);
  console.log(`frames per second: ${Math.round((intervals.length + 1) / seconds)}`);
  console.log(`frame interval: median ${percentile(0.5).toFixed(1)} ms, 90th percentile ${percentile(0.9).toFixed(1)} ms`);
  console.log(`long tasks: ${longTasks.length}${longTasks.length === 0 ? "" : `, longest ${Math.round(Math.max(...longTasks))} ms`}`);
  console.log(`main thread busy: ${Math.round(100 * (1 - idle / total))}%`);
  console.log("busiest functions, including what they call:");
  for (const [key, time] of [...inclusive].filter(([key]) => !/^\((root|idle|program|garbage collector)\)/.test(key))
      .sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${(100 * time / total).toFixed(1).padStart(5)}%  ${key}`);
  }
} finally {
  await browser?.close();
  await server?.close();
}
```

- [ ] **Step 2: Add the npm script and document it**

In `package.json` `scripts`, add `"profile": "node scripts/profile-example.js",`. In `CONTRIBUTING.md`, after the sentence about `screenshot-circuit.js`, add: `` `profile-example.js` loads an example in a visible Chrome window and reports its frame rate and busiest functions; it serves the build in `out/`.``

- [ ] **Step 3: Record the Gate 0 measurements**

Each run opens a Chrome window. Leave it visible and in front until the run ends: a hidden page throttles its frames.

```bash
npm run build
```

```bash
npm run profile -- "Quantum Teleportation"
```

```bash
npm run profile -- "Quantum Teleportation" "#algebra-button"
```

```bash
npm run profile -- "Quantum Teleportation" "#probabilities-button"
```

```bash
npm run profile -- "Quantum Teleportation" play
```

Expected: four reports. At planning time the second, with `--seconds=4`, read 7 frames per second, 34 long tasks, longest 152 ms, and a main thread 100% busy. Copy each report's first five lines into the Gate 0 table, and copy the `npm run test:perf` result lines under it.

### Gate 0: Baseline

| Measurement | Frames per second | Median frame interval | Long tasks | Main thread busy |
|---|---|---|---|---|
| Teleportation | | | | |
| Teleportation, Algebra panel | | | | |
| Teleportation, Probabilities panel | | | | |
| Teleportation, playing | | | | |

---

## Phase 1: The simulation-to-screen path

Reading simulation results back from the GPU is the only step on this path that waits for something outside JavaScript. Phase 1 makes that wait non-blocking, then carries async functions from it up to the redraw loop and to the panels that simulate. Tasks 4 and 5 add async versions beside the blocking ones, so every task leaves the app working. Tasks 9 and 10 delete the blocking versions and give the async ones the plain names.

### Task 4: Read GPU pixels without blocking

**Modify:** `src/engine/webgl/context/WglUtil.js`, `src/engine/webgl/texture/WglTexture.js`, `src/engine/webgl/README.md`.

**Test:** `test/engine/webgl/texture/WglTexture.test.js`.

**Interfaces:**

- Produces: `gpuFinished(gl) -> Promise<void>`, exported from `WglUtil.js`. It resolves once the GPU has run every command queued so far, polling with `clientWaitSync` between tasks.
- Produces: `WglTexture#readPixelsAsync() -> Promise<Uint8Array|Float32Array>`. The read is queued into a pixel buffer before the promise returns, so the caller may render into the texture again or return it to the pool at once.

- [ ] **Step 1: Write the failing tests**

```diff
--- a/test/engine/webgl/texture/WglTexture.test.js
+++ b/test/engine/webgl/texture/WglTexture.test.js
@@ -21,6 +21,45 @@
 
 const suite = new Suite("WglTexture");
 
+suite.testUsingWebGLFloatTextures("readPixelsAsync reads what readPixels reads, even if the texture is reused at once", async () => {
+    const shader = new WglShader(`
+        uniform float v;
+        void main() {
+            fragColor = vec4(gl_FragCoord.xy, v, 254.5);
+        }`);
+    const texture = new WglTexture(2, 2);
+    shader.withArgs(WglArg.float("v", 192.25)).renderTo(texture);
+    const expected = texture.readPixels();
+
+    const pending = texture.readPixelsAsync();
+    // Overwrite the texture before the queued read completes.
+    shader.withArgs(WglArg.float("v", -1)).renderTo(texture);
+
+    assertThat(await pending).isEqualTo(expected);
+    assertThat(await texture.readPixelsAsync()).isEqualTo(new Float32Array([
+        0.5, 0.5, -1, 254.5,
+        1.5, 0.5, -1, 254.5,
+        0.5, 1.5, -1, 254.5,
+        1.5, 1.5, -1, 254.5
+    ]));
+});
+
+suite.testUsingWebGL("readPixelsAsync reads bytes", async () => {
+    const shader = new WglShader(`
+        void main() {
+            vec2 xy = gl_FragCoord.xy - vec2(0.5, 0.5);
+            fragColor = vec4(xy / 255.0, 10.0/255.0, 128.0/255.0);
+        }`);
+    const texture = new WglTexture(2, 2, WebGL2RenderingContext.UNSIGNED_BYTE);
+    shader.withArgs().renderTo(texture);
+    assertThat(await texture.readPixelsAsync()).isEqualTo(new Uint8Array([
+        0, 0, 10, 128,
+        1, 0, 10, 128,
+        0, 1, 10, 128,
+        1, 1, 10, 128
+    ]));
+});
+
 suite.test("properties", () => {
     const t = new WglTexture(8, 16, WebGL2RenderingContext.UNSIGNED_BYTE);
     assertThat(t.width).isEqualTo(8);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: both new `WglTexture` tests fail with `texture.readPixelsAsync is not a function`.

- [ ] **Step 3: Add the GPU wait**

```diff
--- a/src/engine/webgl/context/WglUtil.js
+++ b/src/engine/webgl/context/WglUtil.js
@@ -88,4 +88,39 @@
     throw new Error(`gl.checkFramebufferStatus() returned 0x${code.toString(16)} (${d}).`);
 }
 
-export {checkGetErrorResult, checkFrameBufferStatusResult}
+/**
+ * Resolves once the GPU has run every command queued so far. It polls between tasks instead of
+ * blocking, so the page keeps handling input and painting while the GPU works.
+ * @param {!WebGL2RenderingContext} gl
+ * @returns {!Promise<void>}
+ */
+function gpuFinished(gl) {
+    const GL = WebGL2RenderingContext;
+    const sync = gl.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0);
+    if (sync === null) {
+        return Promise.reject(new Error("gl.fenceSync failed; the WebGL context may be lost."));
+    }
+    gl.flush();
+    return new Promise((resolve, reject) => {
+        const poll = () => {
+            if (gl.isContextLost()) {
+                reject(new Error("The WebGL context was lost while waiting for the GPU."));
+                return;
+            }
+            const status = gl.clientWaitSync(sync, 0, 0);
+            if (status === GL.TIMEOUT_EXPIRED) {
+                setTimeout(poll, 0);
+                return;
+            }
+            gl.deleteSync(sync);
+            if (status === GL.WAIT_FAILED) {
+                reject(new Error("gl.clientWaitSync failed while waiting for the GPU."));
+            } else {
+                resolve();
+            }
+        };
+        poll();
+    });
+}
+
+export {checkGetErrorResult, checkFrameBufferStatusResult, gpuFinished}
```

- [ ] **Step 4: Add the async read**

```diff
--- a/src/engine/webgl/texture/WglTexture.js
+++ b/src/engine/webgl/texture/WglTexture.js
@@ -21,6 +21,7 @@
 import {
   checkGetErrorResult,
   checkFrameBufferStatusResult,
+  gpuFinished,
 } from "../context/WglUtil.js";
 // Both of these import WglTexture back. The cycle is safe: each side only uses the other inside
 // methods, never while the modules are being evaluated.
@@ -294,7 +295,62 @@
       `readPixels(..., RGBA, ${this.pixelType}, ...)`,
       isOnHotPath,
     );
+
+    return outputBuffer;
+  }
+
+  /**
+   * Reads the pixel color data in this texture without blocking on the GPU. The read is queued into
+   * a pixel buffer before this returns its promise, so the texture may be rendered into again or
+   * returned to the pool at once: the queued read already holds the pixels as they are now.
+   * @returns {!Promise<!Uint8Array|!Float32Array>}
+   */
+  async readPixelsAsync() {
+    const GL = WebGL2RenderingContext;
+    if (!this._hasBeenRenderedTo) {
+      throw new Error(
+        "Called readPixelsAsync on a texture that hasn't been rendered to.",
+      );
+    }
+
+    let outputBuffer;
+    switch (this.pixelType) {
+      case GL.UNSIGNED_BYTE:
+        outputBuffer = new Uint8Array(this.width * this.height * 4);
+        break;
+      case GL.FLOAT:
+        outputBuffer = new Float32Array(this.width * this.height * 4);
+        break;
+      default:
+        throw new Error("Unrecognized pixel type.");
+    }
 
+    if (this.width === 0 || this.height === 0) {
+      return outputBuffer;
+    }
+
+    const gl = initializedWglContext().gl;
+    const pixelBuffer = gl.createBuffer();
+    try {
+      gl.bindFramebuffer(GL.FRAMEBUFFER, this.initializedFramebuffer());
+      checkFrameBufferStatusResult(gl, true);
+      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, pixelBuffer);
+      gl.bufferData(GL.PIXEL_PACK_BUFFER, outputBuffer.byteLength, GL.STREAM_READ);
+      gl.readPixels(0, 0, this.width, this.height, GL.RGBA, this.pixelType, 0);
+      checkGetErrorResult(gl, `readPixels into a pixel buffer (..., RGBA, ${this.pixelType}, 0)`, true);
+      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
+
+      await gpuFinished(gl);
+
+      gl.bindBuffer(GL.PIXEL_PACK_BUFFER, pixelBuffer);
+      gl.getBufferSubData(GL.PIXEL_PACK_BUFFER, 0, outputBuffer);
+      checkGetErrorResult(gl, "getBufferSubData(PIXEL_PACK_BUFFER, ...)", true);
+    } finally {
+      if (!gl.isContextLost()) {
+        gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
+        gl.deleteBuffer(pixelBuffer);
+      }
+    }
     return outputBuffer;
   }
 }
```

- [ ] **Step 5: Describe the helper in the WebGL README**

In `src/engine/webgl/README.md`, replace `│   └── WglUtil.js                gl.getError and framebuffer status checks` with `│   └── WglUtil.js                gl.getError and framebuffer status checks, and waiting for the GPU`.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all tests pass.

### Task 5: Compute circuit stats without blocking

**Modify:** `src/engine/simulation/gpu/KetTextureUtil.js`, `src/engine/simulation/CircuitStats.js`.

**Test:** `test/engine/simulation/CircuitStats.test.js`.

**Interfaces:**

- Consumes: `WglTexture#readPixelsAsync()`.
- Produces: `KetTextureUtil.tradeTextureForVec4OutputAsync(trader) -> Promise<Float32Array>` and `KetTextureUtil.mergedReadFloatsAsync(textures) -> Promise<Float32Array[]>`.
- Produces: `CircuitStats.fromCircuitAtTimeAsync(circuit, time, seed) -> Promise<CircuitStats>`. Like `fromCircuitAtTime`, it reports a failure and resolves to NaN data instead of rejecting.

- [ ] **Step 1: Write the failing parity test**

```diff
--- a/test/engine/simulation/CircuitStats.test.js
+++ b/test/engine/simulation/CircuitStats.test.js
@@ -92,6 +92,39 @@
     ['/', null]
 ]), diagram);
 
+suite.testUsingWebGL("fromCircuitAtTimeAsync gives the same stats as fromCircuitAtTime", async () => {
+    const statGate = (id, makeTextures) => new GateBuilder()
+        .setSerializedId(id)
+        .promiseHasNoNetEffectOnStateVector()
+        .setStatTexturesMaker(makeTextures)
+        .gate;
+    const withCustomStats = new CircuitDefinition(1, [
+        Gates.HalfTurns.H,
+        statGate("parity-single", () => Shaders.color(2, 3, 4, 5).toVec4Texture(0)),
+        statGate("parity-array", () => [Shaders.color(6, 7, 8, 9).toVec4Texture(0)]),
+        statGate("parity-empty", () => []),
+        Gates.PostSelectionGates.PostSelectOn
+    ].map(gate => new GateColumn([gate])));
+    const circuits = [
+        CircuitDefinition.EMPTY.withWireCount(1),
+        circuit(`--X-H---•⊕-
+                 --•-H---XX-
+                 -H--M--@---`),
+        withCustomStats,
+    ];
+    const summary = stats => ({
+        finalState: stats.finalState,
+        survival: stats.circuitDefinition.columns.map((_, col) => stats.survivalRate(col)),
+        densities: Array.from({length: stats.circuitDefinition.numWires}, (_, row) => stats.qubitDensityMatrix(Infinity, row)),
+        customStats: [...stats.customStatsEntries()],
+    });
+    for (const c of circuits) {
+        const expected = CircuitStats.fromCircuitAtTime(c, 0.1, 7);
+        const actual = await CircuitStats.fromCircuitAtTimeAsync(c, 0.1, 7);
+        assertThat(summary(actual)).isEqualTo(summary(expected));
+    }
+});
+
 suite.testUsingWebGL("empty", () => {
     const stats = CircuitStats.fromCircuitAtTime(CircuitDefinition.EMPTY.withWireCount(1), 0.1);
     assertThat(stats.finalState).isApproximatelyEqualTo(Matrix.col(1, 0));
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: `FAILED: CircuitStats fromCircuitAtTimeAsync gives the same stats as fromCircuitAtTime`, with `CircuitStats.fromCircuitAtTimeAsync is not a function`.

- [ ] **Step 3: Add the async merged read**

```diff
--- a/src/engine/simulation/gpu/KetTextureUtil.js
+++ b/src/engine/simulation/gpu/KetTextureUtil.js
@@ -54,7 +54,67 @@
 KetTextureUtil.tradeTextureForVec4Output = trader => {
     const result = currentShaderCoder().vec4.pixelsToData(trader.currentTexture.readPixels());
     trader.currentTexture.deallocByDepositingInPool("tradeTextureForVec4Output");
+    return result;
+};
+
+/**
+ * @param {!WglTextureTrader} trader
+ * @returns {!Promise<!Float32Array>}
+ */
+KetTextureUtil.tradeTextureForVec4OutputAsync = async trader => {
+    // The read is queued before the texture goes back to the pool; see WglTexture.readPixelsAsync.
+    const pixels = trader.currentTexture.readPixelsAsync();
+    trader.currentTexture.deallocByDepositingInPool("tradeTextureForVec4OutputAsync");
+    return currentShaderCoder().vec4.pixelsToData(await pixels);
+};
+
+/**
+ * Overlays the textures into one, so a group is read back with a single readback.
+ * @param {!Array.<!WglTexture>} textures
+ * @returns {!{trader: !WglTextureTrader, lengths: !Array.<!int>}}
+ */
+function overlayTextures(textures) {
+    const len = tex => tex.width === 0 ? 0 : 1 << currentShaderCoder().vec4.arrayPowerSizeOfTexture(tex);
+    const lengths = textures.map(len);
+    const totalPowerSize = Math.round(Math.log2(ceilingPowerOf2(lengths.reduce((total, n) => total + n, 0))));
+    const trader = new WglTextureTrader(Shaders.color(0, 0, 0, 0).toVec4Texture(totalPowerSize));
+    let offset = 0;
+    textures.forEach((tex, i) => {
+        if (tex.width > 0) {
+            const at = offset;
+            trader.shadeAndTrade(acc => CircuitShaders.linearOverlay(at, tex, acc));
+        }
+        offset += lengths[i];
+    });
+    return {trader, lengths};
+}
+
+/**
+ * @param {!Float32Array} combinedPixels
+ * @param {!Array.<!int>} lengths
+ * @returns {!Array.<!Float32Array>}
+ */
+function splitPixels(combinedPixels, lengths) {
+    const result = [];
+    let pixelOffset = 0;
+    for (const length of lengths) {
+        result.push(combinedPixels.subarray(pixelOffset, pixelOffset + (length << 2)));
+        pixelOffset += length << 2;
+    }
     return result;
+}
+
+/**
+ * @param {!Array.<!WglTexture>} textures The textures to read and deallocate as a group.
+ * @returns {!Promise<!Array.<!Float32Array>>}
+ */
+KetTextureUtil.mergedReadFloatsAsync = async textures => {
+    const {trader, lengths} = overlayTextures(textures);
+    const combined = KetTextureUtil.tradeTextureForVec4OutputAsync(trader);
+    for (const tex of textures) {
+        tex.deallocByDepositingInPool();
+    }
+    return splitPixels(await combined, lengths);
 };
 
 /**
```

- [ ] **Step 4: Add the async stats**

```diff
--- a/src/engine/simulation/CircuitStats.js
+++ b/src/engine/simulation/CircuitStats.js
@@ -360,8 +360,43 @@
     static _fromCircuitAtTime_noFallback(circuitDefinition, time, seed = undefined) {
         circuitDefinition = circuitDefinition.withMinimumWireCount();
         const textures = collectCircuitStatsTextures(circuitDefinition, time, seed);
-        const pixelData = readCircuitStatsPixels(textures);
+        return CircuitStats._fromPixelData(circuitDefinition, time, seed, textures.customStatsMap,
+            readCircuitStatsPixels(textures));
+    }
+
+    /**
+     * @param {!CircuitDefinition} circuitDefinition
+     * @param {!number} time
+     * @returns {!Promise<!CircuitStats>}
+     */
+    static async fromCircuitAtTimeAsync(circuitDefinition, time, seed = undefined) {
+        try {
+            return await CircuitStats._fromCircuitAtTimeAsync_noFallback(circuitDefinition, time, seed);
+        } catch (ex) {
+            reportRecoveredError(
+                `Defaulted to NaN results. Computing circuit values failed.`,
+                {circuitDefinition: Serializer.toJson(circuitDefinition)},
+                ex);
+            return CircuitStats.withNanDataFromCircuitAtTime(circuitDefinition, time);
+        }
+    }
+
+    /**
+     * @param {!CircuitDefinition} circuitDefinition
+     * @param {!number} time
+     * @returns {!Promise<!CircuitStats>}
+     */
+    static async _fromCircuitAtTimeAsync_noFallback(circuitDefinition, time, seed = undefined) {
+        circuitDefinition = circuitDefinition.withMinimumWireCount();
+        const textures = collectCircuitStatsTextures(circuitDefinition, time, seed);
+        return CircuitStats._fromPixelData(circuitDefinition, time, seed, textures.customStatsMap,
+            await readCircuitStatsPixelsAsync(textures));
+    }
 
+    /**
+     * @private
+     */
+    static _fromPixelData(circuitDefinition, time, seed, customStatsMap, pixelData) {
         const qubitDensities =
             CircuitStats._extractColumnQubitStatsFromPixelDatas(circuitDefinition, pixelData.colQubitDensities);
         const survivalRates =
@@ -371,7 +406,7 @@
             survivalRates.length === 0 ? 1 : survivalRates.at(-1));
 
         const customStatsProcessed = processCustomStats(
-            circuitDefinition, textures.customStatsMap, pixelData.customStats);
+            circuitDefinition, customStatsMap, pixelData.customStats);
         const sampleOutcomes = collectSampleOutcomes(circuitDefinition, customStatsProcessed, time, seed);
         return new CircuitStats(
             circuitDefinition,
@@ -410,11 +445,22 @@
 }
 
 /** Reads and releases the collected textures; the location map stays on the CPU. */
-function readCircuitStatsPixels({output, colQubitDensities, colNorms, customStats}) {
-    // Preserve the original readback order, including each display's texture order.
-    const pixels = KetTextureUtil.mergedReadFloats([
-        ...colNorms, ...colQubitDensities, ...customStats.flat(), output
-    ])[Symbol.iterator]();
+function readCircuitStatsPixels(textures) {
+    return splitCircuitStatsPixels(textures, KetTextureUtil.mergedReadFloats(circuitStatsReadOrder(textures)));
+}
+
+/** Like readCircuitStatsPixels, without blocking on the GPU. */
+async function readCircuitStatsPixelsAsync(textures) {
+    return splitCircuitStatsPixels(textures, await KetTextureUtil.mergedReadFloatsAsync(circuitStatsReadOrder(textures)));
+}
+
+/** The readback order, including each display's texture order. */
+function circuitStatsReadOrder({output, colQubitDensities, colNorms, customStats}) {
+    return [...colNorms, ...colQubitDensities, ...customStats.flat(), output];
+}
+
+function splitCircuitStatsPixels({colQubitDensities, colNorms, customStats}, merged) {
+    const pixels = merged[Symbol.iterator]();
     return {
         colNorms: colNorms.map(() => pixels.next().value),
         colQubitDensities: colQubitDensities.map(() => pixels.next().value),
```

- [ ] **Step 5: Run the suites**

Run: `npm test && npm run test:perf`
Expected: all tests pass, and the same performance goals pass as at Gate 0.

### Task 6: Let the redraw throttle run an async action

**Create:** `test/base/CooldownThrottle.test.js`.

**Modify:** `src/base/CooldownThrottle.js`.

**Interfaces:**

- Produces: an action that returns a `Promise` keeps the throttle running until the promise settles. Triggers during the run coalesce into one more run afterwards. A rejection still reaches the page's unhandled-rejection reporting. A synchronous action behaves as before.

- [ ] **Step 1: Write the failing test**

```js
// test/base/CooldownThrottle.test.js
import {Suite, assertThat} from "../TestUtil.js";
import {CooldownThrottle} from "../../src/base/CooldownThrottle.js";

const suite = new Suite("CooldownThrottle");

/** Polls on timers: the throttle's cooldown runs there. */
async function until(condition, timeout = 2000) {
    const start = performance.now();
    while (!condition()) {
        if (performance.now() - start > timeout) throw new Error("The condition never held.");
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

suite.test("a synchronous action runs at once", () => {
    let runs = 0;
    const throttle = new CooldownThrottle(() => { runs++; }, 1000);
    throttle.trigger();
    assertThat(runs).isEqualTo(1);
});

suite.test("an async action never overlaps itself, and triggers during it run it once more afterwards", async () => {
    let runs = 0;
    let running = 0;
    let mostAtOnce = 0;
    let release;
    const throttle = new CooldownThrottle(async () => {
        runs++;
        running++;
        mostAtOnce = Math.max(mostAtOnce, running);
        if (runs === 1) await new Promise(resolve => { release = resolve; });
        running--;
    }, 0);

    throttle.trigger();
    throttle.trigger();
    throttle.trigger();
    assertThat(runs).isEqualTo(1);

    release();
    await until(() => runs === 2 && running === 0);
    await new Promise(resolve => setTimeout(resolve, 50));
    assertThat(runs).isEqualTo(2);
    assertThat(mostAtOnce).isEqualTo(1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: `FAILED: CooldownThrottle an async action never overlaps itself, and triggers during it run it once more afterwards`, with `Got <3> but expected it to equal <1>`.

- [ ] **Step 3: Keep the throttle running until an async action settles**

```diff
--- a/src/base/CooldownThrottle.js
+++ b/src/base/CooldownThrottle.js
@@ -66,22 +66,39 @@
     // Go go go!
     this._state = "running";
     const t0 = performance.now();
+    let result;
     try {
-      this.action();
-    } finally {
-      const dt = performance.now() - t0;
-      this._cooldownStartTime =
-        performance.now() + dt * this.slowActionCooldownPumpupFactor;
-      // Were there any triggers while we were running?
-      if (this._state === "running-and-triggered") {
-        this._forceIdleTriggerAfter(this.cooldownDuration);
-      } else {
-        this._state = "idle";
-      }
+      result = this.action();
+    } catch (error) {
+      this._finishRun(t0);
+      throw error;
     }
+    if (result instanceof Promise) {
+      // An async action keeps the throttle running until it settles, so runs never overlap. A
+      // rejection still reaches the page's unhandled-rejection reporting.
+      void result.finally(() => this._finishRun(t0));
+    } else {
+      this._finishRun(t0);
+    }
   }
 
   /**
+   * @param {!number} t0 When the run started.
+   * @private
+   */
+  _finishRun(t0) {
+    const dt = performance.now() - t0;
+    this._cooldownStartTime =
+      performance.now() + dt * this.slowActionCooldownPumpupFactor;
+    // Were there any triggers while we were running?
+    if (this._state === "running-and-triggered") {
+      this._forceIdleTriggerAfter(this.cooldownDuration);
+    } else {
+      this._state = "idle";
+    }
+  }
+
+  /**
    * Asks for the action to be performed as soon as possible.
    * (No effect if the action was already requested but not performed yet.)
    */
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests pass.

### Task 7: Make the simulator, redraw loop and recorder async

**Create:** `src/base/LatestRun.js`, `test/base/LatestRun.test.js`.

**Modify:** `src/app/state/Simulator.js`, `src/app/QuirkApp.js`, `src/app/canvas/redrawLoop.js`, `src/app/state/Recorder.js`.

**Test:** `test/app/state/Simulator.test.js`, `test/app/state/Recorder.test.js`, then `npm run test:e2e`.

**Interfaces:**

- Consumes: `CircuitStats.fromCircuitAtTimeAsync`, and `CooldownThrottle` running async actions.
- Produces: `LatestRun` with `start() -> int` and `isCurrent(token) -> boolean`.
- Produces: `Simulator#simulate(circuit, phase?) -> Promise<CircuitStats>` and `Simulator#simulateAtStep(circuit, step, time) -> Promise<CircuitStats>`. A request made while an equal one is still on the GPU shares its run.
- Produces: `Simulator#evaluate(circuit, wireCount, step, publish = true) -> Promise<result>`. It publishes to `completed` only if no later publishing `evaluate` and no `restore` started after it.
- Produces: `captureCommitted() -> Promise<result>` in `QuirkApp.js`, passed to the redraw loop and the recorder.
- Produces: `Recorder#makeTake(result?) -> Promise<take>`.

- [ ] **Step 1: Write the run token test**

```js
// test/base/LatestRun.test.js
import {Suite, assertThat} from "../TestUtil.js";
import {LatestRun} from "../../src/base/LatestRun.js";

const suite = new Suite("LatestRun");

suite.test("only the run that started last is current", () => {
    const runs = new LatestRun();
    const first = runs.start();
    assertThat(runs.isCurrent(first)).isEqualTo(true);
    const second = runs.start();
    assertThat(runs.isCurrent(first)).isEqualTo(false);
    assertThat(runs.isCurrent(second)).isEqualTo(true);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: the test build fails to resolve `../../src/base/LatestRun.js`.

- [ ] **Step 3: Write the run token**

```js
// src/base/LatestRun.js
/**
 * Tells async work whether it is still the most recent of its kind, so a run that finishes late
 * never publishes over a run that started after it.
 */
class LatestRun {
    constructor() {
        /** @private */
        this._latest = 0;
    }

    /** @returns {!int} A token for a run that starts now. */
    start() {
        return ++this._latest;
    }

    /**
     * @param {!int} token
     * @returns {!boolean} Whether no run has started since the one holding the token.
     */
    isCurrent(token) {
        return token === this._latest;
    }
}

export {LatestRun};
```

- [ ] **Step 4: Await the simulator in its tests, and add the restore test**

In `test/app/state/Simulator.test.js`, replace the five tests that call `simulate` or `simulateAtStep` with these, and add the last two tests:

```js
suite.test("simulate reuses the computed stats while the circuit is unchanged", async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    // Both wires carry a gate, so withMinimumWireCount is an identity and a repeat is a cache hit.
    const c = circuit(`H-
                     -X`).withMinimumWireCount();

    const first = await sim.simulate(c);
    clock.advance(Simulation.CYCLE_DURATION_MS / 8);
    const second = await sim.simulate(c);

    // A cache hit hands back the same underlying state. A still circuit leaves the cycle where it stands.
    assertTrue(second.finalState === first.finalState);
    assertThat(second.time).isEqualTo(first.time);
});

suite.test("simulate recomputes a time-dependent circuit every call, with the transport stopped", async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`t-
                     --`);

    const first = await sim.simulate(c);
    clock.advance(Simulation.CYCLE_DURATION_MS / 8);
    const second = await sim.simulate(c);

    assertFalse(second.finalState === first.finalState);
    assertThat(second.time).isApproximatelyEqualTo(0.125);
});

suite.test("a still circuit keeps the cycle where it stands, and a spinning one resumes from there", async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const spinning = circuit(`t-
                            --`);
    const still = circuit(`H-
                         -X`);

    clock.advance(Simulation.CYCLE_DURATION_MS / 4);
    assertThat((await sim.simulate(spinning)).time).isApproximatelyEqualTo(0.25);
    clock.advance(Simulation.CYCLE_DURATION_MS / 2);
    assertThat((await sim.simulate(still)).time).isApproximatelyEqualTo(0.25);
    // The time spent on the still circuit is skipped, not jumped over.
    clock.advance(Simulation.CYCLE_DURATION_MS / 8);
    assertThat((await sim.simulate(spinning)).time).isApproximatelyEqualTo(0.375);
});

suite.test("simulateAtStep runs the truncated circuit without evicting the whole-circuit cache", async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`HX
                     --`).withMinimumWireCount();

    const whole = await sim.simulate(c);
    const atStep = await sim.simulateAtStep(c, 1, 0);
    assertThat(atStep.circuitDefinition.columns.length).isEqualTo(1);

    // The playhead's stats live in their own cache, so the full circuit is still a cache hit.
    const wholeAgain = await sim.simulate(c);
    assertTrue(wholeAgain.finalState === whole.finalState);

    // And the truncated circuit is a cache hit of its own.
    const atStepAgain = await sim.simulateAtStep(c, 1, 0);
    assertTrue(atStepAgain.finalState === atStep.finalState);
});

suite.test("simulateAtStep clamps a negative step to the empty circuit", async () => {
    const sim = new Simulator(manualClock().now);
    const c = circuit(`HX
                     --`);

    assertThat((await sim.simulateAtStep(c, -1, 0)).circuitDefinition.columns.length).isEqualTo(0);
});

suite.test("a repeat request while the first is still running shares its run", async () => {
    const sim = new Simulator(manualClock().now);
    const c = circuit(`H-
                     -X`).withMinimumWireCount();

    const [first, second] = await Promise.all([sim.simulate(c), sim.simulate(c)]);
    assertTrue(second.finalState === first.finalState);
});

suite.test("a restore during an evaluation keeps the restored result", async () => {
    const sim = new Simulator(manualClock().now);
    const restored = await sim.evaluate(circuit(`X-
                                                 --`), 2, 1, false);

    const pending = sim.evaluate(circuit(`H-
                                          --`), 2, 1);
    sim.restore(restored);
    await pending;

    assertTrue(sim.completed.getState().value === restored);
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all tests pass. Awaiting a value that is not a promise changes nothing, so the synchronous simulator still passes.

- [ ] **Step 6: Make the simulator async**

In `src/app/state/Simulator.js`, replace the `StatsCache` class with:

```js
/**
 * Holds onto the last stats computed for one circuit, so redrawing an unchanging circuit doesn't
 * re-run it on the GPU. The playhead simulates a second, truncated circuit alongside the full one,
 * and two circuits alternating through a single slot would evict each other every frame, so each
 * gets its own. The run is kept as its promise, so a request made while it is on the GPU shares it.
 */
class StatsCache {
    constructor() {
        /**
         * @type {undefined|!{circuit: !CircuitDefinition, time: !number, seed: *, stats: !Promise<!CircuitStats>}}
         * @private
         */
        this._cached = undefined;
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @returns {!Promise<!CircuitStats>}
     */
    async statsFor(circuit, time, seed) {
        circuit = circuit.withMinimumWireCount();
        const cached = this._cached;
        if (cached !== undefined && cached.circuit.isEqualTo(circuit) && cached.seed === seed &&
                (circuit.stableDuration() === Infinity || cached.time === time)) {
            return (await cached.stats).withTime(time);
        }
        const stats = CircuitStats.fromCircuitAtTimeAsync(circuit, time, seed);
        this._cached = {circuit, time, seed, stats};
        return stats;
    }
}
```

Then make `simulate` and `simulateAtStep` async functions: add `async` before each, and change each `@returns {!CircuitStats}` to `@returns {!Promise<!CircuitStats>}`. Replace `evaluate` with:

```js
    /**
     * Runs the committed circuit, as far as the playhead has run it.
     *
     * @param {!boolean=} publish Whether the result becomes the completed one. It does only if no
     *     later publishing evaluation and no restore started after this one.
     * @returns {!Promise<!Object>}
     */
    async evaluate(circuit, wireCount, step, publish = true) {
        const phase = this._phaseFor(circuit);
        step = Math.min(circuit.columns.length, Math.max(0, step));
        if (publish && this.restored?.circuit.isEqualTo(circuit) && this.restored.step === step) {
            return this.restored;
        }
        const previous = this.completed.getState().value;
        if (publish && previous?.circuit.isEqualTo(circuit) && previous.step === step &&
                previous.phase === phase && previous.seed === this.seed && previous.wireCount === wireCount) return previous;
        const seed = this.seed;
        const [fullStats, stats] = await Promise.all([
            this._wholeCircuitCache.statsFor(circuit, phase, seed),
            step === circuit.columns.length ? undefined : this.simulateAtStep(circuit, step, phase),
        ]);
        const result = {circuit, wireCount, step, phase, seed, fullStats, stats: stats ?? fullStats};
        if (publish) {
            this.restored = undefined;
            this.completed.setState({value: result});
        }
        return result;
    }
```

- [ ] **Step 7: Run the restore test to see it fail**

Run: `npm test`
Expected: `FAILED: Simulator a restore during an evaluation keeps the restored result`, because the evaluation finishes after the restore and publishes over it. The recorder tests also fail until Step 12.

- [ ] **Step 8: Publish only the latest run**

In `Simulator.js`, add `import {LatestRun} from "../../base/LatestRun.js";`. In the constructor, after `this._playheadCache = new StatsCache();` and its comment, add:

```js
        /**
         * Starts with every publishing evaluation and every restore, so a late result never
         * replaces a newer one.
         * @type {!LatestRun}
         * @private
         */
        this._publishing = new LatestRun();
```

In `restore(result)`, add `this._publishing.start();` as its first line. In `evaluate`, add `const run = publish ? this._publishing.start() : undefined;` as its first line, and change `if (publish) {` to `if (publish && this._publishing.isCurrent(run)) {`.

- [ ] **Step 9: Run the tests**

Run: `npm test`
Expected: the simulator tests pass. The recorder tests may fail until Step 12.

- [ ] **Step 10: Capture the committed circuit asynchronously**

In `src/app/QuirkApp.js`, change the import to `import {noteCircuitEdited, reportRecoveredError} from "../diagnostics/errorReporter.js"`, and replace `captureCommitted` with:

```js
    const captureCommitted = async () => {
        const circuit = fromJsonText_CircuitDefinition(revision.peekActiveCommit());
        return simulator.evaluate(circuit, circuit.numWires, playhead.step());
    };
    /** Publishes the committed circuit's results without holding up the change that asked for them. */
    const captureInBackground = () => {
        captureCommitted().catch(error => reportRecoveredError("Simulating the committed circuit failed.", {}, error));
    };
```

Replace both `if (!recorder.restoring) captureCommitted();` lines with `if (!recorder.restoring) captureInBackground();`.

- [ ] **Step 11: Await the stats in the redraw loop**

In `src/app/canvas/redrawLoop.js`, change the JSDoc line `@param {!function(): !Object} captureCommitted Captures the committed circuit, separate from a drag preview.` to `@param {!function(): !Promise<!Object>} captureCommitted Captures the committed circuit, separate from a drag preview.` Change `const redrawNow = () => {` to `const redrawNow = async () => {`. Replace the lines from `const committed = captureCommitted();` through `committed.fullStats : simulator.simulate(circuitDefinition);` with:

```js
        // The frame paints the editor state it started from, which matches the stats computed for it.
        // The throttle runs one redraw at a time, and a change during this one triggers the next.
        const committed = await captureCommitted();
        // A preview runs at the simulator's own phase, so a spinning gate held over a still circuit spins.
        const stats = committed.circuit.withMinimumWireCount().isEqualTo(circuitDefinition.withMinimumWireCount()) ?
            committed.fullStats : await simulator.simulate(circuitDefinition);
```

In the returned object, replace `redrawNow();` in `start` with `redrawThrottle.trigger();`.

- [ ] **Step 12: Await the capture in the recorder and its tests**

In `src/app/state/Recorder.js`, replace everything from `revision.beforeCommit().subscribe(() => {` through the closing brace of `makeTake` with:

```js
        revision.beforeCommit().subscribe(() => {
            if (this.suppressGhost || !this.ghostsEnabled.getState().value) return;
            // The capture reads the circuit now, before the commit lands; the take is written once simulated.
            this.makeTake().then(take => store.write([take], {ghost: true})).catch(() => {});
        });
    }
    async makeTake(result = undefined) {
        const captured = result ?? await this.capture();
        const n = this.store.items.getState().value.filter(r => !r.ghost).length + 1;
        return createTake(captured, `take ${n}`, (n - 1) % 8);
    }
```

Replace everything from `async record() {` through `const takes = [];` with:

```js
    async record() {
        return this.save([await this.makeTake()]);
    }
    async recordRun() {
        if (this.busy.getState().value) return;
        this.playhead.pause();
        // Every step records at one phase: the animation cycle stands still from the capture until the run ends.
        const releaseClock = this.simulator.holdClock();
        const checkpoint = this.revision.peekActiveCommit();
        const token = new AbortController();
        this.batch = token;
        this.busy.setState({value: true});
        try {
            const initial = await this.capture();
            const takes = [];
```

In the loop, change `const result = this.simulator.evaluate(` to `const result = await this.simulator.evaluate(`.

In `test/app/state/Recorder.test.js`, add after the `suite` declaration:

```js
/** Polls on timers: ghost takes are written once their capture has been simulated. */
async function until(condition, timeout = 2000) {
    const start = performance.now();
    while (!condition()) {
        if (performance.now() - start > timeout) throw new Error("The condition never held.");
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}
```

In "ghost captures before an edit and undo adds no ghost", replace the first `assertThat(store.items.getState().value.length).isEqualTo(1);` with `await until(() => store.items.getState().value.length === 1);`, and before the final assertion add `await new Promise(resolve => setTimeout(resolve, 50));`. In "restore retains saved outcomes without creating a ghost", after `revision.commit(JSON.stringify({cols: [["X"]]}));` add `await until(() => store.items.getState().value.length === 2);`.

- [ ] **Step 13: Run every suite**

Run: `npm run lint && npm test && npm run test:e2e`
Expected: all pass. `quirk-async/await-async-calls` reports nothing, because every new async call is awaited, returned, or ends in `.catch`.

### Task 8: Simulate panel steps without long tasks

**Create:** `src/base/yieldToBrowser.js`, `test/base/yieldToBrowser.test.js`, `src/components/useAsyncResult.js`, `test/components/useAsyncResult.test.js`.

**Modify:** `src/engine/simulation/stepAlgebra.js`, `src/components/panels/algebra/useCircuitAlgebra.js`, `src/components/panels/algebra/algebra-panel.jsx`, `src/components/panels/bloch/useCircuitSteps.js`, `src/components/panels/probabilities/probabilities-panel.jsx`.

**Test:** `test/engine/simulation/stepAlgebra.test.js`, `test/gates/prepare/PrepareGates.test.js`, then `npm run test:e2e`.

**Interfaces:**

- Consumes: `CircuitStats.fromCircuitAtTimeAsync`.
- Produces: `yieldToBrowser() -> Promise<void>`.
- Produces: `useAsyncResult(compute, inputs) -> {value, error}`, where `compute(signal) -> Promise`. One run goes at a time, only the newest inputs run next, the last value stays until the next one is ready, and unmounting aborts.
- Produces: `stateAtStep(stats, wireCount, step) -> Promise<Matrix>`.
- Produces: `circuitAlgebra(stats, wireCount, previous?, signal?) -> Promise<CircuitAlgebra>`. `CircuitAlgebra` gains `stats`, the stats it was computed from.
- Produces: `useCircuitAlgebra(stats, wireCount)` returns `undefined` until the first result, then the latest finished result.

- [ ] **Step 1: Write the helper tests**

```js
// test/base/yieldToBrowser.test.js
import {Suite, assertThat} from "../TestUtil.js";
import {yieldToBrowser} from "../../src/base/yieldToBrowser.js";

const suite = new Suite("yieldToBrowser");

suite.test("the code after it runs later, not during the call", async () => {
    let afterCall = false;
    const resumed = yieldToBrowser().then(() => afterCall);
    afterCall = true;
    assertThat(await resumed).isEqualTo(true);
});
```

```js
// test/components/useAsyncResult.test.js
import {createElement} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {Suite, assertThat} from "../TestUtil.js";
import {useAsyncResult} from "../../src/components/useAsyncResult.js";

const suite = new Suite("useAsyncResult");

/** Polls on timers: React's own scheduling runs there. */
async function until(condition, timeout = 2000) {
    const start = performance.now();
    while (!condition()) {
        if (performance.now() - start > timeout) throw new Error("The result never arrived.");
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

/** A component whose compute calls wait until the test settles them. */
function mount() {
    const root = createRoot(document.createElement("div"));
    const calls = [];
    const results = [];
    function Probe({input}) {
        results.push(useAsyncResult(signal => new Promise(resolve => calls.push({input, signal, resolve})), [input]));
        return null;
    }
    return {
        show: input => flushSync(() => root.render(createElement(Probe, {input}))),
        calls,
        latest: () => results.at(-1),
        unmount: () => root.unmount(),
    };
}

suite.test("inputs that change during a run wait for it, and only the newest runs next", async () => {
    const probe = mount();
    try {
        probe.show(1);
        probe.show(2);
        probe.show(3);
        assertThat(probe.calls.map(call => call.input)).isEqualTo([1]);

        probe.calls[0].resolve("one");
        await until(() => probe.calls.length === 2);
        assertThat(probe.calls[1].input).isEqualTo(3);
        await until(() => probe.latest().value === "one");

        probe.calls[1].resolve("three");
        await until(() => probe.latest().value === "three");
        await new Promise(resolve => setTimeout(resolve, 20));
        assertThat(probe.calls.length).isEqualTo(2);
    } finally {
        probe.unmount();
    }
});

suite.test("the last result stays until the next one is ready", async () => {
    const probe = mount();
    try {
        probe.show(1);
        probe.calls[0].resolve("one");
        await until(() => probe.latest().value === "one");
        probe.show(2);
        await until(() => probe.calls.length === 2);
        assertThat(probe.latest().value).isEqualTo("one");
        probe.calls[1].resolve("two");
        await until(() => probe.latest().value === "two");
    } finally {
        probe.unmount();
    }
});

suite.test("unmounting aborts the run under way and drops its result", async () => {
    const probe = mount();
    probe.show(1);
    const run = probe.calls[0];
    probe.unmount();
    assertThat(run.signal.aborted).isEqualTo(true);
    run.resolve("late");
    await new Promise(resolve => setTimeout(resolve, 20));
    assertThat(probe.latest().value).isEqualTo(undefined);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: the test build fails to resolve `src/base/yieldToBrowser.js` or `src/components/useAsyncResult.js`.

- [ ] **Step 3: Write the helpers**

```js
// src/base/yieldToBrowser.js
/**
 * Lets the browser handle input and paint before the rest of an async function runs. Long work
 * that awaits this between its parts runs as several short tasks instead of one long one.
 *
 * @returns {!Promise<void>}
 */
function yieldToBrowser() {
    if (globalThis.scheduler?.yield !== undefined) {
        return globalThis.scheduler.yield();
    }
    return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
        };
        channel.port2.postMessage(undefined);
    });
}

export {yieldToBrowser};
```

```js
// src/components/useAsyncResult.js
import {useEffect, useRef, useState} from "react";

/**
 * The result of async work on the latest render inputs. One run goes at a time: inputs that change
 * while a run is under way wait for it, and then only the newest of them runs, so inputs that
 * arrive faster than the work still get results. The last result stays until the next one is ready.
 * Unmounting aborts the run under way and drops its result.
 *
 * @template T
 * @param {!function(!AbortSignal): !Promise<T>} compute Reads the inputs from its own closure.
 * @param {!Array<*>} inputs Compute runs again when any of these change.
 * @returns {!{value: (undefined|T), error: *}}
 */
function useAsyncResult(compute, inputs) {
    const [result, setResult] = useState({value: undefined, error: undefined});
    const latestCompute = useRef(compute);
    latestCompute.current = compute;
    const runner = useRef({controller: new AbortController(), running: false, stale: false});

    useEffect(() => {
        const state = runner.current;
        if (state.controller.signal.aborted) state.controller = new AbortController();
        return () => state.controller.abort();
    }, []);

    useEffect(() => {
        const state = runner.current;
        state.stale = true;
        if (state.running) return;
        state.running = true;
        void (async () => {
            try {
                while (state.stale && !state.controller.signal.aborted) {
                    state.stale = false;
                    const signal = state.controller.signal;
                    try {
                        const value = await latestCompute.current(signal);
                        if (!signal.aborted) setResult({value, error: undefined});
                    } catch (error) {
                        if (!signal.aborted) setResult(previous => ({value: previous.value, error}));
                    }
                }
            } finally {
                state.running = false;
            }
        })();
        // The caller lists the inputs, as with useEffect.
    }, inputs);

    return result;
}

export {useAsyncResult};
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: the `yieldToBrowser` and `useAsyncResult` tests pass.

- [ ] **Step 5: Await the step algebra in its tests**

In `test/engine/simulation/stepAlgebra.test.js`, replace `algebraOf` with:

```js
/**
 * @param {!CircuitDefinition} circuit
 * @param {undefined|!CircuitAlgebra} previous
 * @returns {!Promise<!CircuitAlgebra>}
 */
const algebraOf = async (circuit, previous = undefined) =>
    circuitAlgebra(await CircuitStats.fromCircuitAtTimeAsync(circuit, 0), circuit.numWires, previous);
```

Make every test that calls `algebraOf` or `circuitAlgebra` an async function, and put `await` before each of those calls. Lines 82, 99 and 101 call `circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0), ...)` directly; write them as `await circuitAlgebra(await CircuitStats.fromCircuitAtTimeAsync(circuit, 0), ...)`. Do the same at `test/gates/prepare/PrepareGates.test.js` line 79.

In "the list has every state and every step, and each matrix checks out", replace line 82 with these two lines and add the assertion after them:

```js
    const algebra = await circuitAlgebra(await CircuitStats.fromCircuitAtTimeAsync(circuit, 0), 2);
    const {states, steps} = algebra;
    assertThat(algebra.stats.circuitDefinition.columns.length).isEqualTo(circuit.columns.length);
```

- [ ] **Step 6: Run the tests to see them fail**

Run: `npm test`
Expected: `FAILED: stepAlgebra the list has every state and every step, and each matrix checks out`, reading `circuitDefinition` of undefined. The other converted tests pass, because awaiting a value that is not a promise changes nothing.

- [ ] **Step 7: Simulate each step in its own task**

In `src/engine/simulation/stepAlgebra.js`, add `import {yieldToBrowser} from "../../base/yieldToBrowser.js";`. Replace `stateAtStep` with:

```js
/**
 * The state after the circuit's first `step` columns, from a truncated run of the simulator at the
 * stats' time and seed, so it is what the circuit really produces up to there.
 *
 * @param {!CircuitStats} stats The stats of the whole circuit.
 * @param {!int} wireCount
 * @param {!int} step How many columns have run, from 0 to the column count.
 * @returns {!Promise<!Matrix>}
 */
async function stateAtStep(stats, wireCount, step) {
    const circuit = stats.circuitDefinition;
    if (step >= circuit.columns.length) {
        return paddedState(stats.finalState, wireCount);
    }
    const truncated = circuit.withColumns(circuit.columns.slice(0, step));
    const truncatedStats = await CircuitStats.fromCircuitAtTimeAsync(truncated, stats.time, stats.seed);
    return paddedState(truncatedStats.finalState, wireCount);
}
```

In `circuitAlgebra`'s JSDoc, add `@param {undefined|!AbortSignal} signal Stops the work between steps once nobody wants the result.`, change `@returns {!CircuitAlgebra}` to `@returns {!Promise<!CircuitAlgebra>}`, and add `stats: !CircuitStats, ` at the start of the `CircuitAlgebra` typedef's fields. Replace its first three lines and its `return` with:

```js
async function circuitAlgebra(stats, wireCount, previous = undefined, signal = undefined) {
    const circuit = stats.circuitDefinition;
    const {columns} = circuit;
    // One truncated run per step, each in its own task, so the steps never block a frame together.
    const states = [];
    for (let k = 0; k <= columns.length; k++) {
        signal?.throwIfAborted();
        states.push(await stateAtStep(stats, wireCount, k));
        await yieldToBrowser();
    }
```

```js
    return {stats, wireCount, states, steps};
```

- [ ] **Step 8: Compute the algebra outside render**

Replace `src/components/panels/algebra/useCircuitAlgebra.js` with:

```js
import { useRef } from "react";
import { circuitAlgebra } from "../../../engine/simulation/stepAlgebra.js";
import { useAsyncResult } from "../../useAsyncResult.js";

/**
 * The whole circuit's algebra, recomputed only when something it depends on changed: an unchanged
 * circuit reuses the last answer outright, and a changed one still reuses every time-independent
 * column's matrix (see circuitAlgebra). The steps are simulated in the background. Until the first
 * answer is ready this is undefined; after that, the last answer stays until the next one is ready.
 * An answer carries the stats it came from, so a view never pairs one circuit's steps with
 * another circuit's stats.
 *
 * @param {undefined|!CircuitStats} stats
 * @param {undefined|!int} wireCount
 * @returns {undefined|!CircuitAlgebra}
 */
function useCircuitAlgebra(stats, wireCount) {
  const cache = useRef(undefined);
  const { value } = useAsyncResult(async (signal) => {
    if (stats === undefined || wireCount === undefined) {
      return undefined;
    }
    const last = cache.current;
    const circuit = stats.circuitDefinition;
    if (
      last !== undefined &&
      last.algebra.wireCount === wireCount && last.seed === stats.seed &&
      last.circuit.isEqualTo(circuit) &&
      (circuit.stableDuration() === Infinity || last.time === stats.time)
    ) {
      return last.algebra;
    }
    const algebra = await circuitAlgebra(stats, wireCount, last?.algebra, signal);
    cache.current = { circuit, time: stats.time, seed: stats.seed, algebra };
    return algebra;
  }, [stats, wireCount]);
  return value;
}

export { useCircuitAlgebra };
```

In `src/components/panels/algebra/algebra-panel.jsx`, replace the six lines from `const result = useCompletedResult();` through `const algebra = useCircuitAlgebra(circuitStats, playheadSample?.wireCount);` with:

```jsx
  const result = useCompletedResult();
  const current = result?.step ?? 0;
  const playhead = useStore(appStore, (s) => s.playhead);
  const algebra = useCircuitAlgebra(result?.fullStats, result?.wireCount);
  // The algebra's own stats, not the newest sample's: its steps were computed from them.
  const circuitStats = algebra?.stats;
```

and replace `const shownWires = playheadSample?.wireCount;` with `const shownWires = algebra?.wireCount;`.

In `src/components/panels/bloch/useCircuitSteps.js`, replace `const circuit = completed?.fullStats.circuitDefinition;` with `const circuit = algebra?.stats.circuitDefinition;`.

- [ ] **Step 9: Compute the probability history outside render**

In `src/components/panels/probabilities/probabilities-panel.jsx`, add `import { yieldToBrowser } from "../../../base/yieldToBrowser.js";` and `import { useAsyncResult } from "../../useAsyncResult.js";`. Replace the `history` memo with:

```jsx
  // Each step is a truncated simulation, run in the background one task per step.
  const { value: history } = useAsyncResult(async () => {
    if (sample === undefined) {
      return undefined;
    }
    const { fullStats, wireCount, step } = sample;
    const circuit = fullStats.circuitDefinition;
    const stops = stepStops(circuit);
    const steps = [];
    for (const { column } of stops) {
      steps.push(probabilitiesOf(await stateAtStep(fullStats, wireCount, column)));
      await yieldToBrowser();
    }
    return { stops, wireCount, step, registers: circuit.registers, steps };
  }, [sample]);
```

Replace `stops.findLastIndex((stop) => stop.column <= sample.step)` with `stops.findLastIndex((stop) => stop.column <= history.step)`. The `tables` memo stays.

- [ ] **Step 10: Run every suite and measure**

Run: `npm run lint && npm test && npm run test:e2e`
Expected: all pass. The panels show "Waiting for the circuit…" until their first background result, which the end-to-end tests already wait through.

Run: `npm run build && npm run profile -- "Quantum Teleportation" "#algebra-button"`
Expected: fewer long tasks than Gate 0. The frame rate stays low while `useMatrixLayout` measures on every sample.

### Task 9: Make circuit stats async in place

**Modify:** `src/engine/simulation/gpu/KetTextureUtil.js`, `src/engine/simulation/CircuitStats.js`, `src/app/state/Simulator.js`, `src/engine/simulation/stepAlgebra.js`, `src/components/panels/probabilities/probabilities-panel.jsx`, and these 17 files that call `CircuitStats.fromCircuitAtTime` or `circuitAlgebra`: `test/CircuitOperationTestUtil.js`, `test/gates/probes/Detector.test.js`, `test/gates/probes/Controls.test.js`, `test/gates/prepare/PrepareGates.test.js`, `test/gates/rotations/ParametrizedRotationGates.test.js`, `test/gates/displays/sample/SampleDisplay.test.js`, `test/gates/displays/amplitudes/AmplitudeDisplay.test.js`, `test/gates/arithmetic/ModularMultiplicationGates.test.js`, `test/gates/inputs/InputGates.test.js`, `test/engine/simulation/qubitMarginals.test.js`, `test/engine/simulation/CircuitStats.test.js`, `test/engine/simulation/stepAlgebra.test.js`, `test/engine/simulation/columnStructure.test.js`, `test/engine/simulation/engineColumnOperator.js`, `test/engine/simulation/stateTableRows.test.js`, `test/editor/rendering/CircuitRendering.test.js`, `test_perf/EditorState.perf.js`. `test_perf/CircuitStats.perf.js` needs no change, because `perfGoal` awaits since Task 2.

**Interfaces:**

- Produces: `CircuitStats.fromCircuitAtTime(circuit, time, seed) -> Promise<CircuitStats>` and `KetTextureUtil.mergedReadFloats(textures) -> Promise<Float32Array[]>`. The `Async` names are gone.

- [ ] **Step 1: Delete the blocking versions**

In `CircuitStats.js`, delete the blocking `fromCircuitAtTime`, the blocking `_fromCircuitAtTime_noFallback`, and the blocking `readCircuitStatsPixels` with its comment. In `KetTextureUtil.js`, delete the blocking `mergedReadFloats`. In `CircuitStats.test.js`, delete the test "fromCircuitAtTimeAsync gives the same stats as fromCircuitAtTime".

- [ ] **Step 2: Take back the plain names**

```bash
perl -pi -e 's/_fromCircuitAtTimeAsync_noFallback/_fromCircuitAtTime_noFallback/g; s/\b(fromCircuitAtTime|readCircuitStatsPixels|mergedReadFloats)Async\b/$1/g' $(grep -rlE "fromCircuitAtTimeAsync|readCircuitStatsPixelsAsync|mergedReadFloatsAsync" src test test_perf)
```

Then replace the comment `/** Like readCircuitStatsPixels, without blocking on the GPU. */` with `/** Reads and releases the collected textures; the location map stays on the CPU. */`.

- [ ] **Step 3: Regenerate the names and lint**

Run: `npm run async:inventory -- --write-names src test test_perf && npm run lint`
Expected: `quirk-async/await-async-calls` lists every statement that now drops a promise, for example calls to test helpers that became async.

- [ ] **Step 4: Await every call in the tests**

For each lint finding, and for each remaining call to `CircuitStats.fromCircuitAtTime(`, `_fromCircuitAtTime_noFallback(` or `circuitAlgebra(` in the files above: put `await` before the call, wrapping it in parentheses when a property is read from the result, and make the enclosing test or helper an async function. Where a helper became async, do the same at its callers. A `testUsingWebGL` callback may be async since Task 2.

- [ ] **Step 5: Run the suites until they pass**

Run: `npm test`
Expected: all tests pass. A remaining missed `await` shows as a build error for `await` outside an async function, or as a failure reading a property of a `Promise`. Fix each and rerun.

Run: `npm run lint && npm run test:e2e && npm run test:perf`
Expected: all pass, with the same performance goals passing as at Gate 0.

### Task 10: Make the GPU read helpers async in place

**Modify:** `src/engine/webgl/texture/WglTexture.js`, `src/engine/webgl/shader/WglConfiguredShader.js`, `src/engine/simulation/gpu/KetTextureUtil.js`, `test/CircuitOperationTestUtil.js`, and the 32 test files that call `readPixels`, a `WglConfiguredShader` read helper, `tradeTextureForVec2Output` or an assertion helper from `CircuitOperationTestUtil.js`:

- `test/engine/simulation/`: `CircuitComputeUtil.test.js`, and `gpu/CircuitShaders.test.js`, `gpu/GateShaders.test.js`, `gpu/KetShaderUtil.test.js`
- `test/engine/webgl/`: `coder/ShaderCoderTypes.test.js`, `coder/ShaderCoders.test.js`, `operations/Shaders.test.js`, `shader/WglArg.test.js`, `shader/WglShader.test.js`, `texture/WglTexture.test.js`, `texture/WglTexturePool.test.js`
- `test/gates/`: `AllGates.test.js`, `misc/Impossible_UniversalNotGate.test.js`, `probes/Controls.test.js`, `displays/amplitudes/AmplitudeDisplay.test.js`, `displays/density/DensityMatrixDisplay.test.js`, `displays/probability/ProbabilityDisplay.test.js`, `frequency/FourierTransformGates.test.js`, `frequency/PhaseGradientGates.test.js`, `ordering/CycleBitsGates.test.js`, `ordering/PivotFlipGates.test.js`
- `test/gates/arithmetic/`: `ArithmeticGates.test.js`, `BitCountGates.test.js`, `ComparisonGates.test.js`, `IncrementGates.test.js`, `ModularAdditionGates.test.js`, `ModularIncrementGates.test.js`, `ModularMultiplicationGates.test.js`, `ModularMultiplyAccumulateGates.test.js`, `MultiplicationGates.test.js`, `MultiplyAccumulateGates.test.js`, `XorGates.test.js`

**Interfaces:**

- Produces: `WglTexture#readPixels() -> Promise<Uint8Array|Float32Array>`, non-blocking.
- Produces: `WglConfiguredShader#readRawFloatOutputs`, `readRawByteOutputs`, `readBoolOutputs`, `readVecFloatOutputs`, `readVec2Outputs`, `readVec2OutputsAsKet` and `readVec4Outputs`, each returning a promise of what it returned before.
- Produces: `KetTextureUtil.tradeTextureForVec4Output(trader)` and `tradeTextureForVec2Output(trader)`, each returning `Promise<Float32Array>`.
- Produces: the six assertion helpers exported by `test/CircuitOperationTestUtil.js`, each async.

- [ ] **Step 1: Delete the blocking reads and take back the names**

In `WglTexture.js`, delete the blocking `readPixels` method. In `KetTextureUtil.js`, delete the blocking `tradeTextureForVec4Output`. Then run:

```bash
perl -pi -e 's/\b(readPixels|tradeTextureForVec4Output)Async\b/$1/g' $(grep -rlE "readPixelsAsync|tradeTextureForVec4OutputAsync" src test test_perf)
```

In `WglTexture.js`, change the error text `"Called readPixelsAsync on a texture that hasn't been rendered to."` to `"Called readPixels on a texture that hasn't been rendered to."`.

- [ ] **Step 2: Make the read helpers async**

In `KetTextureUtil.js`, replace `tradeTextureForVec2Output` with:

```js
/**
 * @param {!WglTextureTrader} trader
 * @returns {!Promise<!Float32Array>}
 */
KetTextureUtil.tradeTextureForVec2Output = async trader => {
    if (currentShaderCoder().vec2.needRearrangingToBeInVec4Format) {
        trader.shadeHalveAndTrade(Shaders.packVec2IntoVec4);
    }
    return KetTextureUtil.tradeTextureForVec4Output(trader);
};
```

In `WglConfiguredShader.js`, replace `_renderReadDealloc` with the first block below, and replace each read helper's declaration and body with its version in the second block, keeping its JSDoc:

```js
  /**
   * @param {!WglTexture} texture
   * @returns {!Promise<!Uint8Array|!Float32Array>}
   * @private
   */
  async _renderReadDealloc(texture) {
    try {
      this.renderTo(texture);
      // The read is queued before the texture goes back to the pool.
      return texture.readPixels();
    } finally {
      texture.deallocByDepositingInPool();
    }
  }
```

```js
  async readRawFloatOutputs(sizePower) {
    return this._renderReadDealloc(WglTexturePool.takeRawFloatTex(sizePower));
  }

  async readRawByteOutputs(sizePower) {
    return this._renderReadDealloc(WglTexturePool.takeRawByteTex(sizePower));
  }

  async readBoolOutputs(sizePower) {
    const pixels = await this._renderReadDealloc(WglTexturePool.takeBoolTex(sizePower));
    const result = new Uint8Array(pixels.length >> 2);
    for (let i = 0; i < result.length; i++) {
      result[i] = pixels[i << 2] & 1;
    }
    return result;
  }

  async readVecFloatOutputs(sizePower) {
    return currentShaderCoder().float.pixelsToData(
      await this._renderReadDealloc(WglTexturePool.takeVecFloatTex(sizePower)),
    );
  }

  async readVec2Outputs(sizePower) {
    return currentShaderCoder().vec2.pixelsToData(
      await this._renderReadDealloc(WglTexturePool.takeVec2Tex(sizePower)),
    );
  }

  async readVec2OutputsAsKet(sizePower) {
    return new Matrix(1, 1 << sizePower, await this.readVec2Outputs(sizePower));
  }

  async readVec4Outputs(sizePower) {
    return currentShaderCoder().vec4.pixelsToData(
      await this._renderReadDealloc(WglTexturePool.takeVec4Tex(sizePower)),
    );
  }
```

Keep each helper's existing JSDoc, changing its `@returns {!T}` to `@returns {!Promise<!T>}`. Returning `texture.readPixels()` without `await` inside `try` is deliberate: the `finally` runs at once, after the read is queued.

- [ ] **Step 3: Update the texture tests**

In `test/engine/webgl/texture/WglTexture.test.js`, delete "readPixels reads bytes" (the Task 4 copy of `readPixels_bytes`). In "readPixels reads what readPixels reads, even if the texture is reused at once", rename it to "readPixels reads the pixels as they were when called, even if the texture is reused at once", and replace `const expected = texture.readPixels();` with:

```js
    const expected = new Float32Array([
        0.5, 0.5, 192.25, 254.5,
        1.5, 0.5, 192.25, 254.5,
        0.5, 1.5, 192.25, 254.5,
        1.5, 1.5, 192.25, 254.5
    ]);
```

Make `readPixels_bytes` and `readPixels_floats` async, with `await texture.readPixels()`.

- [ ] **Step 4: Regenerate the names, lint and await**

Run: `npm run async:inventory -- --write-names src test test_perf && npm run lint`
Expected: `quirk-async/await-async-calls` lists the statement calls to the assertion helpers in `CircuitOperationTestUtil.js`. Make those helpers async functions, awaiting the read helpers inside them, then await each finding and each read-helper call in the files above, as in Task 9 Step 4.

- [ ] **Step 5: Run the suites until they pass**

Run: `npm test`
Expected: all tests pass, fixing each missed `await` as in Task 9 Step 5.

Run: `npm run check`
Expected: passes.

### Gate 1: Decide whether to continue

- [ ] Run `npm run build` and the four Task 3 measurements, and fill in the Gate 1 table.
- [ ] Run `npm run test:perf` and record its result lines under the table.
- [ ] Run `npm run async:inventory` and record its first line and its convertible counts.
- [ ] The repository owner decides whether to start Phase 2. The evidence to weigh is the change in frames per second and long tasks from Gate 0, and any performance goal that got slower.

| Measurement | Frames per second | Median frame interval | Long tasks | Main thread busy |
|---|---|---|---|---|
| Teleportation | | | | |
| Teleportation, Algebra panel | | | | |
| Teleportation, Probabilities panel | | | | |
| Teleportation, playing | | | | |

---

## Phases 2 to 5: the rest of `src/`

Each of these phases gets its own detailed plan, written after the previous gate, because its code depends on what the previous phase changed. This section fixes each phase's scope, the procedure every folder follows, the restructuring each phase needs, and when each phase is done.

### The procedure for one folder group

1. Append the group's globs to `ASYNC_COMPLETE` in `eslint.config.js`, and run `npm run lint`. The `quirk-async/require-async` findings are the functions to convert.
2. Convert callees before their callers. Add `async` to each function, and change its JSDoc `@returns {T}` to `@returns {!Promise<T>}`.
3. Run `npm run async:inventory -- --write-names src test test_perf`, then `npm run lint`. The `quirk-async/await-async-calls` findings are statements that now drop a promise.
4. Await each call in its caller, and make the caller async. Where the caller cannot be async, use the matching pattern below.
5. Run the group's tests, then `npm test` and `npm run test:e2e`. A missed `await` shows as a build error for `await` outside an async function, or as a failure reading a property of a `Promise`.
6. Run `npm run async:inventory`. The group's folders no longer appear under "Synchronous functions that can be async functions".

**The caller renders.** Compute the value with `useAsyncResult`, as `useCircuitAlgebra` does after Task 8, and render the last finished value.

**The caller is an iteration callback.** Replace the loop, keeping its order:

```js
// Before: const steps = stops.map(({column}) => probabilitiesOf(stateAtStep(fullStats, wireCount, column)));
const steps = [];
for (const {column} of stops) {
    steps.push(probabilitiesOf(await stateAtStep(fullStats, wireCount, column)));
}
```

Use `await Promise.all(items.map(async item => ...))` only for independent work that neither paints nor draws random numbers.

**The caller is an event handler.** Settle the event before the first `await`. From `src/app/canvas/minimap.js`:

```js
canvas.addEventListener('pointerdown', async ev => {
    if (!ev.isPrimary || (ev.pointerType === 'mouse' && ev.button !== 0)) {
        return;
    }
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    await scrollTo(ev);
});
```

**The caller ignores the result.** End the chain in a report, as `captureInBackground` does in Task 7:

```js
captureCommitted().catch(error => reportRecoveredError("Simulating the committed circuit failed.", {}, error));
```

**The caller is a constructor.** Keep the constructor synchronous and move the awaited set-up into `static async create(...)`, which constructs, awaits the set-up and returns the instance. Change every `new` of that class outside the class to `await X.create(...)`.

**The function must stay synchronous.** Put the reason directly before it. From `src/draw/displays/probability/ProbabilityScale.js`:

```js
// async-exempt: the probabilities panel calls it while React renders
export function formatProbability(p, digits = 1) {
```

### Phase 2: Application state, results, browser and panel handlers

**Scope:** 125 files, 1,064 functions, 588 convertible. Folders: `src/app` except `canvas`; `src/components`; `src/results`; `src/browser`; `src/diagnostics`; `src/state`; and `Revision.js`, `Obs.js`, `valueStore.js` and `CooldownThrottle.js` in `src/base`.

**Tasks, in order:** the four `src/base` files; `src/app/state`, `src/app/session`, `src/app/dialogs` and `QuirkApp.js`; `src/results`, `src/browser`, `src/diagnostics` and `src/state`; `src/components` outside `panels`; `src/components/panels`.

**Restructuring this phase needs:**

- React reads zustand stores and `Observable` values through synchronous subscriptions. `setState`, `Observable` subscribers and the `valueStore` helpers stay synchronous, and async functions call them after their awaits. Mapping callbacks passed to `Observable` operators stay synchronous.
- `Revision`'s commit, undo and redo must keep their order. Before converting them, add a test that commits twice and undoes once, and checks that the first commit is active. If that test fails with the async versions, they get `async-exempt` comments naming the test.
- The panels' 137 JSX event handlers follow the event handler pattern.

**Done when:** the phase's globs are in `ASYNC_COMPLETE`, `npm run check` passes, and Gate 2 is recorded with the Task 3 measurements.

### Phase 3: Drawing and the editor

**Scope:** 85 files, 725 functions, 487 convertible. Folders: `src/draw`, `src/editor`, `src/app/canvas`, `src/appearance`, `src/geometry`.

**Restructuring this phase needs:**

- `RenderSurface.beginFrame` schedules the commit with `queueMicrotask`, which would commit a half-painted frame once painters await. `beginFrame` stops scheduling, and each of the six places that start frames awaits `surface.render()` after its last paint: `CircuitViewport.js`, `minimap.js`, `circuit-figure.jsx`, `BlochStrip.js`, `BlochProjections.js` and `BlochScene.js`.
- `DisplayView.group` awaits its painter and keeps element order by reserving its slot first:

```js
    async group(key, update) {
        const child = new DisplayView(this.canvas, this.rng, this.pixelRatio);
        child.lineScale = this.lineScale;
        child.tooltips = this.tooltips;
        child.parent = this;
        const slot = this.elements.length;
        this.elements.push(null);
        this.order++;
        child.result = await update(child);
        this.elements[slot] = child.element(key);
        return child;
    }
```

- Painters await each other in order. Decorative randomness comes from one `RestartableRng` per frame, and its sequence must not change between runs.
- The Pixi scene classes' setters, such as `ShapeView.shape`, `LabelView.label` and `MatrixGraphics.picture`, stay synchronous; the classifier already blocks them.
- Pointer handlers in `canvasPointer.js`, `minimap.js` and `toolboxDrag.js` follow the event handler pattern.

**Done when:** as Phase 2, and no Gate 3 measurement is slower than Gate 1. A slower measurement stops the phase; the folder that caused it gets `async-exempt` comments naming the measurement.

### Phase 4: Circuit model, gates, serialization and config

**Scope:** 82 files, 785 functions, 381 convertible. Folders: `src/circuit`, `src/gates`, `src/serialization`, `src/config`, `src/resources`.

**Restructuring this phase needs:**

- The gate catalogue is built while its modules load: `Gate.buildFamily`, `GateBuilder`, and most of the phase's 271 callbacks passed to other functions. If the builders become async, `src/gates/AllGates.js` exports after a top-level `await`. Vite 8.2.2's default build target is Chrome 111, Edge 111, Firefox 114 and Safari 16.4, which all support top-level `await`, and the operator tile worker is built as an ES module worker, which supports it too.
- `isEqualTo`, `toString` and the other protocol methods stay synchronous. Caches, `whenDifferent` and zustand equality call them synchronously.
- Every commit parses the circuit with `fromJsonText_CircuitDefinition`. Once parsing is async, the revision subscription in `QuirkApp.js` publishes the parsed circuit through a `LatestRun`, like `Simulator#evaluate`.

**First task: add a type-check ratchet.** This phase's code carries precise JSDoc types, where TypeScript 7.0.2 finds promise misuse that lint cannot. In JavaScript files it reports a promise used as a condition (TS2801), a property read from a promise (TS2339), arithmetic on a promise (TS2362), and an async function whose declared return type is not a `Promise` (TS1064). The repository reports about 4,145 type errors today, so the ratchet fails only on errors missing from a recorded baseline. It waits for this phase because, in a planning probe, it missed the untyped wiring around `captureCommitted` while it did flag a caller of a typed async `mergedReadFloats`. The baseline file is about 250 KB.

```js
// scripts/typecheck-ratchet.js
import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";

/**
 * Fails when the type check reports an error the baseline does not have. The code base carries
 * type errors today, so a plain `tsc` exit code cannot gate anything; comparing against a recorded
 * baseline can. Errors are keyed by file, code and message, without line numbers, so unrelated
 * edits that move code do not count as new errors.
 *
 * Usage: node scripts/typecheck-ratchet.js            check against the baseline
 *        node scripts/typecheck-ratchet.js --update   record the current errors as the baseline
 */

const root = path.resolve(import.meta.dirname, "..");
const baselineFile = path.join(import.meta.dirname, "typecheck-baseline.json");
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");

function typeErrors() {
    let output;
    try {
        output = execFileSync(process.execPath, [tsc, "-p", "jsconfig.json", "--pretty", "false"],
            {cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024});
    } catch (error) {
        if (typeof error.stdout !== "string") throw error;
        output = error.stdout;
    }
    const errors = [];
    for (const line of output.split("\n")) {
        const match = /^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/.exec(line);
        if (match) {
            errors.push({key: `${match[1]} ${match[2]} ${match[3]}`, text: line});
        } else if (line.startsWith(" ") && errors.length > 0) {
            errors.at(-1).key += "\n" + line.trim();
            errors.at(-1).text += "\n" + line;
        }
    }
    return errors;
}

const counts = keys => keys.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map());
const errors = typeErrors();
const current = counts(errors.map(error => error.key));

if (process.argv.includes("--update")) {
    const sorted = [...current].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    writeFileSync(baselineFile, JSON.stringify(Object.fromEntries(sorted), null, 1) + "\n");
    console.log(`Recorded ${errors.length} type errors as the baseline.`);
} else {
    const baseline = new Map(Object.entries(JSON.parse(readFileSync(baselineFile, "utf8"))));
    const seen = new Map();
    const introduced = errors.filter(error => {
        const n = (seen.get(error.key) ?? 0) + 1;
        seen.set(error.key, n);
        return n > (baseline.get(error.key) ?? 0);
    });
    const removed = [...baseline].reduce((sum, [key, n]) => sum + Math.max(0, n - (current.get(key) ?? 0)), 0);
    for (const error of introduced) console.error(error.text);
    console.log(`${errors.length} type errors: ${introduced.length} new, ${removed} fewer than the baseline.`);
    if (introduced.length === 0 && removed > 0) {
        console.log("Record the improvement with: npm run typecheck:ratchet -- --update");
    }
    process.exitCode = introduced.length === 0 ? 0 : 1;
}
```

Add `"typecheck:ratchet": "node scripts/typecheck-ratchet.js"` to `package.json`, record the baseline with `npm run typecheck:ratchet -- --update`, and add `npm run typecheck:ratchet` to `check` after `npm run test:async-rules`.

**Done when:** as Phase 2, with the ratchet passing.

### Phase 5: Math engine, simulation, WebGL and base

**Scope:** 58 files, 584 functions, 446 convertible. Folders: the rest of `src/engine` and `src/base`.

**Restructuring this phase needs:**

- The microbenchmark above predicts arithmetic 6 to 8 times slower and matrix products 34 to 66 times slower when every call is awaited. The seven goals in `test_perf/CircuitStats.perf.js` and `test_perf/EditorState.perf.js` are the exit test. A goal that fails stops the folder that caused it, and that folder's functions get `async-exempt` comments naming the goal.
- `collectCircuitStatsTextures` and the shader code it calls must not await, by the global constraint on GPU command sequences. Those functions get `async-exempt` comments that cite it.

**Done when:** as Phase 2, with every performance goal that passed at Gate 1 still passing.

## Functions that stay synchronous

| Kind | Functions | Why | How they reach async work |
|---|---|---|---|
| React components | 96 | React 19 client components cannot be async functions | `useAsyncResult` |
| React hooks | 19 | Hooks run while React renders | `useAsyncResult` |
| React synchronous callbacks | 122 | `useMemo`, `useState`, `useSyncExternalStore` and zustand selectors use the return value; effects must return a cleanup or nothing | Start the work inside, handle its result or rejection |
| Constructors | 56 | JavaScript does not allow async constructors | `static async create()` |
| Protocol methods | 30 | The runtime calls `toString`, `valueOf` and `toJSON`; caches and equality callbacks call `isEqualTo` and `describe` synchronously | Callers await other work first |
| Getters and setters | 12 | JavaScript does not allow async accessors, and Pixi's reconciler assigns scene props synchronously | Callers await other work first |
| Pixi draw callback | 1 | The reconciler calls `draw` synchronously | Precompute what it draws |
| Iteration callbacks that do not await | up to 444 | Their methods use the return value synchronously | Loops become `for...of` when they need to await |
| Functions called during render or reconciliation | about 280 to 540, estimated | They run inside the rows above | `async-exempt` comments, or results computed ahead |
| GPU command sequences | the functions `collectCircuitStatsTextures` calls | Another simulation's commands must not interleave | `async-exempt` comments |

## Planning verification

On 17 September 2026 the planning pass inspected the working tree on branch `custom-gates`, `package.json`, `jsconfig.json`, `knip.json`, `eslint.config.js`, `vite.config.js`, `CONTRIBUTING.md`, the three test runners, and every caller this plan names. Node was 24.10.0, npm 11.6.0, TypeScript 7.0.2 with only its `tsc` executable, and Vite 8.2.2.

In a scratch copy of the working tree, never in the repository:

- `scripts/async/eslint-plugin.test.js` passed, and a deliberately wrong case made it exit with status 1.
- ESLint with the plugin reported nothing on the copy. On a probe file it reported both always-on rules, and with `src/app/state/**` listed it reported 53 `require-async` findings.
- `scripts/async/inventory.js` produced the counts in this plan.
- With Tasks 1, 2, 4, 5 and 6 applied, and `LatestRun`, `yieldToBrowser` and `useAsyncResult` added with their tests, the unit suite completed 820 of 820 tests.
- With the old harness and the old throttle restored, the new harness test failed with `Unreturned textures.`, and the new throttle test failed with `Got <3> but expected it to equal <1>`.
- `scripts/profile-example.js` measured the Algebra panel on a production build at 7 frames per second.
- `scripts/typecheck-ratchet.js` recorded 4,145 errors and passed. It did not flag an async `Simulator#evaluate`, and it did flag a changed error after `KetTextureUtil.mergedReadFloats` became async.

Not executed: the Task 7 to 10 changes to the simulator, `QuirkApp.js`, the redraw loop, the recorder, the step algebra and the panels; the renames in Tasks 9 and 10; the end-to-end and performance suites with any change in this plan; Task 3's script against `play` and the Probabilities panel; and everything in Phases 2 to 5.
