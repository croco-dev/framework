import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pluginPath = fileURLToPath(new URL("../index.ts", import.meta.url));
const oxlintPath = fileURLToPath(
  new URL("../../../../node_modules/oxlint/bin/oxlint", import.meta.url),
);

const cases = [
  {
    name: "constructor decorator aliases retain their enclosing method scope",
    declarations:
      "class Factory { create() { const NAME = 'id', ALIAS = NAME; return class Nested { constructor(@Param(ALIAS) private ALIAS: string) {} }; } }",
    parameters: "",
    errors: 1,
  },
  {
    name: "method parameters do not shadow decorator arguments",
    declarations: "const ID = 'id', Q = `q`, H = ID;",
    parameters:
      "@Param(ID) ID: string, @Query(Q) Q: string, @Header(H) H: string, @Body(undefined) undefined: unknown",
    errors: 4,
  },
  {
    name: "quoted names",
    declarations: "",
    parameters: "@Param('id') id: string, @Query('q') q: string, @Header('h') h: string",
    errors: 3,
  },
  {
    name: "constant names and aliases",
    declarations: "const ID = 'id' as const, Q = `q`, H = ID;",
    parameters: "@Param(ID) id: string, @Query(Q) q: string, @Header(H) h: string",
    errors: 3,
  },
  {
    name: "unsubstituted template names",
    declarations: "",
    parameters: "@Param(`id`) id: string, @Query(`q`) q: string, @Header(`h`) h: string",
    errors: 3,
  },
  {
    name: "explicit undefined schemas",
    declarations: "const ID = 'id';",
    parameters:
      "@Body(undefined) body: unknown, @Param(ID, undefined) id: string, @Query('q', undefined) q: string, @Header(`h`, undefined) h: string",
    errors: 4,
  },
  {
    name: "void schemas and type assertions",
    declarations: "",
    parameters: "@Body(void 0) body: unknown, @Param('id', undefined as never) id: string",
    errors: 2,
  },
  {
    name: "schemas, contract overloads and whole query objects",
    declarations:
      "const ID = 'id'; const schema = z.string(); const contract = defineRouteContract({ method: 'GET', path: '/:id', params: z.object({ id: schema }), query: z.object({ q: schema }), body: schema });",
    parameters:
      "@Param(ID, schema) id: string, @Query(`q`, z.string()) q: string, @Header('h', schema) h: string, @Body(schema) body: string, @Param(contract, 'id') contractId: string, @Query(contract, 'q') contractQuery: string, @Body(contract) contractBody: string, @Query() query: unknown",
    errors: 0,
  },
  {
    name: "unknown expressions and shadowed bindings",
    declarations:
      "const ID = 'id'; function controller(ID: string, undefined: z.ZodType) { return class A { run(@Param(ID) id: string, @Body(undefined) other: unknown) {} }; } const dynamic = readName(); let mutable = 'q'; const cycleA = cycleB, cycleB = cycleA;",
    parameters:
      "@Param(dynamic) id: string, @Query(mutable) q: string, @Param(cycleA) cycle: string, @Query(`q${dynamic}`) interpolated: string",
    errors: 0,
  },
] as const;

describe("REST generated contract schema through Oxlint", () => {
  it.each(cases)("$name", ({ declarations, parameters, errors }) => {
    const directory = mkdtempSync(join(tmpdir(), "croco-rest-schema-"));
    try {
      const config = join(directory, "config.json");
      const source = join(directory, "controller.ts");
      writeFileSync(
        config,
        JSON.stringify({
          categories: { correctness: "off" },
          jsPlugins: [{ name: "@croco/oxlint-rules", specifier: pluginPath }],
          rules: { "@croco/oxlint-rules/rest-generated-contract-schema": "error" },
        }),
      );
      writeFileSync(
        source,
        `
        import { Body, Param, Query, Header, defineRouteContract } from '@croco/protocols-rest';
        import { z } from 'zod';
        ${declarations}
        export class Controller { run(${parameters}) {} }
      `,
      );
      const result = spawnSync(process.execPath, [oxlintPath, "-c", config, "-f", "json", source], {
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as {
        diagnostics: { code: string; severity: string }[];
      };
      expect(output.diagnostics).toHaveLength(errors);
      expect(
        output.diagnostics.every(
          (diagnostic) =>
            diagnostic.code === "@croco/oxlint-rules(rest-generated-contract-schema)" &&
            diagnostic.severity === "error",
        ),
      ).toBe(true);
      expect(result.status).toBe(errors > 0 ? 1 : 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
