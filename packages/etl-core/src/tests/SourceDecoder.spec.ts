import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decodeSource, SourceDecodeProblem } from "../source";
import type { SourceRow, SourceSchema } from "../source";

const limits = { maxBytes: 1024, maxRecords: 10, maxRowBytes: 128 };
const fields = [
  { name: "id", type: "number" as const },
  { name: "name", type: "string" as const, nullable: true, nullValues: ["NULL"] },
  { name: "created", type: "date" as const },
];
const csvSchema: SourceSchema = { format: "csv", encoding: "utf-8", fields, header: true, limits };
const jsonlSchema: SourceSchema = { format: "jsonl", encoding: "utf-8", fields, limits };
const encoder = new TextEncoder();
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function collect(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  for await (const row of decodeSource(bytes, schema)) rows.push(row);
  return rows;
}

async function* chunks(value: string, size: number): AsyncGenerator<Uint8Array> {
  const bytes = encoder.encode(value);
  for (let offset = 0; offset < bytes.length; offset += size)
    yield bytes.slice(offset, offset + size);
}

async function* oneChunk(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes;
}

async function errorFor(value: string, schema: SourceSchema): Promise<SourceDecodeProblem> {
  try {
    await collect(chunks(value, 2), schema);
  } catch (error) {
    if (error instanceof SourceDecodeProblem) return error;
    throw error;
  }
  throw new Error("Expected decoding to fail");
}

