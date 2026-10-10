import "reflect-metadata";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import { buildContractGraph, type ContractGraph } from "@croco/protocols-core";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
} from "@croco/protocols-rest";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { z } from "zod";
import {
  AdminGeneratedContractProblem,
  assertAdminGeneratedContractGraphCoverage,
  createAdminGeneratedArtifact,
  generateAdminResourceFilesFromContractGraph,
  generateAdminResourceSourceFromContractGraph,
  getAdminGeneratedDiagnostics,
} from "../libs/generate";

function typecheckSource(source: string): string[] {
  const fileName = "/virtual/admin-members.ts";
  const host = ts.createCompilerHost({ strict: true, noEmit: true });
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (name) => (name === fileName ? source : readFile(name));
  host.fileExists = (name) => name === fileName || ts.sys.fileExists(name);
  host.getSourceFile = (name, version, ...rest) =>
    name === fileName
      ? ts.createSourceFile(name, source, version)
      : getSourceFile(name, version, ...rest);
  const program = ts.createProgram(
    [fileName],
    { strict: true, noEmit: true, lib: ["lib.es2022.d.ts"] },
    host,
  );
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
}

const ENTITLEMENT_REQUIREMENTS_KEY = Symbol.for("croco:entitlements:requirements");

type EntitlementRequirement = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: {
    readonly type: string;
    readonly id?: string;
    readonly idParam?: string;
  };
};

function RequiresEntitlement(requirement: EntitlementRequirement): MethodDecorator {
  return (target, propertyKey) => {
    const existing =
      (Reflect.getOwnMetadata(ENTITLEMENT_REQUIREMENTS_KEY, target, propertyKey) as
        | readonly EntitlementRequirement[]
        | undefined) ?? [];

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIREMENTS_KEY,
      [...existing, requirement],
      target,
      propertyKey,
    );
  };
}

