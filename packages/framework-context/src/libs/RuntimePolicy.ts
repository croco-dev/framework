import type { RuntimeCapabilities } from "./types";
import {
  PolicyCapabilityProblem,
  PolicyConflictProblem,
  PolicyDefinitionProblem,
} from "./problems/RuntimePolicyProblems";

export const POLICY_TARGET_KINDS = ["route", "service", "event-handler"] as const;
export const POLICY_KINDS = ["timeout", "retry", "tracing"] as const;
export const POLICY_EXECUTION_ORDER = ["tracing", "timeout", "retry"] as const;

export type PolicyTargetKind = (typeof POLICY_TARGET_KINDS)[number];
export type PolicyKind = (typeof POLICY_KINDS)[number];
export type PolicyRuntimeCapability = "trace";
export type PolicyFailurePropagation =
  | "observe-and-rethrow"
  | "terminal"
  | "retryable-operation-error";

export type PolicySource = {
  readonly packageName?: string;
  readonly file?: string;
  readonly symbol?: string;
  readonly decorator?: string;
};

export type PolicyTarget = {
  readonly kind: PolicyTargetKind;
  readonly id: string;
  readonly operation?: string;
  readonly source?: PolicySource;
};

export type TimeoutPolicy = {
  readonly kind: "timeout";
  readonly timeoutMs: number;
  readonly scope?: "operation" | "attempt";
  readonly onTimeout?: "abort" | "fail";
};

export type RetryPolicyDefinition = {
  readonly kind: "retry";
  readonly maxAttempts: number;
  readonly backoffMs?: number;
  readonly retryOn?: readonly string[];
  readonly onExhausted?: "throw-last-error" | "throw-problem";
};

export type TracingPolicy = {
  readonly kind: "tracing";
  readonly spanName?: string;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly recordErrors?: boolean;
};

export type RuntimePolicy = TimeoutPolicy | RetryPolicyDefinition | TracingPolicy;

export type DefinePolicyOptions = {
  readonly override?: boolean;
  readonly order?: number;
  readonly source?: PolicySource;
};

export type PolicyDefinition<TPolicy extends RuntimePolicy = RuntimePolicy> = TPolicy & {
  readonly target: PolicyTarget;
  readonly override?: boolean;
  readonly order?: number;
  readonly source?: PolicySource;
};

export type PolicyExecutionEntry = {
  readonly target: PolicyTarget;
  readonly policy: RuntimePolicy;
  readonly order: number;
  readonly requiredCapabilities: readonly PolicyRuntimeCapability[];
  readonly failurePropagation: PolicyFailurePropagation;
  readonly source?: PolicySource;
};

export type PolicyFailurePropagationEntry = {
  readonly kind: PolicyKind;
  readonly failurePropagation: PolicyFailurePropagation;
};

export type PolicyExecutionPlan = {
  readonly target: PolicyTarget;
  readonly entries: readonly PolicyExecutionEntry[];
  readonly executionOrder: readonly PolicyKind[];
  readonly failurePropagation: readonly PolicyFailurePropagationEntry[];
};

export type PolicyTable = {
  readonly plans: readonly PolicyExecutionPlan[];
};

type PolicyTargetGroup = {
  readonly target: PolicyTarget;
  readonly definitions: PolicyDefinition[];
};

const DEFAULT_POLICY_ORDER: Readonly<Record<PolicyKind, number>> = {
  tracing: 10,
  timeout: 20,
  retry: 30,
};

export function createPolicyTarget(
  kind: PolicyTargetKind,
  id: string,
  options: { readonly operation?: string; readonly source?: PolicySource } = {},
): PolicyTarget {
  return {
    kind,
    id,
    operation: options.operation,
    source: options.source,
  };
}

export function definePolicy<TPolicy extends RuntimePolicy>(
  target: PolicyTarget,
  policy: TPolicy,
  options: DefinePolicyOptions = {},
): PolicyDefinition<TPolicy> {
  return {
    ...policy,
    target,
    override: options.override,
    order: options.order,
    source: options.source,
  };
}

