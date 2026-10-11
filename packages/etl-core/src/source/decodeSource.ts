import { decodeCsv } from "./decodeCsv";
import { decodeJsonl } from "./decodeJsonl";
import { SourceDecodeProblem } from "./SourceDecodeProblem";
import type { SourceRow, SourceSchema } from "./types";

const START = { byteOffset: 0, line: 1, column: 1 };

export function decodeSource(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
): AsyncIterable<SourceRow> {
  validateSchema(schema);
  return schema.format === "csv" ? decodeCsv(bytes, schema) : decodeJsonl(bytes, schema);
}

function validateSchema(schema: SourceSchema): void {
  const invalid = (detail: string): never => {
    throw new SourceDecodeProblem("invalid-schema", START, detail);
  };
  if (schema.encoding !== "utf-8") invalid("Only utf-8 encoding is supported");
  if (schema.format !== "csv" && schema.format !== "jsonl") invalid("Unsupported source format");
  if (schema.fields.length === 0) invalid("At least one field is required");
  const names = new Set<string>();
  for (const field of schema.fields) {
    if (!field.name || names.has(field.name) || field.name === "__proto__")
      invalid("Field names must be nonempty and unique");
    if (field.type !== "string" && field.type !== "number" && field.type !== "date")
      invalid(`Unsupported field type for '${field.name}'`);
    names.add(field.name);
  }
  if (schema.limits === undefined) invalid("All source limits are required");
  for (const [name, value] of Object.entries(schema.limits)) {
    if (!Number.isSafeInteger(value) || value < 1)
      invalid(`${name} must be a positive safe integer`);
  }
  if (
    Object.keys(schema.limits).length !== 3 ||
    !Number.isSafeInteger(schema.limits.maxBytes) ||
    !Number.isSafeInteger(schema.limits.maxRecords) ||
    !Number.isSafeInteger(schema.limits.maxRowBytes)
  )
    invalid("All source limits are required");
  if (schema.format === "csv") {
    if (
      schema.delimiter !== undefined &&
      (Array.from(schema.delimiter).length !== 1 || /["\r\n]/.test(schema.delimiter))
    ) {
      invalid("CSV delimiter must be one character other than quote or newline");
    }
  } else if (schema.delimiter !== undefined || schema.header !== undefined) {
    invalid("JSONL does not accept CSV options");
  }
}
