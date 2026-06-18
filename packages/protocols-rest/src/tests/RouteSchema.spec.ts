import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  Body,
  Controller,
  defineRouteSchema,
  type InferRouteSchemaRequest,
  type InferRouteSchemaResponse,
  Post,
  RESPONSE_SCHEMA_KEY,
  ResponseSchema,
  REST_PARAMS_KEY,
  type ParamMetadata,
} from "../index";

describe("defineRouteSchema", () => {
  it("should let controller decorators consume the same schema that defines DTO types", () => {
    const createUserRoute = defineRouteSchema({
      request: {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      },
      response: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
      }),
    });
    type CreateUserBody = InferRouteSchemaRequest<typeof createUserRoute>["body"];
    type CreateUserResponse = InferRouteSchemaResponse<typeof createUserRoute>;

    const validBody: CreateUserBody = { name: "Ada", email: "ada@example.com" };
    // @ts-expect-error DTO field types come from the schema, not a parallel interface.
    const invalidBody: CreateUserBody = { name: "Ada", email: 42 };

    @Controller("/users")
    class UsersController {
      @Post("/")
      @ResponseSchema(createUserRoute.response)
      createUser(@Body(createUserRoute.request.body) body: CreateUserBody): CreateUserResponse {
        return { id: "4ea573de-cfb9-4696-bc48-216f19f44300", ...body };
      }
    }

    const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UsersController) as Map<
      string | symbol,
      ParamMetadata[]
    >;
    const params = paramsMap.get("createUser") ?? [];
    const bodyPipe = params[0]?.pipes?.[0] as { readonly schema: unknown } | undefined;

    expect(validBody.name).toBe("Ada");
    expect(invalidBody).toBeDefined();
    expect(bodyPipe?.schema).toBe(createUserRoute.request.body);
    expect(Reflect.getMetadata(RESPONSE_SCHEMA_KEY, UsersController, "createUser")).toBe(
      createUserRoute.response,
    );
  });
});
