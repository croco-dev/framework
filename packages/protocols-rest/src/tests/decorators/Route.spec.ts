import "reflect-metadata";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  HttpMethod,
  PROBLEM_RESPONSES_KEY,
  RESPONSE_SCHEMA_KEY,
  REST_ROUTES_KEY,
} from "../../libs/constants";
import { Controller } from "../../libs/decorators/Controller";
import {
  All,
  Delete,
  Get,
  Head,
  Options,
  Patch,
  Post,
  Put,
} from "../../libs/decorators/HttpMethod";
import { ProblemResponse, ProblemResponses } from "../../libs/decorators/ProblemResponse";
import { ResponseSchema } from "../../libs/decorators/ResponseSchema";
import type { ProblemResponseMetadata, RouteMetadata } from "../../libs/types";
import {
  defineRouteContract,
  defineRouteProblem,
  routeProblemResponses,
} from "../../libs/types/RouteContract";

class UserNotFoundProblem extends Problem {
  readonly code = "USER_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor() {
    super("USER_NOT_FOUND", ProblemCategory.NotFound);
  }
}

describe("Route decorators", () => {
  describe("@Get decorator", () => {
    it("should register GET route with path", () => {
      @Controller("/users")
      class UserController {
        @Get("/:id")
        getUser() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe(HttpMethod.GET);
      expect(routes[0].path).toBe("/:id");
      expect(routes[0].methodName).toBe("getUser");
    });

    it("should normalize path without leading slash", () => {
      @Controller("/items")
      class ItemController {
        @Get("list")
        list() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, ItemController) as RouteMetadata[];
      expect(routes[0].path).toBe("/list");
    });

    it("should handle empty path", () => {
      @Controller("/root")
      class RootController {
        @Get()
        index() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, RootController) as RouteMetadata[];
      expect(routes[0].path).toBe("");
    });

    it("should register a typed route contract while keeping route metadata controller-relative", () => {
      const userSchema = z.object({ id: z.string(), name: z.string() });
      const getUserContract = defineRouteContract({
        id: "users.get",
        method: HttpMethod.GET,
        path: "/users/:id",
        operationId: "getUser",
        sourceLocation: { path: "src/controllers/UserController.ts", line: 10 },
        params: z.object({ id: z.string() }),
        response: userSchema,
      });

      @Controller("/users")
      class UserController {
        @Get(getUserContract)
        @ResponseSchema(getUserContract)
        getUser() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];

      expect(routes[0]).toMatchObject({
        method: HttpMethod.GET,
        path: "/:id",
        methodName: "getUser",
        contract: getUserContract,
      });
      expect(Reflect.getMetadata(RESPONSE_SCHEMA_KEY, UserController, "getUser")).toBe(userSchema);
    });
  });

  describe("@Post decorator", () => {
    it("should register POST route", () => {
      @Controller("/users")
      class UserController {
        @Post()
        create() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.POST);
      expect(routes[0].path).toBe("");
      expect(routes[0].methodName).toBe("create");
    });

    it("should register POST route with path", () => {
      @Controller("/auth")
      class AuthController {
        @Post("/login")
        login() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, AuthController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.POST);
      expect(routes[0].path).toBe("/login");
    });
  });

  describe("@ProblemResponse decorators", () => {
    it("should register declared Problem responses with normalized options", () => {
      @Controller("/users")
      class UserController {
        @Get("/:id")
        @ProblemResponses(
          { code: "USER_NOT_FOUND", category: ProblemCategory.NotFound },
          {
            code: "USER_FORBIDDEN",
            category: ProblemCategory.Forbidden,
            status: 451,
            description: "User cannot be read by the current actor.",
            type: "https://example.com/problems/user-forbidden",
          },
        )
        getUser() {}
      }

      const responses = Reflect.getMetadata(
        PROBLEM_RESPONSES_KEY,
        UserController,
        "getUser",
      ) as ProblemResponseMetadata[];

      expect(responses).toEqual([
        {
          code: "USER_NOT_FOUND",
          category: ProblemCategory.NotFound,
          status: 404,
        },
        {
          code: "USER_FORBIDDEN",
          category: ProblemCategory.Forbidden,
          description: "User cannot be read by the current actor.",
          status: 451,
          type: "https://example.com/problems/user-forbidden",
        },
      ]);
    });

    it("should append repeated ProblemResponse decorators", () => {
      @Controller("/users")
      class UserController {
        @Get("/:id")
        @ProblemResponse({
          code: "USER_FORBIDDEN",
          category: ProblemCategory.Forbidden,
        })
        @ProblemResponse({
          code: "USER_NOT_FOUND",
          category: ProblemCategory.NotFound,
        })
        getUser() {}
      }

      const responses = Reflect.getMetadata(
        PROBLEM_RESPONSES_KEY,
        UserController,
        "getUser",
      ) as ProblemResponseMetadata[];

      expect(responses.map((response) => response.code)).toEqual([
        "USER_NOT_FOUND",
        "USER_FORBIDDEN",
      ]);
    });

    it("should register route contract-derived Problem responses with contract provenance", () => {
      const getUserContract = defineRouteContract({
        method: HttpMethod.GET,
        path: "/users",
        problems: [
          defineRouteProblem(UserNotFoundProblem, {
            code: "USER_NOT_FOUND",
            category: ProblemCategory.NotFound,
          }),
        ],
      });

      @Controller("/users")
      class UserController {
        @Get("/:id")
        @ProblemResponses(...routeProblemResponses(getUserContract))
        getUser() {}
      }

      const responses = Reflect.getMetadata(
        PROBLEM_RESPONSES_KEY,
        UserController,
        "getUser",
      ) as ProblemResponseMetadata[];

      expect(responses).toEqual([
        {
          code: "USER_NOT_FOUND",
          category: ProblemCategory.NotFound,
          status: 404,
          routeContractProblems: [
            {
              code: "USER_NOT_FOUND",
              category: ProblemCategory.NotFound,
              status: 404,
            },
          ],
        },
      ]);
    });
  });

  describe("@Put decorator", () => {
    it("should register PUT route with parameter", () => {
      @Controller("/users")
      class UserController {
        @Put("/:id")
        updateUser() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.PUT);
      expect(routes[0].path).toBe("/:id");
    });
  });

  describe("@Patch decorator", () => {
    it("should register PATCH route", () => {
      @Controller("/users")
      class UserController {
        @Patch("/:id")
        partialUpdate() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.PATCH);
      expect(routes[0].path).toBe("/:id");
    });
  });

  describe("@Delete decorator", () => {
    it("should register DELETE route", () => {
      @Controller("/users")
      class UserController {
        @Delete("/:id")
        deleteUser() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.DELETE);
      expect(routes[0].path).toBe("/:id");
    });
  });

  describe("@Options decorator", () => {
    it("should register OPTIONS route", () => {
      @Controller("/api")
      class ApiController {
        @Options()
        handleOptions() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, ApiController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.OPTIONS);
    });
  });

  describe("@Head decorator", () => {
    it("should register HEAD route", () => {
      @Controller("/resources")
      class ResourceController {
        @Head("/:id")
        headResource() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, ResourceController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.HEAD);
      expect(routes[0].path).toBe("/:id");
    });
  });

  describe("@All decorator", () => {
    it("should register ALL route", () => {
      @Controller("/webhook")
      class WebhookController {
        @All()
        handleAll() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, WebhookController) as RouteMetadata[];
      expect(routes[0].method).toBe(HttpMethod.ALL);
    });
  });

  describe("Multiple routes", () => {
    it("should register multiple routes on same controller", () => {
      @Controller("/items")
      class ItemController {
        @Get()
        list() {}

        @Get("/:id")
        getById() {}

        @Post()
        create() {}

        @Put("/:id")
        update() {}

        @Patch("/:id")
        patch() {}

        @Delete("/:id")
        delete() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, ItemController) as RouteMetadata[];
      expect(routes).toHaveLength(6);

      const getRoutes = routes.filter((r: RouteMetadata) => r.method === HttpMethod.GET);
      expect(getRoutes).toHaveLength(2);

      const postRoute = routes.find((r: RouteMetadata) => r.method === HttpMethod.POST);
      expect(postRoute?.methodName).toBe("create");

      const putRoute = routes.find((r: RouteMetadata) => r.method === HttpMethod.PUT);
      expect(putRoute?.methodName).toBe("update");

      const patchRoute = routes.find((r: RouteMetadata) => r.method === HttpMethod.PATCH);
      expect(patchRoute?.methodName).toBe("patch");

      const deleteRoute = routes.find((r: RouteMetadata) => r.method === HttpMethod.DELETE);
      expect(deleteRoute?.methodName).toBe("delete");
    });

    it("should preserve order of route registration", () => {
      @Controller("/order")
      class OrderController {
        @Get("/first")
        first() {}

        @Get("/second")
        second() {}

        @Get("/third")
        third() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, OrderController) as RouteMetadata[];
      expect(routes).toHaveLength(3);
      expect(routes[0].methodName).toBe("first");
      expect(routes[1].methodName).toBe("second");
      expect(routes[2].methodName).toBe("third");
    });
  });

  describe("Path normalization", () => {
    it("should normalize paths consistently across all methods", () => {
      @Controller("/api")
      class ApiController {
        @Get("users")
        getUsers() {}

        @Post("users")
        createUser() {}

        @Put("users/:id")
        updateUser() {}

        @Patch("users/:id")
        patchUser() {}

        @Delete("users/:id")
        deleteUser() {}
      }

      const routes = Reflect.getMetadata(REST_ROUTES_KEY, ApiController) as RouteMetadata[];
      expect(routes).toHaveLength(5);

      for (const route of routes) {
        expect(route.path.startsWith("/")).toBe(true);
      }
    });
  });
});
