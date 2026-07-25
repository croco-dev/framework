import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  Body,
  defineRouteContract,
  defineRouteProblem,
  Get,
  HttpMethod,
  Param,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
  type RouteBody,
  type RouteContractHandler,
  type RouteContractRequest,
  type RouteContractResult,
  type RouteContractSpec,
  type RouteHandler,
  type RouteMethodReturn,
  type RouteParam,
  type RoutePathParamName,
  type RoutePathParams,
  type RouteProblem,
  type RouteQuery,
  type RouteQueryParam,
  type RouteResponse,
  routeParam,
  routeParamSchema,
  routeProblemResponses,
  routeQueryParam,
  routeQuerySchema,
  routeResponseSchema,
} from "../index";

/* oxlint-disable import/no-duplicates */
// @ts-expect-error TypedRouteConfig was removed because it had no owning runtime path.
import type { TypedRouteConfig as RemovedTypedRouteConfig } from "../index";
// @ts-expect-error InferRouteRequest was coupled to the removed TypedRouteConfig surface.
import type { InferRouteRequest as RemovedInferRouteRequest } from "../index";
// @ts-expect-error InferRouteResponse was coupled to the removed TypedRouteConfig surface.
import type { InferRouteResponse as RemovedInferRouteResponse } from "../index";
// @ts-expect-error TypedRouteHandler was coupled to the removed TypedRouteConfig surface.
import type { TypedRouteHandler as RemovedTypedRouteHandler } from "../index";
// @ts-expect-error ApiEndpoint duplicated the removed route configuration surface.
import type { ApiEndpoint as RemovedApiEndpoint } from "../index";
// @ts-expect-error EndpointRequest was coupled to the removed ApiEndpoint surface.
import type { EndpointRequest as RemovedEndpointRequest } from "../index";
// @ts-expect-error EndpointResponse was coupled to the removed ApiEndpoint surface.
import type { EndpointResponse as RemovedEndpointResponse } from "../index";
/* oxlint-enable import/no-duplicates */

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const createUserSchema = z.object({
  name: z.string(),
});

const userQuerySchema = z.object({
  includePosts: z.boolean().optional(),
});

const contractParameterTypes = defineRouteContract({
  method: HttpMethod.POST,
  path: "/typed/:id",
  params: z.object({
    id: z.string().brand<"UserId">(),
  }),
  query: z.object({
    anyOutput: z.any(),
    defaulted: z.string().default("default"),
    neverOutput: z.never(),
    nullable: z.string().nullable(),
    optional: z.string().optional(),
    page: z.coerce.number().int(),
    preprocessed: z.preprocess((value) => String(value), z.string()),
    transformed: z.string().transform((value) => value.length),
    union: z.union([z.string(), z.number()]),
    unknownOutput: z.unknown(),
  }),
  body: z
    .object({ name: z.string() })
    .transform((value) => ({ ...value, normalized: true as const })),
});

const otherBrand = z.string().brand<"OtherId">();

class UserNotFoundProblem extends Problem {
  constructor(id: string) {
    super("users/not-found", ProblemCategory.NotFound, `User '${id}' was not found.`);
  }
}

class UserForbiddenProblem extends Problem {
  readonly code = "USER_FORBIDDEN";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super("USER_FORBIDDEN", ProblemCategory.Forbidden);
  }
}