export function compilePolicyTable(definitions: readonly PolicyDefinition[]): PolicyTable {
  const groupsByTarget = new Map<string, PolicyTargetGroup>();

  for (const definition of definitions) {
    assertPolicyDefinition(definition);

    const key = getPolicyTargetKey(definition.target);
    const existing = groupsByTarget.get(key);

    if (existing) {
      existing.definitions.push(definition);
      continue;
    }

    groupsByTarget.set(key, {
      target: definition.target,
      definitions: [definition],
    });
  }

  return {
    plans: Array.from(groupsByTarget.values()).map(compilePolicyPlan),
  };
}

export function getPolicyExecutionPlan(
  table: PolicyTable,
  target: PolicyTarget,
  capabilities: RuntimeCapabilities,
): PolicyExecutionPlan | undefined {
  const key = getPolicyTargetKey(target);
  const plan = table.plans.find((entry) => getPolicyTargetKey(entry.target) === key);

  if (plan) {
    assertPolicyRuntimeCapabilities(plan, capabilities);
  }

  return plan;
}

export function assertPolicyRuntimeCapabilities(
  plan: PolicyExecutionPlan,
  capabilities: RuntimeCapabilities,
): void {
  for (const entry of plan.entries) {
    for (const capability of entry.requiredCapabilities) {
      if (capability === "trace" && !capabilities.trace) {
        throw new PolicyCapabilityProblem(
          `Policy '${entry.policy.kind}' for ${formatPolicyTarget(entry.target)} requires runtime capability 'trace'.`,
        );
      }
    }
  }
}

function compilePolicyPlan(group: PolicyTargetGroup): PolicyExecutionPlan {
  const definitionsByKind = new Map<PolicyKind, PolicyDefinition>();

  for (const definition of group.definitions) {
    const current = definitionsByKind.get(definition.kind);

    if (current && definition.override !== true) {
      throw new PolicyConflictProblem(
        `Policy '${definition.kind}' for ${formatPolicyTarget(group.target)} is declared more than once. ` +
          "Use an explicit override to replace an existing policy.",
      );
    }

    definitionsByKind.set(definition.kind, definition);
  }

  const entries = Array.from(definitionsByKind.values())
    .map(toExecutionEntry)
    .sort(
      (left, right) =>
        left.order - right.order ||
        getDefaultPolicyOrder(left.policy.kind) - getDefaultPolicyOrder(right.policy.kind),
    );

  return {
    target: group.target,
    entries,
    executionOrder: entries.map((entry) => entry.policy.kind),
    failurePropagation: entries.map((entry) => ({
      kind: entry.policy.kind,
      failurePropagation: entry.failurePropagation,
    })),
  };
}

function toExecutionEntry(definition: PolicyDefinition): PolicyExecutionEntry {
  return {
    target: definition.target,
    policy: toRuntimePolicy(definition),
    order: definition.order ?? getDefaultPolicyOrder(definition.kind),
    requiredCapabilities: getRequiredCapabilities(definition),
    failurePropagation: getFailurePropagation(definition.kind),
    source: definition.source,
  };
}

function toRuntimePolicy(definition: PolicyDefinition): RuntimePolicy {
  switch (definition.kind) {
    case "timeout":
      return {
        kind: definition.kind,
        timeoutMs: definition.timeoutMs,
        scope: definition.scope,
        onTimeout: definition.onTimeout,
      };
    case "retry":
      return {
        kind: definition.kind,
        maxAttempts: definition.maxAttempts,
        backoffMs: definition.backoffMs,
        retryOn: definition.retryOn,
        onExhausted: definition.onExhausted,
      };
    case "tracing":
      return {
        kind: definition.kind,
        spanName: definition.spanName,
        attributes: definition.attributes,
        recordErrors: definition.recordErrors,
      };
  }
}

function getRequiredCapabilities(definition: PolicyDefinition): readonly PolicyRuntimeCapability[] {
  if (definition.kind === "tracing") {
    return ["trace"];
  }

  return [];
}

function getFailurePropagation(kind: PolicyKind): PolicyFailurePropagation {
  switch (kind) {
    case "tracing":
      return "observe-and-rethrow";
    case "timeout":
      return "terminal";
    case "retry":
      return "retryable-operation-error";
  }
}

