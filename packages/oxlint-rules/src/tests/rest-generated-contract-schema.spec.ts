import type { Rule } from "eslint";
import { describe, expect, it } from "vitest";
import restGeneratedContractSchema from "../rules/rest-generated-contract-schema.ts";

type ReportDescriptor = {
  readonly messageId?: string;
};

describe("rest-generated-contract-schema", () => {
  it("reports generated route decorators that cannot produce concrete contracts", () => {
    expect(runDecorator("All")).toEqual(["allRoute"]);
    expect(runDecorator("Body")).toEqual(["bodySchema"]);
    expect(runDecorator("Param", [stringLiteral("id")])).toEqual(["namedParamSchema"]);
    expect(runDecorator("Query", [stringLiteral("include")])).toEqual(["namedParamSchema"]);
    expect(runDecorator("Header", [stringLiteral("x-tenant-id")])).toEqual(["namedParamSchema"]);
  });

  it("allows schema-backed body and named parameter decorators", () => {
    expect(runDecorator("Body", [identifier("bodySchema")])).toEqual([]);
    expect(runDecorator("Param", [stringLiteral("id"), identifier("idSchema")])).toEqual([]);
    expect(runDecorator("Query", [stringLiteral("limit"), identifier("limitSchema")])).toEqual([]);
    expect(
      runDecorator("Header", [stringLiteral("x-tenant-id"), identifier("tenantSchema")]),
    ).toEqual([]);
  });

  it("ignores same-named decorators that are not imported from protocols-rest", () => {
    expect(runDecorator("Body", [], { imported: false })).toEqual([]);
    expect(runDecorator("Param", [stringLiteral("id")], { imported: false })).toEqual([]);
  });

  it("tracks local aliases for protocols-rest decorators", () => {
    expect(runDecorator("RestBody", [], { importedName: "Body" })).toEqual(["bodySchema"]);
    expect(runDecorator("RestParam", [stringLiteral("id")], { importedName: "Param" })).toEqual([
      "namedParamSchema",
    ]);
  });
});

function runDecorator(
  name: string,
  args: readonly object[] = [],
  options: { readonly imported?: boolean; readonly importedName?: string } = {},
): readonly string[] {
  const reports: string[] = [];
  const context = {
    report(descriptor: ReportDescriptor) {
      reports.push(descriptor.messageId ?? "");
    },
  } as unknown as Rule.RuleContext;
  const listeners = restGeneratedContractSchema.create(context);
  const importListener = listeners.ImportDeclaration;
  const listener = listeners.Decorator;

  if (options.imported !== false) {
    if (typeof importListener !== "function") {
      expect(importListener).toBeTypeOf("function");
      return reports;
    }

    importListener({
      type: "ImportDeclaration",
      source: {
        type: "Literal",
        value: "@croco/protocols-rest",
      },
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: identifier(options.importedName ?? name),
          local: identifier(name),
        },
      ],
    } as never);
  }

  if (typeof listener !== "function") {
    expect(listener).toBeTypeOf("function");
    return reports;
  }

  listener({
    type: "Decorator",
    expression: {
      type: "CallExpression",
      callee: identifier(name),
      arguments: args,
      optional: false,
    },
  } as never);

  return reports;
}

function identifier(name: string): object {
  return {
    type: "Identifier",
    name,
  };
}

function stringLiteral(value: string): object {
  return {
    type: "Literal",
    value,
  };
}
