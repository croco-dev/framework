import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import type { ForceFlushResult } from "@croco/telemetry-sdk-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RunWithTelemetryFlush = <T>(
  operation: () => Promise<T>,
  flush: () => Promise<ForceFlushResult>,
) => Promise<T>;

async function loadRunWithTelemetryFlush(): Promise<RunWithTelemetryFlush> {
  const templateModulePath: string =
    "../../templates/addons/lambda/apps/graphql-api/src/telemetryFlush";
  const templateModule = (await import(templateModulePath)) as {
    runWithTelemetryFlush: RunWithTelemetryFlush;
  };
  return templateModule.runWithTelemetryFlush;
}

describe("generated Lambda telemetry flush boundary", () => {
  beforeEach(async () => {
    await TelemetryRuntime.reset();
  });

  afterEach(async () => {
    await TelemetryRuntime.reset();
  });

  it("should preserve the request failure when an intentional skip follows", async () => {
    const runWithTelemetryFlush = await loadRunWithTelemetryFlush();
    const requestFailure = new Error("request failed");

    await expect(
      runWithTelemetryFlush(
        async () => {
          throw requestFailure;
        },
        async () => ({
          outcome: "skipped",
          reason: "telemetry-disabled",
          flushedSpans: 0,
        }),
      ),
    ).rejects.toBe(requestFailure);
  });

  it("should preserve request and flush failures in an aggregate", async () => {
    const runWithTelemetryFlush = await loadRunWithTelemetryFlush();
    const requestFailure = new Error("request failed");
    const runtime = TelemetryRuntime.getInstance();
    Object.assign(runtime, {
      processor: { forceFlush: vi.fn().mockRejectedValue(new Error("export failed")) },
    });
    const flushResult = await runtime.forceFlush();
    expect(flushResult.outcome).toBe("failed");
    if (flushResult.outcome !== "failed") {
      expect.unreachable("forceFlush should expose the processor failure");
    }

    const result = runWithTelemetryFlush(
      async () => {
        throw requestFailure;
      },
      async () => flushResult,
    );

    await expect(result).rejects.toMatchObject({
      code: "create-croco-app/lambda-telemetry-boundary",
      failures: [requestFailure, flushResult.error],
      message: "Lambda request and telemetry flush both failed.",
    });
  });

  it("should fail a successful request when the flush is unsupported", async () => {
    const runWithTelemetryFlush = await loadRunWithTelemetryFlush();
    await expect(
      runWithTelemetryFlush(
        async () => "ok",
        async () => ({ outcome: "unsupported", reason: "not-initialized", flushedSpans: 0 }),
      ),
    ).rejects.toMatchObject({
      code: "TELEMETRY_FORCE_FLUSH_UNSUPPORTED",
      message: "Telemetry forceFlush is unsupported before initialization.",
    });
  });

  it("should return the request result after a completed flush", async () => {
    const runWithTelemetryFlush = await loadRunWithTelemetryFlush();
    await expect(
      runWithTelemetryFlush(
        async () => "ok",
        async () => ({ outcome: "completed", flushedSpans: -1 }),
      ),
    ).resolves.toBe("ok");
  });
});
