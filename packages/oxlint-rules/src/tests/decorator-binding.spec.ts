import type { Rule } from "eslint";
import { describe, expect, it } from "vitest";
import restGeneratedContractSchema from "../rules/rest-generated-contract-schema.ts";
import typeGraphqlExplicitType from "../rules/type-graphql-explicit-type.ts";

type ReportDescriptor = {
  readonly messageId?: string;
  readonly data?: Record<string, unknown>;
};

type ScopeValue = {
  readonly defs: readonly {
    readonly type: string;
    readonly node: Record<string, unknown>;
  }[];
};

type ScopeLike = {
  readonly upper: ScopeLike | null;
  readonly set: Map<string, ScopeValue>;
};

type ScopeEntry = {
  readonly name: string;
  readonly value: ScopeValue;
};

type ScopeFixture = {
  readonly inner: readonly ScopeEntry[];
  readonly outer?: readonly ScopeEntry[];
};

const GRAPHQL_TARGETS = ["Field", "Query", "Mutation"];

describe("decorator import binding", () => {
  it("reports unresolved TypeGraphQL Field, Query, and Mutation decorators", () => {
    for (const name of GRAPHQL_TARGETS) {
      expect(runTypeGraphql(name, [], scope(typeImport(name)))).toHaveLength(1);
    }
  });

  it("reports aliased and namespace TypeGraphQL decorators with the imported name", () => {
    expect(runTypeGraphql("F", [], scope(typeImport("Field", "F")))).toEqual([
      { messageId: "missingTypeArg", decoratorName: "@Field" },
    ]);
    expect(runTypeGraphql("Field", [], scope(typeNamespaceImport("G")), "G")).toEqual([
      { messageId: "missingTypeArg", decoratorName: "@Field" },
    ]);
  });

  it("reports computed namespace member access with a string literal property", () => {
    expect(
      runTypeGraphql("Field", [], scope(typeNamespaceImport("G")), "G", computedProperty("Field")),
    ).toEqual([{ messageId: "missingTypeArg", decoratorName: "@Field" }]);
    expect(
      runTypeGraphql("Field", [], scope(typeNamespaceImport("G")), "G", computedProperty(0)),
    ).toEqual([]);
    expect(
      runTypeGraphql("Field", [], scope(typeNamespaceImport("G")), "G", undefined, {
        type: "MemberExpression",
        object: { type: "Identifier", name: "G" },
        property: { type: "Identifier", name: "Field" },
        computed: true,
      }),
    ).toEqual([]);
  });

  it("reports TypeGraphQL decorators imported from the public facade", () => {
    expect(runTypeGraphql("Field", [], scope(typeFacadeImport("Field")))).toHaveLength(1);
    expect(runTypeGraphql("F", [], scope(typeFacadeImport("Field", "F")))).toEqual([
      { messageId: "missingTypeArg", decoratorName: "@Field" },
    ]);
    expect(runTypeGraphql("Field", [], scope(typeFacadeNamespaceImport("G")), "G")).toEqual([
      { messageId: "missingTypeArg", decoratorName: "@Field" },
    ]);
  });

  it("ignores local and other-module decorators with the same name", () => {
    expect(runTypeGraphql("Query", [], scope(localFunction("Query")))).toEqual([]);
    expect(runTypeGraphql("Query", [], scope(otherModuleImport("Query")))).toEqual([]);
    expect(runTypeGraphql("Query", [], scope([]))).toEqual([]);
  });

  it("ignores a default import used as a namespace object", () => {
    expect(runTypeGraphql("Field", [], scope(defaultImport("G")), "G")).toEqual([]);
    expect(runTypeGraphql("Field", [], scope(defaultImport("Field")))).toEqual([]);
  });

  it("resolves module-scope imports from a nested decorator scope", () => {
    expect(runTypeGraphql("Query", [], scope([], typeImport("Query")))).toHaveLength(1);
    expect(runTypeGraphql("Field", [], scope([], typeNamespaceImport("G")), "G")).toEqual([
      { messageId: "missingTypeArg", decoratorName: "@Field" },
    ]);
    expect(runRest("Body", [], scope([], restImport("Body")))).toEqual(["bodySchema"]);
  });

  it("prefers the inner lexical binding when an outer import exists", () => {
    expect(runTypeGraphql("Query", [], scope(localBinding("Query"), typeImport("Query")))).toEqual(
      [],
    );
    expect(runRest("Body", [], scope(localBinding("Body"), restImport("Body")))).toEqual([]);
  });

  it("accepts aliased, namespace, and direct explicit type arguments", () => {
    const typeArg = { type: "ArrowFunctionExpression" };
    expect(runTypeGraphql("Field", [typeArg], scope(typeImport("Field")))).toEqual([]);
    expect(runTypeGraphql("F", [typeArg], scope(typeImport("Field", "F")))).toEqual([]);
    expect(runTypeGraphql("Field", [typeArg], scope(typeNamespaceImport("G")), "G")).toEqual([]);
  });

  it("reports late and namespace REST decorators without traversal-order dependence", () => {
    expect(runRest("All", [{ type: "Literal", value: "/x" }], scope(restImport("All")))).toEqual([
      "allRoute",
    ]);
    expect(runRest("Body", [], scope(restImport("Body")))).toEqual(["bodySchema"]);
    expect(
      runRest("All", [{ type: "Literal", value: "/x" }], scope(restNamespaceImport("R")), "R"),
    ).toEqual(["allRoute"]);
    expect(runRest("Body", [], scope(restNamespaceImport("R")), "R")).toEqual(["bodySchema"]);
    expect(
      runRest("Param", [{ type: "Literal", value: "id" }], scope(restNamespaceImport("R")), "R"),
    ).toEqual(["namedParamSchema"]);
  });

  it("tracks REST aliases and ignores shadowed or foreign Body decorators", () => {
    expect(runRest("RestBody", [], scope(restImport("Body", "RestBody")))).toEqual(["bodySchema"]);
    expect(runRest("Body", [], scope(otherModuleImport("Body")))).toEqual([]);
    expect(runRest("Body", [], scope(localFunction("Body")))).toEqual([]);
  });
});

