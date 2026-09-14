import {z} from "zod";
import {CircuitStats} from "../engine/simulation/CircuitStats.js";
import {CircuitDefinition} from "../circuit/model/CircuitDefinition.js";
import {Serializer} from "../serialization/Serializer.js";
import {Matrix} from "../engine/math/matrix/Matrix.js";
import {paddedState} from "../engine/simulation/stepAlgebra.js";
import {RANDOM_FORMAT, freshSeed} from "../engine/simulation/random.js";

const unavailable = z.strictObject({unavailable: z.enum(["NaN", "Infinity", "-Infinity"])});
const number = z.union([z.number(), unavailable]);
const json = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(),
    z.array(json), z.record(z.string(), json)]));
const matrix = z.strictObject({kind: z.literal("matrix"), width: z.int().min(1).max(65536),
    height: z.int().min(1).max(65536), buffer: z.array(number)}).refine(
    v => v.buffer.length === 2 * v.width * v.height, "Invalid matrix dimensions");
const statsSchema = z.strictObject({
    circuit: z.record(z.string(), json),
    wires: z.int().min(0).max(16),
    available: z.boolean(),
    amplitudes: z.array(number).max(131072),
    survival: z.array(number),
    densities: z.array(z.array(z.array(number).length(8))),
    custom: z.array(z.tuple([z.string().regex(/^\d+:\d+$/), json])),
    samples: z.record(z.string(), z.strictObject({i: z.int().min(0), p: z.number().min(0).max(1.00001)})),
    readable: z.record(z.string(), json),
});
const takeSchema = z.strictObject({
    format: z.literal("shadow-quant-take/1"), id: z.string().min(1).max(128),
    name: z.string().min(1).max(200), colour: z.int().min(0).max(7),
    recorded: z.iso.datetime(), notes: z.string().max(10000),
    circuit: z.record(z.string(), json), wires: z.int().min(0).max(16),
    step: z.int().min(0), phase: z.number().min(0).lt(1),
    seed: z.string().min(1).max(256), randomFormat: z.literal(RANDOM_FORMAT),
    result: statsSchema, fullResult: statsSchema,
});

function encode(value) {
    if (typeof value === "number" && !Number.isFinite(value)) return {unavailable: String(value)};
    if (value instanceof Matrix) return {kind: "matrix", width: value.width(), height: value.height(), buffer: [...value.rawBuffer()].map(encode)};
    if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, encode);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k, encode(v)]));
    return value;
}

function decode(value) {
    if (value !== null && typeof value === "object") {
        if ("unavailable" in value) return Number(unavailable.parse(value).unavailable);
        if (value.kind === "matrix") {
            const m = matrix.parse(value);
            return new Matrix(m.width, m.height, new Float64Array(m.buffer.map(decode)));
        }
        if (Array.isArray(value)) return value.map(decode);
        return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, decode(v)]));
    }
    return value;
}

function snapshotStats(stats, wires) {
    const data = stats.snapshotData();
    return encode({circuit: Serializer.toJson(stats.circuitDefinition),
        wires: stats.circuitDefinition.numWires, available: data.densities.length > 0,
        amplitudes: [...paddedState(stats.finalState, wires).rawBuffer()],
        ...data, samples: stats.sampleOutcomes,
        readable: stats.toReadableJson(true)});
}

function createTake(result, name = "take", colour = 0) {
    return {format: "shadow-quant-take/1", id: freshSeed(), name, colour,
        recorded: new Date().toISOString(), notes: "", circuit: Serializer.toJson(result.circuit),
        wires: result.wireCount, step: result.step, phase: result.phase, seed: result.seed,
        randomFormat: RANDOM_FORMAT,
        result: snapshotStats(result.stats, result.wireCount),
        fullResult: snapshotStats(result.fullStats, result.wireCount)};
}

function circuitFromJson(value) {
    if (!Array.isArray(value.cols) || value.cols.some(col => !Array.isArray(col) || col.length > 16)) throw new Error("Invalid circuit columns");
    const circuit = Serializer.fromJson(CircuitDefinition, value);
    // Serializer recovers malformed circuit input with error gates. Take imports must not
    // silently repair or discard unknown gates, registers or fields.
    const stable = v => Array.isArray(v) ? v.map(stable) : v !== null && typeof v === "object" ?
        Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
    if (JSON.stringify(stable(value)) !== JSON.stringify(stable(Serializer.toJson(circuit)))) throw new Error("Circuit is not a supported canonical circuit");
    return circuit;
}

