import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { ParamType, REST_PARAMS_KEY } from "../../libs/constants";
import { Controller } from "../../libs/decorators/Controller";
import { Get, Post } from "../../libs/decorators/HttpMethod";
import { Body, Ctx, Header, Param, Query, Raw } from "../../libs/decorators/Params";
import type { ParamMetadata } from "../../libs/types";

describe("Parameter decorators", () => {
  describe("@Param decorator", () => {
    it("should register param metadata with name", () => {
      @Controller("/users")
      class UserController {
        @Get("/:id")
        getUser(@Param("id") id: string) {
          return id;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("getUser") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.PARAM);
      expect(params[0].name).toBe("id");
      expect(params[0].index).toBe(0);
    });

    it("should register multiple params", () => {
      @Controller("/posts/:postId/comments/:commentId")
      class CommentController {
        @Get()
        getComment(@Param("postId") postId: string, @Param("commentId") commentId: string) {
          return { postId, commentId };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, CommentController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("getComment") || [];

      expect(params).toHaveLength(2);
      expect(params[0].type).toBe(ParamType.PARAM);
      expect(params[0].name).toBe("commentId");
      expect(params[0].index).toBe(1);
      expect(params[1].type).toBe(ParamType.PARAM);
      expect(params[1].name).toBe("postId");
      expect(params[1].index).toBe(0);
    });
  });

  describe("@Query decorator", () => {
    it("should register query metadata with name", () => {
      @Controller("/users")
      class UserController {
        @Get()
        listUsers(@Query("page") page: string) {
          return page;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("listUsers") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.QUERY);
      expect(params[0].name).toBe("page");
    });

    it("should register multiple query params", () => {
      @Controller("/items")
      class ItemController {
        @Get()
        list(
          @Query("page") page: string,
          @Query("limit") limit: string,
          @Query("sort") sort: string,
        ) {
          return { page, limit, sort };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, ItemController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("list") || [];

      expect(params).toHaveLength(3);
      expect(params[0].type).toBe(ParamType.QUERY);
      expect(params[0].name).toBe("sort");
      expect(params[1].type).toBe(ParamType.QUERY);
      expect(params[1].name).toBe("limit");
      expect(params[2].type).toBe(ParamType.QUERY);
      expect(params[2].name).toBe("page");
    });
  });

  describe("@Header decorator", () => {
    it("should register header metadata with name", () => {
      @Controller("/auth")
      class AuthController {
        @Post()
        login(@Header("authorization") authHeader: string) {
          return authHeader;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, AuthController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("login") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.HEADER);
      expect(params[0].name).toBe("authorization");
    });

    it("should register multiple headers", () => {
      @Controller("/api")
      class ApiController {
        @Get()
        getData(@Header("authorization") auth: string, @Header("x-api-key") apiKey: string) {
          return { auth, apiKey };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, ApiController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("getData") || [];

      expect(params).toHaveLength(2);
      expect(params[0].type).toBe(ParamType.HEADER);
      expect(params[0].name).toBe("x-api-key");
      expect(params[1].type).toBe(ParamType.HEADER);
      expect(params[1].name).toBe("authorization");
    });
  });

  describe("@Body decorator", () => {
    it("should register body metadata without name", () => {
      @Controller("/users")
      class UserController {
        @Post()
        create(@Body() body: unknown) {
          return body;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("create") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.BODY);
      expect(params[0].name).toBeUndefined();
      expect(params[0].index).toBe(0);
    });

    it("should register body at correct index", () => {
      @Controller("/users")
      class UserController {
        @Post()
        create(@Param("id") id: string, @Body() body: unknown) {
          return { id, body };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("create") || [];

      expect(params).toHaveLength(2);
      expect(params[0].type).toBe(ParamType.BODY);
      expect(params[0].index).toBe(1);
      expect(params[1].type).toBe(ParamType.PARAM);
      expect(params[1].index).toBe(0);
    });
  });

  describe("@Ctx decorator", () => {
    it("should register ctx metadata without name", () => {
      @Controller("/users")
      class UserController {
        @Get()
        list(@Ctx() ctx: unknown) {
          return ctx;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("list") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.CTX);
      expect(params[0].name).toBeUndefined();
    });

    it("should register ctx at correct index", () => {
      @Controller("/items")
      class ItemController {
        @Get("/:id")
        get(@Param("id") id: string, @Ctx() ctx: unknown) {
          return { id, ctx };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, ItemController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("get") || [];

      expect(params).toHaveLength(2);
      expect(params[0].type).toBe(ParamType.CTX);
      expect(params[0].index).toBe(1);
      expect(params[1].type).toBe(ParamType.PARAM);
      expect(params[1].index).toBe(0);
    });
  });

  describe("@Raw decorator", () => {
    it("should register raw metadata without name", () => {
      @Controller("/webhook")
      class WebhookController {
        @Post()
        handle(@Raw() raw: unknown) {
          return raw;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, WebhookController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("handle") || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(ParamType.RAW);
      expect(params[0].name).toBeUndefined();
    });
  });

  describe("Mixed parameter decorators", () => {
    it("should register all types of parameters together", () => {
      @Controller("/users/:id")
      class UserController {
        @Get()
        get(
          @Param("id") id: string,
          @Query("include") include: string,
          @Header("authorization") auth: string,
          @Body() body: unknown,
          @Ctx() ctx: unknown,
          @Raw() raw: unknown,
        ) {
          return { id, include, auth, body, ctx, raw };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("get") || [];

      expect(params).toHaveLength(6);
      expect(params[0].type).toBe(ParamType.RAW);
      expect(params[0].index).toBe(5);

      expect(params[1].type).toBe(ParamType.CTX);
      expect(params[1].index).toBe(4);

      expect(params[2].type).toBe(ParamType.BODY);
      expect(params[2].index).toBe(3);

      expect(params[3].type).toBe(ParamType.HEADER);
      expect(params[3].name).toBe("authorization");
      expect(params[3].index).toBe(2);

      expect(params[4].type).toBe(ParamType.QUERY);
      expect(params[4].name).toBe("include");
      expect(params[4].index).toBe(1);

      expect(params[5].type).toBe(ParamType.PARAM);
      expect(params[5].name).toBe("id");
      expect(params[5].index).toBe(0);
    });
  });

  describe("Multiple methods", () => {
    it("should store separate params for different methods", () => {
      @Controller("/users")
      class UserController {
        @Get("/:id")
        getById(@Param("id") id: string) {
          return id;
        }

        @Post()
        create(@Body() body: unknown) {
          return body;
        }

        @Get()
        list(@Query("page") page: string) {
          return page;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<
        string | symbol,
        ParamMetadata[]
      >;

      const getByIdParams = paramsMap.get("getById") || [];
      expect(getByIdParams).toHaveLength(1);
      expect(getByIdParams[0].type).toBe(ParamType.PARAM);

      const createParams = paramsMap.get("create") || [];
      expect(createParams).toHaveLength(1);
      expect(createParams[0].type).toBe(ParamType.BODY);

      const listParams = paramsMap.get("list") || [];
      expect(listParams).toHaveLength(1);
      expect(listParams[0].type).toBe(ParamType.QUERY);
    });
  });

  describe("Parameter index tracking", () => {
    it("should correctly track parameter indices", () => {
      @Controller("/test")
      class TestController {
        @Post()
        test(
          p1: string,
          @Param("id") p2: string,
          p3: string,
          @Body() p4: unknown,
          p5: string,
          @Query("q") p6: string,
        ) {
          return { p1, p2, p3, p4, p5, p6 };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, TestController) as Map<
        string | symbol,
        ParamMetadata[]
      >;
      const params = paramsMap.get("test") || [];

      expect(params).toHaveLength(3);

      const param2 = params.find((p) => p.name === "id");
      expect(param2?.index).toBe(1);

      const bodyParam = params.find((p) => p.type === ParamType.BODY);
      expect(bodyParam?.index).toBe(3);

      const queryParam = params.find((p) => p.name === "q");
      expect(queryParam?.index).toBe(5);
    });
  });
});
