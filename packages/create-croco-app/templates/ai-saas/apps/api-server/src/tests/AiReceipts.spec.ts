import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AI_INPUT_TOKENS, AI_OUTPUT_TOKENS } from "@croco/ai-usage";
import type { MeteringService, RecordOptions, UsageRecord } from "@croco/metering-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenAIGenerate,
  createTenantOpenAIClient,
  demoPromptPolicy,
  deterministicGenerate,
} from "../aiGenerate";
import { AiProviderUnavailableProblem } from "../aiProblems";
import { buildAiIdempotencyKey, createAiSaasRuntime, seedAiSaasTenant } from "../aiSaas";
import type { AiReceipt, AiReceiptStore } from "../aiSaas";

const cleanups: (() => void)[] = [];
const pricing = { inputPricePerToken: 0.000001, outputPricePerToken: 0.000002, currency: "USD" };
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
});

async function fixture(handle: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture port");
  return `http://127.0.0.1:${address.port}/v1`;
}

function completed(response: ServerResponse, usage = true, status = "completed") {
  response.setHeader("content-type", "application/json");
  response.setHeader("x-request-id", "request-fixture");
  response.end(
    JSON.stringify({
      id: "response-fixture",
      object: "response",
      model: "fixture-model",
      status,
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello", annotations: [] }],
        },
      ],
      ...(usage ? { usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } } : {}),
    }),
  );
}

class SnapshotReceiptStore implements AiReceiptStore {
  private readonly receipts: Map<string, AiReceipt>;
  private failUsageAcknowledgement = false;

  constructor(snapshot = "[]") {
    this.receipts = new Map(JSON.parse(snapshot) as [string, AiReceipt][]);
  }

  snapshot(): string {
    return JSON.stringify([...this.receipts]);
  }

  failNextUsageAcknowledgement(): void {
    this.failUsageAcknowledgement = true;
  }

  async get(key: string): Promise<AiReceipt | undefined> {
    return structuredClone(this.receipts.get(key));
  }

  async claim(receipt: AiReceipt): Promise<boolean> {
    if (
      this.receipts.has(receipt.key) ||
      [...this.receipts.values()].some(
        (current) =>
          current.tenantId === receipt.tenantId && (current.usagePending || current.eventPending),
      )
    ) {
      return false;
    }
    this.receipts.set(receipt.key, structuredClone(receipt));
    return true;
  }

  async save(receipt: AiReceipt): Promise<void> {
    if (this.failUsageAcknowledgement && !receipt.usagePending) {
      this.failUsageAcknowledgement = false;
      throw new Error("receipt usage acknowledgement interrupted");
    }
    this.receipts.set(receipt.key, structuredClone(receipt));
  }

  async hasPending(tenantId: string): Promise<boolean> {
    return [...this.receipts.values()].some(
      (receipt) => receipt.tenantId === tenantId && (receipt.usagePending || receipt.eventPending),
    );
  }
}

