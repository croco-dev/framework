import * as assert from "node:assert/strict";
import { Problem } from "@croco/problems-core";
import type {
  RateLimitPolicy,
  RateLimitRefundReceipt,
  RateLimitStore,
} from "@croco/ratelimit-core";

export type ServerlessProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type ServerlessProviderLiveSmokeGate = {
  readonly requiredEnv: readonly string[];
  readonly isEnabled?: () => boolean;
  readonly run?: () => Promise<void>;
};

export type ServerlessProviderConformanceSuite = {
  readonly cases: readonly ServerlessProviderConformanceCase[];
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
};

export type UpstashRedisRateLimitConformanceScenario =
  | "allow"
  | "deny"
  | "retryable-upstream"
  | "terminal-upstream";

export type UpstashRedisMeteringClient = {
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zrangebyscore(key: string, min: number, max: number, withScores: "WITHSCORES"): Promise<string[]>;
  set(
    key: string,
    value: string,
    mode: "NX",
    expireMode: "EX",
    expire: number,
  ): Promise<string | null>;
  eval<TResult extends unknown[]>(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<TResult>;
};

export type UpstashRedisMeteringConformanceScenario =
  | "success"
  | "duplicate-idempotency"
  | "retryable-upstream"
  | "terminal-upstream";

export type UpstashRedisMeteringConformanceOptions = {
  readonly createClient: (
    scenario: UpstashRedisMeteringConformanceScenario,
  ) => UpstashRedisMeteringClient | Promise<UpstashRedisMeteringClient>;
  readonly createMissingConfig?: () => unknown | Promise<unknown>;
  readonly keyPrefix?: string;
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
  readonly providerName: string;
  readonly secretSamples?: readonly string[];
};

export type UpstashRedisRateLimitConformanceOptions = {
  readonly createMissingConfig?: () => unknown | Promise<unknown>;
  readonly createStore: (
    scenario: UpstashRedisRateLimitConformanceScenario,
  ) => RateLimitStore | Promise<RateLimitStore>;
  readonly invalidPolicy: RateLimitPolicy;
  readonly keyPrefix?: string;
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
  readonly policy: RateLimitPolicy;
  readonly providerName: string;
  readonly secretSamples?: readonly string[];
};

export type QStashTaskExecuteOptions = {
  readonly delay?: number;
  readonly headers?: Record<string, string>;
  readonly idempotencyKey?: string;
};

export type QStashTaskPublisher = {
  execute(
    taskId: string,
    payload: unknown,
    options?: QStashTaskExecuteOptions,
  ): Promise<{ readonly messageId: string }>;
};

export type QStashTaskPublishRecord = {
  readonly body?: unknown;
  readonly deduplicationId?: string;
  readonly delay?: number;
  readonly headers?: Record<string, string>;
  readonly url?: string;
};

export type QStashTaskConformanceHarness = {
  readonly publisher: QStashTaskPublisher;
  readonly getPublishedMessages: () => readonly QStashTaskPublishRecord[];
};

export type QStashTaskConformanceScenario = "success" | "retryable-upstream" | "terminal-upstream";

export type QStashTaskConformanceOptions = {
  readonly createMissingConfig?: () => unknown | Promise<unknown>;
  readonly createPublisher: (
    scenario: QStashTaskConformanceScenario,
  ) => QStashTaskConformanceHarness | Promise<QStashTaskConformanceHarness>;
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
  readonly providerName: string;
  readonly secretSamples?: readonly string[];
};

export type QStashBatchStep = {
  readonly classifyFailure?: (
    error: unknown,
    context: { readonly executionId: string; readonly stepName: string },
  ) =>
    | boolean
    | {
        readonly code?: string;
        readonly retryable: boolean;
      };
  readonly name: string;
  readonly reader: {
    read(): Promise<unknown | null>;
    peek?(): Promise<unknown | null>;
    getCheckpoint?(): unknown;
    restoreCheckpoint?(checkpoint: unknown): void;
  };
  readonly processor?: {
    process(item: unknown): Promise<unknown | null> | unknown | null;
  };
  readonly writer: {
    write(items: readonly unknown[]): Promise<void> | void;
  };
  readonly chunkSize: number;
};

export type QStashBatchChunkExecutor = {
  executeChunk(
    executionId: string,
    step: QStashBatchStep,
  ): Promise<{ readonly hasMore: boolean; readonly processedCount: number }>;
};

export type QStashBatchPublishRecord = {
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly url?: string;
};

export type QStashBatchConformanceHarness = {
  readonly executor: QStashBatchChunkExecutor;
  readonly getExecutionFailures?: () => readonly unknown[];
  readonly getPublishedMessages: () => readonly QStashBatchPublishRecord[];
};

export type QStashBatchConformanceScenario = "success" | "retryable-upstream" | "terminal-upstream";

export type QStashBatchConformanceOptions = {
  readonly createExecutor: (
    scenario: QStashBatchConformanceScenario,
  ) => QStashBatchConformanceHarness | Promise<QStashBatchConformanceHarness>;
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
  readonly providerName: string;
  readonly secretSamples?: readonly string[];
};

export type QStashTriggerSyncDetail = {
  readonly action: string;
  readonly applied: boolean;
  readonly code?: string;
  readonly error?: string;
  readonly retryable?: boolean;
};

export type QStashTriggerSyncResult = {
  readonly applied: boolean;
  readonly created: number;
  readonly deleted: number;
  readonly details: readonly QStashTriggerSyncDetail[];
  readonly failed: number;
  readonly mode: string;
  readonly skipped: number;
  readonly updated: number;
};

export type QStashTriggerScheduler = {
  sync(options?: { readonly mode?: "dry-run" | "apply" }): Promise<QStashTriggerSyncResult>;
};

export type QStashTriggerHandleResult = {
  readonly body: unknown;
  readonly executionId?: string;
  readonly statusCode: number;
  readonly success: boolean;
};

export type QStashTriggerHandler = {
  handle(body: string, signature?: string): Promise<QStashTriggerHandleResult>;
};

export type QStashTriggerScheduleRecord = {
  readonly body?: string;
  readonly cron?: string;
  readonly destination?: string;
  readonly headers?: Record<string, string>;
  readonly method?: string;
  readonly scheduleId?: string;
};

export type QStashTriggerConformanceHarness = {
  readonly getExecutionEvents?: () => readonly unknown[];
  readonly getScheduleOperations: () => readonly QStashTriggerScheduleRecord[];
  readonly handler: QStashTriggerHandler;
  readonly scheduler: QStashTriggerScheduler;
  readonly webhookBody: string;
  readonly validSignature: string;
};

export type QStashTriggerConformanceScenario =
  | "success"
  | "retryable-upstream"
  | "terminal-upstream";

export type QStashTriggerConformanceOptions = {
  readonly createHarness: (
    scenario: QStashTriggerConformanceScenario,
  ) => QStashTriggerConformanceHarness | Promise<QStashTriggerConformanceHarness>;
  readonly liveSmoke?: ServerlessProviderLiveSmokeGate;
  readonly providerName: string;
  readonly secretSamples?: readonly string[];
};

export function createUpstashRedisMeteringConformanceSuite(
  options: UpstashRedisMeteringConformanceOptions,
): ServerlessProviderConformanceSuite {
  let sequence = 0;
  const createKey = (label: string): string => {
    sequence += 1;
    return `${options.keyPrefix ?? "usage"}:${sanitizeKeySegment(options.providerName)}:${label}:${sequence}`;
  };

  const cases: ServerlessProviderConformanceCase[] = [
    {
      name: "validates required Upstash Redis metering configuration without leaking secrets",
      run: async () => {
        assert.ok(
          options.createMissingConfig,
          `${options.providerName} must provide a missing config conformance fixture.`,
        );
        await assertProblemFromAction(() => options.createMissingConfig?.(), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "adapts usage storage commands and idempotency keys without credentials",
      run: async () => {
        const client = await options.createClient("success");
        const usageKey = createKey("metering");
        const member = "usage-1:5:%7B%22source%22%3A%22conformance%22%7D";
        const score = Date.UTC(2026, 0, 1);

        const acquired = await client.set(`${usageKey}:dedupe`, "1", "NX", "EX", 86_400);
        assert.equal(acquired, "OK", `${options.providerName} must acquire idempotency keys.`);

        const inserted = await client.zadd(usageKey, score, member);
        assert.equal(inserted, 1, `${options.providerName} must report usage writes.`);

        const members = await client.zrangebyscore(usageKey, score, score, "WITHSCORES");
        assert.deepEqual(
          members,
          [member, String(score)],
          `${options.providerName} must preserve usage members with scores.`,
        );

        const [exceeded, newUsage] = await client.eval<[number, number]>(
          "return {0, tonumber(ARGV[1])}",
          [usageKey],
          [5],
        );
        assert.equal(exceeded, 0, `${options.providerName} must expose Lua result tuples.`);
        assert.equal(newUsage, 5, `${options.providerName} must expose Lua result tuples.`);
      },
    },
    {
      name: "preserves duplicate idempotency evidence as a terminal no-op",
      run: async () => {
        const client = await options.createClient("duplicate-idempotency");
        const acquired = await client.set(createKey("dedupe"), "1", "NX", "EX", 86_400);

        assert.equal(
          acquired,
          null,
          `${options.providerName} must surface duplicate idempotency keys as null.`,
        );
      },
    },
    {
      name: "surfaces retryable Upstash Redis metering failures as redacted Problems",
      run: async () => {
        const client = await options.createClient("retryable-upstream");
        await assertProblemFromAction(() => client.zadd(createKey("retryable"), 1, "usage-1:1"), {
          providerName: options.providerName,
          retryable: true,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "surfaces terminal Upstash Redis metering failures as redacted Problems",
      run: async () => {
        const client = await options.createClient("terminal-upstream");
        await assertProblemFromAction(() => client.zrangebyscore(createKey("terminal"), 0, 1), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
  ];

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

export function createUpstashRedisRateLimitConformanceSuite(
  options: UpstashRedisRateLimitConformanceOptions,
): ServerlessProviderConformanceSuite {
  let sequence = 0;
  const createKey = (label: string): string => {
    sequence += 1;
    return `${options.keyPrefix ?? "croco-conformance"}:${sanitizeKeySegment(
      options.providerName,
    )}:${label}:${sequence}`;
  };

  const cases: ServerlessProviderConformanceCase[] = [
    {
      name: "validates required Upstash Redis configuration without leaking secrets",
      run: async () => {
        assert.ok(
          options.createMissingConfig,
          `${options.providerName} must provide a missing config conformance fixture.`,
        );
        await assertProblemFromAction(() => options.createMissingConfig?.(), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "rejects unsupported rate-limit policies with a terminal Problem",
      run: async () => {
        const store = await options.createStore("allow");
        await assertProblemFromAction(
          () => store.check(createKey("invalid-policy"), options.invalidPolicy),
          {
            providerName: options.providerName,
            retryable: false,
            secretSamples: options.secretSamples,
          },
        );
      },
    },
    {
      name: "enforces allow, deny, stats, and refund idempotency semantics",
      run: async () => {
        const allowedStore = await options.createStore("allow");
        const allowedKey = createKey("allow");
        const allowed = await allowedStore.check(allowedKey, options.policy);

        assert.equal(allowed.success, true, `${options.providerName} must allow the fixture hit.`);
        assert.equal(
          allowed.limit > 0,
          true,
          `${options.providerName} must report a positive limit.`,
        );
        assert.ok(
          allowed.refundReceipt,
          `${options.providerName} must return a refund receipt for allowed requests.`,
        );

        const afterAllowStats = await allowedStore.getStats();
        assert.equal(afterAllowStats.total, 1, `${options.providerName} must count allowed hits.`);
        assert.equal(
          afterAllowStats.allowed,
          1,
          `${options.providerName} must count allowed hits.`,
        );

        const receipt = allowed.refundReceipt as RateLimitRefundReceipt;
        const refund = await allowedStore.refund(allowedKey, options.policy, receipt);
        const duplicateRefund = await allowedStore.refund(allowedKey, options.policy, receipt);

        assert.equal(
          refund.refunded,
          true,
          `${options.providerName} must refund the first receipt.`,
        );
        assert.equal(
          duplicateRefund.refunded,
          false,
          `${options.providerName} must reject duplicate refunds.`,
        );

        const deniedStore = await options.createStore("deny");
        const denied = await deniedStore.check(createKey("deny"), options.policy);

        assert.equal(denied.success, false, `${options.providerName} must deny the fixture hit.`);
        assert.equal(
          denied.refundReceipt,
          undefined,
          `${options.providerName} must not issue refund receipts for denied hits.`,
        );

        const deniedStats = await deniedStore.getStats();
        assert.equal(deniedStats.total, 1, `${options.providerName} must count denied hits.`);
        assert.equal(deniedStats.denied, 1, `${options.providerName} must count denied hits.`);
      },
    },
    {
      name: "surfaces retryable Upstash Redis failures as redacted Problems",
      run: async () => {
        const store = await options.createStore("retryable-upstream");
        await assertProblemFromAction(() => store.check(createKey("retryable"), options.policy), {
          providerName: options.providerName,
          retryable: true,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "surfaces terminal Upstash Redis failures as redacted Problems",
      run: async () => {
        const store = await options.createStore("terminal-upstream");
        await assertProblemFromAction(() => store.check(createKey("terminal"), options.policy), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
  ];

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

export function createQStashTaskConformanceSuite(
  options: QStashTaskConformanceOptions,
): ServerlessProviderConformanceSuite {
  const cases: ServerlessProviderConformanceCase[] = [
    {
      name: "validates required QStash configuration without leaking secrets",
      run: async () => {
        assert.ok(
          options.createMissingConfig,
          `${options.providerName} must provide a missing config conformance fixture.`,
        );
        await assertProblemFromAction(() => options.createMissingConfig?.(), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "publishes task envelopes with delay, headers, and idempotency evidence",
      run: async () => {
        const harness = await options.createPublisher("success");
        const payload = { tenantId: "tenant-a", action: "sync" };
        const result = await harness.publisher.execute("conformance.task", payload, {
          delay: 15,
          headers: { "X-Croco-Conformance": "qstash" },
          idempotencyKey: "qstash-conformance-key",
        });

        assert.equal(typeof result.messageId, "string");
        assert.ok(result.messageId.length > 0, `${options.providerName} must return a message id.`);

        const [published] = harness.getPublishedMessages();
        assert.ok(published, `${options.providerName} must publish one QStash message.`);
        assert.equal(published.delay, 15);
        assert.equal(published.headers?.["X-Croco-Conformance"], "qstash");
        assert.equal(published.deduplicationId, "qstash-conformance-key");
        assertRecord(published.body, `${options.providerName} must publish an object body.`);
        assert.equal(published.body.taskId, "conformance.task");
        assert.deepEqual(published.body.payload, payload);
        assertNoSecretLeak(JSON.stringify(published), options.secretSamples);
      },
    },
    {
      name: "rejects invalid task ids and unsupported publish options",
      run: async () => {
        const harness = await options.createPublisher("success");
        await assertProblemFromAction(() => harness.publisher.execute("", {}), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
        await assertProblemFromAction(
          () => harness.publisher.execute("conformance.task", {}, { delay: -1 }),
          {
            providerName: options.providerName,
            retryable: false,
            secretSamples: options.secretSamples,
          },
        );
      },
    },
    {
      name: "surfaces retryable QStash failures as redacted Problems",
      run: async () => {
        const harness = await options.createPublisher("retryable-upstream");
        await assertProblemFromAction(() => harness.publisher.execute("conformance.task", {}), {
          providerName: options.providerName,
          retryable: true,
          secretSamples: options.secretSamples,
        });
      },
    },
    {
      name: "surfaces terminal QStash failures as redacted Problems",
      run: async () => {
        const harness = await options.createPublisher("terminal-upstream");
        await assertProblemFromAction(() => harness.publisher.execute("conformance.task", {}), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
      },
    },
  ];

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

export function createQStashBatchConformanceSuite(
  options: QStashBatchConformanceOptions,
): ServerlessProviderConformanceSuite {
  const cases: ServerlessProviderConformanceCase[] = [
    {
      name: "executes a terminal chunk without publishing a follow-up message",
      run: async () => {
        const harness = await options.createExecutor("success");
        const written: unknown[][] = [];
        const step = createBatchStep({
          chunkSize: 10,
          items: [1, 2],
          name: "conformance-terminal",
          written,
        });

        const result = await harness.executor.executeChunk("exec-terminal", step);

        assert.deepEqual(result, { hasMore: false, processedCount: 2 });
        assert.deepEqual(written, [[1, 2]]);
        assert.equal(harness.getPublishedMessages().length, 0);
      },
    },
    {
      name: "publishes next chunk envelopes with idempotency evidence",
      run: async () => {
        const harness = await options.createExecutor("success");
        const written: unknown[][] = [];
        const step = createBatchStep({
          chunkSize: 2,
          items: [1, 2, 3],
          name: "conformance-chained",
          written,
        });

        const result = await harness.executor.executeChunk("exec-chained", step);

        assert.deepEqual(result, { hasMore: true, processedCount: 2 });
        assert.deepEqual(written, [[1, 2]]);

        const [published] = harness.getPublishedMessages();
        assert.ok(published, `${options.providerName} must publish the next chunk.`);
        assert.equal(published.url, "https://example.com/batch/conformance");
        assert.equal(
          published.headers?.["Idempotency-Key"],
          "chunk:exec-chained:conformance-chained:2",
        );
        assertRecord(published.body, `${options.providerName} must publish an object body.`);
        assert.equal(published.body.executionId, "exec-chained");
        assert.equal(published.body.stepName, "conformance-chained");
        assertNoSecretLeak(JSON.stringify(published), options.secretSamples);
      },
    },
    {
      name: "surfaces retryable QStash batch failures as redacted Problems",
      run: async () => {
        const harness = await options.createExecutor("retryable-upstream");
        const step = createBatchStep({
          chunkSize: 1,
          items: [1, 2],
          name: "conformance-retryable",
          written: [],
        });

        await assertProblemFromAction(() => harness.executor.executeChunk("exec-retryable", step), {
          providerName: options.providerName,
          retryable: true,
          secretSamples: options.secretSamples,
        });
        assertFailureEvidence(harness, options.providerName, true);
      },
    },
    {
      name: "surfaces terminal QStash batch failures as redacted Problems",
      run: async () => {
        const harness = await options.createExecutor("terminal-upstream");
        const step = createBatchStep({
          chunkSize: 1,
          items: [1, 2],
          name: "conformance-terminal-failure",
          written: [],
        });

        await assertProblemFromAction(() => harness.executor.executeChunk("exec-terminal", step), {
          providerName: options.providerName,
          retryable: false,
          secretSamples: options.secretSamples,
        });
        assertFailureEvidence(harness, options.providerName, false);
      },
    },
  ];

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

export function createQStashTriggerConformanceSuite(
  options: QStashTriggerConformanceOptions,
): ServerlessProviderConformanceSuite {
  const cases: ServerlessProviderConformanceCase[] = [
    {
      name: "syncs QStash schedules with stable webhook payloads",
      run: async () => {
        const harness = await options.createHarness("success");
        const result = await harness.scheduler.sync();

        assert.equal(result.mode, "apply");
        assert.equal(result.applied, true);
        assert.equal(result.created, 1, `${options.providerName} must create one schedule.`);
        assert.equal(result.failed, 0);

        const [created] = harness.getScheduleOperations();
        assert.ok(created, `${options.providerName} must record a schedule operation.`);
        assert.equal(created.destination, "https://example.com/triggers/conformance");
        assert.equal(created.method, "POST");
        assert.equal(created.headers?.["Content-Type"], "application/json");
        assert.ok(created.scheduleId?.includes("ConformanceTrigger"));
        assert.ok(created.body, `${options.providerName} must publish a webhook payload.`);
        assertNoSecretLeak(JSON.stringify(created), options.secretSamples);
      },
    },
    {
      name: "rejects invalid webhook signatures before dispatch",
      run: async () => {
        const harness = await options.createHarness("success");
        const result = await harness.handler.handle(harness.webhookBody, "invalid-signature");

        assert.equal(result.success, false);
        assert.equal(result.statusCode, 401);
        assertResponseProblem(result.body, {
          code: "triggers-qstash/invalid-signature",
          providerName: options.providerName,
        });
        assert.equal(
          harness.getExecutionEvents?.().length ?? 0,
          0,
          `${options.providerName} must not dispatch invalid signatures.`,
        );
      },
    },
    {
      name: "dispatches verified webhooks through the execution manager",
      run: async () => {
        const harness = await options.createHarness("success");
        const result = await harness.handler.handle(harness.webhookBody, harness.validSignature);

        assert.equal(result.success, true);
        assert.equal(result.statusCode, 200);
        assert.equal(typeof result.executionId, "string");
        assert.ok(result.executionId?.length);
        assert.ok(
          (harness.getExecutionEvents?.().length ?? 0) >= 3,
          `${options.providerName} must create, start, and complete an execution.`,
        );
      },
    },
    {
      name: "surfaces retryable QStash schedule failures as redacted diagnostics",
      run: async () => {
        const harness = await options.createHarness("retryable-upstream");
        const result = await harness.scheduler.sync();
        const [detail] = result.details;

        assert.equal(result.failed, 1);
        assert.ok(detail, `${options.providerName} must return failure details.`);
        assert.equal(detail.action, "failed");
        assert.equal(detail.code, "triggers-qstash/schedule-upstream-failed");
        assert.equal(detail.retryable, true);
        assertNoSecretLeak(JSON.stringify(detail), options.secretSamples);
      },
    },
    {
      name: "surfaces terminal QStash schedule failures as redacted diagnostics",
      run: async () => {
        const harness = await options.createHarness("terminal-upstream");
        const result = await harness.scheduler.sync();
        const [detail] = result.details;

        assert.equal(result.failed, 1);
        assert.ok(detail, `${options.providerName} must return failure details.`);
        assert.equal(detail.action, "failed");
        assert.equal(detail.code, "triggers-qstash/schedule-upstream-failed");
        assert.equal(detail.retryable, false);
        assertNoSecretLeak(JSON.stringify(detail), options.secretSamples);
      },
    },
  ];

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

function createBatchStep(options: {
  readonly chunkSize: number;
  readonly items: readonly unknown[];
  readonly name: string;
  readonly written: unknown[][];
}): QStashBatchStep {
  let cursor = 0;

  return {
    chunkSize: options.chunkSize,
    name: options.name,
    reader: {
      getCheckpoint: () => cursor,
      read: async () => {
        if (cursor >= options.items.length) {
          return null;
        }

        const item = options.items[cursor];
        cursor += 1;
        return item;
      },
      restoreCheckpoint: (checkpoint: unknown) => {
        cursor = typeof checkpoint === "number" ? checkpoint : cursor;
      },
    },
    writer: {
      write: async (items) => {
        options.written.push([...items]);
      },
    },
    classifyFailure: (error) => {
      if (error instanceof Problem && typeof error.extensions?.retryable === "boolean") {
        return {
          code: error.code,
          retryable: error.extensions.retryable,
        };
      }

      return true;
    },
  };
}

function assertFailureEvidence(
  harness: QStashBatchConformanceHarness,
  providerName: string,
  retryable: boolean,
): void {
  const failures = harness.getExecutionFailures?.() ?? [];
  assert.ok(failures.length > 0, `${providerName} must record execution failure evidence.`);
  const [failure] = failures;
  assertRecord(failure, `${providerName} failure evidence must be an object.`);
  assert.equal(failure.retryable, retryable);
}

function assertResponseProblem(
  value: unknown,
  options: {
    readonly code: string;
    readonly providerName: string;
  },
): void {
  assertRecord(value, `${options.providerName} error response must be an object.`);
  assert.equal(value.code, options.code);
}

function createOptionalLiveSmokeCase(
  providerName: string,
  gate: ServerlessProviderLiveSmokeGate,
): ServerlessProviderConformanceCase {
  return {
    name: "keeps live smoke optional and skipped unless explicitly env-gated",
    run: async () => {
      assert.ok(
        gate.requiredEnv.length > 0,
        `${providerName} live smoke gate must declare required environment variables.`,
      );

      const enabled = gate.isEnabled
        ? gate.isEnabled()
        : gate.requiredEnv.every((name) => process.env[name]);
      if (!enabled) {
        return;
      }

      assert.ok(gate.run, `${providerName} live smoke gate is enabled but has no run hook.`);
      await gate.run();
    },
  };
}

async function assertProblemFromAction(
  action: () => unknown | Promise<unknown>,
  options: {
    readonly providerName: string;
    readonly retryable?: boolean;
    readonly secretSamples?: readonly string[];
  },
): Promise<Problem> {
  let thrown: unknown;

  try {
    await action();
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, `${options.providerName} must throw a Problem.`);
  assert.ok(thrown instanceof Problem, `${options.providerName} must throw a Croco Problem.`);

  const problem = thrown as Problem;
  if (options.retryable !== undefined) {
    assert.equal(
      problem.extensions?.retryable,
      options.retryable,
      `${options.providerName} Problem must expose retryable=${String(options.retryable)}.`,
    );
  }

  assertNoSecretLeak(JSON.stringify(problem.toJSON()), options.secretSamples);
  assertNoSecretLeak(problem.message, options.secretSamples);
  assertNoSecretLeak(problem.cause?.message ?? "", options.secretSamples);
  assertNoSecretLeak(problem.cause?.stack ?? "", options.secretSamples);

  return problem;
}

function assertNoSecretLeak(value: string, secretSamples: readonly string[] | undefined): void {
  for (const secret of secretSamples ?? []) {
    if (!secret) {
      continue;
    }
    assert.equal(
      value.includes(secret),
      false,
      `Conformance evidence must not leak secret sample '${secret}'.`,
    );
  }
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value), message);
}

function sanitizeKeySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
