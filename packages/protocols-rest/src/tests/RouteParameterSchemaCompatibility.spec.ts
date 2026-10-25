import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("route parameter schema compatibility", () => {
  it("accepts object-rooted Zod 4 pipelines and rejects scalar inputs or outputs", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-route-parameter-compatibility-"));
    const sourcePath = join(directory, "compatibility.ts");
    const schemaPath = resolve(import.meta.dirname, "../libs/internal/routeParameterSchema.ts");
    const zodPath = require.resolve("zod");

    // Check the recursive public schema boundary with the consumer TypeScript compiler.
    const source = `
import { z } from ${JSON.stringify(zodPath)};
import type { RouteParameterSchema } from ${JSON.stringify(schemaPath)};

type CurrentPipeline = Extract<RouteParameterSchema, { readonly def: { readonly type: "pipe" } }>;
declare const currentPipeline: CurrentPipeline;
const pipelineDefinition = currentPipeline.def;
// @ts-expect-error Pipeline definitions retain the readonly contract.
currentPipeline.def = pipelineDefinition;

type IsUnknown<T> = unknown extends T ? ([keyof T] extends [never] ? true : false) : false;
type Assert<T extends true> = T;
type CurrentInputIsUnknown = Assert<IsUnknown<z.input<RouteParameterSchema>>>;

function accept<Schema extends RouteParameterSchema>(schema: Schema): Schema { return schema; }
const object = z.object({ id: z.string() });
accept(object);
accept(object.refine(() => true));
accept(object.transform(({ id }) => ({ id: id.length })));
accept(object.transform(({ id }) => ({ count: id.length })).pipe(z.object({ count: z.number() })));
accept(object.refine(() => true).pipe(z.object({ id: z.string() })).refine(() => true));

// @ts-expect-error Scalar-input transforms cannot supply a route parameter object.
accept(z.string().transform((value) => ({ value })));
// @ts-expect-error Parameter outputs must remain objects.
accept(object.transform(({ id }) => id));
// @ts-expect-error Pipeline outputs must remain objects.
accept(object.pipe(z.string()));
// @ts-expect-error A scalar schema cannot supply route parameter fields.
accept(z.string());
`;

    try {
      writeFileSync(sourcePath, source);
      const program = ts.createProgram([sourcePath], {
        allowImportingTsExtensions: true,
        // This fixture exercises schema types and needs only the ES2022 standard library.
        lib: ["lib.es2022.d.ts"],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        types: [],
      });
      const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      }));

      expect(diagnostics).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