describe("AI generation receipt recovery", () => {
  it("persists response loss and blocks new spending after recreating the service", async () => {
    let requests = 0;
    const baseURL = await fixture((request) => {
      requests++;
      request.socket.destroy();
    });
    const options = {
      providerProfile: "openai" as const,
      generate: createOpenAIGenerate(() => createTenantOpenAIClient({ apiKey: "test", baseURL })),
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion: async () => {},
    };
    const receipts = new SnapshotReceiptStore();
    const runtime = createAiSaasRuntime(undefined, options, receipts);
    const { tenant } = await seedAiSaasTenant(runtime, "team", "response-loss");
    const request = { tenantId: tenant.id, requestId: "lost", prompt: "Hello" };
    const failure = await runtime.service.generateText(request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiProviderUnavailableProblem);
    expect((failure as AiProviderUnavailableProblem).cause).toBeInstanceOf(Error);
    const restartedReceipts = new SnapshotReceiptStore(receipts.snapshot());
    const restarted = createAiSaasRuntime(runtime.saasRuntime, options, restartedReceipts);
    await expect(restarted.service.generateText(request)).rejects.toThrow();
    await expect(
      restarted.service.generateText({ ...request, requestId: "new" }),
    ).rejects.toThrow();
    expect(requests).toBe(1);
    expect((await restarted.service.getUsageState(tenant.id)).usage.totalTokens).toBe(0);
    expect(await restartedReceipts.hasPending(tenant.id)).toBe(true);
  });

  it("replays pending event delivery after restart with one provider request and one usage charge", async () => {
    let requests = 0;
    const baseURL = await fixture((_request, response) => {
      requests++;
      completed(response);
    });
    const publishCompletion = vi
      .fn()
      .mockRejectedValueOnce(new Error("event unavailable"))
      .mockResolvedValue(undefined);
    const options = {
      providerProfile: "openai" as const,
      generate: createOpenAIGenerate(() => createTenantOpenAIClient({ apiKey: "test", baseURL })),
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion,
    };
    const receipts = new SnapshotReceiptStore();
    const runtime = createAiSaasRuntime(undefined, options, receipts);
    const { tenant } = await seedAiSaasTenant(runtime, "team", "event-recovery");
    const request = { tenantId: tenant.id, requestId: "recover", prompt: "Hello" };
    await expect(runtime.service.generateText(request)).rejects.toThrow("event unavailable");
    const restarted = createAiSaasRuntime(
      runtime.saasRuntime,
      options,
      new SnapshotReceiptStore(receipts.snapshot()),
    );
    expect((await restarted.service.generateText(request)).text).toBe("Hello");
    await restarted.service.generateText(request);
    expect(requests).toBe(1);
    expect(publishCompletion).toHaveBeenCalledTimes(2);
    expect((await restarted.service.getUsageState(tenant.id)).usage.totalTokens).toBe(5);
  });

  it("recovers partial meter writes without repeating completed meters or provider work", async () => {
    let requests = 0;
    const baseURL = await fixture((_request, response) => {
      requests++;
      completed(response);
    });
    const options = {
      providerProfile: "openai" as const,
      generate: createOpenAIGenerate(() => createTenantOpenAIClient({ apiKey: "test", baseURL })),
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion: async () => {},
    };
    const receipts = new SnapshotReceiptStore();
    const runtime = createAiSaasRuntime(undefined, options, receipts);
    const { tenant } = await seedAiSaasTenant(runtime, "team", "meter-recovery");
    const meteringService = runtime.saasRuntime.meteringService;
    const originalRecord = meteringService.record.bind(meteringService) as (
      options: RecordOptions,
    ) => Promise<UsageRecord>;
    let failCompletion = true;
    meteringService.record = (async (recordOptions: RecordOptions) => {
      if (failCompletion && recordOptions.meterId === AI_OUTPUT_TOKENS) {
        failCompletion = false;
        throw new Error("completion meter unavailable");
      }
      return originalRecord(recordOptions);
    }) as MeteringService["record"];
    const request = { tenantId: tenant.id, requestId: "partial", prompt: "Hello" };

    await expect(runtime.service.generateText(request)).rejects.toThrow();
    meteringService.record = originalRecord as MeteringService["record"];
    const restarted = createAiSaasRuntime(
      runtime.saasRuntime,
      options,
      new SnapshotReceiptStore(receipts.snapshot()),
    );
    expect((await restarted.service.generateText(request)).text).toBe("Hello");
    expect(requests).toBe(1);
    expect((await restarted.service.getUsageState(tenant.id)).usage.totalTokens).toBe(5);
  });

  it("keeps quota-rejected usage retryable across receipt replay", async () => {
    const receipts = new SnapshotReceiptStore();
    let runtime!: ReturnType<typeof createAiSaasRuntime>;
    const generate = vi.fn(async (input: Parameters<typeof deterministicGenerate>[0]) => {
      await runtime.saasRuntime.meterRegistry.register({
        tenantId: input.tenantId,
        meterId: AI_OUTPUT_TOKENS,
        type: "COUNT",
        quota: 1,
        allowOverQuota: false,
      });
      return deterministicGenerate(input);
    });
    const options = {
      providerProfile: "in-memory" as const,
      generate,
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion: async () => {},
    };
    runtime = createAiSaasRuntime(undefined, options, receipts);
    const { tenant } = await seedAiSaasTenant(runtime, "team", "quota-rejection-replay");
    const request = { tenantId: tenant.id, requestId: "quota-rejected", prompt: "Hello" };
    const receiptKey = buildAiIdempotencyKey(tenant.id, request.requestId);

    await expect(runtime.service.generateText(request)).rejects.toMatchObject({
      code: "ai-usage/record-failed",
    });
    await expect(
      runtime.saasRuntime.meteringService.getRecordStatus(
        tenant.id,
        AI_OUTPUT_TOKENS,
        `${receiptKey}:completion`,
      ),
    ).resolves.toBe("retryable");

    const restartedReceipts = new SnapshotReceiptStore(receipts.snapshot());
    const restarted = createAiSaasRuntime(runtime.saasRuntime, options, restartedReceipts);
    await expect(restarted.service.generateText(request)).rejects.toMatchObject({
      code: "ai-usage/record-failed",
    });
    await expect(
      restarted.saasRuntime.meteringService.getRecordStatus(
        tenant.id,
        AI_OUTPUT_TOKENS,
        `${receiptKey}:completion`,
      ),
    ).resolves.toBe("retryable");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(
      await runtime.saasRuntime.meteringService.getUsage({
        tenantId: tenant.id,
        meterId: AI_INPUT_TOKENS,
        period: "billing_cycle",
      }),
    ).toBeGreaterThan(0);
    const outputUsageBeforeRecovery = await runtime.saasRuntime.meteringService.getUsage({
      tenantId: tenant.id,
      meterId: AI_OUTPUT_TOKENS,
      period: "billing_cycle",
    });
    expect(outputUsageBeforeRecovery).toBe(0);
    expect(await restartedReceipts.hasPending(tenant.id)).toBe(true);

    await restarted.saasRuntime.meterRegistry.register({
      tenantId: tenant.id,
      meterId: AI_OUTPUT_TOKENS,
      type: "COUNT",
      quota: 1,
      allowOverQuota: true,
    });
    const recovered = await restarted.service.generateText(request);
    expect(recovered.text).toBe("Welcome to the deterministic Croco AI SaaS demo.");
    if (recovered.usage.state !== "known") {
      throw new Error("Recovered generation has unknown usage");
    }
    const recoveredOutputUsage = await restarted.saasRuntime.meteringService.getUsage({
      tenantId: tenant.id,
      meterId: AI_OUTPUT_TOKENS,
      period: "billing_cycle",
    });
    expect(recoveredOutputUsage - outputUsageBeforeRecovery).toBe(recovered.usage.outputTokens);
    expect(await restartedReceipts.hasPending(tenant.id)).toBe(false);
    expect((await restarted.service.generateText(request)).text).toBe(recovered.text);
    expect(
      await restarted.saasRuntime.meteringService.getUsage({
        tenantId: tenant.id,
        meterId: AI_OUTPUT_TOKENS,
        period: "billing_cycle",
      }),
    ).toBe(recoveredOutputUsage);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("recovers when receipt acknowledgement fails after all meter writes", async () => {
    let requests = 0;
    const baseURL = await fixture((_request, response) => {
      requests++;
      completed(response);
    });
    const options = {
      providerProfile: "openai" as const,
      generate: createOpenAIGenerate(() => createTenantOpenAIClient({ apiKey: "test", baseURL })),
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion: async () => {},
    };
    const receipts = new SnapshotReceiptStore();
    receipts.failNextUsageAcknowledgement();
    const runtime = createAiSaasRuntime(undefined, options, receipts);
    const { tenant } = await seedAiSaasTenant(runtime, "team", "receipt-recovery");
    const request = { tenantId: tenant.id, requestId: "ack", prompt: "Hello" };

    await expect(runtime.service.generateText(request)).rejects.toThrow(
      "receipt usage acknowledgement interrupted",
    );
    const restarted = createAiSaasRuntime(
      runtime.saasRuntime,
      options,
      new SnapshotReceiptStore(receipts.snapshot()),
    );
    expect((await restarted.service.generateText(request)).text).toBe("Hello");
    expect(requests).toBe(1);
    expect((await restarted.service.getUsageState(tenant.id)).usage.totalTokens).toBe(5);
  });

  it("rejects pre-dispatch cancellation without leaving a pending receipt", async () => {
    const generate = vi.fn(deterministicGenerate);
    const receipts = new SnapshotReceiptStore();
    const runtime = createAiSaasRuntime(
      undefined,
      {
        providerProfile: "in-memory",
        generate,
        promptPolicy: demoPromptPolicy,
        pricing,
        publishCompletion: async () => {},
      },
      receipts,
    );
    const { tenant } = await seedAiSaasTenant(runtime, "team", "cancel-before-dispatch");
    const controller = new AbortController();
    controller.abort(new Error("cancelled by caller"));

    await expect(
      runtime.service.generateText({
        tenantId: tenant.id,
        requestId: "cancelled",
        prompt: "Hello",
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(await receipts.hasPending(tenant.id)).toBe(false);
    await runtime.service.generateText({
      tenantId: tenant.id,
      requestId: "retry",
      prompt: "Hello",
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("blocks unknown usage and runs the prompt policy before generation", async () => {
    const generate = vi.fn(async (request: Parameters<typeof deterministicGenerate>[0]) => ({
      ...(await deterministicGenerate(request)),
      usage: { state: "unknown" as const },
    }));
    const runtime = createAiSaasRuntime(undefined, {
      providerProfile: "in-memory",
      generate,
      promptPolicy: demoPromptPolicy,
      pricing,
      publishCompletion: async () => {},
    });
    const { tenant } = await seedAiSaasTenant(runtime, "team", "unknown-usage");
    await expect(
      runtime.service.generateText({
        tenantId: tenant.id,
        requestId: "pii",
        prompt: "person@example.test",
      }),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
    await expect(
      runtime.service.generateText({ tenantId: tenant.id, requestId: "unknown", prompt: "Hello" }),
    ).rejects.toThrow();
    await expect(
      runtime.service.generateText({ tenantId: tenant.id, requestId: "other", prompt: "Hello" }),
    ).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(await runtime.receipts.hasPending(tenant.id)).toBe(true);
  });
});