describe("route contract types", () => {
  const getUserContract = defineRouteContract({
    id: "users.get",
    method: HttpMethod.GET,
    path: "/users/:id",
    operationId: "getUser",
    sourceLocation: { path: "src/controllers/UserController.ts", line: 12 },
    params: z.object({ id: z.string() }),
    query: userQuerySchema,
    response: userSchema,
    problems: [UserNotFoundProblem],
  });

  const createUserContract = defineRouteContract({
    id: "users.create",
    method: HttpMethod.POST,
    path: "/users",
    body: createUserSchema,
    response: userSchema,
  });

  const listUsersContract = defineRouteContract({
    id: "users.list",
    method: HttpMethod.GET,
    path: "/users",
    response: z.array(userSchema),
  });

  const updateUserContract = defineRouteContract({
    method: HttpMethod.POST,
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    response: userSchema,
    problems: [
      defineRouteProblem(UserForbiddenProblem, {
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
      }),
    ],
  });

  it("connects route schemas to controller decorator migration helpers", () => {
    class UsersController {
      @Get(getUserContract)
      getUser(
        @Param(getUserContract, "id") id: RouteParam<typeof getUserContract, "id">,
        @Query(getUserContract, "includePosts")
        includePosts: RouteQueryParam<typeof getUserContract, "includePosts">,
      ): RouteMethodReturn<typeof getUserContract> {
        return { id, name: includePosts ? "Ada Lovelace" : "Ada" };
      }

      @Post(createUserContract)
      @ResponseSchema(createUserContract)
      createUser(
        @Body(createUserContract) body: RouteBody<typeof createUserContract>,
      ): RouteMethodReturn<typeof createUserContract> {
        return { id: "user_1", name: body.name };
      }
    }

    expect(new UsersController().getUser("user_1", true)).toEqual({
      id: "user_1",
      name: "Ada Lovelace",
    });
    expect(routeParamSchema(getUserContract, "id")).toBe(getUserContract.params.shape.id);
    expect(routeQueryParam(getUserContract, "includePosts")).toBe("includePosts");
    expect(routeQuerySchema(getUserContract)).toBe(userQuerySchema);
    expect(routeResponseSchema(getUserContract)).toBe(userSchema);
  });

  it("infers request, response, and Problem types from route contracts", async () => {
    expectTypeOf<RoutePathParamName<typeof getUserContract.path>>().toEqualTypeOf<"id">();
    expectTypeOf<RouteParam<typeof getUserContract, "id">>().toEqualTypeOf<string>();
    expectTypeOf<RouteQuery<typeof getUserContract>>().toEqualTypeOf<{
      includePosts?: boolean | undefined;
    }>();
    expectTypeOf<RouteBody<typeof createUserContract>>().toEqualTypeOf<{
      name: string;
    }>();
    expectTypeOf<RouteResponse<typeof listUsersContract>>().toEqualTypeOf<
      {
        id: string;
        name: string;
      }[]
    >();
    expectTypeOf<RouteResponse<typeof getUserContract>>().toEqualTypeOf<{
      id: string;
      name: string;
    }>();
    expectTypeOf<RouteProblem<typeof getUserContract>>().toEqualTypeOf<UserNotFoundProblem>();
    expectTypeOf<RouteProblem<typeof updateUserContract>>().toEqualTypeOf<UserForbiddenProblem>();
    expectTypeOf(routeProblemResponses(updateUserContract)[0]?.status).toEqualTypeOf<403>();
    expectTypeOf<RoutePathParams<typeof getUserContract>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<RouteContractRequest<typeof createUserContract>["body"]>().toEqualTypeOf<{
      name: string;
    }>();
    expectTypeOf<RouteContractRequest<typeof createUserContract>["params"]>().toEqualTypeOf<
      RoutePathParams<typeof createUserContract>
    >();
    expectTypeOf<RouteContractResult<typeof createUserContract>>().toEqualTypeOf<
      { id: string; name: string } | Promise<{ id: string; name: string }>
    >();

    const routeHandler: RouteHandler<{ id: string }, { found: boolean }> = ({ id }) => ({
      found: id.length > 0,
    });
    const contractSpec: RouteContractSpec = getUserContract;

    expect(routeHandler({ id: "user_1" })).toEqual({ found: true });
    expect(contractSpec.path).toBe("/users/:id");

    const handler: RouteContractHandler<typeof createUserContract> = async ({ body }) => ({
      id: "user_1",
      name: body.name,
    });

    await expect(handler({ body: { name: "Ada" }, params: {}, query: {} })).resolves.toEqual({
      id: "user_1",
      name: "Ada",
    });
  });
});

