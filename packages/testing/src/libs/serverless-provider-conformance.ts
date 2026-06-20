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
