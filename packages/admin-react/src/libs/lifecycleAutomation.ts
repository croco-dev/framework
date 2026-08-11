import type {
  RetryConsoleItem,
  RetryConsoleCorrelationIds,
  RetryConsoleRecoveryAction,
} from "@croco/admin-ops";
import type { AdminAction } from "@croco/admin-core";
import type {
  LifecycleActionStatus,
  LifecycleContext,
  LifecycleDryRunResult,
  LifecycleRuleActivationCommandType,
  LifecycleRuleEvaluator,
  LifecycleRuleInspection,
  LifecycleRuleRegistry,
  LifecycleRun,
  LifecycleRunStore,
} from "@croco/lifecycle-core";

export type LifecycleOperationsProblem = {
  readonly code: string;
  readonly message: string;
  readonly source: "access" | "dry-run" | "recovery" | "rules" | "runs";
};

export type LifecycleDescriptorDiff = {
  readonly field:
    | "actions"
    | "contextRequirements"
    | "cooldownDurationMs"
    | "executableFingerprint"
    | "severity"
    | "triggers";
  readonly previous: string;
  readonly next: string;
};

export type LifecycleRuleAdminAction = AdminAction & {
  readonly id: string;
  readonly command: LifecycleRuleActivationCommandType;
  readonly label: string;
  readonly permission: "lifecycle:write";
  readonly ruleId: string;
  readonly version: string;
  readonly expectedRevision: number;
  readonly descriptorFingerprint: string;
  readonly requiredInput: {
    readonly actor: true;
    readonly reason: true;
    readonly idempotencyKey: true;
  };
  readonly warning?: string;
};

export type LifecycleRuleOperation = {
  readonly inspection: LifecycleRuleInspection;
  readonly activeVersion?: string;
  readonly descriptorDiff: readonly LifecycleDescriptorDiff[];
  readonly actions: readonly LifecycleRuleAdminAction[];
};

export type LifecycleRunActionEvidence = Omit<LifecycleRun["actionResults"][number], "error"> & {
  readonly error?: { readonly code: string };
};

export type LifecycleRunEvidence = Omit<
  LifecycleRun,
  "actionResults" | "error" | "idempotencyKey"
> & {
  readonly actionResults: readonly LifecycleRunActionEvidence[];
  readonly error?: { readonly code: string };
};

export type LifecycleRunOutcome =
  | "completed"
  | "failed-action"
  | "reconciliation-required"
  | "not-matched"
  | "suppressed"
  | "suppressed-cooldown";

export type LifecycleRunOperation = {
  readonly run: LifecycleRunEvidence;
  readonly outcome: LifecycleRunOutcome;
  readonly problem?: LifecycleOperationsProblem;
  readonly recovery?: RetryConsoleRecoveryAction;
  readonly correlationIds: RetryConsoleCorrelationIds;
  readonly links?: {
    readonly tenantHref?: string;
    readonly operationsHref?: string;
  };
};

export type LifecycleDryRunFixtureDescriptor = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tenantId?: string;
};

export type LifecycleDryRunEvidence = {
  readonly kind: "dry-run";
  readonly result: LifecycleDryRunResult;
};

export type LifecycleRunFilters = {
  readonly tenantId?: string;
  readonly ruleId?: string;
  readonly version?: string;
  readonly signalType?: string;
  readonly outcome?: LifecycleRunOutcome;
  readonly actionState?: LifecycleActionStatus;
  readonly problemCode?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
};

export type LifecycleAutomationLoadingState = {
  readonly kind: "loading";
  readonly generatedAt: Date;
};

export type LifecycleAutomationEmptyState = {
  readonly kind: "empty";
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly fixtures: readonly LifecycleDryRunFixtureDescriptor[];
  readonly dryRun?: LifecycleDryRunResponse;
  readonly problems: readonly LifecycleOperationsProblem[];
};