describe("source decoder", () => {
  it("decodes a real CSV file stream with quoted multiline fields, reordered headers, BOM and normalized values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "croco-etl-source-"));
    directories.push(directory);
    const path = join(directory, "source.csv");
    await writeFile(
      path,
      '\uFEFFname;created;id\r\n"한\n글";2024-02-29;42\r\nNULL;2024-03-01;43\r\n',
    );
    const rows = await collect(createReadStream(path, { highWaterMark: 1 }), {
      ...csvSchema,
      delimiter: ";",
    });
    expect(rows).toEqual([
      { id: 42, name: "한\n글", created: new Date("2024-02-29T00:00:00.000Z") },
      { id: 43, name: null, created: new Date("2024-03-01T00:00:00.000Z") },
    ]);
  });

  it("decodes JSONL across byte splits and normalizes timestamps", async () => {
    const rows = await collect(
      chunks('{"id":1,"name":"한글","created":"2024-04-01T09:30:00+09:00"}\r\n', 1),
      jsonlSchema,
    );
    expect(rows).toEqual([{ id: 1, name: "한글", created: new Date("2024-04-01T00:30:00.000Z") }]);
  });

  it("reports malformed CSV and JSONL with source positions", async () => {
    const csv = await errorFor('id,name,created\n1,"bad"x,2024-01-01', csvSchema);
    expect(csv.code).toBe("etl-core/source-decode-failed");
    expect(csv.reason).toBe("invalid-csv");
    expect(csv.toJSON()).toMatchObject({
      code: "etl-core/source-decode-failed",
      reason: "invalid-csv",
    });
    expect(csv.position).toMatchObject({ line: 2, column: 8 });
    const jsonl = await errorFor('{"id":1,\n', jsonlSchema);
    expect(jsonl.reason).toBe("invalid-jsonl");
    expect(jsonl.position).toMatchObject({ line: 1, column: 1 });
  });

  it("rejects invalid UTF-8, including incomplete final characters", async () => {
    await expect(collect(oneChunk(Uint8Array.of(0xff)), jsonlSchema)).rejects.toMatchObject({
      reason: "invalid-utf8",
    });
    await expect(collect(oneChunk(Uint8Array.of(0x61, 0xff)), jsonlSchema)).rejects.toMatchObject({
      reason: "invalid-utf8",
      position: { byteOffset: 1, line: 1, column: 2 },
    });
    await expect(collect(oneChunk(Uint8Array.of(0xe2, 0x82)), jsonlSchema)).rejects.toMatchObject({
      reason: "invalid-utf8",
    });
  });

  it("rejects byte, record and row limits", async () => {
    await expect(
      collect(chunks("12345", 2), { ...jsonlSchema, limits: { ...limits, maxBytes: 4 } }),
    ).rejects.toMatchObject({ reason: "byte-limit" });
    await expect(
      collect(chunks("id,name,created\n1,a,2024-01-01\n", 1), {
        ...csvSchema,
        limits: { ...limits, maxRecords: 1 },
      }),
    ).rejects.toMatchObject({ reason: "record-limit" });
    await expect(
      collect(chunks('{"id":1}', 1), { ...jsonlSchema, limits: { ...limits, maxRowBytes: 5 } }),
    ).rejects.toMatchObject({ reason: "row-limit" });
  });

  it("rejects unsafe numbers, invalid dates, nulls and missing fields", async () => {
    expect(
      (await errorFor("id,name,created\n9007199254740992,a,2024-01-01", csvSchema)).field,
    ).toBe("id");
    expect((await errorFor("id,name,created\n1,a,2024-02-30", csvSchema)).field).toBe("created");
    expect((await errorFor("id,name,created\nNULL,a,2024-01-01", csvSchema)).field).toBe("id");
    expect((await errorFor('{"id":1,"name":"a"}', jsonlSchema)).field).toBe("created");
  });

  it("rejects an incorrect CSV header and unknown JSONL fields", async () => {
    expect((await errorFor("id,name,name\n1,a,2024-01-01", csvSchema)).reason).toBe(
      "invalid-header",
    );
    expect(
      (await errorFor('{"id":1,"name":"a","created":"2024-01-01","extra":1}', jsonlSchema)).field,
    ).toBe("extra");
  });

  it("locates a JSONL key after a matching string value and an optional BOM", async () => {
    const schema: SourceSchema = {
      format: "jsonl",
      encoding: "utf-8",
      fields: [
        { name: "s", type: "string" },
        { name: "n", type: "number" },
      ],
      limits,
    };
    const valueError = await errorFor('{"s":"n","n":"bad"}', schema);
    expect(valueError.position).toEqual({ byteOffset: 9, line: 1, column: 10 });
    const bomError = await errorFor('\uFEFF{"n":"bad"}', {
      ...schema,
      fields: [{ name: "n", type: "number" }],
    });
    expect(bomError.position).toEqual({ byteOffset: 4, line: 1, column: 2 });
  });

  it("normalizes valid dates and timestamps in years 0000 through 0099", async () => {
    const schema: SourceSchema = {
      format: "jsonl",
      encoding: "utf-8",
      fields: [{ name: "date", type: "date" }],
      limits,
    };
    const rows = await collect(
      chunks('{"date":"0000-02-29"}\n{"date":"0099-12-31T23:00:00+01:00"}', 1),
      schema,
    );
    expect(rows).toEqual([
      { date: new Date("0000-02-29T00:00:00.000Z") },
      { date: new Date("0099-12-31T22:00:00.000Z") },
    ]);
  });

  it("rejects JSON numbers that underflow or lose decimal precision", async () => {
    const schema: SourceSchema = {
      format: "jsonl",
      encoding: "utf-8",
      fields: [{ name: "n", type: "number" }],
      limits,
    };
    expect((await errorFor('{"n":1e-999}', schema)).field).toBe("n");
    expect((await errorFor('{"n":9007199254740991.1}', schema)).field).toBe("n");
    expect(await collect(chunks('{"n":0.10}', 1), schema)).toEqual([{ n: 0.1 }]);
  });

  it("applies null markers to JSON strings without treating numeric zero as null", async () => {
    const schema: SourceSchema = {
      format: "jsonl",
      encoding: "utf-8",
      fields: [{ name: "n", type: "number", nullable: true, nullValues: ["0"] }],
      limits,
    };
    expect(await collect(chunks('{"n":"0"}\n{"n":0}\n{"n":0.0}\n{"n":0e0}', 1), schema)).toEqual([
      { n: null },
      { n: 0 },
      { n: 0 },
      { n: 0 },
    ]);
  });
});
