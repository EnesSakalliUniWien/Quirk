import {initializedWglContext} from "../webgl/context/WglContext.js"

/**
 * How much GPU memory one set of checkpoints may hold in saved states, give or take the two states
 * that are always kept: before the first time-dependent column and after the last column.
 */
const CHECKPOINT_BUDGET_BYTES = 16 << 20;

/** Bytes per RGBA32F pixel. */
const BYTES_PER_PIXEL = 16;

/**
 * The fewest columns between saved states. A fused run of gates stops wherever a state is saved
 * (gateFusion.js), so saving at every column would leave nothing to fuse.
 */
const MIN_COLUMNS_BETWEEN_STATES = 8;

/**
 * @typedef {!{
 *     colNorms: !Array.<!Float32Array>,
 *     colQubitDensities: !Array.<!Float32Array>,
 *     customStats: !Map.<!string, *>
 * }} ColumnPixels
 * The raw statistics each column read back: its norm, its single-qubit densities and each display's pixels,
 * keyed by "column:row" in evaluation order. colQubitDensities has one more entry than there are columns, for
 * the densities after the last one.
 */

/**
 * @typedef {!{col: !int, texture: !WglTexture, randomDraws: !int}} SavedState
 * The state from just before column `col`, and how many random numbers the columns before it drew.
 */

/**
 * The states one circuit passed through on its last run, and the raw statistics its columns read
 * back, so that the next run can start at the first column that differs instead of at the initial
 * state. Columns only depend on the columns before them (their disabled reasons, measured wires and
 * input context are all built front to back), so editing a late column, stepping the playhead
 * forward, or animating a time-dependent gate leaves everything before it valid.
 *
 * The saved states are textures borrowed from the pool and held until they are superseded or
 * released. A lost GL context loses their contents, so a run after one starts over.
 */
class CircuitCheckpoints {
    constructor() {
        this._clear();
    }

    /**
     * @private
     */
    _clear() {
        /** @type {undefined|!CircuitDefinition} */
        this._circuit = undefined;
        /** @type {undefined|!number} */
        this._time = undefined;
        this._seed = undefined;
        /** @type {undefined|!int} */
        this._lifetime = undefined;
        /** @type {undefined|!ColumnPixels} */
        this._pixels = undefined;
        /**
         * Keyed by the column each state comes just before.
         * @type {!Map.<!int, !SavedState>}
         */
        this._states = new Map();
    }

    /**
     * Where a run of the given circuit can start: the latest saved state before the first column that
     * differs from the last run (or, at a different time, the first time-dependent column), together
     * with the statistics of the columns before it.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @param {*} seed
     * @returns {undefined|!{col: !int, texture: !WglTexture, randomDraws: !int, pixels: !ColumnPixels}}
     */
    resumePoint(circuit, time, seed) {
        const col = this._resumeColumn(circuit, time, seed);
        if (col === 0) {
            return undefined;
        }
        const {texture, randomDraws} = this._states.get(col);
        const pixels = this._pixels;
        return {
            col,
            texture,
            randomDraws,
            pixels: {
                colNorms: pixels.colNorms.slice(0, col),
                colQubitDensities: pixels.colQubitDensities.slice(0, col),
                customStats: new Map([...pixels.customStats].filter(([key]) => parseInt(key) < col))
            }
        };
    }

    /**
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @param {*} seed
     * @returns {!int} 0 when the run has to start from the initial state.
     * @private
     */
    _resumeColumn(circuit, time, seed) {
        const previous = this._circuit;
        if (previous === undefined ||
                this._lifetime !== initializedWglContext().lifetimeCounter ||
                this._seed !== seed ||
                !previous.withColumns([]).isEqualTo(circuit.withColumns([]))) {
            return 0;
        }

        let shared = 0;
        const n = Math.min(previous.columns.length, circuit.columns.length);
        while (shared < n && previous.columns[shared].isEqualTo(circuit.columns[shared])) {
            shared++;
        }
        if (time !== this._time) {
            shared = Math.min(shared, firstTimeDependentColumn(circuit));
        }

        let best = 0;
        for (const col of this._states.keys()) {
            if (col <= shared && col > best) {
                best = col;
            }
        }
        return best;
    }