export type LifecycleAutomationPermissionDeniedState = {
  readonly kind: "permission-denied";
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly requiredPermissions: readonly ["lifecycle:read"];
  readonly problem: LifecycleOperationsProblem;
};

export type LifecycleAutomationReadyState = {
  readonly kind: "ready";
  readonly generatedAt: Date;
  readonly grantedPermissions: readonly string[];
  readonly rules: readonly LifecycleRuleOperation[];
  readonly runs: readonly LifecycleRunOperation[];
  readonly fixtures: readonly LifecycleDryRunFixtureDescriptor[];
  readonly dryRun?: LifecycleDryRunResponse;
  readonly problems: readonly LifecycleOperationsProblem[];
};

export type LifecycleAutomationConsoleState =
  | LifecycleAutomationLoadingState
  | LifecycleAutomationEmptyState
  | LifecycleAutomationPermissionDeniedState
  | LifecycleAutomationReadyState;

export type LifecycleRuleActionInput = {
  readonly action: LifecycleRuleAdminAction;
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly grantedPermissions: readonly string[];
};

export type LifecycleRuleActionResult =
  | {
      readonly kind: "succeeded";
      readonly replayed: boolean;
      readonly revision: number;
    }
  | {
      readonly kind: "denied" | "invalid" | "problem";
      readonly problem: LifecycleOperationsProblem;
    };

export type LifecycleDryRunRequest =
  | {
      readonly ruleId: string;
      readonly version?: string;
      readonly fixtureId: string;
      readonly pastedContext?: never;
    }
  | {
      readonly ruleId: string;
      readonly version?: string;
      readonly fixtureId?: never;
      readonly pastedContext: unknown;
    };

export type LifecycleDryRunResponse =
  | {
      readonly kind: "succeeded";
      readonly evidence: LifecycleDryRunEvidence;
    }
  | {
      readonly kind: "denied" | "invalid" | "problem";
      readonly problem: LifecycleOperationsProblem;
    };

export interface LifecycleAutomationSource {
  inspectRules(): Promise<readonly LifecycleRuleInspection[]>;
  listRuns(filters?: LifecycleRunFilters): Promise<readonly LifecycleRun[]>;
  listRecoveryItems?(): Promise<readonly RetryConsoleItem[]>;
  runLinks?(run: LifecycleRun): LifecycleRunOperation["links"];
  listDryRunFixtures(): readonly LifecycleDryRunFixtureDescriptor[];
  executeRuleAction(input: LifecycleRuleActionInput): Promise<LifecycleRuleActionResult>;
  dryRun(
    request: LifecycleDryRunRequest,
    grantedPermissions: readonly string[],
  ): Promise<LifecycleDryRunResponse>;
}

export type LifecycleDryRunFixture = LifecycleDryRunFixtureDescriptor & {
  readonly resolve: () => LifecycleContext | Promise<LifecycleContext>;
};

export type LifecycleAutomationSourceOptions = {
  readonly registry: LifecycleRuleRegistry;
  readonly evaluator: LifecycleRuleEvaluator;
  readonly runStore: Pick<LifecycleRunStore, "list">;
  readonly fixtures?: readonly LifecycleDryRunFixture[];
  readonly parsePastedContext?: (input: unknown) => LifecycleContext | Promise<LifecycleContext>;
  readonly listRecoveryItems?: () => Promise<readonly RetryConsoleItem[]>;
  readonly runLinks?: (run: LifecycleRun) => LifecycleRunOperation["links"];
};

export type LoadLifecycleAutomationOptions = {
  readonly source: LifecycleAutomationSource;
  readonly grantedPermissions: readonly string[];
  readonly filters?: LifecycleRunFilters;
  readonly dryRun?: LifecycleDryRunResponse;
  readonly generatedAt?: Date;
};

function problem(
  code: string,
  message: string,
  source: LifecycleOperationsProblem["source"],
): LifecycleOperationsProblem {
  return { code, message, source };
}

