import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GuardContext,
  RATE_LIMIT_METADATA_KEY,
  RateLimitGuard,
  type RateLimitMetadata,
} from "../libs/guards/RateLimitGuard";
import { RateLimit } from "../libs/decorators/RateLimit";
import { RateLimitExceededProblem } from "../libs/problems/RateLimitExceededProblem";
import { RateLimiter } from "../libs/RateLimiter";
import { SlidingWindowInMemoryStore } from "../libs/InMemoryRateLimitStore";
import { RateLimitKeyBuilder } from "../libs/RateLimitKeyBuilder";
import type { RateLimitPolicy, RateLimitResult } from "../libs/types";

describe("RateLimitGuard", () => {
  let guard!: RateLimitGuard;
  let mockRateLimiter!: RateLimiter;

  const policy: RateLimitPolicy = {
    name: "test-policy",
    algorithm: "sliding",
    limit: 10,
    windowMs: 60000,
  };

  const successResult: RateLimitResult = {
    success: true,
    degraded: false,
    limit: 10,
    remaining: 9,
    resetAtMs: Date.now() + 60000,
  };

  const failedResult: RateLimitResult = {
    success: false,
    degraded: false,
    limit: 10,
    remaining: 0,
    resetAtMs: Date.now() + 60000,
  };

  const createContext = (handler: () => void, data: Record<string, unknown> = {}): GuardContext => {
    const store = new Map<string, unknown>();
    return {
      getHandler: () => handler,
      get: <T>(key: string): T | undefined => data[key] as T | undefined,
      set: <T>(key: string, value: T): void => {
        store.set(key, value);
      },
    };
  };

  beforeEach(() => {
    mockRateLimiter = {
      check: vi.fn().mockResolvedValue(successResult),
      checkWithKey: vi.fn().mockResolvedValue(successResult),
    } as unknown as RateLimiter;
    guard = new RateLimitGuard(mockRateLimiter);
  });

  it("should allow request when no metadata present", async () => {
    const handler = () => {};
    const context = createContext(handler);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRateLimiter.check).not.toHaveBeenCalled();
  });

  it("should allow request within rate limit", async () => {
    const handler = () => {};
    const metadata: RateLimitMetadata = { policy };
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, handler);
    const context = createContext(handler);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRateLimiter.check).toHaveBeenCalledWith(context, policy);
  });

  it("shares a budget when unrelated controllers explicitly name the same policy", async () => {
    class UsersController {
      @RateLimit({ policy: "shared-create", limit: 1 })
      create() {}
    }
    class OrdersController {
      @RateLimit({ policy: "shared-create", limit: 1 })
      create() {}
    }
    const store = new SlidingWindowInMemoryStore({ now: () => 1000, pruneIntervalMs: 0 });
    const sharedGuard = new RateLimitGuard(
      new RateLimiter(store, new RateLimitKeyBuilder(["user"])),
    );
    const data = { user: { id: "user-1" } };

    await expect(
      sharedGuard.canActivate(createContext(UsersController.prototype.create, data)),
    ).resolves.toBe(true);
    await expect(
      sharedGuard.canActivate(createContext(OrdersController.prototype.create, data)),
    ).rejects.toThrow(RateLimitExceededProblem);
  });

  it("preserves the policy name and storage key for a unique default declaration", async () => {
    class UniqueController {
      @RateLimit({ limit: 1 })
      uniqueDefault() {}
    }
    const store = new SlidingWindowInMemoryStore({ now: () => 1000, pruneIntervalMs: 0 });
    const check = vi.spyOn(store, "check");
    const uniqueGuard = new RateLimitGuard(
      new RateLimiter(store, new RateLimitKeyBuilder(["user"])),
    );
    const context = createContext(UniqueController.prototype.uniqueDefault, {
      user: { id: "user-1" },
    });

    await expect(uniqueGuard.canActivate(context)).resolves.toBe(true);
    expect(check).toHaveBeenCalledWith(
      'rl2:[["policy","uniqueDefault-default"],["user","user-1"]]',
      expect.objectContaining({ name: "uniqueDefault-default", limit: 1 }),
    );
    await expect(uniqueGuard.canActivate(context)).rejects.toThrow(RateLimitExceededProblem);
  });

  it("should evaluate and use a custom rate limit key", async () => {
    const handler = () => {};
    const customKey = vi.fn((value: unknown) => {
      const context = value as GuardContext;
      return `tenant:${context.get("tenantId")}`;
    });
    const metadata: RateLimitMetadata = { policy, customKey };
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, handler);
    const context = {
      ...createContext(handler, { tenantId: "tenant-42" }),
      getRequest: () => ({ user: { id: "user-1" } }),
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(customKey).toHaveBeenCalledWith(context);
    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith("tenant:tenant-42", policy);
    expect(mockRateLimiter.check).not.toHaveBeenCalled();
  });

  it("keeps authenticated and anonymous user keys separate", async () => {
    const handler = () => {};
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, { policy }, handler);
    const builder = new RateLimitKeyBuilder(["user"]);
    const keys: string[] = [];

    for (const request of [{ user: { id: "user-1" } }, {}]) {
      const context = { ...createContext(handler), getRequest: () => request };
      await guard.canActivate(context);
      const keyContext = vi.mocked(mockRateLimiter.check).mock.lastCall?.[0];
      if (keyContext) keys.push(builder.build(keyContext, policy.name));
    }

    expect(keys).toEqual([
      'rl2:[["policy","test-policy"],["user","user-1"]]',
      'rl2:[["policy","test-policy"],["user",null]]',
    ]);
  });

  it.each([
    [{ principal: { type: "user", id: "user-id" } }, "user", { type: "user", id: "user-id" }],
    [{ principal: { type: "apikey", id: "principal-id", keyId: "key-id" } }, "apiKey", "key-id"],
    [{ principal: { type: "apikey", id: "principal-id" } }, "apiKey", "principal-id"],
  ])(
    "reads a typed principal when the %s request field is absent",
    async (request, key, expected) => {
      const handler = () => {};
      Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, { policy }, handler);
      const context = { ...createContext(handler), getRequest: () => request };

      await guard.canActivate(context);

      const keyContext = vi.mocked(mockRateLimiter.check).mock.lastCall?.[0];
      expect(keyContext?.get(key)).toEqual(expected);
    },
  );

  it("uses context variables when the request has no principal", async () => {
    const handler = () => {};
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, { policy }, handler);
    const context = {
      ...createContext(handler, {
        userId: "context-user",
        apiKey: "context-key",
        route: "context-route",
      }),
      getRequest: () => ({}),
    };

    await guard.canActivate(context);

    const keyContext = vi.mocked(mockRateLimiter.check).mock.lastCall?.[0];
    expect(keyContext?.get("userId")).toBe("context-user");
    expect(keyContext?.get("apiKey")).toBe("context-key");
    expect(keyContext?.get("route")).toBe("context-route");
  });

  it("should throw RateLimitExceededProblem when limit exceeded", async () => {
    vi.mocked(mockRateLimiter.check).mockResolvedValue(failedResult);
    const handler = () => {};
    const metadata: RateLimitMetadata = { policy };
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, handler);
    const context = createContext(handler);

    await expect(guard.canActivate(context)).rejects.toThrow(RateLimitExceededProblem);
  });

  it("should store rate limit result in context", async () => {
    const handler = () => {};
    const metadata: RateLimitMetadata = { policy };
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, metadata, handler);

    const store = new Map<string, unknown>();
    const context: GuardContext = {
      getHandler: () => handler,
      get: () => undefined,
      set: <T>(key: string, value: T) => {
        store.set(key, value);
      },
    };

    await guard.canActivate(context);

    expect(store.get("rateLimitResult")).toEqual(successResult);
  });

  it.each(["limited", Symbol("limited")])("should resolve named handler %s", async (name) => {
    class Controller {
      @RateLimit({ policy: "named-handler", limit: 1, window: "1m" })
      [name]() {}
    }
    const context = {
      ...createContext(() => {}),
      getClass: () => Controller,
      getHandler: () => name,
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRateLimiter.check).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ limit: 1, windowMs: 60000 }),
    );
    vi.mocked(mockRateLimiter.check).mockResolvedValue(failedResult);
    await expect(guard.canActivate(context)).rejects.toThrow(RateLimitExceededProblem);
  });

  it("should use inherited metadata without applying it to an undecorated override", async () => {
    class Parent {
      @RateLimit({ policy: "inherited-handler", limit: 1 })
      limited() {}
    }
    class Child extends Parent {}
    class Override extends Parent {
      override limited() {}
    }
    const context = {
      ...createContext(() => {}),
      getClass: () => Child,
      getHandler: () => "limited",
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRateLimiter.check).toHaveBeenCalledOnce();
    vi.mocked(mockRateLimiter.check).mockClear();
    await expect(guard.canActivate({ ...context, getClass: () => Override })).resolves.toBe(true);
    expect(mockRateLimiter.check).not.toHaveBeenCalled();
  });

  it("should allow an undecorated named handler without consuming quota", async () => {
    class Controller {
      plain() {}
    }
    const context = {
      ...createContext(() => {}),
      getClass: () => Controller,
      getHandler: () => "plain",
    };
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRateLimiter.check).not.toHaveBeenCalled();
  });

  it("should preserve function handlers on contexts that also expose a class", async () => {
    const handler = () => {};
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, { policy }, handler);
    const getClass = vi.fn(() => class Controller {});
    const context = { ...createContext(handler), getClass };
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRateLimiter.check).toHaveBeenCalledWith(context, policy);
    expect(getClass).not.toHaveBeenCalled();
  });
});