const userSchema = z.object({
  email: z.string(),
  id: z.string(),
  name: z.string(),
  nickname: z.string().optional(),
});
const createUserSchema = z.object({
  email: z.string(),
  name: z.string(),
});
const updateUserSchema = z.object({
  name: z.string().optional(),
});
describe("admin-generated", () => {
  it.each<{ name: string; values: z.EnumLike; expected: string }>([
    {
      name: "numeric",
      values: { 0: "Active", 1: "Inactive", Active: 0, Inactive: 1 },
      expected: "0 | 1",
    },
    {
      name: "string",
      values: { Active: "active", Inactive: "inactive" },
      expected: "'active' | 'inactive'",
    },
    {
      name: "mixed",
      values: { 0: "Inactive", Inactive: 0, Active: "active" },
      expected: "0 | 'active'",
    },
    { name: "duplicate", values: { 0: "Alias", Active: 0, Alias: 0 }, expected: "0" },
  ])(
    "should emit only schema-accepted $name native enum values for input and output",
    ({ values, expected }) => {
      const schema = z.nativeEnum(values);

      @Controller("/statuses")
      class StatusController {
        @Post("/")
        @ResponseSchema(schema)
        createStatus(@Body(schema) body: z.infer<typeof schema>): z.infer<typeof schema> {
          return body;
        }
      }

      const source = generateAdminResourceSourceFromContractGraph(
        buildContractGraph([StatusController]),
      );
      expect(source).toContain(`export type StatusControllerCreateStatusInput = ${expected};`);
      expect(source).toContain(`export type StatusControllerCreateStatusOutput = ${expected};`);

      const generatedValues = expected
        .split(" | ")
        .map((literal) => (literal.startsWith("'") ? literal.slice(1, -1) : Number(literal)));
      for (const value of [...Object.values(values), "unknown", -1, null, undefined]) {
        expect(generatedValues.includes(value as string | number)).toBe(
          schema.safeParse(value).success,
        );
      }
    },
  );
  it("should preserve defaulted route body input and parsed output contracts", () => {
    const schema = z.object({
      label: z.string().default("all"),
      pageSize: z.number().default(20),
      settings: z.object({ enabled: z.boolean().default(true) }).default({}),
      nested: z.object({ count: z.number().default(1) }),
      optional: z.string().optional(),
      optionalDefault: z.string().optional().default("value"),
      defaultOptional: z.string().default("value").optional(),
      nullable: z.string().default("value").nullable(),
      readonly: z.number().default(2).readonly(),
      wrappedOptional: z.string().optional().readonly(),
      wrappedDefaultOptional: z.string().default("value").optional().readonly(),
      refined: z
        .string()
        .default("value")
        .refine((value) => value.length > 0),
      items: z.array(z.object({ size: z.number().default(3) })),
      numbers: z.array(z.number().default(6)),
      legacyNullableItems: z.array(z.string().nullable()),
      variants: z.union([z.object({ size: z.number().default(4) }), z.string()]),
      values: z.record(z.object({ size: z.number().default(5) })),
    });

    @Controller("/defaults")
    class DefaultsController {
      @Post("/")
      @ResponseSchema(schema)
      createDefaults(@Body(schema) body: z.input<typeof schema>): z.output<typeof schema> {
        return schema.parse(body);
      }
    }

    const input: z.input<typeof schema> = {
      nested: {},
      items: [{}],
      numbers: [undefined],
      legacyNullableItems: [null],
      variants: {},
      values: { a: {} },
    };
    expect(schema.parse(input)).toEqual({
      label: "all",
      pageSize: 20,
      settings: { enabled: true },
      nested: { count: 1 },
      optionalDefault: "value",
      nullable: "value",
      readonly: 2,
      refined: "value",
      items: [{ size: 3 }],
      numbers: [6],
      legacyNullableItems: [null],
      variants: { size: 4 },
      values: { a: { size: 5 } },
    });
    const source = generateAdminResourceSourceFromContractGraph(
      buildContractGraph([DefaultsController]),
    );
    expect(source).toContain(
      "export type DefaultsControllerCreateDefaultsInput = { defaultOptional?: string | undefined; items: { size?: number; }[]; label?: string; legacyNullableItems: (string | null)[]; nested: { count?: number; }; nullable?: string | undefined | null; numbers: (number | undefined)[]; optional?: string; optionalDefault?: string | undefined; pageSize?: number; readonly?: number | undefined; refined?: string | undefined; settings?: { enabled?: boolean; }; values: Record<string, { size?: number; }>; variants: { size?: number; } | string; wrappedDefaultOptional?: string | undefined | undefined; wrappedOptional: string | undefined; };",
    );
    expect(source).toContain(
      "export type DefaultsControllerCreateDefaultsOutput = { defaultOptional?: string; items: { size: number; }[]; label: string; legacyNullableItems: (string | null)[]; nested: { count: number; }; nullable: string | null; numbers: number[]; optional?: string; optionalDefault: string | undefined; pageSize: number; readonly: number; refined: string; settings: { enabled: boolean; }; values: Record<string, { size: number; }>; variants: { size: number; } | string; wrappedDefaultOptional: string | undefined; wrappedOptional: string | undefined; };",
    );
    expect(source).toContain(
      "readonly input: DefaultsControllerCreateDefaultsInput; readonly output: DefaultsControllerCreateDefaultsOutput;",
    );
  });

  it("should allow omitted union fields only when a branch has a default", () => {
    const schema = z.object({
      mode: z.union([z.string().default("all"), z.number()]),
      wrapped: z.union([z.number(), z.string().default("all").readonly()]).nullable(),
      nested: z.union([z.number(), z.union([z.boolean(), z.string().default("all")])]),
      optionalBranch: z.union([z.string().optional(), z.number()]),
      objectBranch: z.union([z.object({ value: z.string().default("all") }), z.number()]),
    });

    @Controller("/union-defaults")
    class UnionDefaultsController {
      @Post("/")
      @ResponseSchema(schema)
      create(@Body(schema) body: z.input<typeof schema>): z.output<typeof schema> {
        return schema.parse(body);
      }
    }

    const input: z.input<typeof schema> = { objectBranch: {} };
    expect(schema.parse(input)).toEqual({
      mode: "all",
      wrapped: "all",
      nested: "all",
      objectBranch: { value: "all" },
    });
    const source = generateAdminResourceSourceFromContractGraph(
      buildContractGraph([UnionDefaultsController]),
    );
    expect(source).toContain(
      "export type UnionDefaultsControllerCreateInput = { mode?: string | undefined | number; nested?: number | boolean | string | undefined; objectBranch: { value?: string; } | number; optionalBranch: string | undefined | number; wrapped?: number | string | undefined | null; };",
    );
    expect(source).toContain(
      "export type UnionDefaultsControllerCreateOutput = { mode: string | number; nested: number | boolean | string; objectBranch: { value: string; } | number; optionalBranch: string | undefined | number; wrapped: number | string | null; };",
    );
  });

  it("keeps array-of-union response fields assignable from real response data", () => {
    const memberSchema = z.object({
      id: z.string(),
      roles: z.array(z.enum(["admin", "member"])),
      aliases: z.array(z.string().nullable()),
      nicknames: z.array(z.string().optional()),
      contacts: z.array(
        z.union([z.object({ kind: z.literal("email"), address: z.string() }), z.string()]),
      ),
    });

    @Controller("/admin/members")
    class MembersController {
      @Get("/")
      @ResponseSchema(z.array(memberSchema))
      listMembers(): z.infer<typeof memberSchema>[] {
        return [];
      }
    }

    const generated = generateAdminResourceSourceFromContractGraph(
      buildContractGraph([MembersController]),
    );
    const outputType = generated
      .split("\n")
      .find((line) => line.startsWith("export type MembersControllerListMembersOutput"));
    if (!outputType) throw new Error("output type was not generated");

    expect(outputType).toContain("roles: ('admin' | 'member')[]");
    expect(outputType).toContain("aliases: (string | null)[]");
    expect(outputType).toContain("nicknames: (string | undefined)[]");
    expect(outputType).toContain("contacts: ({ address: string; kind: 'email'; } | string)[]");

    expect(
      typecheckSource(
        `${outputType}\nexport const sample: MembersControllerListMembersOutput = [{ id: "m_1", roles: ["admin", "member"], aliases: ["ada", null], nicknames: ["ada", undefined], contacts: [{ kind: "email" as const, address: "ada@example.com" }, "ext-member"] }];\n`,
      ),
    ).toEqual([]);
  });

  it("should generate typed admin resource config from Contract Graph routes", () => {
    @Controller("/admin/users")
    class UsersController {
      @Get("/")
      @ResponseSchema(z.array(userSchema))
      listUsers(
        @Query("q", z.string().optional()) _query: string | undefined,
      ): z.infer<typeof userSchema>[] {
        return [];
      }

      @Get("/:id")
      @ResponseSchema(userSchema)
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "User was not found.",
      })
      getUser(@Param("id") _id: string): z.infer<typeof userSchema> {
        return { email: "ada@example.com", id: "user_1", name: "Ada" };
      }

      @Post("/")
      @ResponseSchema(userSchema)
      createUser(
        @Body(createUserSchema) _body: z.infer<typeof createUserSchema>,
      ): z.infer<typeof userSchema> {
        return { email: "ada@example.com", id: "user_1", name: "Ada" };
      }

      @Patch("/:id")
      @ResponseSchema(userSchema)
      updateUser(
        @Param("id") _id: string,
        @Body(updateUserSchema) _body: z.infer<typeof updateUserSchema>,
      ): z.infer<typeof userSchema> {
        return { email: "ada@example.com", id: "user_1", name: "Ada" };
      }

      @Delete("/:id")
      deleteUser(@Param("id") _id: string): void {}

      @Post("/:id/suspend")
      @ResponseSchema(userSchema)
      suspendUser(@Param("id") _id: string): z.infer<typeof userSchema> {
        return { email: "ada@example.com", id: "user_1", name: "Ada" };
      }
    }

    const graph = buildContractGraph([UsersController]);
    const artifact = createAdminGeneratedArtifact(graph);

    expect(artifact.diagnostics).toEqual([]);
    expect(artifact.resources).toHaveLength(1);
    expect(artifact.resources[0]).toMatchObject({
      id: "adminUsers",
      label: "Users",
      path: "/admin/users",
      operations: {
        list: {
          routeId: "UsersController.listUsers",
          request: { query: "present" },
          response: "present",
        },
        detail: {
          routeId: "UsersController.getUser",
          problems: [
            {
              code: "USER_NOT_FOUND",
              category: "NotFound",
              status: 404,
              description: "User was not found.",
            },
          ],
        },
        create: {
          inputType: "UsersControllerCreateUserInput",
          outputType: "UsersControllerCreateUserOutput",
        },
        update: {
          inputType: "UsersControllerUpdateUserInput",
          outputType: "UsersControllerUpdateUserOutput",
        },
        delete: { routeId: "UsersController.deleteUser", response: "absent" },
      },
      actions: [
        {
          action: "suspend",
          scope: "record",
          routeId: "UsersController.suspendUser",
          outputType: "UsersControllerSuspendUserOutput",
        },
      ],
    });
    expect(artifact.clientBindings.usersControllerGetUser.problems).toEqual([
      {
        code: "USER_NOT_FOUND",
        category: "NotFound",
        status: 404,
        description: "User was not found.",
      },
    ]);
  });

  it("should emit deterministic generated resource source with preserved input, output, and Problem types", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ResponseSchema(userSchema)
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: 'User\'s "profile" path C:\\users',
        type: 'https://example.com/problems/user\'s-"missing"',
      })
      getUser(@Param("id") _id: string): z.infer<typeof userSchema> {
        return { email: "ada@example.com", id: "user_1", name: "Ada" };
      }
    }

    const source = generateAdminResourceSourceFromContractGraph(
      buildContractGraph([UsersController]),
    );

    expect(source).toMatchInlineSnapshot(`
"import type { AdminGeneratedProblem, AdminGeneratedResourceConfig } from '@croco/admin-generated';

export type UsersControllerGetUserInput = { path: { id: string; }; };
export type UsersControllerGetUserOutput = { email: string; id: string; name: string; nickname?: string; };
export type UsersControllerGetUserProblem = AdminGeneratedProblem<'USER_NOT_FOUND', 'NotFound', 404>;
export type UsersControllerGetUserAdminBinding = { readonly input: UsersControllerGetUserInput; readonly output: UsersControllerGetUserOutput; readonly problem: UsersControllerGetUserProblem; };
export const adminClientBindings = {
  usersControllerGetUser: {
    routeId: 'UsersController.getUser',
    operationId: 'UsersController_getUser',
    methodName: 'getUser',
    httpMethod: 'GET',
    path: '/users/:id',
    inputType: 'UsersControllerGetUserInput',
    outputType: 'UsersControllerGetUserOutput',
    problemType: 'UsersControllerGetUserProblem',
    problems: [
      {
        code: 'USER_NOT_FOUND',
        category: 'NotFound',
        status: 404,
        description: 'User\\'s "profile" path C:\\\\users',
        type: 'https://example.com/problems/user\\'s-"missing"'
      }
    ],
    entitlements: []
  }
} as const;

export const adminResources = [
  {
    id: 'users',
    label: 'Users',
    path: '/users',
    routeIds: [
      'UsersController.getUser'
    ],
    operations: {
      detail: {
        kind: 'detail',
        routeId: 'UsersController.getUser',
        operationId: 'UsersController_getUser',
        methodName: 'getUser',
        httpMethod: 'GET',
        path: '/users/:id',
        clientBinding: 'usersControllerGetUser',
        inputType: 'UsersControllerGetUserInput',
        outputType: 'UsersControllerGetUserOutput',
        problemType: 'UsersControllerGetUserProblem',
        request: {
          body: 'absent',
          path: 'present',
          query: 'absent',
          headers: 'absent'
        },
        response: 'present',
        problems: [
          {
            code: 'USER_NOT_FOUND',
            category: 'NotFound',
            status: 404,
            description: 'User\\'s "profile" path C:\\\\users',
            type: 'https://example.com/problems/user\\'s-"missing"'
          }
        ],
        access: {
          guards: [],
          roles: []
        },
        entitlements: []
      }
    },
    actions: []
  }
] as const satisfies readonly AdminGeneratedResourceConfig[];
"
`);
  });

  it("should keep generated client binding and type names unique across controllers", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      list(): void {}
    }

    @Controller("/projects")
    class ProjectsController {
      @Get("/")
      list(): void {}
    }

    const artifact = createAdminGeneratedArtifact(
      buildContractGraph([UsersController, ProjectsController]),
    );

    expect(Object.keys(artifact.clientBindings)).toEqual([
      "projectsControllerList",
      "usersControllerList",
    ]);
    expect(artifact.resources.map((resource) => resource.operations.list?.clientBinding)).toEqual([
      "projectsControllerList",
      "usersControllerList",
    ]);
  });

  it("should preserve normalized entitlement requirements across every generated route surface", () => {
    @Controller("/reports")
    class ReportsController {
      @Get("/")
      listReports(): void {}

      @Get("/:id")
      @RequiresEntitlement({
        feature: "reports.read",
        description: "Read report data.",
        resource: { type: "report", idParam: "id" },
      })
      getReport(@Param("id") _id: string): void {}

      @Post("/:id/export")
      @RequiresEntitlement({ feature: "reports.export" })
      @RequiresEntitlement({
        feature: "reports.read",
        resource: { type: "report", idParam: "id" },
      })
      exportReport(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([ReportsController]);
    const artifact = createAdminGeneratedArtifact(graph);
    const resource = artifact.resources[0];
    const detailEntitlements = [
      {
        feature: "reports.read",
        description: "Read report data.",
        resource: { type: "report", idParam: "id" },
      },
    ];
    const actionEntitlements = [
      { feature: "reports.export" },
      { feature: "reports.read", resource: { type: "report", idParam: "id" } },
    ];

    expect(resource?.operations.list?.entitlements).toEqual([]);
    expect(artifact.clientBindings.reportsControllerListReports?.entitlements).toEqual([]);
    expect(resource?.operations.detail?.entitlements).toEqual(detailEntitlements);
    expect(artifact.clientBindings.reportsControllerGetReport?.entitlements).toEqual(
      detailEntitlements,
    );
    expect(resource?.actions[0]?.entitlements).toEqual(actionEntitlements);
    expect(artifact.clientBindings.reportsControllerExportReport?.entitlements).toEqual(
      actionEntitlements,
    );

    const detail = resource?.operations.detail;
    const action = resource?.actions[0];
    const detailBinding = artifact.clientBindings.reportsControllerGetReport;

    expect(detail).toBeDefined();
    expect(action).toBeDefined();
    expect(detailBinding).toBeDefined();

    if (!resource || !detail || !action || !detailBinding) {
      return;
    }

    const withMutatedDetail = {
      ...artifact,
      resources: [
        {
          ...resource,
          operations: {
            ...resource.operations,
            detail: { ...detail, entitlements: [] },
          },
        },
      ],
    };
    const withMutatedAction = {
      ...artifact,
      resources: [
        {
          ...resource,
          actions: [{ ...action, entitlements: [] }],
        },
      ],
    };
    const withMutatedBinding = {
      ...artifact,
      clientBindings: {
        ...artifact.clientBindings,
        reportsControllerGetReport: { ...detailBinding, entitlements: [] },
      },
    };

    expect(() => assertAdminGeneratedContractGraphCoverage(graph, withMutatedDetail)).toThrow(
      "contract-consumer-route-field-mismatch",
    );
    expect(() => assertAdminGeneratedContractGraphCoverage(graph, withMutatedAction)).toThrow(
      "contract-consumer-route-field-mismatch",
    );
    expect(() => assertAdminGeneratedContractGraphCoverage(graph, withMutatedBinding)).toThrow(
      "contract-consumer-route-field-mismatch",
    );
  });

  it("should generate identical entitlement artifacts when route requirements are reordered", () => {
    @Controller("/reports")
    class ReportsController {
      @Get("/")
      @RequiresEntitlement({ feature: "reports.read" })
      @RequiresEntitlement({ feature: "reports.export" })
      listReports(): void {}
    }

    const graph = buildContractGraph([ReportsController]);
    const reorderedGraph = {
      ...graph,
      routes: graph.routes.map((route) => ({
        ...route,
        entitlements: [...route.entitlements].reverse(),
      })),
    };

    expect(generateAdminResourceSourceFromContractGraph(reorderedGraph)).toBe(
      generateAdminResourceSourceFromContractGraph(graph),
    );
  });

  it("should order entitlement requirements without consulting the runtime locale", () => {
    @Controller("/reports")
    class ReportsController {
      @Get("/")
      @RequiresEntitlement({ feature: "ä.reports" })
      @RequiresEntitlement({ feature: "z.reports" })
      listReports(): void {}
    }

    const graph = buildContractGraph([ReportsController]);
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => {
      throw new Error("localeCompare must not affect entitlement ordering");
    });

    try {
      expect(
        createAdminGeneratedArtifact(graph).resources[0]?.operations.list?.entitlements,
      ).toEqual([{ feature: "z.reports" }, { feature: "ä.reports" }]);
    } finally {
      localeCompare.mockRestore();
    }
  });

  it("should fail ambiguous or unsupported route shapes with stable diagnostics", () => {
    @Controller("/users")
    class UsersController {
      @Post("/:id")
      retryUser(@Param("id") _id: string): void {}

      @Get("/search")
      searchUsers(): void {}

      @Get("/:id/history/:entryId")
      getUserHistory(@Param("id") _id: string, @Param("entryId") _entryId: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(() => generateAdminResourceSourceFromContractGraph(graph)).toThrow(
      AdminGeneratedContractProblem,
    );
    try {
      generateAdminResourceSourceFromContractGraph(graph);
    } catch (error) {
      expect(error).toBeInstanceOf(AdminGeneratedContractProblem);
      expect((error as AdminGeneratedContractProblem).code).toBe(
        "admin-generated/contract-diagnostics",
      );
    }
    expect(createAdminGeneratedArtifact(graph).diagnostics).toEqual([
      expect.objectContaining({
        code: "admin-generated-ambiguous-collection-action",
        routeId: "UsersController.searchUsers",
      }),
      expect.objectContaining({
        code: "admin-generated-ambiguous-record-route",
        routeId: "UsersController.retryUser",
      }),
      expect.objectContaining({
        code: "admin-generated-unsupported-route-shape",
        routeId: "UsersController.getUserHistory",
      }),
    ]);
  });

  it("should fail binding-name normalization collisions with a dedicated diagnostic", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      listUsers(): void {}
    }

    @Controller("/user-details")
    class UserDetailsController {
      @Get("/")
      listUsers(): void {}
    }

    const graph = buildContractGraph([UsersController, UserDetailsController]);
    const artifact = createAdminGeneratedArtifact(graph);
    expect(Object.keys(artifact.clientBindings)).toEqual([
      "userDetailsControllerListUsers",
      "usersControllerListUsers",
    ]);
    const renamedGraph: ContractGraph = {
      ...graph,
      routes: graph.routes.map((route) =>
        route.routeId === "UserDetailsController.listUsers"
          ? { ...route, operationId: "UsersController-listUsers" }
          : route,
      ),
    };

    const diagnostics = getAdminGeneratedDiagnostics(renamedGraph);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "admin-generated-duplicate-binding",
        routeId: "UserDetailsController.listUsers",
      }),
    ]);
    const [diagnostic] = diagnostics;
    expect(diagnostic?.message).toContain("usersControllerListUsers");
    expect(diagnostic?.message).toContain("UsersController.listUsers");
    expect(diagnostic?.message).toContain("UsersController-listUsers");

    expect(() => createAdminGeneratedArtifact(renamedGraph)).toThrow(AdminGeneratedContractProblem);
    try {
      createAdminGeneratedArtifact(renamedGraph);
    } catch (error) {
      expect(error).toBeInstanceOf(AdminGeneratedContractProblem);
      const problem = error as AdminGeneratedContractProblem;
      expect(problem.diagnostics.map((entry) => entry.code)).toEqual([
        "admin-generated-duplicate-binding",
      ]);
      expect(problem.message).toContain("UsersController.listUsers");
      expect(problem.message).toContain("UsersController-listUsers");
      expect(problem.message).not.toContain("contract-consumer-missing-route");
    }
    expect(() => generateAdminResourceSourceFromContractGraph(renamedGraph)).toThrow(
      "usersControllerListUsers",
    );
  });

  it("should write deterministic admin resource files", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      listUsers(): void {}
    }

    const graph = buildContractGraph([UsersController]);
    const outDir = mkdtempSync(join(tmpdir(), "croco-admin-generated-"));
    const files = generateAdminResourceFilesFromContractGraph(graph, outDir);

    expect(files.map((file) => file.split("/").at(-1))).toEqual(["admin-resources.ts", "index.ts"]);
    expect(readFileSync(join(outDir, "index.ts"), "utf-8")).toBe(
      "export * from './admin-resources';\n",
    );
    expect(readFileSync(join(outDir, "admin-resources.ts"), "utf-8")).toContain(
      "export const adminResources =",
    );
  });
});
