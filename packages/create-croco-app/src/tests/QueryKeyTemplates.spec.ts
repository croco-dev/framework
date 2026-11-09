import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { Problem, ProblemCategory } from "@croco/problems-core";
import Handlebars from "handlebars";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("RPC query key templates", () => {
  it.each(["admin-console", "spa-be-split", "saas-node-postgres-contracts"])(
    "preserves own properties in the %s client support",
    (template) => {
      const source = Handlebars.compile(
        readFileSync(
          join(__dirname, "../../templates", template, "libs/shared/provider-rpc/src/rpc.ts.hbs"),
          "utf8",
        ),
      )({ scope: "@test" });
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const context = {
        exports: {} as Record<string, unknown>,
        require: (specifier: string) => {
          expect(["@croco/problems-core", "@croco/frontend-problems"]).toContain(specifier);
          return specifier === "@croco/problems-core" ? { Problem, ProblemCategory } : {};
        },
      };
      runInNewContext(output, context);
      const serialize = context.exports.serializeRpcQueryKeyInput as (input: unknown) => unknown;
      const red = JSON.parse('{"__proto__":"red","constructor":{"prototype":true}}') as unknown;
      const blue = JSON.parse('{"__proto__":{"shade":"blue"}}') as unknown;
      const serializedRed = serialize({ filter: [red] });
      const serializedBlue = serialize({ filter: [blue] });
      expect(JSON.parse(JSON.stringify(serializedRed))).toEqual({ filter: [red] });
      expect(JSON.parse(JSON.stringify(serializedBlue))).toEqual({ filter: [blue] });
      expect(JSON.stringify(serializedRed)).not.toBe(JSON.stringify(serializedBlue));
    },
  );
});
