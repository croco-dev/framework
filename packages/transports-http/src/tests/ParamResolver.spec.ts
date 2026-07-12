import "reflect-metadata";
import type { PipeTransform } from "@croco/protocols-rest";
import { Body, ParamType, REST_PARAMS_KEY } from "@croco/protocols-rest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ParamResolver } from "../libs/ParamResolver";
import type { CrocoHttpContext } from "../libs/types";

function createMockHttpContext(json: CrocoHttpContext["json"]): CrocoHttpContext {
  const request = new Request("http://localhost/test");
  const store = new Map<string, unknown>();

  return {
    req: {
      method: "POST",
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
      },
    } as CrocoHttpContext["raw"],
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
    const json = vi.fn(async () => {
      if (json.mock.calls.length > 1) {
        throw new TypeError("Body already read");
      }
      return parsedBody;
    });

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"]);

    const args = await resolver.resolveParams(ctx, TestController, "create");

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it("동일 요청 컨텍스트에서 resolveParams를 다시 호출해도 body 캐시를 재사용", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const parsedBody = { id: "1" };
    const json = vi.fn(async () => parsedBody);

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"]);

    await resolver.resolveParams(ctx, TestController, "create");
    const args = await resolver.resolveParams(ctx, TestController, "create");

    expect(args).toEqual([parsedBody, parsedBody]);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it("body parse failure도 캐시해 같은 요청에서 다시 읽지 않음", async () => {
    class TestController {
      create(@Body() _first: unknown, @Body() _second: unknown) {}
    }

    const json = vi.fn(async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    });

    const resolver = new ParamResolver();
    const ctx = createMockHttpContext(json as CrocoHttpContext["json"]);
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
    expect(json).toHaveBeenCalledTimes(1);

    await expect(resolver.resolveParams(ctx, TestController, "create")).rejects.toMatchObject(
      expectedProblem,
    );
    expect(json).toHaveBeenCalledTimes(1);
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
});
