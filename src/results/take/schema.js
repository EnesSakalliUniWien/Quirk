import { z } from "zod";
import { RANDOM_FORMAT } from "../../engine/simulation/random.js";

const TAKE_FORMAT = "shadow-quant-take/1";

// Schemas validate stored JSON; circuit and display relationships are checked separately.
const unavailable = z.strictObject({
  unavailable: z.enum(["NaN", "Infinity", "-Infinity"]),
});
const number = z.union([z.number(), unavailable]);
const json = z.json();
const matrix = z
  .strictObject({
    kind: z.literal("matrix"),
    width: z.int().min(1).max(65536),
    height: z.int().min(1).max(65536),
    buffer: z.array(number),
  })
  .refine(
    (v) => v.buffer.length === 2 * v.width * v.height,
    "Invalid matrix dimensions",
  );
const statsSchema = z.strictObject({
  circuit: z.record(z.string(), json),
  wires: z.int().min(0).max(16),
  available: z.boolean(),
  amplitudes: z.array(number).max(131072),
  survival: z.array(number),
  densities: z.array(z.array(z.array(number).length(8))),
  custom: z.array(z.tuple([z.string().regex(/^(0|[1-9]\d*):(0|[1-9]\d*)$/), json])),
  samples: z.record(
    z.string(),
    z.strictObject({ i: z.int().min(0), p: z.number().min(0).max(1.00001) }),
  ),
  readable: z.record(z.string(), json),
});
const takeSchema = z.strictObject({
  format: z.literal(TAKE_FORMAT),
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  colour: z.int().min(0).max(7),
  recorded: z.iso.datetime(),
  notes: z.string().max(10000),
  circuit: z.record(z.string(), json),
  wires: z.int().min(0).max(16),
  step: z.int().min(0),
  phase: z.number().min(0).lt(1),
  seed: z.string().min(1).max(256),
  randomFormat: z.literal(RANDOM_FORMAT),
  result: statsSchema,
  fullResult: statsSchema,
});

export { TAKE_FORMAT, unavailable, matrix, takeSchema };