// @ts-expect-error route path declares id, not userId.
defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ userId: z.string() }),
});

// @ts-expect-error params schema declares id, but the route path has no path parameters.
defineRouteContract({
  method: HttpMethod.GET,
  path: "/users",
  params: z.object({ id: z.string() }),
});

const unionParamsSchema =
  Math.random() > 0.5 ? z.object({ id: z.string() }) : z.object({ userId: z.string() });

// @ts-expect-error union params schemas still expose extra path params on paramless routes.
defineRouteContract({
  method: HttpMethod.GET,
  path: "/users",
  params: unionParamsSchema,
});

const responseContract = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.string() }),
  response: userSchema,
});

const postContractForNegativeTest = defineRouteContract({
  method: HttpMethod.POST,
  path: "/users",
  body: createUserSchema,
  response: userSchema,
});

// @ts-expect-error routeParam only accepts names declared by the route path and params schema.
routeParam(responseContract, "userId");

const invalidResponseHandler: RouteContractHandler<typeof responseContract> = () => ({
  // @ts-expect-error response id must stay a string because it is inferred from the response schema.
  id: 123,
  name: "Ada",
});

void invalidResponseHandler;

class InvalidMethodController {
  // @ts-expect-error @Get cannot consume a POST route contract.
  @Get(postContractForNegativeTest)
  invalidMethod(): void {}
}

class InvalidBodyController {
  invalidBody(
    // @ts-expect-error @Body(contract) requires a route contract with a body schema.
    @Body(responseContract) _body: unknown,
  ): void {}
}

void InvalidMethodController;
void InvalidBodyController;

class ValidContractParameterController {
  valid(
    @Param(contractParameterTypes, "id") id: string,
    @Query(contractParameterTypes, "page") page: number,
    @Query(contractParameterTypes, "defaulted") defaulted: string,
    @Query(contractParameterTypes, "transformed") transformed: number,
    @Query(contractParameterTypes, "preprocessed") preprocessed: string,
    @Query(contractParameterTypes, "optional") optional: string | undefined,
    @Query(contractParameterTypes, "nullable") nullable: string | null,
    @Query(contractParameterTypes, "union") union: string | number,
    @Query(contractParameterTypes, "anyOutput") anyOutput: unknown,
    @Query(contractParameterTypes, "unknownOutput") unknownOutput: unknown,
    @Body(contractParameterTypes) body: { name: string; normalized: true },
  ): void {
    void [
      id,
      page,
      defaulted,
      transformed,
      preprocessed,
      optional,
      nullable,
      union,
      anyOutput,
      unknownOutput,
      body,
    ];
  }

  acceptsNeverOutput(@Query(contractParameterTypes, "neverOutput") neverOutput: unknown): void {
    void neverOutput;
  }

  acceptsSafeWiderAnnotations(
    @Param(contractParameterTypes, "id") id: string | null,
    @Query(contractParameterTypes, "page") page: unknown,
  ): void {
    void [id, page];
  }

  legacyLooseOverloads(
    @Param("id", z.string()) id: number,
    @Query("page", z.coerce.number()) page: string,
    @Body(z.object({ name: z.string() })) body: boolean,
  ): void {
    void [id, page, body];
  }
}

class InvalidContractParameterController {
  invalidCoercion(
    // @ts-expect-error parsed number output is not assignable to a string annotation.
    @Query(contractParameterTypes, "page") page: string,
  ): void {
    void page;
  }

  invalidTransform(
    // @ts-expect-error transformed number output is not assignable to the pre-transform string.
    @Query(contractParameterTypes, "transformed") transformed: string,
  ): void {
    void transformed;
  }

  invalidBrand(
    // @ts-expect-error UserId output is not assignable to an unrelated brand.
    @Param(contractParameterTypes, "id") id: z.infer<typeof otherBrand>,
  ): void {
    void id;
  }

  invalidOptional(
    // @ts-expect-error optional output includes undefined.
    @Query(contractParameterTypes, "optional") optional: string,
  ): void {
    void optional;
  }

