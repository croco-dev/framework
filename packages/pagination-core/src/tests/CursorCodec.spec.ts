import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { createCursorCodec } from "../libs/cursor";
import { InvalidCursorProblem } from "../libs/problems";

const compoundCursorSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  createdAt: z.string(),
});

const compoundCursorCodec = createCursorCodec(compoundCursorSchema);

function encodeRawCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

describe("createCursorCodec", () => {
  it("should infer and preserve a compound cursor schema output", () => {
    const payload = {
      v: 1 as const,
      id: "post_01HXYZ",
      createdAt: "2026-08-27T10:00:00.000Z",
    };

    const decoded = compoundCursorCodec.decode(compoundCursorCodec.encode(payload));

    expect(decoded).toEqual(payload);
    expectTypeOf(decoded).toEqualTypeOf<{
      v: 1;
      id: string;
      createdAt: string;
    }>();
  });

  it("should not allow decode callers to replace the inferred payload type", () => {
    const encoded = compoundCursorCodec.encode({
      v: 1,
      id: "post_01HXYZ",
      createdAt: "2026-08-27T10:00:00.000Z",
    });

    // @ts-expect-error decode owns its return type through the factory schema.
    compoundCursorCodec.decode<{ spoofed: true }>(encoded);

    // @ts-expect-error the inferred payload cannot be assigned to an unrelated shape.
    const spoofed: { spoofed: true } = compoundCursorCodec.decode(encoded);
    expect(spoofed).toBeDefined();
  });

  it("should require version and id fields in the factory schema", () => {
    // @ts-expect-error cursor schemas must include the common version and id fields.
    createCursorCodec(z.object({ createdAt: z.string() }));
    // @ts-expect-error cursor schema outputs must keep id as a string.
    createCursorCodec(z.object({ v: z.literal(1), id: z.number() }));

    expect(true).toBe(true);
  });

  it.each([
    [{ v: 1, id: "post_01HXYZ" }, "missing compound field"],
    [{ v: 1, id: "post_01HXYZ", createdAt: 123 }, "wrong compound field type"],
    [{ id: "post_01HXYZ", createdAt: "2026-08-27T10:00:00.000Z" }, "missing version"],
    [{ v: "1", id: "post_01HXYZ", createdAt: "2026-08-27T10:00:00.000Z" }, "wrong version type"],
    [{ v: 99, id: "post_01HXYZ", createdAt: "2026-08-27T10:00:00.000Z" }, "unsupported version"],
  ])("should reject %s with a stable Problem (%s)", (payload, _reason) => {
    expect(() => compoundCursorCodec.decode(encodeRawCursor(payload))).toThrow(
      expect.objectContaining({ code: "INVALID_CURSOR" }),
    );
  });

  it("should report distinct schema issue paths without invalid values", () => {
    expect(() =>
      compoundCursorCodec.decode(encodeRawCursor({ v: 1, id: "private-id", createdAt: 123 })),
    ).toThrow(
      expect.objectContaining({
        detail: "Cursor payload does not match the schema: createdAt",
      }),
    );

    const rootCodec = createCursorCodec(compoundCursorSchema.refine(() => false));
    expect(() =>
      rootCodec.decode(
        encodeRawCursor({
          v: 1,
          id: "private-id",
          createdAt: "2026-08-27T10:00:00.000Z",
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        detail: "Cursor payload does not match the schema: (root)",
      }),
    );
  });

  it("should validate payloads before encoding", () => {
    expect(() =>
      compoundCursorCodec.encode({
        v: 1,
        id: "post_01HXYZ",
        createdAt: 123,
      } as unknown as z.output<typeof compoundCursorSchema>),
    ).toThrow(InvalidCursorProblem);

    const versionedSchema = z.object({
      v: z.number(),
      id: z.string(),
      createdAt: z.string(),
    });
    const versionedCodec = createCursorCodec(versionedSchema);

    expect(() =>
      versionedCodec.encode({
        v: 99,
        id: "post_01HXYZ",
        createdAt: "2026-08-27T10:00:00.000Z",
      }),
    ).toThrow(InvalidCursorProblem);
  });

  it("should apply the caller schema unknown-key policy", () => {
    const encoded = encodeRawCursor({
      v: 1,
      id: "post_01HXYZ",
      createdAt: "2026-08-27T10:00:00.000Z",
      unexpected: true,
    });

    expect(compoundCursorCodec.decode(encoded)).not.toHaveProperty("unexpected");

    const strictCodec = createCursorCodec(z.strictObject(compoundCursorSchema.shape));
    expect(() => strictCodec.decode(encoded)).toThrow(InvalidCursorProblem);

    const looseCodec = createCursorCodec(z.looseObject(compoundCursorSchema.shape));
    expect(looseCodec.decode(encoded)).toMatchObject({ unexpected: true });
  });

  it("should support bidirectional Zod codecs without applying transforms twice", () => {
    let decodeCalls = 0;
    let encodeCalls = 0;
    const dateCodec = z.codec(z.iso.datetime(), z.date(), {
      decode: (value) => {
        decodeCalls += 1;
        return new Date(value);
      },
      encode: (value) => {
        encodeCalls += 1;
        return value.toISOString();
      },
    });
    const codec = createCursorCodec(
      z.object({
        v: z.literal(1),
        id: z.string(),
        createdAt: dateCodec,
      }),
    );
    const createdAt = new Date("2026-08-27T10:00:00.000Z");

    const encoded = codec.encode({ v: 1, id: "post_01HXYZ", createdAt });
    expect({ decodeCalls, encodeCalls }).toEqual({ decodeCalls: 0, encodeCalls: 1 });

    const decoded = codec.decode(encoded);

    expect(decoded).toEqual({ v: 1, id: "post_01HXYZ", createdAt });
    expectTypeOf(decoded.createdAt).toEqualTypeOf<Date>();
    expect({ decodeCalls, encodeCalls }).toEqual({ decodeCalls: 1, encodeCalls: 1 });
  });

  it("should reject schema outputs whose JSON wire cannot be decoded", () => {
    const codec = createCursorCodec(
      z.object({
        v: z.literal(1),
        id: z.string(),
        createdAt: z.date(),
      }),
    );

    expect(() =>
      codec.encode({
        v: 1,
        id: "post_01HXYZ",
        createdAt: new Date("2026-08-27T10:00:00.000Z"),
      }),
    ).toThrow(InvalidCursorProblem);
  });

  it("should reject sparse arrays even when extra keys balance the serialized shape", () => {
    const codec = createCursorCodec(
      z.object({
        v: z.literal(1),
        id: z.string(),
        values: z.any(),
      }),
    );
    const values: unknown[] = [];
    values.length = 1;
    Object.assign(values, { extra: "lost" });

    expect(() => codec.encode({ v: 1, id: "post_01HXYZ", values })).toThrow(InvalidCursorProblem);
  });

  it("should preserve acyclic shared values by structure", () => {
    const codec = createCursorCodec(
      z.object({
        v: z.literal(1),
        id: z.string(),
        left: z.any(),
        right: z.any(),
      }),
    );
    const shared = { rank: 7 };

    const decoded = codec.decode(
      codec.encode({ v: 1, id: "post_01HXYZ", left: shared, right: shared }),
    );

    expect(decoded).toEqual({ v: 1, id: "post_01HXYZ", left: { rank: 7 }, right: { rank: 7 } });
  });

  it("should reject serialization that mutates the validated payload", () => {
    const codec = createCursorCodec(
      z.looseObject({
        v: z.number(),
        id: z.string(),
      }),
    );

    expect(() =>
      codec.encode({
        v: 1,
        id: "post_01HXYZ",
        toJSON: () => ({ v: 99, id: "post_01HXYZ" }),
      }),
    ).toThrow(InvalidCursorProblem);

    expect(() =>
      codec.encode({
        v: 1,
        id: "post_01HXYZ",
        toJSON: () => ({ v: 1, id: "rewritten" }),
      }),
    ).toThrow(InvalidCursorProblem);
  });

  it("should map unidirectional schema and serialization failures to InvalidCursorProblem", () => {
    const transformedCodec = createCursorCodec(
      z.object({
        v: z.literal(1),
        id: z.string(),
        createdAt: z.string().transform((value) => new Date(value)),
      }),
    );

    expect(() =>
      transformedCodec.encode({
        v: 1,
        id: "post_01HXYZ",
        createdAt: new Date("2026-08-27T10:00:00.000Z"),
      }),
    ).toThrow(InvalidCursorProblem);

    const recursive: { self?: unknown; v: number; id: string } = { v: 1, id: "post_01HXYZ" };
    recursive.self = recursive;
    const looseCodec = createCursorCodec(
      z.looseObject({
        v: z.number(),
        id: z.string(),
      }),
    );

    expect(() => looseCodec.encode(recursive)).toThrow(InvalidCursorProblem);
  });
});
