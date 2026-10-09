import path from "node:path";
import type { Rule } from "eslint";
import { describe, expect, it } from "vitest";
import rule from "../rules/no-cross-domain-import.ts";

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

describe.each(declarationTypes)("no-cross-domain-import %s", (type) => {
  it.each([
    ["libs/orders/src/service/index.ts", "../../../payments/src/payment"],
    ["libs/orders/src/service/index.ts", "../../../payments"],
    ["libs/orders/service/src/index.ts", "../../../payments/service/src/payment"],
    ["libs/orders/service/src/index.ts", "../../../payments"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/src/service/payment"],
    ["libs/orders/datasource/src/index.ts", "../../../payments/service/src/payment"],
    ["libs/orders/src/datasource-utils/index.ts", "../../../payments/src/datasource/payment"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/src/datasource-utils/payment"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/src/datasource.ts"],
  ])("reports %s importing %s", (file, value) => {
    expect(run(file, type, value)).toEqual([
      expect.objectContaining({
        messageId: "crossDomainImport",
        data: { sourceDomain: "orders", targetDomain: "payments" },
      }),
    ]);
  });

  it.each([
    ["libs/orders/src/service/index.ts", "../domain/order"],
    ["libs/orders/service/src/index.ts", "../../domain/src/order"],
    ["libs/orders/src/service/index.ts", "../.."],
    ["libs/orders/src/service/index.ts", "../../../shared"],
    ["libs/orders/src/service/index.ts", "../../../shared/src/money"],
    ["libs/orders/service/src/index.ts", "../../../shared/domain/src/money"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/src/datasource/payment"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/src/datasource"],
    ["libs/orders/datasource/src/index.ts", "../../../payments/datasource/src/payment"],
    ["libs/orders/datasource/src/index.ts", "../../../payments/datasource"],
    ["libs/orders/src/datasource/index.ts", "../../../payments/datasource"],
    ["libs/orders/datasource/src/index.ts", "../../../payments/src/datasource"],
    ["libs/orders/src/service/index.ts", "@scope/payments"],
    ["apps/web/src/service/index.ts", "../../../../libs/payments"],
    ["libs/orders/src/service/index.ts", "../../../../apps/payments"],
    ["otherlibs/orders/src/service/index.ts", "../../../payments/src/payment"],
  ])("allows %s importing %s", (file, value) => {
    expect(run(file, type, value)).toEqual([]);
  });

  it("does not treat a shared domain substring as shared", () => {
    expect(run("libs/orders/src/service/index.ts", type, "../../../shared-utils")).toEqual([
      expect.objectContaining({ messageId: "crossDomainImport" }),
    ]);
  });
});

it("ignores a named export without a source", () => {
  expect(run("libs/orders/src/service/index.ts", "ExportNamedDeclaration", null)).toEqual([]);
});
