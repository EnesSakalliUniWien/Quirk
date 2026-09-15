import { distributions } from "../take/distributions.js";

const columns = ["take_id", "take_name", "register", "start", "width", "value", "label", "bits", "probability"];

function quote(value) {
  // Preserve the existing export-only spreadsheet formula protection.
  const text = typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function* rows(takes) {
  yield columns;
  for (const take of takes) {
    const { groups, joint } = distributions(take);
    const jointGroup = { name: "joint", start: 0, length: take.wires, labels: {}, probabilities: joint };
    for (const group of [...groups, jointGroup]) {
      for (const [index, probability] of group.probabilities.entries()) {
        yield [
          take.id, take.name, group.name, group.start, group.length, index,
          group.labels[index] ?? "", index.toString(2).padStart(group.length, "0"),
          Number.isFinite(probability) ? probability : "unavailable",
        ];
      }
    }
  }
}

function takeCsv(takes) {
  // Format rows as they are produced, avoiding a retained table of cell arrays.
  // The returned CSV string and its line strings still require memory proportional to output.
  return Array.from(rows(takes), row => row.map(quote).join(",")).join("\r\n");
}

export { takeCsv };
