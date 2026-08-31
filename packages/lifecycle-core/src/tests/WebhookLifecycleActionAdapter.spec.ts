import { describe, expect, it, vi } from "vitest";
import {
  WebhookLifecycleActionAdapter,
  createLifecycleContext,
  createScheduledLifecycleSignal,
} from "../index";

function executeWebhook(
  adapter: WebhookLifecycleActionAdapter,
  payload: Record<string, unknown> = { url: "https://example.test/lifecycle" },
) {
  return adapter.execute(
    {
      id: "notify-webhook",
      type: "webhook",
      payload,
    },
    createLifecycleContext({
      signal: createScheduledLifecycleSignal({
        signalId: "scheduled-1",
        tenantId: "tenant-1",
        reason: "test",
      }),
    }),
    {
      id: "run-1",
      ruleId: "webhook-rule",
      ruleVersion: "1.0.0",
      ruleFingerprint: "fingerprint",
      tenantId: "tenant-1",
      idempotencyKey: "webhook-rule:tenant-1",
    },
  );
}

describe("WebhookLifecycleActionAdapter", () => {
  it("returns explicit failure evidence for invalid webhook actions", async () => {
    const adapter = new WebhookLifecycleActionAdapter(vi.fn() as unknown as typeof fetch);

    await expect(executeWebhook(adapter, {})).resolves.toMatchObject({
      status: "failure",
      error: {
        code: "lifecycle-core/webhook-url-missing",
      },
    });
  });

  it("bounds stalled webhook requests with the default timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    try {
      const captured: { signal?: AbortSignal | null } = {};
      const settled: { result?: Awaited<ReturnType<typeof executeWebhook>> } = {};
      const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        captured.signal = init?.signal;
        return new Promise<Response>(() => {});
      }) as unknown as typeof fetch;
      const execution = executeWebhook(new WebhookLifecycleActionAdapter(fetchImpl));
      void execution.then((result) => {
        settled.result = result;
      });

      await vi.advanceTimersByTimeAsync(30_000);

      expect(captured.signal?.aborted).toBe(true);
      expect(settled.result).toMatchObject({
        status: "failure",
        error: {
          code: "lifecycle-core/webhook-request-error",
          message: "Webhook request timed out after 30000ms",
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the configured webhook timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    try {
      const settled: { result?: Awaited<ReturnType<typeof executeWebhook>> } = {};
      const fetchImpl = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
      const execution = executeWebhook(
        new WebhookLifecycleActionAdapter(fetchImpl, { timeoutMs: 25 }),
      );
      void execution.then((result) => {
        settled.result = result;
      });

      await vi.advanceTimersByTimeAsync(24);
      expect(settled.result).toBeUndefined();

      await vi.advanceTimersByTimeAsync(1);
      expect(settled.result).toMatchObject({
        status: "failure",
        error: {
          code: "lifecycle-core/webhook-request-error",
          message: "Webhook request timed out after 25ms",
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    "rejects invalid webhook timeout %s during setup",
    (timeoutMs) => {
      let captured: unknown;
      try {
        new WebhookLifecycleActionAdapter(vi.fn() as unknown as typeof fetch, { timeoutMs });
      } catch (error) {
        captured = error;
      }

      expect(captured).toMatchObject({
        code: "lifecycle-core/webhook-timeout-invalid",
        extensions: {
          retryable: false,
          timeoutMs: String(timeoutMs),
        },
      });
    },
  );

  it("preserves successful webhook results", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 })) as unknown as typeof fetch;

    await expect(executeWebhook(new WebhookLifecycleActionAdapter(fetchImpl))).resolves.toEqual({
      actionId: "notify-webhook",
      type: "webhook",
      status: "success",
      message: "Webhook returned 202",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/lifecycle",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("preserves non-ok webhook failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 })) as unknown as typeof fetch;

    await expect(executeWebhook(new WebhookLifecycleActionAdapter(fetchImpl))).resolves.toEqual({
      actionId: "notify-webhook",
      type: "webhook",
      status: "failure",
      error: {
        code: "lifecycle-core/webhook-request-failed",
        message: "Webhook returned 503",
      },
    });
  });

  it("keeps network errors distinguishable from webhook timeouts", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new TypeError("socket closed")) as unknown as typeof fetch;

    await expect(executeWebhook(new WebhookLifecycleActionAdapter(fetchImpl))).resolves.toEqual({
      actionId: "notify-webhook",
      type: "webhook",
      status: "failure",
      error: {
        code: "lifecycle-core/webhook-request-error",
        message: "socket closed",
      },
    });
  });
});
