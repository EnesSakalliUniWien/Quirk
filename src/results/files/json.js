import { z } from "zod";
import { validateTake } from "../take/validation.js";
import { MAX_FILE_BYTES } from "./limits.js";

const ALBUM_FORMAT = "shadow-quant-album/1";
const albumSchema = z.strictObject({ format: z.literal(ALBUM_FORMAT), takes: z.array(z.unknown()) });
const encoder = new TextEncoder();
const album = takes => ({ format: ALBUM_FORMAT, takes });
const takeJson = value => JSON.stringify(value);

function parseTakes(text) {
  if (typeof text !== "string") throw new TypeError("Take input must be JSON text");
  // Reject obviously oversized strings before allocating their UTF-8 representation.
  if (text.length > MAX_FILE_BYTES || encoder.encode(text).byteLength > MAX_FILE_BYTES) {
    throw new Error("File exceeds 200 MiB");
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new Error("Invalid take JSON", { cause });
  }
  let list = [value];
  if (value?.format === ALBUM_FORMAT) {
    const parsed = albumSchema.safeParse(value);
    if (!parsed.success) throw new Error("Invalid album", { cause: parsed.error });
    list = parsed.data.takes;
  }
  // Validate the entire album before Recorder can save any take.
  const seen = new Set();
  return list.map((item, index) => {
    let take;
    try {
      take = validateTake(item);
    } catch (cause) {
      throw new Error(`Invalid take at index ${index}: ${cause.message}`, { cause });
    }
    if (seen.has(take.id)) throw new Error(`Duplicate take identity at index ${index}`);
    seen.add(take.id);
    return take;
  });
}

export { album, takeJson, parseTakes };
