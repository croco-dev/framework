import path from "node:path";
import type { Rule } from "eslint";
import { describe, expect, it } from "vitest";
import rule from "../rules/no-datasource-import.ts";

const declarationTypes = [
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportAllDeclaration",
] as const;
type DeclarationType = (typeof declarationTypes)[number];

function run(file: string, type: DeclarationType, value: string | null): unknown[] {
  const reports: unknown[] = [];
  const node = { type, source: value === null ? null : { type: "Literal", value } };
  const context = {
    filename: path.resolve("/repo", file),
    report(descriptor: unknown) {
      reports.push(descriptor);
    },
  } as unknown as Rule.RuleContext;
  const listener = rule.create(context)[type];
  if (typeof listener === "function") {
    listener(node as never);
  }
  return reports;
}

describe.each(declarationTypes)("no-datasource-import %s", (type) => {
  for (const layer of ["domain", "service", "application"]) {
    it.each([
      [`libs/orders/src/${layer}/index.ts`, "../datasource/repository"],
      [`libs/orders/src/${layer}/index.ts`, "../datasource"],
      [`libs/orders/${layer}/src/index.ts`, "../../datasource/src/repository"],
      [`libs/orders/${layer}/src/index.ts`, "../../datasource"],
    ])("reports %s importing %s", (file, value) => {
      expect(run(file, type, value)).toEqual([
        expect.objectContaining({ messageId: "noDatasourceImport", data: { layer } }),
      ]);
    });
  }

  it.each([
    ["libs/orders/src/datasource/index.ts", "./client"],
    ["libs/orders/datasource/src/index.ts", "./client"],
    ["libs/orders/src/service/index.ts", "../domain/order"],
    ["libs/orders/service/src/index.ts", "../../domain/src/order"],
    ["libs/orders/src/service/index.ts", "@scope/orders-datasource"],
    ["libs/orders/src/service/index.ts", "../datasource-utils/client"],
    ["libs/orders/src/service/index.ts", "../my-datasource/client"],
    ["libs/orders/src/service/index.ts", "../datasource.ts"],
    ["libs/orders/src/service-utils/index.ts", "../datasource/client"],
    ["libs/orders/src/my-domain/index.ts", "../datasource/client"],
    ["libs/orders/src/application-utils/index.ts", "../datasource/client"],
    ["libs/orders/src/ui/index.ts", "../datasource/client"],
    ["apps/web/src/service/index.ts", "../datasource/client"],
    ["otherlibs/orders/src/service/index.ts", "../datasource/client"],
    ["libs/orders/src/service/index.ts", "../../../../apps/datasource/client"],
  ])("allows %s importing %s", (file, value) => {
    expect(run(file, type, value)).toEqual([]);
  });
});

it("ignores a named export without a source", () => {
  expect(run("libs/orders/src/service/index.ts", "ExportNamedDeclaration", null)).toEqual([]);
});
