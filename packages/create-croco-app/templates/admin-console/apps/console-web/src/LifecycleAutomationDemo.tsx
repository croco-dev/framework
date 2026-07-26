import {
  createLifecycleAutomationLoadingState,
  LifecycleAutomationConsole,
  type LifecycleAutomationConsoleState,
  type LifecycleAutomationSource,
  type LifecycleDryRunEvidence,
  type LifecycleDryRunResponse,
  type LifecycleRuleAdminAction,
  type LifecycleRunOutcome,
  loadLifecycleAutomationConsole,
} from "@croco/admin-react";
import type { RetryConsoleItem } from "@croco/admin-ops";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { useEffect, useState } from "react";

const demoAt = new Date("2026-07-26T00:00:00.000Z");
const permissions = ["lifecycle:read", "lifecycle:write", "lifecycle:dry-run"] as const;

type RuleState = "registered" | "active" | "paused" | "superseded";

type DemoRun = {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly ruleFingerprint: string;
  readonly tenantId: string;
  readonly signalType: "health.score.dropped";
  readonly signalId: string;
  readonly severity: "high" | "critical";
  readonly status: "succeeded" | "failed" | "skipped";
  readonly idempotencyKey: string;
  readonly skipReason?: "condition_not_met" | "cooldown_active" | "rule_paused";
  readonly actionResults: readonly {
    readonly actionId: string;
    readonly type: string;
    readonly status: "success" | "failure";
    readonly error?: { readonly code: string; readonly message: string };
  }[];
  readonly error?: { readonly code: string; readonly message: string };
  readonly startedAt: Date;
  readonly completedAt: Date;
};

type GeneratedLifecycleSource = LifecycleAutomationSource & {
  evaluateCustomerSignal(input: {
    readonly signalId: string;
    readonly at: Date;
    readonly healthScore: number;
  }): void;
  evaluateRenewalFailure(at: Date): void;
};

type DemoRuntime = {
  readonly source: LifecycleAutomationSource;
  readonly auditEvidence: readonly string[];
  readonly dryRun: LifecycleDryRunEvidence;
};

class LifecycleAutomationDemoProblem extends Problem {
  public constructor(detail: string) {
    super("ADMIN_LIFECYCLE_DEMO_INVARIANT", ProblemCategory.InternalServerError, detail);
  }
}

function classifyDemoRun(run: DemoRun): LifecycleRunOutcome {
  if (run.status === "succeeded") {
    return "completed";
  }
  if (run.status === "failed") {
    return "failed-action";
  }
  if (run.skipReason === "condition_not_met") {
    return "not-matched";
  }
  if (run.skipReason === "cooldown_active") {
    return "suppressed-cooldown";
  }
  return "suppressed";
}