function scope(inner: readonly ScopeEntry[], outer: readonly ScopeEntry[] = []): ScopeFixture {
  return { inner, outer: outer.length > 0 ? outer : undefined };
}

function runTypeGraphql(
  calleeName: string,
  args: readonly object[] = [],
  fixture: ScopeFixture = scope([]),
  objectName?: string,
  propertyOverride?: Record<string, unknown>,
  calleeOverride?: Record<string, unknown>,
): readonly { messageId: string; decoratorName: unknown }[] {
  const reports: { messageId: string; decoratorName: unknown }[] = [];
  const context = {
    report(descriptor: ReportDescriptor) {
      reports.push({
        messageId: descriptor.messageId ?? "",
        decoratorName: descriptor.data?.decoratorName,
      });
    },
    sourceCode: { getScope: () => scopeOf(fixture) },
  } as unknown as Rule.RuleContext;
  const listener = typeGraphqlExplicitType.create(context).Decorator;

  if (typeof listener !== "function") {
    expect(listener).toBeTypeOf("function");
    return reports;
  }

  listener(decoratorNode(calleeName, args, objectName, propertyOverride, calleeOverride) as never);

  return reports;
}

function runRest(
  calleeName: string,
  args: readonly object[] = [],
  fixture: ScopeFixture = scope([]),
  objectName?: string,
): readonly string[] {
  const reports: string[] = [];
  const context = {
    report(descriptor: ReportDescriptor) {
      reports.push(descriptor.messageId ?? "");
    },
    sourceCode: { getScope: () => scopeOf(fixture) },
  } as unknown as Rule.RuleContext;
  const listener = restGeneratedContractSchema.create(context).Decorator;

  if (typeof listener !== "function") {
    expect(listener).toBeTypeOf("function");
    return reports;
  }

  listener(decoratorNode(calleeName, args, objectName) as never);

  return reports;
}

function scopeOf(fixture: ScopeFixture): ScopeLike {
  return {
    upper: fixture.outer
      ? {
          upper: null,
          set: new Map(fixture.outer.map((variable) => [variable.name, variable.value])),
        }
      : null,
    set: new Map(fixture.inner.map((variable) => [variable.name, variable.value])),
  };
}

function typeImport(imported: string, local: string = imported): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: imported },
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "type-graphql" },
              },
            },
          },
        ],
      },
    },
  ];
}

function typeNamespaceImport(local: string): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportNamespaceSpecifier",
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "type-graphql" },
              },
            },
          },
        ],
      },
    },
  ];
}

function defaultImport(local: string): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportDefaultSpecifier",
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "type-graphql" },
              },
            },
          },
        ],
      },
    },
  ];
}

function localBinding(name: string): readonly ScopeEntry[] {
  return [
    {
      name,
      value: { defs: [{ type: "Parameter", node: { type: "FunctionDeclaration" } }] },
    },
  ];
}

function restImport(imported: string, local: string = imported): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: imported },
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

function restNamespaceImport(local: string): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportNamespaceSpecifier",
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

function localFunction(name: string): readonly ScopeEntry[] {
  return [
    {
      name,
      value: { defs: [{ type: "FunctionName", node: { type: "FunctionDeclaration" } }] },
    },
  ];
}

function otherModuleImport(name: string): readonly ScopeEntry[] {
  return [
    {
      name,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name },
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "unrelated-module" },
              },
            },
          },
        ],
      },
    },
  ];
}

function computedProperty(value: string | number): Record<string, unknown> {
  return { type: "Literal", value };
}

function typeFacadeImport(imported: string, local: string = imported): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: imported },
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "@croco/protocols-graphql" },
              },
            },
          },
        ],
      },
    },
  ];
}

function typeFacadeNamespaceImport(local: string): readonly ScopeEntry[] {
  return [
    {
      name: local,
      value: {
        defs: [
          {
            type: "ImportBinding",
            node: {
              type: "ImportNamespaceSpecifier",
              parent: {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "@croco/protocols-graphql" },
              },
            },
          },
        ],
      },
    },
  ];
}

function decoratorNode(
  calleeName: string,
  args: readonly object[],
  objectName?: string,
  propertyOverride?: Record<string, unknown>,
  calleeOverride?: Record<string, unknown>,
): object {
  return {
    type: "Decorator",
    expression: {
      type: "CallExpression",
      callee:
        calleeOverride ??
        (objectName
          ? {
              type: propertyOverride ? "ComputedMemberExpression" : "MemberExpression",
              object: { type: "Identifier", name: objectName },
              property: propertyOverride ?? { type: "Identifier", name: calleeName },
              computed: Boolean(propertyOverride),
            }
          : { type: "Identifier", name: calleeName }),
      arguments: args,
      optional: false,
    },
  };
}
