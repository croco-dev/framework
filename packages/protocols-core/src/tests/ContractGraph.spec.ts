import "reflect-metadata";
import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertContractGraphHasNoErrors,
  buildContractGraph,
  ContractGraphDiagnosticError,
  formatContractDiagnostic,
} from "../libs/ContractGraph";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Roles,
  UseGuards,
} from "./helpers/test-decorators";

describe("buildContractGraph", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should build stable controller, route id, operation id, and schema graph nodes", () => {
    const createUserSchema = z.object({ name: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string, @Query("include") _include: string): void {}

      @Post("/")
      createUser(@Body(createUserSchema) _body: z.infer<typeof createUserSchema>): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.version).toBe("croco.contract-graph.v1");
    expect(graph.controllers).toEqual([
      {
        name: "UsersController",
        path: "/users",
        guards: [],
        roles: [],
        routeIds: ["UsersController.getUser", "UsersController.createUser"],
      },
    ]);
    expect(graph.routes).toHaveLength(2);
    expect(graph.routes[0]).toMatchObject({
      routeId: "UsersController.getUser",
      operationId: "UsersController_getUser",
      controllerName: "UsersController",
      methodName: "getUser",
      httpMethod: "GET",
      path: "/users/:id",
      controllerPath: "/users",
    });
    expect(graph.routes[1]?.inputSchemas.body).toBe(createUserSchema);
    expect(graph.diagnostics).toEqual([]);
  });

  it("should normalize catch-all route parameters when validating path metadata", () => {
    @Controller("/assets")
    class AssetsController {
      @Get("/:...id")
      getAsset(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([AssetsController]);

    expect(graph.routes[0]).toMatchObject({
      routeId: "AssetsController.getAsset",
      path: "/assets/:...id",
    });
    expect(graph.diagnostics).toEqual([]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
  });

  it("should expose auth and access metadata references when present", () => {
    const AuthGuard = class SharedAccessGuard {};
    const AuditGuard = class SharedAccessGuard {};

    @UseGuards(AuthGuard)
    @Roles("admin")
    @Controller("/admin")
    class AdminController {
      @UseGuards(AuditGuard)
      @Roles("owner")
      @Get("/:id")
      getAdminAsset(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([AdminController]);

    expect(graph.controllers[0]).toMatchObject({
      name: "AdminController",
      guards: [
        {
          type: "rest.guard",
          id: "rest.guard:controller:AdminController:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "controller",
          owner: { controllerName: "AdminController" },
          index: 0,
        },
      ],
      roles: ["admin"],
    });
    expect(graph.routes[0]?.access).toEqual({
      guards: [
        {
          type: "rest.guard",
          id: "rest.guard:controller:AdminController:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "controller",
          owner: { controllerName: "AdminController" },
          index: 0,
        },
        {
          type: "rest.guard",
          id: "rest.guard:route:AdminController.getAdminAsset:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "route",
          owner: {
            controllerName: "AdminController",
            methodName: "getAdminAsset",
            routeId: "AdminController.getAdminAsset",
          },
          index: 0,
        },
      ],
      roles: ["admin", "owner"],
    });
    expect(graph.routes[0]?.access.guards[0]?.id).not.toBe(graph.routes[0]?.access.guards[1]?.id);
    expect(graph.diagnostics).toEqual([]);
  });

  it("should report unsupported and drift-prone route metadata as diagnostics", () => {
    @Controller("/hooks")
    class HooksController {
      @Get("/:id")
      handleHook(@Param("hookId") _hookId: string): void {}
    }

    const graph = buildContractGraph([HooksController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-path-param",
        severity: "error",
        routeId: "HooksController.handleHook",
      }),
      expect.objectContaining({
        code: "contract-route-unbound-path-param",
        severity: "error",
        routeId: "HooksController.handleHook",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should warn when generated contracts unwrap Zod effects", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Post("/")
      createProfile(@Body(z.string().transform((value) => value.trim())) _body: string): void {}
    }

    const graph = buildContractGraph([ProfilesController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-schema-zod-effects-unwrapped",
        severity: "warning",
        routeId: "ProfilesController.createProfile",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
    expect(formatContractDiagnostic(graph.diagnostics[0])).toContain(
      "WARNING contract-schema-zod-effects-unwrapped ProfilesController.createProfile",
    );
  });

  it("should reject routes with more than one request body parameter", () => {
    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(
        @Body(z.object({ name: z.string() })) _body: { name: string },
        @Body(z.object({ auditId: z.string() })) _audit: { auditId: string },
      ): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-multiple-body-params",
        severity: "error",
        routeId: "UsersController.createUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject duplicate normalized operation ids", () => {
    @Controller("/users")
    class UsersController {
      @Get("/with-underscore")
      get_user(): void {}
    }

    @Controller("/users-alt")
    class UsersController_get {
      @Get("/plain")
      user(): void {}
    }

    const graph = buildContractGraph([UsersController, UsersController_get]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-duplicate-operation-id",
        severity: "error",
        routeId: "UsersController_get.user",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });
});
