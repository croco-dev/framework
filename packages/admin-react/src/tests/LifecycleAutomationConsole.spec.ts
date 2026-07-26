import {
  createHealthScoreDroppedSignal,
  createLifecycleContext,
  InMemoryLifecycleActionSink,
  InMemoryLifecycleRunStore,
  LifecycleRuleEvaluator,
  LifecycleRuleRegistry,
} from "@croco/lifecycle-core";
import type { LifecycleRun } from "@croco/lifecycle-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LifecycleAutomationSource, LifecycleRuleAdminAction } from "../index";
import {
  createLifecycleAutomationLoadingState,
  createLifecycleAutomationSource,
  classifyLifecycleRun,
  LifecycleAutomationConsole,
  loadLifecycleAutomationConsole,
} from "../index";

const instant = new Date("2026-07-26T00:00:00.000Z");

async function createRuntime(options: { readonly failAction?: boolean } = {}) {
  const registry = new LifecycleRuleRegistry();
  const runStore = new InMemoryLifecycleRunStore();
  const actionSink = new InMemoryLifecycleActionSink({
    failActionIds: options.failAction ? ["notify-success"] : [],
  });
  const evaluator = new LifecycleRuleEvaluator({
    registry,
    runStore,
    actionAdapter: actionSink,
  });
  const context = createLifecycleContext({
    signal: createHealthScoreDroppedSignal({
      tenantId: "tenant-1",
      previousScore: 80,
      currentScore: 55,
      dropPercentage: 31,
      signalId: "signal-1",
      occurredAt: instant,
    }),
    now: instant,
    metadata: {
      privateEmail: "secret@example.com",
    },
  });

  await registry.registerVersion({
    rule: {
      id: "customer-risk",
      description: "Notify operators when health falls sharply.",
      triggers: [{ type: "health.score.dropped" }],
      severity: "high",
      cooldown: { durationMs: 60_000 },
      when: (candidate) => (candidate.health?.score ?? 0) < 60,
      conditionEvidence: (candidate) => ({
        belowThreshold: (candidate.health?.score ?? 0) < 60,
      }),
      actions: [{ id: "notify-success", type: "notification" }],
    },
    version: "v1",
    executableRegistrationId: "customer-risk-v1",
    executableFingerprint: "bundle-customer-risk-v1",
    contextRequirements: ["health.score"],
    activate: true,
    registeredAt: instant,
  });

  const source = createLifecycleAutomationSource({
    registry,
    evaluator,
    runStore,
    fixtures: [
      {
        id: "risk-fixture",
        label: "Redacted at-risk tenant",
        tenantId: "tenant-1",
        resolve: () => context,
      },
    ],
  });

  return { actionSink, context, evaluator, registry, runStore, source };
}

function render(state: Parameters<typeof LifecycleAutomationConsole>[0]["state"]): string {
  return renderToStaticMarkup(createElement(LifecycleAutomationConsole, { state }));
}

