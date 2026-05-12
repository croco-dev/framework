import type { Guard } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuardInterceptor } from "../libs/interceptors/GuardInterceptor";
import { InterceptorChain } from "../libs/interceptors/InterceptorChain";
import { LoggingInterceptor } from "../libs/interceptors/LoggingInterceptor";
import type { GraphQLCallHandler, GraphQLInterceptorContext } from "../libs/types/InterceptorTypes";

const createMockContext = (): GraphQLInterceptorContext => ({
  root: {},
  args: {},
  context: {},
  info: {
    fieldName: "test",
    fieldNodes: [],
    returnType: {} as any,
    parentType: {} as any,
    path: { key: "test", typename: "Test" } as any,
    schema: {} as any,
    fragments: {},
    rootValue: {},
    operation: { kind: "OperationDefinition", operation: "query" } as any,
    variableValues: {},
  },
});

describe("InterceptorChain", () => {
  it("should execute final handler when no interceptors", async () => {
    const chain = new InterceptorChain([]);
    const finalHandler = vi.fn().mockResolvedValue("result");
    const context = createMockContext();

    const result = await chain.execute(context, finalHandler);

    expect(result).toBe("result");
    expect(finalHandler).toHaveBeenCalled();
  });

  it("should execute interceptors in order", async () => {
    const order: number[] = [];

    const interceptor1 = {
      intercept: vi.fn().mockImplementation(async (_ctx, next) => {
        order.push(1);
        const result = await next.handle();
        order.push(4);
        return result;
      }),
    };

    const interceptor2 = {
      intercept: vi.fn().mockImplementation(async (_ctx, next) => {
        order.push(2);
        const result = await next.handle();
        order.push(3);
        return result;
      }),
    };

    const chain = new InterceptorChain([interceptor1, interceptor2]);
    const finalHandler = vi.fn().mockResolvedValue("result");
    const context = createMockContext();

    const result = await chain.execute(context, finalHandler);

    expect(result).toBe("result");
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("should execute static method", async () => {
    const interceptor = {
      intercept: vi.fn().mockImplementation(async (_ctx, next) => await next.handle()),
    };
    const finalHandler = vi.fn().mockResolvedValue("result");
    const context = createMockContext();

    const result = await InterceptorChain.execute([interceptor], context, finalHandler);

    expect(result).toBe("result");
  });
});

describe("GuardInterceptor", () => {
  it("should call next when all guards pass", async () => {
    const guard: Guard<GraphQLInterceptorContext> = {
      canActivate: vi.fn().mockResolvedValue(true),
    };

    const interceptor = new GuardInterceptor([guard]);
    const next: GraphQLCallHandler<string> = { handle: vi.fn().mockResolvedValue("result") };
    const context = createMockContext();

    const result = await interceptor.intercept(context, next);

    expect(result).toBe("result");
    expect(guard.canActivate).toHaveBeenCalledWith(context);
    expect(next.handle).toHaveBeenCalled();
  });

  it("should throw when guard denies access", async () => {
    const guard: Guard<GraphQLInterceptorContext> = {
      canActivate: vi.fn().mockResolvedValue(false),
    };

    const interceptor = new GuardInterceptor([guard]);
    const next: GraphQLCallHandler<string> = { handle: vi.fn() };
    const context = createMockContext();

    await expect(interceptor.intercept(context, next)).rejects.toThrow("Access denied by guard");
    expect(next.handle).not.toHaveBeenCalled();
  });
});
