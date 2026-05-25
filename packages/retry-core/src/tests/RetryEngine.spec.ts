import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackoffPolicy } from "../libs/BackoffPolicy";
import { NoBackoff } from "../libs/BackoffPolicy";
import { RetryAbortedProblem, RetryExhaustedProblem } from "../libs/errors";
import { RetryContext } from "../libs/RetryContext";
import { executeRetryLoop } from "../libs/RetryEngine";
import type { RetryPolicy } from "../libs/RetryPolicy";
import { DefaultRetryPolicy } from "../libs/RetryPolicy";

describe("executeRetryLoop", () => {
  let retryPolicy!: RetryPolicy;
  let backoffPolicy!: BackoffPolicy;
  let context!: RetryContext;

  beforeEach(() => {
    retryPolicy = new DefaultRetryPolicy();
    backoffPolicy = new NoBackoff();
    context = new RetryContext("execute", [], 3);
  });

  it("should succeed on first attempt", async () => {
    const callback = vi.fn().mockResolvedValue("result");

    const result = await executeRetryLoop(callback, {
      maxAttempts: 3,
      retryPolicy,
      backoffPolicy,
      context,
    });

    expect(result).toBe("result");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should succeed on 2nd and 3rd attempt after failures", async () => {
    const secondAttemptContext = new RetryContext("execute", [], 3);
    const secondAttemptCallback = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockResolvedValue("result-2");

    const secondResult = await executeRetryLoop(secondAttemptCallback, {
      maxAttempts: 3,
      retryPolicy,
      backoffPolicy,
      context: secondAttemptContext,
    });

    expect(secondResult).toBe("result-2");
    expect(secondAttemptCallback).toHaveBeenCalledTimes(2);

    const thirdAttemptContext = new RetryContext("execute", [], 3);
    const thirdAttemptCallback = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail-1"))
      .mockRejectedValueOnce(new Error("fail-2"))
      .mockResolvedValue("result-3");

    const thirdResult = await executeRetryLoop(thirdAttemptCallback, {
      maxAttempts: 3,
      retryPolicy,
      backoffPolicy,
      context: thirdAttemptContext,
    });

    expect(thirdResult).toBe("result-3");
    expect(thirdAttemptCallback).toHaveBeenCalledTimes(3);
  });

  it("should throw last error and set exhausted when maxAttempts exhausted", async () => {
    const exhaustedContext = new RetryContext("execute", [], 3);
    const error = new Error("persistent");
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      executeRetryLoop(callback, {
        maxAttempts: 3,
        retryPolicy,
        backoffPolicy,
        context: exhaustedContext,
      }),
    ).rejects.toThrow("persistent");

    expect(exhaustedContext.exhausted).toBe(true);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("should throw immediately when RetryPolicy rejects without exhausting", async () => {
    const nonRetryPolicy: RetryPolicy = {
      shouldRetry: vi.fn().mockReturnValue(false),
    };
    const nonRetryContext = new RetryContext("execute", [], 3);
    const error = new TypeError("non-retryable");
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      executeRetryLoop(callback, {
        maxAttempts: 3,
        retryPolicy: nonRetryPolicy,
        backoffPolicy,
        context: nonRetryContext,
      }),
    ).rejects.toThrow(error);

    expect(nonRetryContext.exhausted).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should throw without exhausted when non-retryable error occurs on last attempt", async () => {
    class RetryableError extends Error {}
    class NonRetryableError extends Error {}

    const lastAttemptPolicy: RetryPolicy = {
      shouldRetry: (error: unknown) => error instanceof RetryableError,
    };
    const lastAttemptContext = new RetryContext("execute", [], 2);
    const error = new NonRetryableError("last-attempt-fail");
    const callback = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError("retryable"))
      .mockRejectedValueOnce(error);

    await expect(
      executeRetryLoop(callback, {
        maxAttempts: 2,
        retryPolicy: lastAttemptPolicy,
        backoffPolicy,
        context: lastAttemptContext,
      }),
    ).rejects.toThrow(error);

    expect(lastAttemptContext.exhausted).toBe(false);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should call backoffPolicy.wait on each retry", async () => {
    const waitSpy = vi.fn().mockResolvedValue(undefined);
    const mockBackoff: BackoffPolicy = {
      getDelay: vi.fn().mockReturnValue(0),
      wait: waitSpy,
      reset: vi.fn(),
    };
    const callback = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("ok");

    await executeRetryLoop(callback, {
      maxAttempts: 3,
      retryPolicy,
      backoffPolicy: mockBackoff,
      context,
    });

    expect(waitSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle hooks correctly", async () => {
    const startContext = new RetryContext("execute", [], 3);
    const startCallback = vi.fn().mockResolvedValue("ok");

    await expect(
      executeRetryLoop(
        startCallback,
        {
          maxAttempts: 3,
          retryPolicy,
          backoffPolicy,
          context: startContext,
        },
        {
          onStart: vi.fn().mockResolvedValue(false),
        },
      ),
    ).rejects.toBeInstanceOf(RetryAbortedProblem);
    expect(startCallback).not.toHaveBeenCalled();

    const waitSpy = vi.fn().mockResolvedValue(undefined);
    const hookBackoff: BackoffPolicy = {
      getDelay: vi.fn().mockReturnValue(10),
      wait: waitSpy,
      reset: vi.fn(),
    };
    const successContext = new RetryContext("execute", [], 3);
    const successCallback = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");
    const onRetryError = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const beforeWait = vi.fn().mockResolvedValue(false);

    const successResult = await executeRetryLoop(
      successCallback,
      {
        maxAttempts: 3,
        retryPolicy,
        backoffPolicy: hookBackoff,
        context: successContext,
      },
      {
        onRetryError,
        onSuccess,
        beforeWait,
      },
    );

    expect(successResult).toBe("ok");
    expect(onRetryError).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(beforeWait).toHaveBeenCalledTimes(1);
    expect(waitSpy).not.toHaveBeenCalled();

    const exhaustedContext = new RetryContext("execute", [], 2);
    const exhaustedCallback = vi.fn().mockRejectedValue(new Error("fail"));
    const onExhausted = vi.fn().mockResolvedValue(undefined);

    await expect(
      executeRetryLoop(
        exhaustedCallback,
        {
          maxAttempts: 2,
          retryPolicy,
          backoffPolicy,
          context: exhaustedContext,
        },
        {
          onExhausted,
        },
      ),
    ).rejects.toThrow("fail");
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it("should track context state accurately", async () => {
    const stateContext = new RetryContext("execute", [], 3);
    const callback = vi.fn().mockRejectedValueOnce(new Error("first")).mockResolvedValue("ok");

    await executeRetryLoop(callback, {
      maxAttempts: 3,
      retryPolicy,
      backoffPolicy,
      context: stateContext,
    });

    expect(stateContext.attempt).toBe(2);
    expect(stateContext.remainingAttempts).toBe(1);
    expect(stateContext.lastError?.message).toBe("first");
    expect(stateContext.elapsedTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should pass 1-based attempts to retry policy and 0-based attempts to backoff", async () => {
    const policyAttempts: number[] = [];
    const backoffAttempts: number[] = [];
    const attemptPolicy: RetryPolicy = {
      shouldRetry: vi.fn((_error: unknown, attempt: number, maxAttempts: number) => {
        policyAttempts.push(attempt);
        return attempt < maxAttempts;
      }),
    };
    const attemptBackoff: BackoffPolicy = {
      getDelay: vi.fn((attempt: number) => {
        backoffAttempts.push(attempt);
        return 0;
      }),
      wait: vi.fn(async (attempt: number) => {
        backoffAttempts.push(attempt);
      }),
      reset: vi.fn(),
    };
    const callback = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValue("ok");

    const result = await executeRetryLoop(callback, {
      maxAttempts: 3,
      retryPolicy: attemptPolicy,
      backoffPolicy: attemptBackoff,
      context: new RetryContext("execute", [], 3),
    });

    expect(result).toBe("ok");
    expect(policyAttempts).toEqual([1, 2]);
    expect(backoffAttempts).toEqual([0, 0, 1, 1]);
  });

  it("should surface RetryExhaustedProblem when maxAttempts is zero and no lastError exists", async () => {
    const zeroAttemptContext = new RetryContext("execute", [], 0);

    await expect(
      executeRetryLoop(
        async () => "ok",
        {
          maxAttempts: 0,
          retryPolicy,
          backoffPolicy,
          context: zeroAttemptContext,
        },
        {
          onExhausted: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).rejects.toBeInstanceOf(RetryExhaustedProblem);
  });
});