function validateTake(value) {
    const parsed = takeSchema.safeParse(value);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`Invalid take at ${issue.path.join(".")}: ${issue.message}`);
    }
    const take = parsed.data;
    const circuit = circuitFromJson(take.circuit);
    if (take.step > circuit.columns.length || circuit.numWires > Math.max(1, take.wires)) throw new Error("Invalid take step or wire count");
    for (const [stored, step] of [[take.result, take.step], [take.fullResult, circuit.columns.length]]) {
        if (stored.amplitudes.length !== 2 * 2 ** take.wires) throw new Error("Invalid amplitude count");
        const def = circuitFromJson(stored.circuit);
        const expected = circuit.withColumns(circuit.columns.slice(0, step)).withMinimumWireCount();
        if (JSON.stringify(Serializer.toJson(def)) !== JSON.stringify(Serializer.toJson(expected))) throw new Error("Stored results do not match the circuit step");
        if (stored.wires > take.wires || (stored.available && (stored.densities.length !== step + 1 || stored.survival.length !== step)) ||
            stored.densities.some(col => col.length !== stored.wires)) throw new Error("Invalid result dimensions");
        if (stored.wires !== expected.numWires) throw new Error("Invalid simulated wire count");
        const simulatedAmplitudeCount = 2 * 2 ** stored.wires;
        if (!stored.available && (stored.densities.length !== 0 || stored.amplitudes.some((v, i) =>
            typeof v === "number" && (i < simulatedAmplitudeCount || v !== 0)) || stored.custom.length)) throw new Error("Invalid unavailable result");
        const decoded = decode(stored);
        const customLocations = new Set(decoded.custom.map(([key]) => key));
        if (customLocations.size !== decoded.custom.length) throw new Error("Duplicate display location");
        const sampleDistributions = new Map();
        for (const [key, data] of decoded.custom) {
            const [col, row] = key.split(":").map(Number);
            if (col >= step || row >= take.wires || def.gateInSlot(col, row) === undefined) throw new Error("Invalid display location");
            const gate = def.gateInSlot(col, row);
            const id = gate.serializedId;
            const isMatrix = (m, entries) => m instanceof Matrix && m.width() * m.height() === entries;
            if (/^(Sample|Chance)\d+$/.test(id)) {
                if (!isMatrix(data, 2 ** gate.height) || data.width() !== 1) throw new Error("Invalid probability display");
                if (/^Sample\d+$/.test(id)) sampleDistributions.set(key, data);
            } else if (/^Density\d+$/.test(id)) {
                if (!isMatrix(data, 4 ** gate.height) || data.width() !== data.height()) throw new Error("Invalid density display");
            } else if (/^Amps\d+$/.test(id)) {
                if (!data || typeof data.quality !== "number" || !isMatrix(data.ket, 2 ** gate.height) ||
                    !isMatrix(data.incoherentKet, 2 ** gate.height) || (data.phaseLockIndex !== undefined &&
                    (!Number.isInteger(data.phaseLockIndex) || data.phaseLockIndex < 0 || data.phaseLockIndex >= 2 ** gate.height))) throw new Error("Invalid amplitude display");
            } else if (/Detect/.test(id)) {
                if (typeof data !== "boolean") throw new Error("Invalid detector outcome");
            } else throw new Error("Unsupported display result");
        }
        if (stored.available) {
            for (let col = 0; col < step; col++) {
                for (const row of def.customStatRowsInCol(col)) {
                    if (!customLocations.has(`${col}:${row}`)) {
                        throw new Error(`Missing ${def.gateInSlot(col, row).serializedId} result at ${col}:${row}`);
                    }
                }
            }
        }
        for (const [key, data] of sampleDistributions) {
            if (!data.hasNaN() && !Object.hasOwn(stored.samples, key)) throw new Error("Missing Sample outcome");
        }
        for (const [key, sample] of Object.entries(stored.samples)) {
            const data = sampleDistributions.get(key);
            if (data === undefined || data.hasNaN() || sample.i >= data.height()) throw new Error("Invalid Sample outcome");
            const probability = data.rawBuffer()[sample.i * 2];
            if (!Number.isFinite(probability) || Math.abs(sample.p - probability) > 1e-6) throw new Error("Sample probability does not match its distribution");
        }
    }
    return take;
}

function restoreTake(take) {
    const circuit = Serializer.fromJson(CircuitDefinition, take.circuit);
    const hydrate = (stored, step) => {
        const s = decode(stored);
        return new CircuitStats(circuit.withColumns(circuit.columns.slice(0, step)).withWireCount(s.wires), take.phase, s.survival,
            s.densities.map(col => col.map(buf => new Matrix(2, 2, new Float64Array(buf)))),
            new Matrix(1, 2 ** take.wires, new Float64Array(s.amplitudes)), new Map(s.custom), take.seed, s.samples);
    };
    return {circuit: Serializer.fromJson(CircuitDefinition, take.circuit), wireCount: take.wires,
        step: take.step, phase: take.phase, seed: take.seed, stats: hydrate(take.result, take.step), fullStats: hydrate(take.fullResult, circuit.columns.length)};
}

function distributions(take) {
    const circuit = Serializer.fromJson(CircuitDefinition, take.circuit);
    const amplitudes = take.result.amplitudes.map(decode);
    const joint = Array.from({length: 2 ** take.wires}, (_, i) => amplitudes[i*2] ** 2 + amplitudes[i*2+1] ** 2);
    const groups = [];
    for (let start = 0; start < take.wires;) {
        const register = circuit.registers.at(start);
        const length = register?.length ?? 1;
        const name = register?.name ?? `q${start}`;
        const probabilities = new Array(2 ** length).fill(0);
        joint.forEach((p, i) => probabilities[(i >> start) & (2 ** length - 1)] += p);
        groups.push({name, start, length, labels: register?.labels ?? {}, probabilities});
        start += length;
    }
    return {joint, groups};
}

export {createTake, validateTake, restoreTake, distributions};
