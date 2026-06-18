import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assertContractGraphHasNoErrors,
  buildContractGraph,
  ContractGraphDiagnosticError,
  formatContractDiagnostic,
} from "../libs/ContractGraph";
import { diffContractGraphSnapshots } from "../libs/ContractGraphDiff";
import {
  createContractGraphSnapshot,
  stringifyContractGraphSnapshot,
} from "../libs/ContractGraphSnapshot";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
  Roles,
  UseGuards,
} from "./helpers/test-decorators";

describe("buildContractGraph", () => {
  beforeEach(() => {
    Container.reset();
    vi.restoreAllMocks();
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

  it("should preserve unnamed guard metadata references", () => {
    const unnamedGuard = function Guard() {};
    Object.defineProperty(unnamedGuard, "name", { value: "" });

    @UseGuards(unnamedGuard)
    @Controller("/admin")
    class AdminController {
      @Get("/")
      getAdmin(): void {}
    }

    const graph = buildContractGraph([AdminController]);

    expect(unnamedGuard.name).toBe("");
    expect(graph.controllers[0]?.guards).toEqual([
      {
        type: "rest.guard",
        id: "rest.guard:controller:AdminController:0:constructor:anonymous",
        kind: "constructor",
        name: "anonymous",
        declaredAt: "controller",
        owner: { controllerName: "AdminController" },
        index: 0,
      },
    ]);
    expect(graph.routes[0]?.access.guards[0]?.name).toBe("anonymous");
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

  it("should warn when generated contracts unwrap nested Zod effects", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Post("/")
      createProfile(
        @Body(z.object({ name: z.string().transform((value) => value.trim()) }))
        _body: { name: string },
      ): void {}
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

  it("should reject duplicate controller names used as contract identity", () => {
    const FirstController = (() => {
      @Controller("/first")
      class DuplicateController {
        @Get("/one")
        one(): void {}
      }

      return DuplicateController;
    })();

    const SecondController = (() => {
      @Controller("/second")
      class DuplicateController {
        @Get("/two")
        two(): void {}
      }

      return DuplicateController;
    })();

    const graph = buildContractGraph([FirstController, SecondController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-controller-duplicate-name",
        severity: "error",
        target: "controller",
        controllerName: "DuplicateController",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should create byte-stable sorted JSON snapshots for the same controller metadata", () => {
    @Controller("/admin")
    class AdminController {
      @Get("/")
      listAdmins(): void {}
    }

    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(
        @Body(z.object({ email: z.string().optional(), name: z.string() }))
        _body: { name: string; email?: string },
      ): void {}

      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const first = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(buildContractGraph([UsersController, AdminController])),
    );
    const second = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(buildContractGraph([AdminController, UsersController])),
    );
    const snapshot = JSON.parse(first);

    expect(first).toBe(second);
    expect(snapshot).toMatchObject({
      snapshotVersion: "croco.contract-graph.snapshot.v1",
      graphVersion: "croco.contract-graph.v1",
      controllerCount: 2,
      routeCount: 3,
      operationIds: [
        "AdminController_listAdmins",
        "UsersController_createUser",
        "UsersController_getUser",
      ],
    });
  });

  it("should snapshot declared Problem responses as route failure contracts", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
      })
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "User id is missing.",
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);
    const snapshot = createContractGraphSnapshot(graph);

    expect(graph.diagnostics).toEqual([]);
    expect(snapshot.routes[0]?.problems).toEqual([
      {
        code: "USER_FORBIDDEN",
        category: "Forbidden",
        status: 403,
      },
      {
        code: "USER_NOT_FOUND",
        category: "NotFound",
        description: "User id is missing.",
        status: 404,
      },
    ]);
  });

  it("should reject duplicate declared Problem codes on a route", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
      @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-duplicate-problem-code",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should classify added routes as non-breaking and removed routes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/")
        listUsers(): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/")
        listUsers(): void {}

        @Post("/")
        createUser(@Body(z.object({ name: z.string() })) _body: { name: string }): void {}
      }

      return UsersController;
    })();
    const baseline = createContractGraphSnapshot(buildContractGraph([BaselineController]));
    const current = createContractGraphSnapshot(buildContractGraph([CurrentController]));

    const additiveDiff = diffContractGraphSnapshots(baseline, current);
    const removalDiff = diffContractGraphSnapshots(current, baseline);

    expect(additiveDiff.hasBreakingChanges).toBe(false);
    expect(additiveDiff.nonBreakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-route-added",
        routeId: "UsersController.createUser",
      }),
    ]);
    expect(removalDiff.hasBreakingChanges).toBe(true);
    expect(removalDiff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-route-removed",
          routeId: "UsersController.createUser",
        }),
        expect.objectContaining({
          code: "contract-operation-id-removed",
          operationId: "UsersController_createUser",
        }),
      ]),
    );
  });

  it("should classify HTTP method and path changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/:id/details")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-route-method-path-changed",
          routeId: "UsersController.getUser",
        }),
      ]),
    );
  });

  it("should classify required request expansion as breaking and optional fields as non-breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(@Body(z.object({ name: z.string() })) _body: { name: string }): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.number().optional(),
              email: z.string(),
              name: z.string(),
            }),
          )
          _body: { name: string; email: string; age?: number },
        ): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-required-field-added",
        fieldPath: "email",
        location: "body",
      }),
    ]);
    expect(diff.nonBreakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-optional-field-added",
        fieldPath: "age",
        location: "body",
      }),
    ]);
  });

  it("should classify request field schema changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.string(),
              profile: z.object({ nickname: z.string() }),
            }),
          )
          _body: { age: string; profile: { nickname: string } },
        ): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.number(),
              profile: z.object({ nickname: z.number() }),
            }),
          )
          _body: { age: number; profile: { nickname: number } },
        ): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-request-field-schema-incompatible",
          fieldPath: "age",
          location: "body",
        }),
        expect.objectContaining({
          code: "contract-request-field-schema-incompatible",
          fieldPath: "profile.nickname",
          location: "body",
        }),
      ]),
    );
  });

  it("should classify top-level request schema changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/search")
      class SearchController {
        @Post("/")
        search(@Body(z.string()) _body: string): void {}
      }

      return SearchController;
    })();
    const CurrentController = (() => {
      @Controller("/search")
      class SearchController {
        @Post("/")
        search(@Body(z.number()) _body: number): void {}
      }

      return SearchController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-schema-incompatible",
        location: "body",
        routeId: "SearchController.search",
      }),
    ]);
  });

  it("should classify response schema removals as incompatible", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ id: z.string(), name: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ id: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-response-schema-incompatible",
        routeId: "UsersController.getUser",
      }),
    ]);
  });

  it("should classify added Problem response codes as breaking and removed codes as non-breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_FORBIDDEN", category: ProblemCategory.Forbidden })
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const baseline = createContractGraphSnapshot(buildContractGraph([BaselineController]));
    const current = createContractGraphSnapshot(buildContractGraph([CurrentController]));

    const additiveDiff = diffContractGraphSnapshots(baseline, current);
    const removalDiff = diffContractGraphSnapshots(current, baseline);

    expect(additiveDiff.hasBreakingChanges).toBe(true);
    expect(additiveDiff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-added",
        fieldPath: "USER_FORBIDDEN",
        location: "problem",
      }),
    ]);
    expect(removalDiff.hasBreakingChanges).toBe(true);
    expect(removalDiff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-removed",
        fieldPath: "USER_FORBIDDEN",
        location: "problem",
      }),
    ]);
  });

  it("should classify Problem category or status changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.Forbidden })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-classification-changed",
        fieldPath: "USER_NOT_FOUND",
        location: "problem",
      }),
    ]);
  });

  it("should classify nullable response expansions as incompatible", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ name: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ name: z.string().nullable() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-response-schema-incompatible",
        routeId: "UsersController.getUser",
      }),
    ]);
  });
});