function assertPolicyDefinition(definition: PolicyDefinition): void {
  assertPolicyTarget(definition.target);

  const kind = getDefinitionKind(definition);

  if (!isPolicyKind(kind)) {
    throw new PolicyDefinitionProblem(
      `Unsupported policy kind '${kind}' for ${formatPolicyTarget(definition.target)}.`,
    );
  }

  if (
    definition.order !== undefined &&
    (!Number.isInteger(definition.order) || definition.order < 0)
  ) {
    throw new PolicyDefinitionProblem(
      `Policy '${definition.kind}' for ${formatPolicyTarget(definition.target)} must use a non-negative integer order.`,
    );
  }

  switch (definition.kind) {
    case "timeout":
      assertPositiveInteger(
        definition.timeoutMs,
        `Policy 'timeout' for ${formatPolicyTarget(definition.target)} must use a positive timeoutMs.`,
      );
      assertAllowedValue(
        definition.scope,
        ["operation", "attempt"],
        `Policy 'timeout' for ${formatPolicyTarget(definition.target)} has unsupported scope.`,
      );
      assertAllowedValue(
        definition.onTimeout,
        ["abort", "fail"],
        `Policy 'timeout' for ${formatPolicyTarget(definition.target)} has unsupported onTimeout behavior.`,
      );
      return;
    case "retry":
      assertPositiveInteger(
        definition.maxAttempts,
        `Policy 'retry' for ${formatPolicyTarget(definition.target)} must use a positive maxAttempts.`,
      );

      if (definition.backoffMs !== undefined) {
        assertNonNegativeInteger(
          definition.backoffMs,
          `Policy 'retry' for ${formatPolicyTarget(definition.target)} must use a non-negative backoffMs.`,
        );
      }

      assertAllowedValue(
        definition.onExhausted,
        ["throw-last-error", "throw-problem"],
        `Policy 'retry' for ${formatPolicyTarget(definition.target)} has unsupported onExhausted behavior.`,
      );
      return;
    case "tracing":
      if (definition.spanName !== undefined && definition.spanName.trim().length === 0) {
        throw new PolicyDefinitionProblem(
          `Policy 'tracing' for ${formatPolicyTarget(definition.target)} must not use an empty spanName.`,
        );
      }
      return;
  }
}

function assertPolicyTarget(target: PolicyTarget): void {
  if (!isPolicyTargetKind(target.kind)) {
    throw new PolicyDefinitionProblem(`Unsupported policy target kind '${String(target.kind)}'.`);
  }

  if (target.id.trim().length === 0) {
    throw new PolicyDefinitionProblem(`Policy target '${target.kind}' must use a non-empty id.`);
  }
}

function getDefinitionKind(definition: PolicyDefinition): string {
  return (definition as { readonly kind: string }).kind;
}

function getDefaultPolicyOrder(kind: PolicyKind): number {
  return DEFAULT_POLICY_ORDER[kind];
}

function getPolicyTargetKey(target: PolicyTarget): string {
  return `${target.kind}:${target.id}:${target.operation ?? ""}`;
}

function formatPolicyTarget(target: PolicyTarget): string {
  const operation = target.operation ? `#${target.operation}` : "";
  return `${target.kind} '${target.id}${operation}'`;
}

function assertPositiveInteger(value: number, detail: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new PolicyDefinitionProblem(detail);
  }
}

function assertNonNegativeInteger(value: number, detail: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new PolicyDefinitionProblem(detail);
  }
}

function assertAllowedValue<TValue extends string>(
  value: TValue | undefined,
  allowed: readonly TValue[],
  detail: string,
): void {
  if (value !== undefined && !allowed.includes(value)) {
    throw new PolicyDefinitionProblem(detail);
  }
}

function isPolicyKind(value: string): value is PolicyKind {
  return (POLICY_KINDS as readonly string[]).includes(value);
}

function isPolicyTargetKind(value: string): value is PolicyTargetKind {
  return (POLICY_TARGET_KINDS as readonly string[]).includes(value);
}
