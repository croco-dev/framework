import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  Body,
  defineRouteContract,
  Get,
  HttpMethod,
  Param,
  Post,
  Query,
  ResponseSchema,
  routeBodySchema,
  routeParam,
  routeQueryParam,
  routeQuerySchema,
  routeResponseSchema,
  type RouteBody,
  type RouteContractHandler,
  type RouteMethodReturn,
  type RouteParam,
  type RoutePathParamName,
  type RouteProblem,
  type RouteQuery,
  type RouteQueryParam,
  type RouteResponse,
} from "../index";

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

class UserNotFoundProblem extends Problem {
  constructor(id: string) {
    super("users/not-found", ProblemCategory.NotFound, `User '${id}' was not found.`);
  }
}

describe("route contract types", () => {
  const getUserContract = defineRouteContract({
    method: HttpMethod.GET,
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    query: userQuerySchema,
    response: userSchema,
    problems: [UserNotFoundProblem],
  });

  const createUserContract = defineRouteContract({
    method: HttpMethod.POST,
    path: "/users",
    body: createUserSchema,
    response: userSchema,
  });

  it("connects route schemas to controller decorator migration helpers", () => {
    class UsersController {
      @Get(getUserContract.path)
      @ResponseSchema(routeResponseSchema(getUserContract))
      getUser(
        @Param(routeParam(getUserContract, "id")) id: RouteParam<typeof getUserContract, "id">,
        @Query(routeQueryParam(getUserContract, "includePosts"))
        includePosts: RouteQueryParam<typeof getUserContract, "includePosts">,
      ): RouteMethodReturn<typeof getUserContract> {
        return { id, name: includePosts ? "Ada Lovelace" : "Ada" };
      }

      @Post(createUserContract.path)
      @ResponseSchema(routeResponseSchema(createUserContract))
      createUser(
        @Body(routeBodySchema(createUserContract)) body: RouteBody<typeof createUserContract>,
      ): RouteMethodReturn<typeof createUserContract> {
        return { id: "user_1", name: body.name };
      }
    }

    expect(new UsersController().getUser("user_1", true)).toEqual({
      id: "user_1",
      name: "Ada Lovelace",
    });
    expect(routeQuerySchema(getUserContract)).toBe(userQuerySchema);
    expect(routeResponseSchema(getUserContract)).toBe(userSchema);
    expect(routeBodySchema(createUserContract)).toBe(createUserSchema);
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
    expectTypeOf<RouteResponse<typeof getUserContract>>().toEqualTypeOf<{
      id: string;
      name: string;
    }>();
    expectTypeOf<RouteProblem<typeof getUserContract>>().toEqualTypeOf<UserNotFoundProblem>();

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

const responseContract = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.string() }),
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
