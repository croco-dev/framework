import "reflect-metadata";
import type { PipeTransform } from "@croco/protocols-rest";
import { Body, ParamType, REST_PARAMS_KEY } from "@croco/protocols-rest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ParamResolver } from "../libs/ParamResolver";
import type { CrocoHttpContext } from "../libs/types";

function createMockHttpContext(
  json: CrocoHttpContext["json"],
  request = new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }),
): CrocoHttpContext {
  const store = new Map<string, unknown>();

  return {
    req: {
      method: request.method,
      url: request.url,
      path: "/test",
      params: {},
      query: {},
      headers: {},
    },
    res: {
      status: 200,
      headers: {},
    },
    raw: {
      req: {
        raw: request,
        text: vi.fn(() => request.text()),
      },
    } as unknown as CrocoHttpContext["raw"],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json,
    set: (key, value) => {
      store.set(key, value);
    },
    get: <T>(key: string) => store.get(key) as T | undefined,
    text: vi
      .fn()
      .mockImplementation((body: string, status: number = 200) => new Response(body, { status })),
    jsonResponse: vi
      .fn()
      .mockImplementation(
        (body: unknown, status: number = 200) => new Response(JSON.stringify(body), { status }),
      ),
    redirect: vi
      .fn()
      .mockImplementation((url: string, status: number = 302) => Response.redirect(url, status)),
  };
}

function defineNamedParamMetadata(
  controller: object,
  methodName: string,
  type: ParamType,
  pipe?: PipeTransform | z.ZodType,
): void {
  Reflect.defineMetadata(
    REST_PARAMS_KEY,
    new Map([
      [
        methodName,
        [
          {
            type,
            index: 0,
            name: "value",
            ...(pipe ? { pipes: [pipe as PipeTransform] } : {}),
          },
        ],
      ],
    ]),
    controller,
  );
}

