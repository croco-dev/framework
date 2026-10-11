import type { Rule } from "eslint";
import { describe, expect, it } from "vitest";
import restGeneratedContractSchema from "../rules/rest-generated-contract-schema.ts";

type ReportDescriptor = {
  readonly messageId?: string;
};

type ScopeValue = {
  readonly defs: readonly {
    readonly type: string;
    readonly node: Record<string, unknown>;
  }[];
};

type ScopeEntry = {
  readonly name: string;
  readonly value: ScopeValue;
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
    sourceCode: { getScope: () => scopeOf(entries(name, options)) },
  } as unknown as Rule.RuleContext;
  const listener = restGeneratedContractSchema.create(context).Decorator;

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

function entries(
  name: string,
  options: { readonly imported?: boolean; readonly importedName?: string },
): readonly ScopeEntry[] {
  if (options.imported === false) {
    return [];
  }

  const importedName = options.importedName ?? name;

  return [
    {
      name,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportSpecifier",
              imported: identifier(importedName),
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "@croco/protocols-rest" },
              },
            },
          },
        ],
      },
    },
  ];
}

function scopeOf(variables: readonly ScopeEntry[]): {
  readonly upper: null;
  readonly set: Map<string, ScopeValue>;
} {
  return {
    upper: null,
    set: new Map(variables.map((variable) => [variable.name, variable.value])),
  };
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
