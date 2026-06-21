import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
  CONTRACT_SCHEMA_ZOD_EFFECTS_UNWRAPPED_DIAGNOSTIC_CODE,
  describeZodSchema,
  getSchemaDescriptorDiagnostics,
  JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX,
} from "../libs/SchemaDescriptor";

const NUMERIC_NATIVE_ENUM = {
  0: "Draft",
  1: "Published",
  Draft: 0,
  Published: 1,
} as const;
const MIXED_NATIVE_ENUM = {
  0: "Draft",
  Draft: 0,
  Published: "published",
} as const;

describe("SchemaDescriptor", () => {
  it("should describe optional, nullable, default, and refined schemas with one shared tree", () => {
    const descriptor = describeZodSchema(
      z.object({
        displayName: z.string().nullable().default(null),
        email: z.string().email().optional(),
        tags: z.array(z.string().refine((value) => value.length > 0)),
      }),
    );

    expect(descriptor).toMatchObject({
      kind: "object",
      typeName: "ZodObject",
      jsonSafe: true,
      fields: [
        {
          name: "displayName",
          required: false,
          schema: {
            kind: "default",
            inner: {
              kind: "nullable",
              inner: { kind: "string", jsonSafe: true },
            },
          },
        },
        {
          name: "email",
          required: false,
          schema: {
            kind: "optional",
            inner: { kind: "string", jsonSafe: true },
          },
        },
        {
          name: "tags",
          required: true,
          schema: {
            kind: "array",
            element: {
              kind: "effects",
              effectType: "refinement",
              inner: { kind: "string", jsonSafe: true },
            },
          },
        },
      ],
    });
    expect(getSchemaDescriptorDiagnostics(descriptor)).toEqual([
      expect.objectContaining({
        code: CONTRACT_SCHEMA_ZOD_EFFECTS_UNWRAPPED_DIAGNOSTIC_CODE,
        severity: "warning",
        schemaPath: ["tags", "[]"],
      }),
    ]);
  });

  it("should report JSON-unsafe schemas with one diagnostic code and precise paths", () => {
    const descriptor = describeZodSchema(
      z.object({
        amount: z.bigint(),
        checkedAt: z.date(),
        trimmed: z.string().transform((value) => value.trim()),
      }),
    );

    const diagnostics = getSchemaDescriptorDiagnostics(descriptor).filter(
      (diagnostic) => diagnostic.severity === "error",
    );

    expect(descriptor).toMatchObject({ kind: "object", jsonSafe: false });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["amount"],
        typeName: "ZodBigInt",
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["checkedAt"],
        typeName: "ZodDate",
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["trimmed"],
        typeName: "ZodEffects",
      }),
    ]);
  });

  it("should ignore TypeScript native enum reverse mappings", () => {
    expect(describeZodSchema(z.nativeEnum(NUMERIC_NATIVE_ENUM))).toMatchObject({
      kind: "enum",
      values: [0, 1],
      jsonSafe: true,
    });
    expect(describeZodSchema(z.nativeEnum(MIXED_NATIVE_ENUM))).toMatchObject({
      kind: "enum",
      values: [0, "published"],
      jsonSafe: true,
    });
  });

  it("should reject non-finite literal and enum number values", () => {
    const descriptor = describeZodSchema(
      z.object({
        enumValue: z.nativeEnum({
          Finite: 1,
          Infinite: Number.POSITIVE_INFINITY,
        }),
        infinite: z.literal(Number.POSITIVE_INFINITY),
        nan: z.literal(Number.NaN),
      }),
    );

    expect(getSchemaDescriptorDiagnostics(descriptor)).toEqual([
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["enumValue"],
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["infinite"],
        typeName: "ZodLiteral",
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        schemaPath: ["nan"],
        typeName: "ZodLiteral",
      }),
    ]);
  });

  it("should expose the JSON-safe Zod support matrix", () => {
    expect(JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          typeName: "ZodString",
          jsonSafe: "supported",
        }),
        expect.objectContaining({
          typeName: "ZodDate",
          jsonSafe: "unsupported",
        }),
        expect.objectContaining({
          typeName: "ZodEffects",
          jsonSafe: "supported",
        }),
      ]),
    );
  });

  it("should keep Zod internals isolated to the shared schema descriptor", () => {
    const repoRoot = join(__dirname, "../../../..");
    const sourceRoots = [
      join(repoRoot, "packages/protocols-core/src/libs"),
      join(repoRoot, "packages/rpc-codegen/src/libs"),
      join(repoRoot, "packages/openapi-spec/src/libs"),
    ];
    const allowedFile = join(repoRoot, "packages/protocols-core/src/libs/SchemaDescriptor.ts");
    const forbiddenPatterns = ["constructor.name", "._def", '"_def"', "instanceof z.ZodEffects"];
    const offenders = sourceRoots.flatMap((sourceRoot) =>
      collectTypeScriptFiles(sourceRoot)
        .filter((filePath) => filePath !== allowedFile)
        .flatMap((filePath) => {
          const content = readFileSync(filePath, "utf8");

          return forbiddenPatterns
            .filter((pattern) => content.includes(pattern))
            .map((pattern) => `${filePath.replace(`${repoRoot}/`, "")}: ${pattern}`);
        }),
    );

    expect(offenders).toEqual([]);
  });
});

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      return collectTypeScriptFiles(filePath);
    }

    return filePath.endsWith(".ts") ? [filePath] : [];
  });
}
