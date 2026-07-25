import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpMethod, ParamType } from "../libs/constants";
import { Controller } from "../libs/decorators/Controller";
import { Get, Post } from "../libs/decorators/HttpMethod";
import { Body, Param, Query } from "../libs/decorators/Params";
import { getParamsMeta } from "../libs/metadata/MetadataReader";
import { defineRouteContract } from "../libs/types/RouteContract";

describe("Param decorators", () => {
  it("should register param metadata", () => {
    @Controller("/users")
    class UserController {
      @Get("/:id")
      getUser(@Param("id") id: string, @Query("include") include: string) {
        return { id, include };
      }
    }

    const params = getParamsMeta(UserController, "getUser");
    expect(params).toHaveLength(2);

    const idParam = params.find((p) => p.name === "id");
    expect(idParam?.type).toBe(ParamType.PARAM);
    expect(idParam?.index).toBe(0);

    const includeParam = params.find((p) => p.name === "include");
    expect(includeParam?.type).toBe(ParamType.QUERY);
    expect(includeParam?.index).toBe(1);
  });

  it("should register body without name", () => {
    @Controller("/users")
    class UserController {
      @Get()
      create(@Body() body: unknown) {
        return body;
      }
    }

    const params = getParamsMeta(UserController, "create");
    expect(params).toHaveLength(1);
    expect(params[0].type).toBe(ParamType.BODY);
    expect(params[0].name).toBeUndefined();
  });

  it("should preserve metadata and indexes for contract-bound parameters", () => {
    const updateUser = defineRouteContract({
      method: HttpMethod.POST,
      path: "/users/:id",
      params: z.object({ id: z.string() }),
      query: z.object({ notify: z.coerce.boolean().optional() }),
      body: z.object({ name: z.string() }),
    });

    @Controller("/users")
    class UserController {
      @Post(updateUser)
      update(
        @Param(updateUser, "id") id: string,
        @Query(updateUser, "notify") notify: boolean | undefined,
        @Body(updateUser) body: { name: string },
      ) {
        return { body, id, notify };
      }
    }

    const params = getParamsMeta(UserController, "update");
    expect(params).toHaveLength(3);
    expect(params).toEqual([
      expect.objectContaining({ index: 2, type: ParamType.BODY }),
      expect.objectContaining({ index: 1, name: "notify", type: ParamType.QUERY }),
      expect.objectContaining({ index: 0, name: "id", type: ParamType.PARAM }),
    ]);
    expect(params.every((param) => param.pipes?.length === 1)).toBe(true);
  });
});
