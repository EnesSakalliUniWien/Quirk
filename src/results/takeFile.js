import {validateTake, distributions} from "./take.js";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const LINK_LIMIT = 32 * 1024;
const album = takes => ({format: "shadow-quant-album/1", takes});
const takeJson = value => JSON.stringify(value);

function parseTakes(text) {
    if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error("File exceeds 200 MB");
    const value = JSON.parse(text);
    const list = value?.format === "shadow-quant-album/1" ? value.takes : [value];
    if (!Array.isArray(list)) throw new Error("Invalid album");
    if (value.format === "shadow-quant-album/1" && Object.keys(value).some(k => !["format", "takes"].includes(k))) throw new Error("Unknown album field");
    const takes = list.map(validateTake);
    if (new Set(takes.map(t => t.id)).size !== takes.length) throw new Error("Duplicate take identity");
    return takes;
}

function takeCsv(takes) {
    const quote = value => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["take_id", "take_name", "register", "start", "width", "value", "label", "bits", "probability"]];
    for (const take of takes) {
        const {groups, joint} = distributions(take);
        for (const group of [...groups, {name: "joint", start: 0, length: take.wires, labels: {}, probabilities: joint}]) {
            group.probabilities.forEach((p, i) => rows.push([take.id, take.name, group.name, group.start,
                group.length, i, group.labels[i] ?? "", i.toString(2).padStart(group.length, "0"), Number.isFinite(p) ? p : "unavailable"]));
        }
    }
    // Text fields are quoted, with spreadsheet formula prefixes neutralized on export only.
    return rows.map(row => row.map(value => quote(typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : value)).join(",")).join("\r\n");
}

function takeLink(take, base) {
    const fragment = "#take=" + encodeURIComponent(JSON.stringify(take));
    if (new TextEncoder().encode(fragment).byteLength > LINK_LIMIT) throw new Error("Take exceeds the 32 KiB link limit. Download JSON instead.");
    return base.split("#")[0] + fragment;
}

export {MAX_FILE_BYTES, LINK_LIMIT, album, takeJson, parseTakes, takeCsv, takeLink};