function createGeneratedLifecycleSource(): GeneratedLifecycleSource {
  let customerState: RuleState = "registered";
  let revision = 0;
  let lastSuccessfulAt: Date | undefined;
  const runs: DemoRun[] = [];
  const commandResults = new Map<
    string,
    { readonly signature: string; readonly revision: number }
  >();

  const customerInspection = () => ({
    ruleId: "customer-risk",
    version: "2026-07-26",
    fingerprint: "descriptor-customer-risk-v1",
    executableRegistrationId: "admin-console/customer-risk",
    executableFingerprint: "admin-console-customer-risk-v1",
    description: "Notify operators when customer health drops sharply.",
    triggers: [{ type: "health.score.dropped" as const }],
    contextRequirements: ["health.score"],
    severity: "high" as const,
    cooldownDurationMs: 60_000,
    actions: [
      {
        id: "notify-customer-success",
        type: "notification",
        title: "Notify customer success",
      },
    ],
    state: customerState,
    revision,
    registeredAt: demoAt,
    updatedAt: new Date(demoAt.getTime() + revision),
  });

  const source: LifecycleAutomationSource = {
    inspectRules: async () => [
      customerInspection(),
      {
        ruleId: "renewal-risk",
        version: "2026-07-26",
        fingerprint: "descriptor-renewal-risk-v1",
        executableRegistrationId: "admin-console/renewal-risk",
        executableFingerprint: "admin-console-renewal-risk-v1",
        description: "Open a recovery task when renewal health is critical.",
        triggers: [{ type: "health.score.dropped" }],
        contextRequirements: ["health.score"],
        severity: "critical",
        actions: [{ id: "open-recovery-task", type: "task" }],
        state: "active",
        revision: 1,
        registeredAt: demoAt,
        updatedAt: demoAt,
      },
    ],
    listRuns: async (filters = {}) => {
      const filtered = runs.filter(
        (run) =>
          (filters.tenantId === undefined || filters.tenantId === run.tenantId) &&
          (filters.ruleId === undefined || filters.ruleId === run.ruleId) &&
          (filters.version === undefined || filters.version === run.ruleVersion) &&
          (filters.signalType === undefined || filters.signalType === run.signalType) &&
          (filters.outcome === undefined || filters.outcome === classifyDemoRun(run)) &&
          (filters.actionState === undefined ||
            run.actionResults.some((action) => action.status === filters.actionState)) &&
          (filters.problemCode === undefined ||
            run.error?.code === filters.problemCode ||
            run.actionResults.some((action) => action.error?.code === filters.problemCode)) &&
          (filters.from === undefined || run.completedAt >= filters.from) &&
          (filters.to === undefined || run.startedAt <= filters.to),
      );
      return filters.limit === undefined ? filtered : filtered.slice(0, Math.max(0, filters.limit));
    },
    listRecoveryItems: async () => {
      const failed = runs.find((run) => run.status === "failed");
      const items: RetryConsoleItem[] = failed
        ? [
            {
              id: failed.id,
              source: { kind: "lifecycle", label: "Lifecycle" },
              state: "terminal_failed",
              title: failed.ruleId,
              retryable: false,
              attempts: { current: 1, max: 1 },
              timestamps: { completedAt: failed.completedAt.toISOString() },
              correlationIds: {
                lifecycleRunId: failed.id,
                lifecycleRuleId: failed.ruleId,
                tenantId: failed.tenantId,
                signalId: failed.signalId,
              },
              recoveryActions: [
                {
                  id: "replay",
                  kind: "replay",
                  label: "Replay through admin-ops",
                  allowed: true,
                  reason: "Fake recovery provider declares replay safe.",
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
        : [];
      return items;
    },
    runLinks: (run) => ({
      tenantHref: `/admin/tenants/${run.tenantId}`,
      operationsHref: `/admin/operations/lifecycle/${run.id}`,
    }),
    listDryRunFixtures: () => [
      {
        id: "at-risk-tenant",
        label: "Stored redacted at-risk tenant",
        description: "Only safe condition evidence and signal identity reach the browser.",
        tenantId: "tenant_acme",
      },
    ],
    executeRuleAction: async (input) => {
      if (!input.grantedPermissions.includes("lifecycle:write")) {
        return {
          kind: "denied",
          problem: {
            code: "admin-react/lifecycle-action-permission-denied",
            message: "Permission 'lifecycle:write' is required.",
            source: "access",
          },
        };
      }
      if (
        input.actor.trim() === "" ||
        input.reason.trim() === "" ||
        input.idempotencyKey.trim() === ""
      ) {
        return {
          kind: "invalid",
          problem: {
            code: "admin-react/lifecycle-action-invalid",
            message: "Actor, reason, and idempotency key are required.",
            source: "access",
          },
        };
      }
      const signature = `${input.action.command}:${input.action.ruleId}:${input.action.version}:${input.action.expectedRevision}`;
      const replay = commandResults.get(input.idempotencyKey);
      if (replay) {
        return replay.signature === signature
          ? { kind: "succeeded", replayed: true, revision: replay.revision }
          : {
              kind: "problem",
              problem: {
                code: "admin-react/lifecycle-action-idempotency-conflict",
                message: "The idempotency key was reused with different input.",
                source: "rules",
              },
            };
      }
      if (
        input.action.ruleId !== "customer-risk" ||
        input.action.descriptorFingerprint !== customerInspection().fingerprint ||
        input.action.expectedRevision !== revision
      ) {
        return {
          kind: "problem",
          problem: {
            code: "admin-react/lifecycle-action-intent-stale",
            message: "Review the current descriptor before retrying.",
            source: "rules",
          },
        };
      }
      const nextState: Partial<Record<LifecycleRuleAdminAction["command"], RuleState>> = {
        activate: "active",
        pause: "paused",
        resume: "active",
        supersede: "superseded",
      };
      customerState = nextState[input.action.command] ?? customerState;
      revision += 1;
      commandResults.set(input.idempotencyKey, { signature, revision });
      return { kind: "succeeded", replayed: false, revision };
    },
    dryRun: async (request, grantedPermissions) => {
      if (!grantedPermissions.includes("lifecycle:dry-run")) {
        return {
          kind: "denied",
          problem: {
            code: "admin-react/lifecycle-dry-run-permission-denied",
            message: "Permission 'lifecycle:dry-run' is required.",
            source: "access",
          },
        };
      }
      if (request.fixtureId !== "at-risk-tenant") {
        return {
          kind: "invalid",
          problem: {
            code: "admin-react/lifecycle-dry-run-fixture-not-found",
            message: "The redacted fixture was not found.",
            source: "dry-run",
          },
        };
      }
      return {
        kind: "succeeded",
        evidence: {
          kind: "dry-run",
          result: {
            tenantId: "tenant_acme",
            signal: {
              id: "fixture-risk",
              type: "health.score.dropped",
              occurredAt: demoAt,
            },
            evaluatedAt: demoAt,
            ruleId: "customer-risk",
            ruleVersion: "2026-07-26",
            ruleFingerprint: customerInspection().fingerprint,
            state: customerState,
            matched: true,
            conditionEvidence: { belowRiskThreshold: true },
            proposedActions: customerInspection().actions,
            suppression: { suppressed: false },
            problems: [],
          },
        },
      };
    },
  };

  Object.assign(source, {
    evaluateCustomerSignal(input: {
      readonly signalId: string;
      readonly at: Date;
      readonly healthScore: number;
    }) {
      const cooldownActive =
        lastSuccessfulAt !== undefined && input.at.getTime() - lastSuccessfulAt.getTime() < 60_000;
      const skipReason =
        customerState === "paused"
          ? "rule_paused"
          : cooldownActive
            ? "cooldown_active"
            : input.healthScore >= 60
              ? "condition_not_met"
              : undefined;
      const status = skipReason ? "skipped" : "succeeded";
      if (status === "succeeded") {
        lastSuccessfulAt = input.at;
      }
      runs.unshift({
        id: `run-${input.signalId}`,
        ruleId: "customer-risk",
        ruleVersion: "2026-07-26",
        ruleFingerprint: customerInspection().fingerprint,
        tenantId: "tenant_acme",
        signalType: "health.score.dropped",
        signalId: input.signalId,
        severity: "high",
        status,
        idempotencyKey: input.signalId,
        skipReason,
        actionResults:
          status === "succeeded"
            ? [
                {
                  actionId: "notify-customer-success",
                  type: "notification",
                  status: "success",
                },
              ]
            : [],
        startedAt: input.at,
        completedAt: input.at,
      });
    },
    evaluateRenewalFailure(at: Date) {
      runs.unshift({
        id: "run-renewal-action-failure",
        ruleId: "renewal-risk",
        ruleVersion: "2026-07-26",
        ruleFingerprint: "descriptor-renewal-risk-v1",
        tenantId: "tenant_acme",
        signalType: "health.score.dropped",
        signalId: "renewal-action-failure",
        severity: "critical",
        status: "failed",
        idempotencyKey: "renewal-action-failure",
        actionResults: [
          {
            actionId: "open-recovery-task",
            type: "task",
            status: "failure",
            error: {
              code: "lifecycle-core/in-memory-action-failed",
              message: "Redacted provider failure",
            },
          },
        ],
        error: {
          code: "lifecycle-core/in-memory-action-failed",
          message: "Redacted provider failure",
        },
        startedAt: at,
        completedAt: at,
      });
    },
  });

  return source as GeneratedLifecycleSource;
}

async function requireRuleAction(
  source: LifecycleAutomationSource,
  command: LifecycleRuleAdminAction["command"],
): Promise<LifecycleRuleAdminAction> {
  const state = await loadLifecycleAutomationConsole({
    source,
    grantedPermissions: permissions,
    generatedAt: demoAt,
  });
  const action =
    state.kind === "ready"
      ? state.rules
          .filter((rule) => rule.inspection.ruleId === "customer-risk")
          .flatMap((rule) => rule.actions)
          .find((candidate) => candidate.command === command)
      : undefined;
  if (!action) {
    throw new LifecycleAutomationDemoProblem(`Lifecycle demo action '${command}' is unavailable`);
  }
  return action;
}

async function executeAuditedAction(
  source: LifecycleAutomationSource,
  command: LifecycleRuleAdminAction["command"],
  idempotencyKey: string,
  reason: string,
): Promise<string> {
  const action = await requireRuleAction(source, command);
  const result = await source.executeRuleAction({
    action,
    actor: "demo-operator",
    reason,
    idempotencyKey,
    grantedPermissions: permissions,
  });
  if (result.kind !== "succeeded") {
    throw new LifecycleAutomationDemoProblem(result.problem.code);
  }
  return `${command} · revision ${result.revision} · ${idempotencyKey}`;
}

async function createDemoRuntime(): Promise<DemoRuntime> {
  const source = createGeneratedLifecycleSource();
  const auditEvidence = [
    await executeAuditedAction(
      source,
      "activate",
      "demo-activate-customer-risk",
      "Approve the reviewed rule descriptor for the demo.",
    ),
  ];
  const dryRunResult = await source.dryRun(
    { ruleId: "customer-risk", fixtureId: "at-risk-tenant" },
    permissions,
  );
  if (dryRunResult.kind !== "succeeded") {
    throw new LifecycleAutomationDemoProblem(dryRunResult.problem.code);
  }

  source.evaluateCustomerSignal({
    signalId: "production-match",
    at: new Date(demoAt.getTime() + 1_000),
    healthScore: 52,
  });
  source.evaluateCustomerSignal({
    signalId: "cooldown-suppression",
    at: new Date(demoAt.getTime() + 2_000),
    healthScore: 52,
  });
  auditEvidence.push(
    await executeAuditedAction(
      source,
      "pause",
      "demo-pause-customer-risk",
      "Pause while the operator verifies recent matches.",
    ),
  );
  source.evaluateCustomerSignal({
    signalId: "paused-signal",
    at: new Date(demoAt.getTime() + 3_000),
    healthScore: 52,
  });
  auditEvidence.push(
    await executeAuditedAction(
      source,
      "resume",
      "demo-resume-customer-risk",
      "Resume future signal handling after verification.",
    ),
  );
  source.evaluateRenewalFailure(new Date(demoAt.getTime() + 4_000));

  return { source, auditEvidence, dryRun: dryRunResult.evidence };
}

async function loadState(
  runtime: DemoRuntime,
  dryRun: LifecycleDryRunResponse = {
    kind: "succeeded",
    evidence: runtime.dryRun,
  },
): Promise<LifecycleAutomationConsoleState> {
  return loadLifecycleAutomationConsole({
    source: runtime.source,
    grantedPermissions: permissions,
    dryRun,
  });
}

export function LifecycleAutomationDemo() {
  const [runtime, setRuntime] = useState<DemoRuntime>();
  const [state, setState] = useState<LifecycleAutomationConsoleState>(() =>
    createLifecycleAutomationLoadingState(),
  );
  const [auditEvidence, setAuditEvidence] = useState<readonly string[]>([]);

  useEffect(() => {
    let active = true;
    void createDemoRuntime().then(async (created) => {
      const loaded = await loadState(created);
      if (active) {
        setRuntime(created);
        setAuditEvidence(created.auditEvidence);
        setState(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function runAction(action: LifecycleRuleAdminAction) {
    if (!runtime) {
      return;
    }
    const idempotencyKey = `demo-${action.command}-${action.expectedRevision}`;
    const result = await runtime.source.executeRuleAction({
      action,
      actor: "demo-operator",
      reason: `Run ${action.command} from the generated lifecycle console.`,
      idempotencyKey,
      grantedPermissions: permissions,
    });
    setAuditEvidence((current) => [
      ...current,
      result.kind === "succeeded"
        ? `${action.command} · revision ${result.revision} · ${idempotencyKey}`
        : `${action.command} · ${result.problem.code}`,
    ]);
    setState(await loadState(runtime));
  }

  async function runDryRun(fixtureId: string) {
    if (!runtime) {
      return;
    }
    const result = await runtime.source.dryRun({ ruleId: "customer-risk", fixtureId }, permissions);
    setState(await loadState(runtime, result));
  }

  return (
    <section aria-label="Generated lifecycle automation demo">
      <LifecycleAutomationConsole
        state={state}
        onDryRunFixture={(fixtureId) => void runDryRun(fixtureId)}
        onRuleAction={(action) => void runAction(action)}
      />
      <section aria-labelledby="lifecycle-demo-audit-heading">
        <h2 id="lifecycle-demo-audit-heading">Demo audit evidence</h2>
        <ul>
          {auditEvidence.map((evidence) => (
            <li key={evidence}>{evidence}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
