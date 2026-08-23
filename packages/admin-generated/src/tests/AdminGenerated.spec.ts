import "reflect-metadata";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import { buildContractGraph } from "@croco/protocols-core";
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
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AdminGeneratedContractProblem,
  assertAdminGeneratedContractGraphCoverage,
  createAdminGeneratedArtifact,
  generateAdminResourceFilesFromContractGraph,
  generateAdminResourceSourceFromContractGraph,
} from "../libs/generate";

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
