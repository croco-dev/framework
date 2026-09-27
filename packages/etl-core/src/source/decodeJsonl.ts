import { decodeCharacters } from "./characters";
import { normalizeValue } from "./normalize";
import { SourceDecodeProblem } from "./SourceDecodeProblem";
import type { SourcePosition, SourceRow, SourceSchema } from "./types";

export async function* decodeJsonl(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
): AsyncGenerator<SourceRow> {
  let line = "";
  let lineBytes = 0;
  let records = 0;
  let skipLF = false;
  let linePosition: SourcePosition = { byteOffset: 0, line: 1, column: 1 };

  function finishLine(position: SourcePosition): SourceRow {
    records++;
    if (records > schema.limits.maxRecords) {
      throw new SourceDecodeProblem(
        "record-limit",
        position,
        `Source exceeds ${schema.limits.maxRecords} records`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new SourceDecodeProblem("invalid-jsonl", linePosition, "Invalid JSONL record");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new SourceDecodeProblem(
        "invalid-jsonl",
        linePosition,
        "JSONL record must be an object",
      );
    }
    const object = parsed as Record<string, unknown>;
    const { fields: tokens, duplicate } = topLevelFieldTokens(line);
    if (duplicate) {
      throw new SourceDecodeProblem(
        "invalid-jsonl",
        fieldPosition(duplicate.offset),
        `Duplicate JSONL field '${duplicate.name}'`,
        duplicate.name,
      );
    }
    const allowed = new Set(schema.fields.map((field) => field.name));
    for (const key of Object.keys(object)) {
      if (!allowed.has(key))
        throw new SourceDecodeProblem(
          "invalid-field",
          fieldPosition(tokens.get(key)?.offset),
          `Unknown field '${key}'`,
          key,
        );
    }
    const row: Record<string, string | number | Date | null> = {};
    for (const field of schema.fields) {
      if (!Object.hasOwn(object, field.name)) {
        throw new SourceDecodeProblem(
          "invalid-field",
          linePosition,
          `Missing field '${field.name}'`,
          field.name,
        );
      }
      const token = tokens.get(field.name);
      row[field.name] = normalizeValue(
        object[field.name],
        field,
        fieldPosition(token?.offset),
        field.type === "number" ? token?.number : undefined,
      );
    }
    return row;
  }

  function fieldPosition(offset: number | undefined): SourcePosition {
    if (offset === undefined) return linePosition;
    const prefix = line.slice(0, offset);
    return {
      byteOffset: linePosition.byteOffset + new TextEncoder().encode(prefix).byteLength,
      line: linePosition.line,
      column: linePosition.column + Array.from(prefix).length,
    };
  }

  for await (const character of decodeCharacters(bytes, schema.limits)) {
    const { value, position, byteLength } = character;
    if (
      records === 0 &&
      linePosition.byteOffset === 0 &&
      line.length === 0 &&
      position.byteOffset > 0
    ) {
      linePosition = position;
    }
    if (skipLF) {
      skipLF = false;
      if (value === "\n") {
        linePosition = {
          byteOffset: position.byteOffset + byteLength,
          line: position.line,
          column: 1,
        };
        continue;
      }
    }
    if (value === "\n" || value === "\r") {
      yield finishLine(position);
      line = "";
      lineBytes = 0;
      skipLF = value === "\r";
      linePosition = {
        byteOffset: position.byteOffset + byteLength,
        line: position.line + 1,
        column: 1,
      };
      continue;
    }
    lineBytes += byteLength;
    if (lineBytes > schema.limits.maxRowBytes) {
      throw new SourceDecodeProblem(
        "row-limit",
        position,
        `JSONL record exceeds ${schema.limits.maxRowBytes} bytes`,
      );
    }
    line += value;
  }
  if (line.length > 0) yield finishLine(linePosition);
}

type FieldToken = { readonly offset: number; readonly number?: string };

function topLevelFieldTokens(line: string): {
  fields: ReadonlyMap<string, FieldToken>;
  duplicate?: { name: string; offset: number };
} {
  const fields = new Map<string, FieldToken>();
  let depth = 0;
  let expectingKey = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      const start = index;
      index++;
      while (index < line.length) {
        if (line[index] === "\\") {
          index += 2;
          continue;
        }
        if (line[index] === '"') break;
        index++;
      }
      if (depth === 1 && expectingKey) {
        const name = JSON.parse(line.slice(start, index + 1)) as string;
        if (fields.has(name)) return { fields, duplicate: { name, offset: start } };
        let valueStart = index + 1;
        while (/\s/.test(line[valueStart] ?? "")) valueStart++;
        valueStart++;
        while (/\s/.test(line[valueStart] ?? "")) valueStart++;
        const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
          line.slice(valueStart),
        )?.[0];
        fields.set(name, { offset: start, ...(number === undefined ? {} : { number }) });
        expectingKey = false;
      }
      continue;
    }
    if (character === "{" || character === "[") {
      depth++;
      if (depth === 1) expectingKey = true;
    } else if (character === "}" || character === "]") {
      depth--;
    } else if (character === "," && depth === 1) {
      expectingKey = true;
    }
  }
  return { fields };
}
