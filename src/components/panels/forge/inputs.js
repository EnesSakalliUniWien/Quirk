

/** Joins a method's inputs into one debounce key. */
const inputKey = (...values) => JSON.stringify(values);

export { inputKey };
