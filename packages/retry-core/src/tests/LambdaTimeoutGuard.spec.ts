import { describe, expect, it } from "vitest";
import {
  getLambdaContext,
  getRemainingTimeInMillis,
  hasTimeForRetry,
  runWithLambdaContext,
  setLambdaContext,
} from "../libs/LambdaTimeoutGuard";

describe("LambdaTimeoutGuard context scope", () => {
  it("returns Infinity without lambda context", () => {
    expect(getLambdaContext()).toBeNull();
    expect(getRemainingTimeInMillis()).toBe(Infinity);
    expect(hasTimeForRetry(1000)).toBe(true);
  });

  it("propagates lambda context across async boundaries", async () => {
    await runWithLambdaContext(
      {
        getRemainingTimeInMillis: () => 120,
      },
      async () => {
        await Promise.resolve();

        expect(getLambdaContext()?.getRemainingTimeInMillis()).toBe(120);
        expect(getRemainingTimeInMillis()).toBe(120);
        expect(hasTimeForRetry(80, { reserveTimeMs: 30 })).toBe(true);
      },
    );

    expect(getLambdaContext()).toBeNull();
    expect(getRemainingTimeInMillis()).toBe(Infinity);
  });

  it("keeps concurrent lambda scopes isolated", async () => {
    const results = await Promise.all([
      runWithLambdaContext(
        {
          getRemainingTimeInMillis: () => 90,
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return getRemainingTimeInMillis();
        },
      ),
      runWithLambdaContext(
        {
          getRemainingTimeInMillis: () => 190,
        },
        async () => {
          await Promise.resolve();
          return getRemainingTimeInMillis();
        },
      ),
    ]);

    expect(results).toEqual([90, 190]);
    expect(getLambdaContext()).toBeNull();
  });

  it("keeps setLambdaContext as a compatibility entrypoint for the current async flow", async () => {
    setLambdaContext({
      getRemainingTimeInMillis: () => 75,
    });

    try {
      await Promise.resolve();

      expect(getLambdaContext()?.getRemainingTimeInMillis()).toBe(75);
      expect(getRemainingTimeInMillis()).toBe(75);
    } finally {
      setLambdaContext(null);
    }

    expect(getLambdaContext()).toBeNull();
  });
});