function safeFailure(source: LifecycleOperationsProblem["source"]): LifecycleOperationsProblem {
  return problem(
    `admin-react/lifecycle-${source}-unavailable`,
    `Lifecycle ${source} could not be loaded. Inspect the server-side Problem evidence.`,
    source,
  );
}

function normalize(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value === undefined ? "not declared" : String(value);
}

export function diffLifecycleRuleDescriptors(
  previous: LifecycleRuleInspection,
  next: LifecycleRuleInspection,
): readonly LifecycleDescriptorDiff[] {
  const fields: readonly LifecycleDescriptorDiff["field"][] = [
    "triggers",
    "severity",
    "cooldownDurationMs",
    "contextRequirements",
    "actions",
    "executableFingerprint",
  ];

  return fields.flatMap((field) => {
    const previousValue = normalize(previous[field]);
    const nextValue = normalize(next[field]);
    return previousValue === nextValue ? [] : [{ field, previous: previousValue, next: nextValue }];
  });
}

function actionsForInspection(
  inspection: LifecycleRuleInspection,
): readonly LifecycleRuleAdminAction[] {
  const base = {
    permission: "lifecycle:write" as const,
    target: "record" as const,
    permissions: [
      {
        permissions: ["lifecycle:write"],
        resource: `${inspection.ruleId}:${inspection.version}`,
      },
    ] as const,
    audit: {
      eventName: "lifecycle.rule.transition",
      subjectType: "lifecycle-rule-version",
      actor: "required" as const,
      reason: "required" as const,
      idempotencyKey: "required" as const,
      metadata: {
        expectedRevision: inspection.revision,
        descriptorFingerprint: inspection.fingerprint,
      },
    },
    problems: [
      {
        code: "admin-react/lifecycle-action-intent-stale",
        category: "Conflict",
        status: 409,
        retryable: true,
      },
      {
        code: "admin-react/lifecycle-action-permission-denied",
        category: "Forbidden",
        status: 403,
        retryable: false,
      },
    ] as const,
    idempotency: "required" as const,
    ruleId: inspection.ruleId,
    version: inspection.version,
    expectedRevision: inspection.revision,
    descriptorFingerprint: inspection.fingerprint,
    requiredInput: {
      actor: true as const,
      reason: true as const,
      idempotencyKey: true as const,
    },
  };

  switch (inspection.state) {
    case "registered":
    case "inactive":
      return [
        {
          ...base,
          id: `activate:${inspection.ruleId}:${inspection.version}`,
          command: "activate",
          kind: "activate",
          label: "Activate",
          mutability: "write",
        },
      ];
    case "active":
      return [
        {
          ...base,
          id: `pause:${inspection.ruleId}:${inspection.version}`,
          command: "pause",
          kind: "pause",
          label: "Pause",
          mutability: "write",
        },
        {
          ...base,
          id: `supersede:${inspection.ruleId}:${inspection.version}`,
          command: "supersede",
          kind: "supersede",
          label: "Supersede",
          mutability: "destructive",
        },
      ];
    case "paused":
      return [
        {
          ...base,
          id: `resume:${inspection.ruleId}:${inspection.version}`,
          command: "resume",
          kind: "resume",
          label: "Resume",
          mutability: "write",
          warning: "Resume affects future signals only; historical signals are not replayed.",
        },
        {
          ...base,
          id: `supersede:${inspection.ruleId}:${inspection.version}`,
          command: "supersede",
          kind: "supersede",
          label: "Supersede",
          mutability: "destructive",
        },
      ];
    case "superseded":
    case "unavailable":
      return [];
  }
}

