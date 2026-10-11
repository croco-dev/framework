import { decodeCharacters } from "./characters";
import { normalizeValue } from "./normalize";
import { SourceDecodeProblem } from "./SourceDecodeProblem";
import type { SourcePosition, SourceRow, SourceSchema } from "./types";

export async function* decodeCsv(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
): AsyncGenerator<SourceRow> {
  const delimiter = schema.delimiter ?? ",";
  const fields: string[] = [];
  const positions: SourcePosition[] = [];
  let field = "";
  let fieldPosition: SourcePosition = { byteOffset: 0, line: 1, column: 1 };
  let inQuotes = false;
  let afterQuote = false;
  let skipLF = false;
  let recordBytes = 0;
  let records = 0;
  let sawContent = false;
  let headerIndexes: number[] | undefined;

  function finishField(): void {
    fields.push(field);
    positions.push(fieldPosition);
    field = "";
    afterQuote = false;
  }

  function finishRecord(position: SourcePosition): SourceRow | undefined {
    records++;
    if (records > schema.limits.maxRecords) {
      throw new SourceDecodeProblem(
        "record-limit",
        position,
        `Source exceeds ${schema.limits.maxRecords} records`,
      );
    }
    if (schema.header && headerIndexes === undefined) {
      const names = schema.fields.map((item) => item.name);
      if (
        fields.length !== names.length ||
        new Set(fields).size !== fields.length ||
        names.some((name) => !fields.includes(name))
      ) {
        throw new SourceDecodeProblem(
          "invalid-header",
          position,
          "CSV header must contain each schema field exactly once",
        );
      }
      headerIndexes = names.map((name) => fields.indexOf(name));
    } else {
      if (fields.length !== schema.fields.length) {
        throw new SourceDecodeProblem(
          "invalid-csv",
          position,
          `Expected ${schema.fields.length} CSV fields, received ${fields.length}`,
        );
      }
      const row: Record<string, string | number | Date | null> = {};
      for (const [index, item] of schema.fields.entries()) {
        const column = headerIndexes?.[index] ?? index;
        row[item.name] = normalizeValue(fields[column], item, positions[column]);
      }
      fields.length = 0;
      positions.length = 0;
      recordBytes = 0;
      sawContent = false;
      return row;
    }
    fields.length = 0;
    positions.length = 0;
    recordBytes = 0;
    sawContent = false;
    return undefined;
  }

  for await (const character of decodeCharacters(bytes, schema.limits)) {
    const { value, position, byteLength } = character;
    if (records === 0 && fieldPosition.byteOffset === 0 && !sawContent && position.byteOffset > 0) {
      fieldPosition = position;
    }
    if (skipLF) {
      skipLF = false;
      if (value === "\n") {
        fieldPosition = {
          byteOffset: position.byteOffset + byteLength,
          line: position.line,
          column: 1,
        };
        continue;
      }
    }
    const newline = !inQuotes && (value === "\n" || value === "\r");
    if (!newline) {
      recordBytes += byteLength;
      if (recordBytes > schema.limits.maxRowBytes) {
        throw new SourceDecodeProblem(
          "row-limit",
          position,
          `CSV record exceeds ${schema.limits.maxRowBytes} bytes`,
        );
      }
    }
    sawContent = true;
    if (inQuotes) {
      if (value === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        field += value;
      }
      continue;
    }
    if (afterQuote && value === '"') {
      field += '"';
      inQuotes = true;
      afterQuote = false;
      continue;
    }
    if (value === delimiter || newline) {
      finishField();
      if (newline) {
        const row = finishRecord(position);
        if (row !== undefined) yield row;
        skipLF = value === "\r";
      }
      fieldPosition = {
        byteOffset: position.byteOffset + byteLength,
        line: newline ? position.line + 1 : position.line,
        column: newline ? 1 : position.column + 1,
      };
      continue;
    }
    if (afterQuote || value === '"') {
      if (value === '"' && field.length === 0 && !afterQuote) {
        inQuotes = true;
        continue;
      }
      throw new SourceDecodeProblem(
        "invalid-csv",
        position,
        "Unexpected character after a quote or quote inside an unquoted field",
      );
    }
    field += value;
  }
  if (inQuotes)
    throw new SourceDecodeProblem(
      "invalid-csv",
      fieldPosition,
      "CSV record ends inside a quoted field",
    );
  if (sawContent) {
    finishField();
    const row = finishRecord(fieldPosition);
    if (row !== undefined) yield row;
  }
}