  invalidNullable(
    // @ts-expect-error nullable output includes null.
    @Query(contractParameterTypes, "nullable") nullable: string,
  ): void {
    void nullable;
  }

  invalidUnion(
    // @ts-expect-error the complete parsed union must be accepted by the annotation.
    @Query(contractParameterTypes, "union") union: string,
  ): void {
    void union;
  }

  invalidBody(
    // @ts-expect-error body parameters receive the transformed output.
    @Body(contractParameterTypes) body: { name: number; normalized: true },
  ): void {
    void body;
  }

  invalidAny(
    // @ts-expect-error any cannot bypass strict contract-bound parameter validation.
    @Query(contractParameterTypes, "page") page: any,
  ): void {
    void page;
  }

  invalidAnyOutput(
    // @ts-expect-error unconstrained parsed output can only be delivered to unknown.
    @Query(contractParameterTypes, "anyOutput") value: string,
  ): void {
    void value;
  }

  invalidNever(
    // @ts-expect-error a parsed number cannot be delivered to never.
    @Query(contractParameterTypes, "page") page: never,
  ): void {
    void page;
  }

  invalidKey(
    // @ts-expect-error contract query keys remain validated.
    @Query(contractParameterTypes, "missing") missing: unknown,
  ): void {
    void missing;
  }
}

class InvalidGenericContractParameterController {
  invalidGeneric<Value>(
    // @ts-expect-error generic method annotations cannot prove a stable contract input slot.
    @Query(contractParameterTypes, "page") page: Value,
  ): void {
    void page;
  }

  invalidConstrainedGeneric<Value extends number>(
    // @ts-expect-error constrained generics may still be instantiated with a narrower subtype.
    @Query(contractParameterTypes, "page") page: Value,
  ): void {
    void page;
  }
}

class InvalidVisibilityContractParameterController {
  private invalidPrivate(
    // @ts-expect-error contract-bound parameters require a public instance method target.
    @Query(contractParameterTypes, "page") page: number,
  ): void {
    void page;
  }

  protected invalidProtected(
    // @ts-expect-error contract-bound parameters require a public instance method target.
    @Query(contractParameterTypes, "page") page: number,
  ): void {
    void page;
  }

  static invalidStatic(
    // @ts-expect-error static targets do not own controller parameter metadata.
    @Query(contractParameterTypes, "page") page: number,
  ): void {
    void page;
  }
}

class InvalidContractParameterConstructor {
  constructor(
    // @ts-expect-error contract-bound parameter decorators require a method target.
    @Body(contractParameterTypes) body: RouteBody<typeof contractParameterTypes>,
  ) {
    void body;
  }
}

void ValidContractParameterController;
void InvalidContractParameterController;
void InvalidGenericContractParameterController;
void InvalidVisibilityContractParameterController;
void InvalidContractParameterConstructor;

defineRouteProblem(UserForbiddenProblem, {
  // @ts-expect-error typed Problem helpers preserve the subclass literal code.
  code: "USER_NOT_FOUND",
  category: ProblemCategory.Forbidden,
});

defineRouteProblem(UserForbiddenProblem, {
  code: "USER_FORBIDDEN",
  // @ts-expect-error typed Problem helpers preserve the subclass literal category.
  category: ProblemCategory.NotFound,
});

ProblemResponse({
  code: "USER_FORBIDDEN",
  category: ProblemCategory.Forbidden,
  // @ts-expect-error route contract provenance is attached only by routeProblemResponses(contract).
  routeContractProblems: [],
});

type RemovedRouteTypes = [
  RemovedTypedRouteConfig,
  RemovedInferRouteRequest<never>,
  RemovedInferRouteResponse<never>,
  RemovedTypedRouteHandler<never>,
  RemovedApiEndpoint,
  RemovedEndpointRequest<never>,
  RemovedEndpointResponse<never>,
];

const removedRouteTypes: RemovedRouteTypes | undefined = undefined;
void removedRouteTypes;