describe("LifecycleAutomationConsole", () => {
  it("renders loading, permission denied, and empty states explicitly", async () => {
    expect(render(createLifecycleAutomationLoadingState(instant))).toContain('aria-busy="true"');

    const source: LifecycleAutomationSource = {
      inspectRules: async () => [],
      listRuns: async () => [],
      listDryRunFixtures: () => [],
      executeRuleAction: async () => ({
        kind: "invalid",
        problem: {
          code: "unused",
          message: "unused",
          source: "rules",
        },
      }),
      dryRun: async () => ({
        kind: "invalid",
        problem: {
          code: "unused",
          message: "unused",
          source: "dry-run",
        },
      }),
    };
    const denied = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: [],
      generatedAt: instant,
    });
    expect(render(denied)).toContain("admin-react/lifecycle-read-permission-denied");

    const empty = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read"],
      generatedAt: instant,
    });
    expect(empty.kind).toBe("empty");
    expect(render(empty)).toContain("No lifecycle rules or runs are available.");
  });

  it("keeps partial provider failures as explicit Problems", async () => {
    const source: LifecycleAutomationSource = {
      inspectRules: async () => {
        throw new TypeError("provider leaked a secret");
      },
      listRuns: async () => [],
      listDryRunFixtures: () => [],
      executeRuleAction: async () => ({
        kind: "invalid",
        problem: { code: "unused", message: "unused", source: "rules" },
      }),
      dryRun: async () => ({
        kind: "invalid",
        problem: { code: "unused", message: "unused", source: "dry-run" },
      }),
    };
    const state = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read"],
      generatedAt: instant,
    });

    expect(state.kind).toBe("ready");
    expect(render(state)).toContain("admin-react/lifecycle-rules-unavailable");
    expect(render(state)).not.toContain("provider leaked a secret");
  });

  it("renders active, paused, unavailable, and descriptor diff evidence", async () => {
    const { registry, source } = await createRuntime();
    await registry.registerVersion({
      rule: {
        id: "customer-risk",
        description: "Escalate customer risk.",
        triggers: [{ type: "health.score.dropped" }],
        severity: "critical",
        actions: [{ id: "page-operator", type: "pager" }],
      },
      version: "v2",
      executableRegistrationId: "customer-risk-v2",
      executableFingerprint: "bundle-customer-risk-v2",
    });

    const ready = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:write"],
      generatedAt: instant,
    });
    const html = render(ready);

    expect(html).toContain('data-rule-state="active"');
    expect(html).toContain("Descriptor changes");
    expect(html).toContain("bundle-customer-risk-v2");
    const unavailable = await loadLifecycleAutomationConsole({
      source: {
        ...source,
        inspectRules: async () =>
          (await source.inspectRules()).map((inspection) => ({
            ...inspection,
            state: "unavailable" as const,
          })),
      },
      grantedPermissions: ["lifecycle:read"],
      generatedAt: instant,
    });
    expect(render(unavailable)).toContain('data-rule-state="unavailable"');
    expect(render(unavailable)).toContain("no matching code registration");

    const active =
      ready.kind === "ready"
        ? ready.rules.find((entry) => entry.inspection.state === "active")
        : undefined;
    expect(active).toBeDefined();
    if (active) {
      const pause = active.actions.find((action) => action.command === "pause");
      expect(pause).toBeDefined();
      if (pause) {
        expect(pause).toEqual(
          expect.objectContaining({
            kind: "pause",
            mutability: "write",
            target: "record",
            idempotency: "required",
            audit: expect.objectContaining({
              actor: "required",
              reason: "required",
              idempotencyKey: "required",
            }),
          }),
        );
        const result = await source.executeRuleAction({
          action: pause,
          actor: "ops-1",
          reason: "Investigate unexpected matches",
          idempotencyKey: "pause-customer-risk-v1",
          grantedPermissions: ["lifecycle:write"],
        });
        expect(result.kind).toBe("succeeded");
      }
    }

    const paused = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:write"],
      generatedAt: instant,
    });
    expect(render(paused)).toContain('data-rule-state="paused"');
    expect(render(paused)).toContain("historical signals are not replayed");
  });

  it("invalidates action intent when descriptor revision evidence changes", async () => {
    const { registry, source } = await createRuntime();
    const state = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:write"],
    });
    const action =
      state.kind === "ready"
        ? state.rules[0]?.actions.find((candidate) => candidate.command === "pause")
        : undefined;
    expect(action).toBeDefined();

    await registry.pause({
      commandId: "external-pause",
      ruleId: "customer-risk",
      version: "v1",
      expectedRevision: 1,
      actor: "other-operator",
      reason: "Concurrent operator action",
    });
    const stale = await source.executeRuleAction({
      action: action as LifecycleRuleAdminAction,
      actor: "ops-1",
      reason: "Pause the rule",
      idempotencyKey: "pause-stale",
      grantedPermissions: ["lifecycle:write"],
    });

    expect(stale).toEqual(
      expect.objectContaining({
        kind: "problem",
        problem: expect.objectContaining({
          code: "admin-react/lifecycle-action-intent-stale",
        }),
      }),
    );
  });

  it("preserves registry idempotent replay after the action revision advances", async () => {
    const { source } = await createRuntime();
    const state = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:write"],
    });
    const action =
      state.kind === "ready"
        ? state.rules[0]?.actions.find((candidate) => candidate.command === "pause")
        : undefined;
    expect(action).toBeDefined();
    const input = {
      action: action as LifecycleRuleAdminAction,
      actor: "ops-1",
      reason: "Investigate unexpected matches",
      idempotencyKey: "pause-replay",
      grantedPermissions: ["lifecycle:write"],
    };

    expect(await source.executeRuleAction(input)).toEqual(
      expect.objectContaining({ kind: "succeeded", replayed: false }),
    );
    expect(await source.executeRuleAction(input)).toEqual(
      expect.objectContaining({ kind: "succeeded", replayed: true }),
    );
  });

  it("keeps dry-run evidence distinct and excludes sensitive context values", async () => {
    const { actionSink, runStore, source } = await createRuntime();
    const dryRun = await source.dryRun({ ruleId: "customer-risk", fixtureId: "risk-fixture" }, [
      "lifecycle:dry-run",
    ]);
    expect(dryRun.kind).toBe("succeeded");
    expect(await runStore.list()).toHaveLength(0);
    expect(actionSink.getEmissions()).toHaveLength(0);

    const state = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:dry-run"],
      dryRun:
        dryRun.kind === "succeeded"
          ? {
              kind: "succeeded",
              evidence: {
                ...dryRun.evidence,
                result: {
                  ...dryRun.evidence.result,
                  matched: false,
                  problems: [
                    {
                      code: "lifecycle-core/dry-run-condition-failed",
                      message: "Redacted dry-run failure",
                    },
                  ],
                },
              },
            }
          : undefined,
      generatedAt: instant,
    });
    const html = render(state);

    expect(html).toContain("Dry-run evidence — not dispatched");
    expect(html).toContain('data-evidence-kind="dry-run"');
    expect(html).toContain("lifecycle-core/dry-run-condition-failed");
    expect(html).not.toContain("secret@example.com");
  });

  it("renders an explicit dry-run invocation failure", async () => {
    const { source } = await createRuntime();
    const dryRun = await source.dryRun({ ruleId: "customer-risk", fixtureId: "missing-fixture" }, [
      "lifecycle:dry-run",
    ]);
    expect(dryRun.kind).toBe("invalid");

    const state = await loadLifecycleAutomationConsole({
      source,
      grantedPermissions: ["lifecycle:read", "lifecycle:dry-run"],
      dryRun,
      generatedAt: instant,
    });
    const html = render(state);

    expect(html).toContain('data-evidence-kind="dry-run-problem"');
    expect(html).toContain("admin-react/lifecycle-dry-run-fixture-not-found");
  });

  it("distinguishes invalid pasted context from evaluator availability failures", async () => {
    const { evaluator, registry, runStore } = await createRuntime();
    const source = createLifecycleAutomationSource({
      registry,
      evaluator,
      runStore,
      parsePastedContext: () => {
        throw new TypeError("schema mismatch with private input");
      },
    });

    const dryRun = await source.dryRun(
      { ruleId: "customer-risk", pastedContext: { privateEmail: "secret@example.com" } },
      ["lifecycle:dry-run"],
    );

    expect(dryRun).toEqual({
      kind: "invalid",
      problem: {
        code: "admin-react/lifecycle-pasted-context-invalid",
        message: "The pasted context did not satisfy the configured schema.",
        source: "dry-run",
      },
    });
    expect(JSON.stringify(dryRun)).not.toContain("secret@example.com");
    expect(JSON.stringify(dryRun)).not.toContain("schema mismatch with private input");
  });

  it("explains production match, cooldown suppression, failed action, and safe recovery", async () => {
    const { context, evaluator, registry, runStore, source } = await createRuntime({
      failAction: true,
    });
    await evaluator.evaluate({
      ...context,
      health: { score: 55 },
    });
    await evaluator.evaluate({
      ...context,
      signal: {
        ...context.signal,
        id: "signal-2",
        occurredAt: new Date(instant.getTime() + 1_000),
      },
      now: new Date(instant.getTime() + 1_000),
      health: { score: 55 },
    });
    const runs = await runStore.list();
    const failed = runs.find((run) => run.status === "failed");
    const sourceWithRecovery = createLifecycleAutomationSource({
      registry,
      evaluator,
      runStore,
      runLinks: (run) => ({
        tenantHref: `/admin/tenants/${run.tenantId}`,
        operationsHref: `/admin/operations/lifecycle/${run.id}`,
      }),
      listRecoveryItems: async () =>
        failed
          ? [
              {
                id: failed.id,
                source: { kind: "lifecycle", label: "Lifecycle" },
                state: "terminal_failed",
                title: failed.ruleId,
                retryable: false,
                attempts: { current: 1, max: 1 },
                timestamps: {},
                correlationIds: { lifecycleRunId: failed.id },
                recoveryActions: [
                  {
                    id: "replay",
                    kind: "replay",
                    label: "Replay safely",
                    allowed: true,
                    reason: "Recovery provider declares replay safe",
                    permission: {
                      action: "admin-ops:replay",
                      resource: failed.id,
                    },
                    requiresAudit: true,
                    requiresIdempotencyKey: true,
                  },
                ],
              },
            ]
          : [],
    });
    const state = await loadLifecycleAutomationConsole({
      source: {
        ...sourceWithRecovery,
        inspectRules: source.inspectRules,
      },
      grantedPermissions: ["lifecycle:read"],
      generatedAt: instant,
    });
    const html = render(state);

    expect(html).toContain("failed-action");
    expect(html).toContain("suppressed-cooldown");
    expect(html).toContain("Replay safely");
    expect(html).toContain("lifecycle-core/in-memory-action-failed");
    expect(html).toContain("/admin/tenants/tenant-1");
    expect(await sourceWithRecovery.listRuns({ actionState: "failure" })).toHaveLength(1);
  });

  it("applies limits after secondary filters", async () => {
    const { context, evaluator, source } = await createRuntime();
    await evaluator.evaluate({ ...context, health: { score: 55 } });
    await evaluator.evaluate({
      ...context,
      signal: {
        ...context.signal,
        id: "newer-cooldown-signal",
        occurredAt: new Date(instant.getTime() + 1_000),
      },
      now: new Date(instant.getTime() + 1_000),
      health: { score: 55 },
    });

    const completed = await source.listRuns({ outcome: "completed", limit: 1 });
    expect(completed).toHaveLength(1);
    expect(completed[0]?.status).toBe("succeeded");
  });

  it("preserves partial fixture and link failures without exposing raw run errors", async () => {
    const { context, evaluator, source } = await createRuntime({ failAction: true });
    await evaluator.evaluate({ ...context, health: { score: 55 } });
    const [failed] = await source.listRuns();
    expect(failed).toBeDefined();
    const hostileRun: LifecycleRun = {
      ...(failed as LifecycleRun),
      error: {
        code: "provider/failed",
        message: "secret@example.com from provider exception",
      },
      actionResults: (failed as LifecycleRun).actionResults.map((result) => ({
        ...result,
        error: {
          code: result.error?.code ?? "provider/action-failed",
          message: "private-token-value",
        },
      })),
    };

    const state = await loadLifecycleAutomationConsole({
      source: {
        ...source,
        listRuns: async () => [hostileRun],
        listDryRunFixtures: () => {
          throw new TypeError("fixture provider secret");
        },
        runLinks: () => {
          throw new TypeError("link provider secret");
        },
      },
      grantedPermissions: ["lifecycle:read"],
      generatedAt: instant,
    });
    const serialized = JSON.stringify(state);

    expect(state.kind).toBe("ready");
    expect(serialized).toContain("admin-react/lifecycle-dry-run-unavailable");
    expect(serialized).toContain("admin-react/lifecycle-run-links-unavailable");
    expect(serialized).toContain("provider/failed");
    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("private-token-value");
    expect(serialized).not.toContain("fixture provider secret");
    expect(serialized).not.toContain("link provider secret");
  });

  it("classifies every production run outcome explicitly", () => {
    const run = {
      id: "run-1",
      ruleId: "customer-risk",
      ruleVersion: "v1",
      ruleFingerprint: "rule-v1",
      tenantId: "tenant-1",
      signalType: "health.score.dropped",
      severity: "high",
      idempotencyKey: "run-1",
      actionResults: [],
      startedAt: instant,
      completedAt: instant,
    } satisfies Omit<LifecycleRun, "status">;

    expect(classifyLifecycleRun({ ...run, status: "succeeded" })).toBe("completed");
    expect(classifyLifecycleRun({ ...run, status: "failed" })).toBe("failed-action");
    expect(
      classifyLifecycleRun({
        ...run,
        status: "skipped",
        skipReason: "condition_not_met",
      }),
    ).toBe("not-matched");
    expect(
      classifyLifecycleRun({
        ...run,
        status: "skipped",
        skipReason: "cooldown_active",
      }),
    ).toBe("suppressed-cooldown");
    expect(
      classifyLifecycleRun({
        ...run,
        status: "skipped",
        skipReason: "rule_paused",
      }),
    ).toBe("suppressed");
  });
});
