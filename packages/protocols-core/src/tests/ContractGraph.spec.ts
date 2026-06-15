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
import { Body, Controller, Get, Param, Post, Query } from "./helpers/test-decorators";

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
