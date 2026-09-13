import seedrandom from "seedrandom";

// Versioned in take files. Never replace the process-wide Math.random.
const RANDOM_FORMAT = "seedrandom-arc4/1";
const randomFor = (seed) => seedrandom(String(seed));
const freshSeed = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, "0")).join("");

export {RANDOM_FORMAT, randomFor, freshSeed};
