import {
  Container,
  Context,
  DEV_INSPECTOR_TOKEN,
  RuntimeInspector,
} from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import { NoBackoff } from "../libs/BackoffPolicy";
import {
  RetryAbortedProblem,
  RetryExhaustedProblem,
  RetrySuccessHookProblem,
} from "../libs/errors";
import type { RetryListener } from "../libs/RetryListener";
import { RetryTemplate } from "../libs/RetryTemplate";

describe("RetryTemplate", () => {
  it("returns result on first success", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    const result = await template.execute(async () => "success");

    expect(result).toBe("success");
  });

  it("retries on failure and succeeds", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    let attempts = 0;
    const result = await template.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "success";
    });

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("records retry lifecycle events for the active runtime inspector request", async () => {
    const inspector = new RuntimeInspector();
    inspector.startRequest({ requestId: "retry-req-1" });
    Container.set(DEV_INSPECTOR_TOKEN, inspector);

    try {
      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      });

      let attempts = 0;
      const result = await Context.run({ requestId: "retry-req-1" }, async () =>
        template.execute(async () => {
          attempts++;
          if (attempts < 2) throw new Error("retry failed once token=retry-secret");
          return "success";
        }),
      );
      inspector.finishRequest({ requestId: "retry-req-1", status: 200, outcome: "succeeded" });

      const timeline = inspector.snapshot().requests[0].timeline;

      expect(result).toBe("success");
      expect(timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "retry.start",
            outcome: "started",
            details: expect.objectContaining({
              maxAttempts: 3,
              argumentCount: 0,
            }),
          }),
          expect.objectContaining({
            kind: "retry.error",
            outcome: "failed",
            details: expect.objectContaining({
              attempt: 1,
              error: {
                name: "Error",
                message: "retry failed once token=[Redacted]",
              },
            }),
          }),
          expect.objectContaining({
            kind: "retry.wait",
            outcome: "started",
            details: expect.objectContaining({
              delayMs: 0,
            }),
          }),
          expect.objectContaining({
            kind: "retry.success",
            outcome: "succeeded",
            details: expect.objectContaining({
              attempt: 2,
            }),
          }),
        ]),
      );
      expect(JSON.stringify(timeline)).not.toContain("retry-secret");
    } finally {
      Container.reset();
    }
  });

  it("throws last error when exhausted", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    const error = new Error("persistent failure");

    await expect(
      template.execute(async () => {
        throw error;
      }),
    ).rejects.toThrow("persistent failure");
  });

  it("wraps error when wrapExhausted is true", async () => {
    const template = new RetryTemplate({
      maxAttempts: 2,
      wrapExhausted: true,
      backoffPolicy: new NoBackoff(),
    });

    await expect(
      template.execute(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow(RetryExhaustedProblem);
  });

  it("calls recovery on exhaustion", async () => {
    const template = new RetryTemplate({
      maxAttempts: 2,
      backoffPolicy: new NoBackoff(),
    });

    const result = await template.execute(
      async () => {
        throw new Error("fail");
      },
      async (ctx) => `recovered after ${ctx.attempt} attempts`,
    );

    expect(result).toBe("recovered after 2 attempts");
  });

  it("does not retry non-retryable errors", async () => {
    const template = new RetryTemplate({
      maxAttempts: 3,
      backoffPolicy: new NoBackoff(),
    });

    let attempts = 0;

    await expect(
      template.execute(async () => {
        attempts++;
        throw new TypeError("type error");
      }),
    ).rejects.toThrow(TypeError);

    expect(attempts).toBe(1);
  });

  describe("RetryListener 콜백", () => {
    it("onStart 콜백이 호출되어야 한다", async () => {
      const onStartSpy = vi.fn();
      const listener: RetryListener = { onStart: onStartSpy };

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });

      await template.execute(async () => "success");

      expect(onStartSpy).toHaveBeenCalledTimes(1);
      expect(onStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({ methodName: "execute", maxAttempts: 3 }),
      );
    });

    it("onError 콜백이 실패 시마다 호출되어야 한다", async () => {
      const onErrorSpy = vi.fn();
      const listener: RetryListener = { onError: onErrorSpy };

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });

      await expect(
        template.execute(async () => {
          throw new Error("fail");
        }),
      ).rejects.toThrow("fail");

      expect(onErrorSpy).toHaveBeenCalledTimes(3);
    });

    it("onSuccess 콜백이 성공 시 호출되어야 한다", async () => {
      const onSuccessSpy = vi.fn();
      const listener: RetryListener = { onSuccess: onSuccessSpy };

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });

      await template.execute(async () => "success");

      expect(onSuccessSpy).toHaveBeenCalledTimes(1);
    });

    it("onSuccess 실패가 성공한 작업이나 recovery를 다시 실행하지 않아야 한다", async () => {
      const hookError = new Error("telemetry unavailable");
      const listener: RetryListener = {
        onSuccess: vi.fn().mockRejectedValue(hookError),
      };
      const callback = vi.fn().mockResolvedValue("committed");
      const recovery = vi.fn().mockResolvedValue("recovered");
      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });
      const execution = template.execute(callback, recovery);

      await expect(execution).rejects.toMatchObject({
        cause: hookError,
        code: "retry-core/success-hook-failed",
        extensions: {
          attempt: 1,
          callbackSucceeded: true,
          hook: "onSuccess",
          methodName: "execute",
        },
      });
      await expect(execution).rejects.toBeInstanceOf(RetrySuccessHookProblem);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(recovery).not.toHaveBeenCalled();
    });

    it("onExhausted 콜백이 모든 시도 실패 시 호출되어야 한다", async () => {
      const onExhaustedSpy = vi.fn();
      const listener: RetryListener = { onExhausted: onExhaustedSpy };

      const template = new RetryTemplate({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });

      await expect(
        template.execute(async () => {
          throw new Error("fail");
        }),
      ).rejects.toThrow("fail");

      expect(onExhaustedSpy).toHaveBeenCalledTimes(1);
    });

    it("onStart가 false를 반환하면 실행을 취소해야 한다", async () => {
      const listener: RetryListener = { onStart: async () => false };

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener],
      });

      await expect(template.execute(async () => "success")).rejects.toBeInstanceOf(
        RetryAbortedProblem,
      );
    });

    it("복수의 리스너가 모두 호출되어야 한다", async () => {
      const listener1Spy = vi.fn();
      const listener2Spy = vi.fn();
      const listener1: RetryListener = { onSuccess: listener1Spy };
      const listener2: RetryListener = { onSuccess: listener2Spy };

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
        listeners: [listener1, listener2],
      });

      await template.execute(async () => "success");

      expect(listener1Spy).toHaveBeenCalledTimes(1);
      expect(listener2Spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("RetryContext 전파", () => {
    it("context에 attempt가 올바르게 설정되어야 한다", async () => {
      let capturedContext!: any;

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      });

      let attempts = 0;
      await template.execute(
        async (ctx) => {
          capturedContext = ctx;
          attempts++;
          if (attempts < 2) throw new Error("fail");
          return "success";
        },
        async (ctx) => {
          capturedContext = ctx;
          return "fallback";
        },
      );

      expect(capturedContext.attempt).toBeGreaterThanOrEqual(1);
      expect(capturedContext.maxAttempts).toBe(3);
    });

    it("context에 lastError가 설정되어야 한다", async () => {
      let capturedContext!: any;

      const template = new RetryTemplate({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      });

      const testError = new Error("test error");

      await template.execute(
        async () => {
          throw testError;
        },
        async (ctx) => {
          capturedContext = ctx;
          return "fallback";
        },
      );

      expect(capturedContext.lastError).toBe(testError);
    });

    it("context에 startTime과 elapsedTime이 계산되어야 한다", async () => {
      let capturedContext!: any;

      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      });

      await template.execute(async (ctx) => {
        capturedContext = ctx;
        return "success";
      });

      expect(capturedContext.elapsedTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof capturedContext.elapsedTimeMs).toBe("number");
    });

    it("context에 exhausted 플래그가 설정되어야 한다", async () => {
      let capturedContext!: any;

      const template = new RetryTemplate({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      });

      await template.execute(
        async () => {
          throw new Error("fail");
        },
        async (ctx) => {
          capturedContext = ctx;
          return "fallback";
        },
      );

      expect(capturedContext.exhausted).toBe(true);
    });

    it("context에 attribute를 설정하고 조회할 수 있어야 한다", async () => {
      const template = new RetryTemplate({
        maxAttempts: 3,
        backoffPolicy: new NoBackoff(),
      });

      await template.execute(async (ctx) => {
        ctx.setAttribute("customKey", "customValue");
        expect(ctx.getAttribute("customKey")).toBe("customValue");
        expect(ctx.getAttribute("nonExistent")).toBeUndefined();
        return "success";
      });
    });

    it("context에 remainingAttempts가 올바르게 계산되어야 한다", async () => {
      const template = new RetryTemplate({
        maxAttempts: 5,
        backoffPolicy: new NoBackoff(),
      });

      let attempts = 0;
      await template.execute(async (ctx) => {
        attempts++;
        expect(ctx.remainingAttempts).toBe(5 - attempts);
        if (attempts < 3) throw new Error("fail");
        return "success";
      });
    });
  });

  describe("비동기 Recovery", () => {
    it("비동기 recovery 콜백이 정상 동작해야 한다", async () => {
      const template = new RetryTemplate({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      });

      const result = await template.execute(
        async () => {
          throw new Error("fail");
        },
        async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `async recovered: ${ctx.attempt}`;
        },
      );

      expect(result).toBe("async recovered: 2");
    });

    it("recovery에서 throw된 에러가 전파되어야 한다", async () => {
      const template = new RetryTemplate({
        maxAttempts: 2,
        backoffPolicy: new NoBackoff(),
      });

      const recoveryError = new Error("recovery failed");

      await expect(
        template.execute(
          async () => {
            throw new Error("fail");
          },
          async () => {
            throw recoveryError;
          },
        ),
      ).rejects.toThrow("recovery failed");
    });
  });
});