describe("ParamResolver", () => {
  it("BUG-03 @Body를 여러 번 사용해도 body를 한 번만 파싱", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const parsedBody = { name: "croco" };
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody),
    });
    const json = vi.fn();

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"], request);

    const args = await resolver.resolveParams(ctx, TestController, "create");

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(ctx.raw.req.text).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it("동일 요청 컨텍스트에서 resolveParams를 다시 호출해도 body 캐시를 재사용", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const parsedBody = { id: "1" };
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody),
    });
    const json = vi.fn();

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"], request);

    await resolver.resolveParams(ctx, TestController, "create");
    const args = await resolver.resolveParams(ctx, TestController, "create");

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(ctx.raw.req.text).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it("body parse failure도 캐시해 같은 요청에서 다시 읽지 않음", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const json = vi.fn();

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"], request);
    const expectedProblem = {
      code: "protocols-rest/request-validation-failed",
      issues: [
        {
          path: "body.value",
          message: "Request body must contain valid JSON",
        },
      ],
    };

    await expect(resolver.resolveParams(ctx, TestController, "create")).rejects.toMatchObject(
      expectedProblem,
    );
    expect(ctx.raw.req.text).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();

    await expect(resolver.resolveParams(ctx, TestController, "create")).rejects.toMatchObject(
      expectedProblem,
    );
    expect(ctx.raw.req.text).toHaveBeenCalledTimes(1);
  });

  it("represents an omitted request body as undefined and caches the omission", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const json = vi.fn(async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    });
    const request = new Request("http://localhost/test", { method: "POST" });
    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"], request);

    await expect(resolver.resolveParams(ctx, TestController, "create")).resolves.toEqual([
      undefined,
      undefined,
    ]);
    await expect(resolver.resolveParams(ctx, TestController, "create")).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(json).not.toHaveBeenCalled();
    expect(ctx.raw.req.text).not.toHaveBeenCalled();
  });

  it("parses a present body independently of the HTTP method", async () => {
    class TestController {
      remove(@Body() _body: unknown) {}
    }

    const parsedBody = { id: "widget-1" };
    const json = vi.fn();
    const request = new Request("http://localhost/test", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody),
    });
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"], request);

    await expect(new ParamResolver().resolveParams(ctx, TestController, "remove")).resolves.toEqual(
      [parsedBody],
    );
    expect(ctx.raw.req.text).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  });

  it("같은 인자 슬롯에 중복된 parameter metadata가 있으면 fail fast", async () => {
    class TestController {
      create(_value: unknown) {}
    }

    const params = new Map<
      string | symbol,
      Array<{ type: string; index: number; name?: string }>
    >();
    params.set("create", [
      { type: "body", index: 0 },
      { type: "user", index: 0 },
    ]);

    Reflect.defineMetadata(REST_PARAMS_KEY, params, TestController);

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(
      vi.fn(async () => ({ ok: true })) as CrocoHttpContext["json"],
    );

    await expect(resolver.resolveParams(ctx, TestController, "create")).rejects.toThrow(
      "Duplicate parameter metadata detected for create at index 0",
    );
  });

  it("pipe가 container에서 resolve되지 않으면 fail fast", async () => {
    class MissingPipe {
      transform(value: unknown): unknown {
        return value;
      }
    }

    class TestController {
      create(_value: unknown) {}
    }

    const params = new Map<
      string | symbol,
      Array<{
        type: string;
        index: number;
        name?: string;
        pipes?: Array<new (...args: unknown[]) => PipeTransform<unknown, unknown>>;
      }>
    >();
    params.set("create", [
      {
        type: "body",
        index: 0,
        pipes: [MissingPipe],
      },
    ]);

    Reflect.defineMetadata(REST_PARAMS_KEY, params, TestController);

    const resolver = new ParamResolver(() => undefined);
    const ctx = createMockHttpContext(
      vi.fn(async () => ({ ok: true })) as CrocoHttpContext["json"],
    );

    await expect(resolver.resolveParams(ctx, TestController, "create")).rejects.toThrow(
      "Container did not return an instance for pipe MissingPipe",
    );
  });

  it("recognizes a native raw Zod schema as a validation pipe", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    defineNamedParamMetadata(TestController, "read", ParamType.QUERY, z.string().trim().min(2));

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.query = vi.fn().mockReturnValue(" croco ");

    await expect(new ParamResolver().resolveParams(ctx, TestController, "read")).resolves.toEqual([
      "croco",
    ]);
  });

  it("recognizes a structurally compatible Zod schema with a foreign prototype", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    const schema = z.string().trim().min(2);
    const foreignSchema = Object.assign(
      Object.create({ constructor: schema.constructor }),
      schema,
      {
        safeParse: schema.safeParse.bind(schema),
      },
    ) as z.ZodType;
    expect(foreignSchema).not.toBeInstanceOf(z.ZodType);
    defineNamedParamMetadata(TestController, "read", ParamType.QUERY, foreignSchema);

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.query = vi.fn().mockReturnValue(" croco ");

    await expect(new ParamResolver().resolveParams(ctx, TestController, "read")).resolves.toEqual([
      "croco",
    ]);
  });

  it("keeps an ordinary parse-like object on the PipeTransform path", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    const safeParse = vi.fn();
    const transform = vi.fn((value: unknown) => `pipe:${String(value)}`);
    defineNamedParamMetadata(TestController, "read", ParamType.QUERY, {
      parse: vi.fn(),
      safeParse,
      transform,
    });

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.query = vi.fn().mockReturnValue("croco");

    await expect(new ParamResolver().resolveParams(ctx, TestController, "read")).resolves.toEqual([
      "pipe:croco",
    ]);
    expect(transform).toHaveBeenCalledWith("croco", {
      type: "query",
      name: "value",
    });
    expect(safeParse).not.toHaveBeenCalled();
  });

  it("routes invalid repeated query input through the shared ValidationPipe", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    defineNamedParamMetadata(TestController, "read", ParamType.QUERY, z.string().catch("fallback"));

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.query = vi.fn().mockReturnValue(["first", "second"]);

    await expect(
      new ParamResolver().resolveParams(ctx, TestController, "read"),
    ).rejects.toMatchObject({
      code: "protocols-rest/request-validation-failed",
      issues: [
        {
          path: "query.value",
          message: "Expected a single query value",
        },
      ],
    });
  });

  it("validates schema-less named query values against the scalar fallback contract", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    defineNamedParamMetadata(TestController, "read", ParamType.QUERY);

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.query = vi.fn().mockReturnValue("first");
    const resolver = new ParamResolver();

    await expect(resolver.resolveParams(ctx, TestController, "read")).resolves.toEqual(["first"]);

    vi.mocked(ctx.query).mockReturnValue(undefined);
    await expect(resolver.resolveParams(ctx, TestController, "read")).resolves.toEqual([undefined]);

    vi.mocked(ctx.query).mockReturnValue(["first", "second"]);
    await expect(resolver.resolveParams(ctx, TestController, "read")).rejects.toMatchObject({
      code: "protocols-rest/request-validation-failed",
      issues: [expect.objectContaining({ path: "query.value" })],
    });
  });

  it("keeps schema-less named headers on the optional scalar fallback contract", async () => {
    class TestController {
      read(_value: unknown) {}
    }

    defineNamedParamMetadata(TestController, "read", ParamType.HEADER);

    const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
    ctx.header = vi.fn().mockReturnValue("request-1");
    const resolver = new ParamResolver();

    await expect(resolver.resolveParams(ctx, TestController, "read")).resolves.toEqual([
      "request-1",
    ]);

    vi.mocked(ctx.header).mockReturnValue(undefined);
    await expect(resolver.resolveParams(ctx, TestController, "read")).resolves.toEqual([undefined]);
  });

  describe("auth parameter decorators (@User, @CurrentPrincipal, @CurrentApiKey)", () => {
    function createAuthDecorator(type: "user" | "principal" | "apikey"): ParameterDecorator {
      return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;
        const targetConstructor = target.constructor;
        const existingParams: Map<string | symbol, unknown[]> =
          Reflect.getOwnMetadata(REST_PARAMS_KEY, targetConstructor) ?? new Map();
        const methodParams = existingParams.get(propertyKey) ?? [];
        existingParams.set(propertyKey, [
          ...methodParams,
          {
            type,
            index: parameterIndex,
            name: undefined,
          },
        ]);
        Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, targetConstructor);
      };
    }

    const MockUser = (): ParameterDecorator => createAuthDecorator("user");
    const MockCurrentPrincipal = (): ParameterDecorator => createAuthDecorator("principal");
    const MockCurrentApiKey = (): ParameterDecorator => createAuthDecorator("apikey");

    it("resolves @User(), @CurrentPrincipal(), and @CurrentApiKey() from request properties", async () => {
      class SecureController {
        profile(
          @MockUser() _user: unknown,
          @MockCurrentPrincipal() _principal: unknown,
          @MockCurrentApiKey() _apiKey: unknown,
        ) {}
      }

      const mockUser = { id: "usr_123", email: "user@example.com", roles: ["admin"] };
      const mockPrincipal = { id: "usr_123", type: "user" as const };
      const mockApiKey = { key: "croco_live_test_key", tenantId: "tenant_abc" };

      const request = new Request("http://localhost/secured");
      Object.assign(request, {
        user: mockUser,
        principal: mockPrincipal,
        apiKey: mockApiKey,
      });

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      const resolver = new ParamResolver();

      const args = await resolver.resolveParams(ctx, SecureController, "profile");

      expect(args[0]).toEqual(mockUser);
      expect(args[1]).toEqual(mockPrincipal);
      expect(args[2]).toEqual(mockApiKey);
    });

    it("resolves undefined when auth principal properties are missing or undefined", async () => {
      class OptionalAuthController {
        optionalProfile(
          @MockUser() _user: unknown,
          @MockCurrentPrincipal() _principal: unknown,
          @MockCurrentApiKey() _apiKey: unknown,
        ) {}
      }

      const request = new Request("http://localhost/public");
      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      const resolver = new ParamResolver();

      const args = await resolver.resolveParams(ctx, OptionalAuthController, "optionalProfile");

      expect(args).toEqual([undefined, undefined, undefined]);
    });

    it("resolves auth params mixed with standard REST parameters in correct argument order", async () => {
      class MixedController {
        handle(
          @MockUser() _user: unknown,
          @Body() _body: unknown,
          @MockCurrentPrincipal() _principal: unknown,
        ) {}
      }

      const mockUser = { id: "usr_456" };
      const mockPrincipal = { id: "usr_456", type: "user" as const };
      const parsedBody = { amount: 100 };

      const request = new Request("http://localhost/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedBody),
      });
      Object.assign(request, {
        user: mockUser,
        principal: mockPrincipal,
      });

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      const resolver = new ParamResolver();

      const args = await resolver.resolveParams(ctx, MixedController, "handle");

      expect(args[0]).toEqual(mockUser);
      expect(args[1]).toEqual(parsedBody);
      expect(args[2]).toEqual(mockPrincipal);
    });

    it("supports fallback resolution from ctx.raw or ctx.get() when request property is not present", async () => {
      class FallbackController {
        me(@MockUser() _user: unknown, @MockCurrentApiKey() _apiKey: unknown) {}
      }

      const mockUser = { id: "usr_ctx" };
      const mockApiKey = { key: "croco_fallback_key" };

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
      // ctx.get("user") provides mockUser, ctx.raw.apiKey provides mockApiKey
      ctx.set("user", mockUser);
      (ctx.raw as unknown as Record<string, unknown>).apiKey = mockApiKey;

      const resolver = new ParamResolver();
      const args = await resolver.resolveParams(ctx, FallbackController, "me");

      expect(args[0]).toEqual(mockUser);
      expect(args[1]).toEqual(mockApiKey);
    });

    it("runs pipes on auth parameters with custom metadata type", async () => {
      class TransformedAuthController {
        profile(_user: unknown) {}
      }

      const mockUser = { id: "usr_999", role: "member" };
      const pipeTransform = vi.fn((val: unknown, meta: { type: string }) => ({
        ...(val as object),
        transformedBy: meta.type,
      }));

      Reflect.defineMetadata(
        REST_PARAMS_KEY,
        new Map([
          [
            "profile",
            [
              {
                type: "user",
                index: 0,
                pipes: [{ transform: pipeTransform }],
              },
            ],
          ],
        ]),
        TransformedAuthController,
      );

      const request = new Request("http://localhost/profile");
      Object.assign(request, { user: mockUser });

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      const resolver = new ParamResolver();

      const args = await resolver.resolveParams(ctx, TransformedAuthController, "profile");

      expect(args[0]).toEqual({
        id: "usr_999",
        role: "member",
        transformedBy: "custom",
      });
      expect(pipeTransform).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({ type: "custom" }),
      );
    });

    it("resolves lowercase apikey property from request", async () => {
      class ApiKeyController {
        check(@MockCurrentApiKey() _apiKey: unknown) {}
      }

      const mockApiKey = { key: "croco_lowercase_apikey" };
      const request = new Request("http://localhost/apikey");
      Object.assign(request, { apikey: mockApiKey });

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      const resolver = new ParamResolver();

      const args = await resolver.resolveParams(ctx, ApiKeyController, "check");
      expect(args[0]).toEqual(mockApiKey);
    });

    it("preserves explicit null auth user without falling back", async () => {
      class NullUserController {
        profile(@MockUser() _user: unknown) {}
      }

      const request = new Request("http://localhost/null-user");
      Object.assign(request, { user: null });

      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"], request);
      ctx.set("user", { id: "should_not_use_fallback" });

      const resolver = new ParamResolver();
      const args = await resolver.resolveParams(ctx, NullUserController, "profile");
      expect(args[0]).toBeNull();
    });

    it("resolves auth property attached to ctx.req (CrocoRequest)", async () => {
      class CrocoReqController {
        profile(@MockUser() _user: unknown) {}
      }

      const mockUser = { id: "usr_croco_req" };
      const ctx = createMockHttpContext(vi.fn() as CrocoHttpContext["json"]);
      Object.assign(ctx.req, { user: mockUser });

      const resolver = new ParamResolver();
      const args = await resolver.resolveParams(ctx, CrocoReqController, "profile");
      expect(args[0]).toEqual(mockUser);
    });
  });
});
