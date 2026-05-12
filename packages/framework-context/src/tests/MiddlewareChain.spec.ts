import { beforeEach, describe, expect, it } from "vitest";
import { MiddlewareChain } from "../libs/Middleware";
import { MiddlewareProblem } from "../libs/problems/MiddlewareProblems";

describe("MiddlewareChain", () => {
  let chain!: MiddlewareChain<{ requestId: string }>;

  beforeEach(() => {
    chain = new MiddlewareChain<{ requestId: string }>();
  });

  describe("execute", () => {
    it("should execute middleware in onion pattern", async () => {
      const order: string[] = [];

      chain.use(async (_ctx, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      });

      chain.use(async (_ctx, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      });

      await chain.execute({ requestId: "test-123" }, async () => {
        order.push("final");
      });

      expect(order).toEqual(["mw1-before", "mw2-before", "final", "mw2-after", "mw1-after"]);
    });

    it("should throw MiddlewareProblem when next() is called multiple times", async () => {
      chain.use(async (_ctx, next) => {
        await next();
        await next(); // 두 번째 호출
      });

      await expect(chain.execute({ requestId: "test-456" })).rejects.toThrow(MiddlewareProblem);
    });

    it("should include correct code and category for multiple next() calls", async () => {
      chain.use(async (_ctx, next) => {
        await next();
        await next();
      });

      try {
        await chain.execute({ requestId: "test-789" });
        expect.fail("Should have thrown MiddlewareProblem");
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareProblem);
        if (error instanceof MiddlewareProblem) {
          expect(error.code).toBe("MIDDLEWARE_EXECUTION_ERROR");
          expect(error.category).toBe("InternalServerError");
          expect(error.detail).toBe("Middleware called next() multiple times");
        }
      }
    });

    it("should return undefined when no finalFn is provided", async () => {
      chain.use(async (_ctx, next) => {
        await next();
      });

      const result = await chain.execute({ requestId: "test-000" });
      expect(result).toBeUndefined();
    });

    it("should return result from finalFn", async () => {
      chain.use(async (_ctx, next) => {
        await next();
      });

      const result = await chain.execute({ requestId: "test-111" }, async () => "final-result");
      expect(result).toBe("final-result");
    });

    it("should return undefined when finalFn returns undefined", async () => {
      chain.use(async (_ctx, next) => {
        await next();
      });

      const result = await chain.execute({ requestId: "test-222" }, async () => undefined);
      expect(result).toBeUndefined();
    });

    it("should handle multiple middleware with errors", async () => {
      const order: string[] = [];

      chain.use(async (_ctx, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      });

      chain.use(async (_ctx, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      });

      chain.use(async (_ctx, _next) => {
        order.push("mw3");
        throw new Error("Test error");
      });

      // 에러가 전파되어야 함
      await expect(chain.execute({ requestId: "test-333" })).rejects.toThrow("Test error");

      // 에러가 발생하면 이후 미들웨어는 실행되지 않음
      expect(order).toEqual(["mw1-before", "mw2-before", "mw3"]);
    });
  });

  describe("use", () => {
    it("should chain middleware calls", async () => {
      const results: number[] = [];

      chain.use(async (_ctx, next) => {
        results.push(1);
        await next();
        results.push(2);
      });

      chain.use(async (_ctx, next) => {
        results.push(3);
        await next();
        results.push(4);
      });

      await chain.execute({ requestId: "test-444" });

      expect(results).toEqual([1, 3, 4, 2]);
    });

    it("should return this for chaining", () => {
      const result = chain.use(async (_ctx, next) => {
        await next();
      });

      expect(result).toBe(chain);
    });
  });

  describe("clear", () => {
    it("should remove all middleware", async () => {
      chain.use(async (_ctx, next) => {
        await next();
      });

      chain.use(async (_ctx, next) => {
        await next();
      });

      chain.clear();

      const result = await chain.execute({ requestId: "test-555" });
      expect(result).toBeUndefined();
    });
  });
});