function buildRuleOperations(
  inspections: readonly LifecycleRuleInspection[],
): readonly LifecycleRuleOperation[] {
  return inspections.map((inspection) => {
    const siblings = inspections.filter((candidate) => candidate.ruleId === inspection.ruleId);
    const active = siblings.find(
      (candidate) => candidate.state === "active" || candidate.state === "paused",
    );

    return {
      inspection,
      activeVersion: active?.version,
      descriptorDiff:
        active && active.version !== inspection.version
          ? diffLifecycleRuleDescriptors(active, inspection)
          : [],
      actions: actionsForInspection(inspection),
    };
  });
}

export function classifyLifecycleRun(run: LifecycleRun): LifecycleRunOutcome {
  if (run.status === "indeterminate") {
    return "reconciliation-required";
  }
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

function findRecovery(item: RetryConsoleItem | undefined): RetryConsoleRecoveryAction | undefined {
  return item?.recoveryActions.find(
    (action) => action.allowed && (action.kind === "retry" || action.kind === "replay"),
  );
}

function findReconciliation(
  item: RetryConsoleItem | undefined,
): RetryConsoleRecoveryAction | undefined {
  return item?.recoveryActions.find((action) => action.allowed && action.kind === "inspect");
}

function buildRunOperation(
  run: LifecycleRun,
  recoveryItems: readonly RetryConsoleItem[],
  links?: LifecycleRunOperation["links"],
): LifecycleRunOperation {
  const failure = run.error ?? run.actionResults.find((result) => result.error)?.error;
  const recoveryItem = recoveryItems.find((item) => item.correlationIds.lifecycleRunId === run.id);
  const reconciliationRequired = run.status === "indeterminate";
  const safeRun: LifecycleRunEvidence = {
    id: run.id,
    ruleId: run.ruleId,
    ruleVersion: run.ruleVersion,
    ruleFingerprint: run.ruleFingerprint,
    tenantId: run.tenantId,
    signalType: run.signalType,
    signalId: run.signalId,
    severity: run.severity,
    status: run.status,
    skipReason: run.skipReason,
    actionResults: run.actionResults.map(({ error, ...result }) => ({
      ...result,
      error: error ? { code: error.code ?? "lifecycle-core/action-failed" } : undefined,
    })),
    error: run.error ? { code: run.error.code ?? "lifecycle-core/run-failed" } : undefined,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  };
  return {
    run: safeRun,
    outcome: classifyLifecycleRun(run),
    problem: reconciliationRequired
      ? problem(
          "lifecycle-core/run-indeterminate",
          "Lifecycle action dispatch may have completed. Reconcile provider evidence before finalizing; do not replay the run.",
          "runs",
        )
      : failure
        ? problem(
            failure.code ?? "lifecycle-core/run-failed",
            "Lifecycle execution failed. Inspect the linked server-side Problem evidence.",
            "runs",
          )
        : undefined,
    recovery: reconciliationRequired
      ? findReconciliation(recoveryItem)
      : findRecovery(recoveryItem),
    correlationIds: recoveryItem?.correlationIds ?? {
      lifecycleRunId: run.id,
      lifecycleRuleId: run.ruleId,
      tenantId: run.tenantId,
      signalId: run.signalId,
    },
    links,
  };
}

function matchesRunFilters(run: LifecycleRun, filters: LifecycleRunFilters): boolean {
  const outcome = classifyLifecycleRun(run);
  const problemCode =
    run.error?.code ?? run.actionResults.find((result) => result.error)?.error?.code;

  return (
    (filters.tenantId === undefined || run.tenantId === filters.tenantId) &&
    (filters.ruleId === undefined || run.ruleId === filters.ruleId) &&
    (filters.version === undefined || run.ruleVersion === filters.version) &&
    (filters.signalType === undefined || run.signalType === filters.signalType) &&
    (filters.outcome === undefined || outcome === filters.outcome) &&
    (filters.actionState === undefined ||
      run.actionResults.some((result) => result.status === filters.actionState)) &&
    (filters.problemCode === undefined || problemCode === filters.problemCode) &&
    (filters.from === undefined || run.completedAt >= filters.from) &&
    (filters.to === undefined || run.startedAt <= filters.to)
  );
}

function invalidAction(message: string): LifecycleRuleActionResult {
  return {
    kind: "invalid",
    problem: problem("admin-react/lifecycle-action-invalid", message, "access"),
  };
}

export function createLifecycleAutomationSource(
  options: LifecycleAutomationSourceOptions,
): LifecycleAutomationSource {
  const fixtures = options.fixtures ?? [];

  return {
    inspectRules: () => options.registry.inspect(),

    async listRuns(filters = {}): Promise<readonly LifecycleRun[]> {
      const runs = await options.runStore.list({
        tenantId: filters.tenantId,
        ruleId: filters.ruleId,
      });
      const filtered = runs.filter((run) => matchesRunFilters(run, filters));
      return filters.limit === undefined ? filtered : filtered.slice(0, Math.max(0, filters.limit));
    },

    listRecoveryItems: options.listRecoveryItems,

    runLinks: options.runLinks,

    listDryRunFixtures: () => fixtures.map(({ resolve: _resolve, ...descriptor }) => descriptor),

    async executeRuleAction(input): Promise<LifecycleRuleActionResult> {
      if (!input.grantedPermissions.includes(input.action.permission)) {
        return {
          kind: "denied",
          problem: problem(
            "admin-react/lifecycle-action-permission-denied",
            `Permission '${input.action.permission}' is required.`,
            "access",
          ),
        };
      }
      if (
        input.actor.trim() === "" ||
        input.reason.trim() === "" ||
        input.idempotencyKey.trim() === ""
      ) {
        return invalidAction("Actor, reason, and idempotency key are required.");
      }

      const current = (await options.registry.inspect()).find(
        (inspection) =>
          inspection.ruleId === input.action.ruleId && inspection.version === input.action.version,
      );
      if (current === undefined || current.fingerprint !== input.action.descriptorFingerprint) {
        return {
          kind: "problem",
          problem: problem(
            "admin-react/lifecycle-action-intent-stale",
            "The rule descriptor or optimistic revision changed. Review the current version before retrying.",
            "rules",
          ),
        };
      }

      try {
        const command = {
          actor: input.actor,
          commandId: input.idempotencyKey,
          expectedRevision: input.action.expectedRevision,
          reason: input.reason,
          ruleId: input.action.ruleId,
          version: input.action.version,
        };
        const mutation = await options.registry[input.action.command](command);
        return {
          kind: "succeeded",
          replayed: mutation.replayed,
          revision: mutation.state.revision,
        };
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : undefined;
        if (code === "lifecycle-core/rule-version-conflict") {
          return {
            kind: "problem",
            problem: problem(
              "admin-react/lifecycle-action-intent-stale",
              "The rule descriptor or optimistic revision changed. Review the current version before retrying.",
              "rules",
            ),
          };
        }
        if (code === "lifecycle-core/rule-command-conflict") {
          return {
            kind: "problem",
            problem: problem(
              "admin-react/lifecycle-action-idempotency-conflict",
              "The idempotency key was already used for different lifecycle action input.",
              "rules",
            ),
          };
        }
        return {
          kind: "problem",
          problem: safeFailure("rules"),
        };
      }
    },

    async dryRun(request, grantedPermissions): Promise<LifecycleDryRunResponse> {
      if (!grantedPermissions.includes("lifecycle:dry-run")) {
        return {
          kind: "denied",
          problem: problem(
            "admin-react/lifecycle-dry-run-permission-denied",
            "Permission 'lifecycle:dry-run' is required.",
            "access",
          ),
        };
      }

      let context: LifecycleContext;
      try {
        if (request.fixtureId !== undefined) {
          const fixture = fixtures.find((candidate) => candidate.id === request.fixtureId);
          if (!fixture) {
            return {
              kind: "invalid",
              problem: problem(
                "admin-react/lifecycle-dry-run-fixture-not-found",
                `Dry-run fixture '${request.fixtureId}' was not found.`,
                "dry-run",
              ),
            };
          }
          context = await fixture.resolve();
        } else {
          if (!options.parsePastedContext) {
            return {
              kind: "denied",
              problem: problem(
                "admin-react/lifecycle-pasted-context-disabled",
                "Pasted contexts are disabled because no server-side schema validator is configured.",
                "access",
              ),
            };
          }
          try {
            context = await options.parsePastedContext(request.pastedContext);
          } catch {
            return {
              kind: "invalid",
              problem: problem(
                "admin-react/lifecycle-pasted-context-invalid",
                "The pasted context did not satisfy the configured schema.",
                "dry-run",
              ),
            };
          }
        }
        const result = await options.evaluator.dryRun({
          context,
          ruleId: request.ruleId,
          version: request.version,
        });
        return { kind: "succeeded", evidence: { kind: "dry-run", result } };
      } catch {
        return { kind: "problem", problem: safeFailure("dry-run") };
      }
    },
  };
}

export function createLifecycleAutomationLoadingState(
  generatedAt = new Date(),
): LifecycleAutomationLoadingState {
  return { kind: "loading", generatedAt };
}

export async function loadLifecycleAutomationConsole(
  options: LoadLifecycleAutomationOptions,
): Promise<LifecycleAutomationConsoleState> {
  const generatedAt = options.generatedAt ?? new Date();
  if (!options.grantedPermissions.includes("lifecycle:read")) {
    return {
      kind: "permission-denied",
      generatedAt,
      grantedPermissions: options.grantedPermissions,
      requiredPermissions: ["lifecycle:read"],
      problem: problem(
        "admin-react/lifecycle-read-permission-denied",
        "Permission 'lifecycle:read' is required.",
        "access",
      ),
    };
  }

  const [rulesResult, runsResult, recoveryResult, fixturesResult] = await Promise.allSettled([
    options.source.inspectRules(),
    options.source.listRuns(options.filters),
    options.source.listRecoveryItems?.() ?? Promise.resolve([]),
    Promise.resolve().then(() => options.source.listDryRunFixtures()),
  ]);
  const problems: LifecycleOperationsProblem[] = [];
  const inspections = rulesResult.status === "fulfilled" ? rulesResult.value : [];
  if (rulesResult.status === "rejected") {
    problems.push(safeFailure("rules"));
  }
  const runs = runsResult.status === "fulfilled" ? runsResult.value : [];
  if (runsResult.status === "rejected") {
    problems.push(safeFailure("runs"));
  }
  const recoveryItems = recoveryResult.status === "fulfilled" ? recoveryResult.value : [];
  if (recoveryResult.status === "rejected") {
    problems.push(safeFailure("recovery"));
  }
  const fixtures = fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
  if (fixturesResult.status === "rejected") {
    problems.push(safeFailure("dry-run"));
  }

  if (inspections.length === 0 && runs.length === 0 && problems.length === 0) {
    return {
      kind: "empty",
      generatedAt,
      grantedPermissions: options.grantedPermissions,
      fixtures,
      dryRun: options.dryRun,
      problems,
    };
  }

  return {
    kind: "ready",
    generatedAt,
    grantedPermissions: options.grantedPermissions,
    rules: buildRuleOperations(inspections),
    runs: runs.map((run) => {
      let links: LifecycleRunOperation["links"];
      try {
        links = options.source.runLinks?.(run);
      } catch {
        if (
          !problems.some((entry) => entry.code === "admin-react/lifecycle-run-links-unavailable")
        ) {
          problems.push(
            problem(
              "admin-react/lifecycle-run-links-unavailable",
              "Lifecycle run links could not be loaded. Run evidence remains available.",
              "runs",
            ),
          );
        }
      }
      return buildRunOperation(run, recoveryItems, links);
    }),
    fixtures,
    dryRun: options.dryRun,
    problems,
  };
}
