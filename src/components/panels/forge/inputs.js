

/** Joins a method's inputs into one debounce key. */
const inputKey = (...values) => values.join(" ");

/** An empty field means its placeholder, the way the forge has always read them. */
const entered = (text, placeholder) => (text === "" ? placeholder : text);

export { inputKey, entered };