    /**
     * Whether a run should save its state from just before the given column (savesStateBefore).
     *
     * @param {!CircuitDefinition} circuit
     * @param {!int} col Between 1 and the column count.
     * @param {!WglTexture} texture The state that would be saved.
     * @returns {!boolean}
     */
    shouldSave(circuit, col, texture) {
        return savesStateBefore(circuit, col, texture);
    }

    /**
     * Replaces the last run with a new one. States from before the new run's first column are kept;
     * the rest are returned to the pool and the new run's states take their place.
     *
     * @param {!CircuitDefinition} circuit
     * @param {!number} time
     * @param {*} seed
     * @param {!int} firstCol The column the run started at.
     * @param {!Array.<!SavedState>} savedStates The states the run saved, all after firstCol.
     * @param {!ColumnPixels} pixels The statistics of every column, including those before firstCol.
     */
    record(circuit, time, seed, firstCol, savedStates, pixels) {
        const kept = new Map([...this._states].filter(([col]) => col <= firstCol));
        this._releaseStates([...this._states.values()].filter(state => state.col > firstCol));
        this._circuit = circuit;
        this._time = time;
        this._seed = seed;
        this._lifetime = initializedWglContext().lifetimeCounter;
        this._pixels = pixels;
        this._states = kept;
        for (const state of savedStates) {
            this._states.set(state.col, state);
        }
    }

    /**
     * Returns every saved state to the pool and forgets the last run.
     */
    release() {
        this._releaseStates([...this._states.values()]);
        this._clear();
    }

    /**
     * Columns that apply no operation save the same texture more than once; it is released once.
     *
     * @param {!Array.<!SavedState>} states
     * @private
     */
    _releaseStates(states) {
        const stillHeld = new Set([...this._states.values()]
            .filter(state => !states.includes(state))
            .map(state => state.texture));
        const released = new Set();
        for (const {texture} of states) {
            if (!stillHeld.has(texture) && !released.has(texture)) {
                released.add(texture);
                texture.deallocByDepositingInPool("CircuitCheckpoints saved state");
            }
        }
    }
}

/**
 * Whether a run keeps its state from just before the given column. It depends only on the circuit
 * and the size of its state, so a run fuses gates the same way whether or not it keeps states, and a
 * resumed run gives exactly the results of a fresh one.
 *
 * States are saved at a stride that keeps them within the memory budget, but no closer together than
 * MIN_COLUMNS_BETWEEN_STATES, and always just before the first time-dependent column (where an
 * animating circuit restarts every frame) and after the last column (where a gate appended to the
 * circuit starts).
 *
 * @param {!CircuitDefinition} circuit
 * @param {!int} col
 * @param {!WglTexture} texture A state of the circuit, for its size.
 * @returns {!boolean}
 */
function savesStateBefore(circuit, col, texture) {
    const columnCount = circuit.columns.length;
    const bytes = texture.width * texture.height * BYTES_PER_PIXEL;
    const stride = Math.max(MIN_COLUMNS_BETWEEN_STATES, Math.ceil(columnCount * bytes / CHECKPOINT_BUDGET_BYTES));
    return col % stride === 0 || col === columnCount || col === firstTimeDependentColumn(circuit);
}

/**
 * Asked once per column of every run, so remembered per circuit.
 * @type {!WeakMap.<!CircuitDefinition, !int>}
 */
const FIRST_TIME_DEPENDENT_COLUMNS = new WeakMap();

/**
 * @param {!CircuitDefinition} circuit
 * @returns {!int} The index of the first column whose gates change with time, else the column count.
 */
function firstTimeDependentColumn(circuit) {
    let index = FIRST_TIME_DEPENDENT_COLUMNS.get(circuit);
    if (index === undefined) {
        index = circuit.columns.findIndex(column => column.stableDuration() < Infinity);
        if (index === -1) {
            index = circuit.columns.length;
        }
        FIRST_TIME_DEPENDENT_COLUMNS.set(circuit, index);
    }
    return index;
}

export {CircuitCheckpoints, firstTimeDependentColumn, savesStateBefore}
