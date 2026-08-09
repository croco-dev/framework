import {
  addPolicyDecisionIdExtension,
  createPolicyDecisionTrace,
  recordPolicyDecisionTrace,
  type PolicyDecisionSourceLocation,
  type PolicyDecisionTrace,
  type PolicyDecisionTraceSink,
} from "@croco/access-core";
import { recordEvent } from "@croco/telemetry-api";
import {
  TenantAdminBypassReasonRequiredProblem,
  TenantCrossTenantLeakProblem,
  TenantDefaultFallbackProblem,
  TenantIsolationContextMissingProblem,
  TenantUnsafeQueryProblem,
} from "./problems/TenantIsolationProblems";
import { TenantManager } from "./TenantManager";

export type TenantOperationKind = "repository-read" | "repository-write" | "query" | "command";

export type TenantOperationIsolation = "tenant-scoped" | "admin-bypass" | "system";

export type TenantContextProvider = {
  getTenantId(): string | null;
};

export type TenantContextRequirement<TTenantId extends string = string> = {
  readonly tenantId: TTenantId;
};

const tenantScopedOperationBrand = Symbol("tenantScopedOperation");

export type TenantScopedOperationMarker = {
  readonly [tenantScopedOperationBrand]: true;
};

export type TenantBypassReason = {
  readonly reason: string;
  readonly actorId?: string;
  readonly ticket?: string;
};

export type TenantScopedOperation = TenantScopedOperationMarker & {
  readonly name: string;
  readonly kind: TenantOperationKind;
  readonly isolation?: TenantOperationIsolation;
  readonly resource?: string;
  readonly ruleId?: string;
  readonly sourceLocation?: PolicyDecisionSourceLocation;
  readonly tenantId?: string | null;
  readonly requestedTenantId?: string | null;
  readonly defaultTenantId?: string | null;
  readonly bypass?: TenantBypassReason;
  readonly inputs?: Record<string, unknown>;
  readonly metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type TenantIsolationEvidence = {
  readonly operation: string;
  readonly kind: TenantOperationKind;
  readonly resource?: string;
  readonly status: "tenant-scoped" | "bypassed";
  readonly tenantId: string | null;
  readonly bypassReason?: TenantBypassReason;
};

export type TenantIsolationAuditEvent = {
  readonly type:
    | "tenant-isolation.allowed"
    | "tenant-isolation.bypassed"
    | "tenant-isolation.denied"
    | "tenant-isolation.leak-detected";
  readonly operation: string;
  readonly kind: TenantOperationKind;
  readonly tenantId: string | null;
  readonly resource?: string;
  readonly reason?: string;
  readonly problemCode?: string;
  readonly decisionId?: string;
  readonly policyDecisionTrace?: PolicyDecisionTrace;
  readonly metadata?: Record<string, unknown>;
};

export type TenantIsolationAuditSink = {
  recordTenantIsolation(event: TenantIsolationAuditEvent): void | Promise<void>;
};

/** Controls whether observability delivery can block an allowed tenant operation. */
export type TenantIsolationObservabilityFailureMode = "best-effort" | "fail-closed";

export type TenantIsolationEnforcerOptions = {
  readonly contextProvider?: TenantContextProvider;
  readonly defaultTenantIds?: readonly string[];
  readonly auditSink?: TenantIsolationAuditSink;
  readonly policyDecisionTraceSink?: PolicyDecisionTraceSink;
  /** Defaults to best-effort. Denials always preserve their original Tenant Problem. */
  readonly observabilityFailureMode?: TenantIsolationObservabilityFailureMode;
};

export type TenantQueryPredicate = {
  readonly field: string;
  readonly operator: "=" | "in" | "rls" | "raw";
  readonly value?: string | readonly string[] | null;
};

export type TenantRlsEvidence = {
  readonly adapter: "drizzle" | "postgres" | string;
  readonly configKey: string;
  readonly tenantId: string | null;
  readonly enforced: boolean;
  readonly policyName?: string;
};

export type TenantQueryBoundary = {
  readonly operation: TenantScopedOperation;
  readonly tenantColumn?: string;
  readonly predicates?: readonly TenantQueryPredicate[];
  readonly rls?: TenantRlsEvidence;
};

export type TenantRepositoryBoundary = {
  read<TResult>(
    operation: Omit<TenantScopedOperation, "kind"> & Partial<Pick<TenantScopedOperation, "kind">>,
    fn: (evidence: TenantIsolationEvidence) => Promise<TResult> | TResult,
  ): Promise<TResult>;
  write<TResult>(
    operation: Omit<TenantScopedOperation, "kind"> & Partial<Pick<TenantScopedOperation, "kind">>,
    fn: (evidence: TenantIsolationEvidence) => Promise<TResult> | TResult,
  ): Promise<TResult>;
  query<TResult>(
    boundary: Omit<TenantQueryBoundary, "operation"> & {
      operation: Omit<TenantScopedOperation, "kind"> & Partial<Pick<TenantScopedOperation, "kind">>;
    },
    fn: (evidence: TenantIsolationEvidence) => Promise<TResult> | TResult,
  ): Promise<TResult>;
};

export type CrossTenantLeakFixtureRecord = Record<string, unknown>;

export type CrossTenantLeakFixtureOptions<TRecord extends CrossTenantLeakFixtureRecord> = {
  readonly operation: string;
  readonly tenantIds?: readonly [string, string, ...string[]];
  readonly tenantKey?: keyof TRecord & string;
  readonly recordsPerTenant?: number;
  readonly createRecord?: (tenantId: string, index: number) => TRecord;
};

export type CrossTenantLeakFixture<TRecord extends CrossTenantLeakFixtureRecord> = {
  readonly operation: string;
  readonly tenantIds: readonly string[];
  readonly tenantKey: keyof TRecord & string;
  readonly records: readonly TRecord[];
  expectedRowsForTenant(tenantId: string): readonly TRecord[];
  assertNoCrossTenantRows(tenantId: string, rows: readonly TRecord[]): void;
};

export function markTenantScopedOperation(
  operation: Omit<TenantScopedOperation, typeof tenantScopedOperationBrand>,
): TenantScopedOperation {
  return {
    ...operation,
    [tenantScopedOperationBrand]: true,
  };
}

export class TenantIsolationEnforcer {
  private readonly contextProvider: TenantContextProvider;
  private readonly defaultTenantIds: ReadonlySet<string>;
  private readonly auditSink: TenantIsolationAuditSink | undefined;
  private readonly policyDecisionTraceSink: PolicyDecisionTraceSink | undefined;
  private readonly observabilityFailureMode: TenantIsolationObservabilityFailureMode;

  constructor(options: TenantIsolationEnforcerOptions = {}) {
    this.contextProvider = options.contextProvider ?? new TenantManager();
    this.defaultTenantIds = new Set(options.defaultTenantIds ?? ["default"]);
    this.auditSink = options.auditSink;
    this.policyDecisionTraceSink = options.policyDecisionTraceSink;
    this.observabilityFailureMode = options.observabilityFailureMode ?? "best-effort";
  }

  async enforce<TResult>(
    operation: TenantScopedOperation,
    fn: (evidence: TenantIsolationEvidence) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const evidence = await this.requireOperation(operation);
    return fn(evidence);
  }

  async requireOperation(operation: TenantScopedOperation): Promise<TenantIsolationEvidence> {
    return this.resolveOperation(operation, true);
  }

  private async resolveOperation(
    operation: TenantScopedOperation,
    recordAllowed: boolean,
  ): Promise<TenantIsolationEvidence> {
    const currentTenantId = this.contextProvider.getTenantId();
    const isolation = operation.isolation ?? "tenant-scoped";

    if (this.hasDefaultTenantFallback(operation)) {
      const tenantId = this.resolveOperationTenantId(operation) ?? "default";
      await this.deny(
        operation,
        new TenantDefaultFallbackProblem(operation.name, tenantId),
        currentTenantId,
      );
    }

    if (isolation === "admin-bypass" || isolation === "system") {
      if (!hasBypassReason(operation.bypass)) {
        await this.deny(
          operation,
          new TenantAdminBypassReasonRequiredProblem(operation.name),
          currentTenantId,
        );
      }

      const evidence: TenantIsolationEvidence = {
        operation: operation.name,
        kind: operation.kind,
        resource: operation.resource,
        status: "bypassed",
        tenantId: currentTenantId,
        bypassReason: operation.bypass,
      };
      if (recordAllowed) {
        await this.allow(operation, evidence);
      }
      return evidence;
    }

    if (!currentTenantId) {
      await this.deny(operation, new TenantIsolationContextMissingProblem(operation.name), null);
    }

    const operationTenantId = this.resolveOperationTenantId(operation);
    if (operationTenantId && operationTenantId !== currentTenantId) {
      await this.deny(
        operation,
        new TenantUnsafeQueryProblem(
          operation.name,
          "operation tenant does not match active tenant context",
          {
            activeTenantId: currentTenantId,
            requestedTenantId: operationTenantId,
          },
        ),
        currentTenantId,
      );
    }

    const evidence: TenantIsolationEvidence = {
      operation: operation.name,
      kind: operation.kind,
      resource: operation.resource,
      status: "tenant-scoped",
      tenantId: currentTenantId,
    };
    if (recordAllowed) {
      await this.allow(operation, evidence);
    }
    return evidence;
  }

  async enforceQuery<TResult>(
    boundary: TenantQueryBoundary,
    fn: (evidence: TenantIsolationEvidence) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const evidence = await this.resolveOperation(boundary.operation, false);

    try {
      this.assertQueryBoundary(boundary, evidence);
    } catch (error) {
      if (isTenantIsolationProblem(error)) {
        await this.deny(boundary.operation, error, evidence.tenantId);
      }

      throw error;
    }

    await this.allow(boundary.operation, evidence);
    return fn(evidence);
  }

  createRepositoryBoundary(
    defaults: Partial<TenantScopedOperation> = {},
  ): TenantRepositoryBoundary {
    return {
      read: async (operation, fn) =>
        this.enforce(
          markTenantScopedOperation({
            ...defaults,
            ...operation,
            kind: operation.kind ?? "repository-read",
          }),
          fn,
        ),
      write: async (operation, fn) =>
        this.enforce(
          markTenantScopedOperation({
            ...defaults,
            ...operation,
            kind: operation.kind ?? "repository-write",
          }),
          fn,
        ),
      query: async (boundary, fn) =>
        this.enforceQuery(
          {
            ...boundary,
            operation: markTenantScopedOperation({
              ...defaults,
              ...boundary.operation,
              kind: boundary.operation.kind ?? "query",
            }),
          },
          fn,
        ),
    };
  }

  assertQueryBoundary(boundary: TenantQueryBoundary, evidence: TenantIsolationEvidence): void {
    if (evidence.status === "bypassed") {
      return;
    }

    const tenantId = evidence.tenantId;
    if (!tenantId) {
      throw new TenantIsolationContextMissingProblem(boundary.operation.name);
    }

    if (boundary.rls) {
      this.assertRlsEvidence(boundary.rls, boundary.operation, tenantId);
      return;
    }

    const tenantColumn = boundary.tenantColumn ?? "tenantId";
    const predicate = boundary.predicates?.find((candidate) => candidate.field === tenantColumn);

    if (!predicate) {
      throw new TenantUnsafeQueryProblem(
        boundary.operation.name,
        `missing tenant predicate '${tenantColumn}'`,
        {
          tenantColumn,
        },
      );
    }

    const values = normalizePredicateValues(predicate.value);
    const defaultTenantId = values.find((value) => this.defaultTenantIds.has(value));
    if (defaultTenantId) {
      throw new TenantDefaultFallbackProblem(boundary.operation.name, defaultTenantId);
    }

    if (!hasExactTenantPredicate(predicate, tenantId, values)) {
      throw new TenantUnsafeQueryProblem(
        boundary.operation.name,
        "tenant predicate must constrain exactly the active tenant",
        {
          activeTenantId: tenantId,
          predicateTenantIds: values,
          operator: predicate.operator,
        },
      );
    }
  }

  assertRlsEvidence(
    rls: TenantRlsEvidence,
    operation: TenantScopedOperation,
    activeTenantId: string,
  ): void {
    if (!rls.enforced) {
      throw new TenantUnsafeQueryProblem(operation.name, "RLS evidence is not enforced", {
        adapter: rls.adapter,
        configKey: rls.configKey,
      });
    }

    if (!rls.tenantId) {
      throw new TenantIsolationContextMissingProblem(operation.name);
    }

    if (this.defaultTenantIds.has(rls.tenantId)) {
      throw new TenantDefaultFallbackProblem(operation.name, rls.tenantId);
    }

    if (rls.tenantId !== activeTenantId) {
      throw new TenantUnsafeQueryProblem(
        operation.name,
        "RLS tenant does not match active tenant",
        {
          activeTenantId,
          rlsTenantId: rls.tenantId,
          adapter: rls.adapter,
          configKey: rls.configKey,
        },
      );
    }
  }

  private resolveOperationTenantId(operation: TenantScopedOperation): string | null {
    return operation.tenantId ?? operation.requestedTenantId ?? null;
  }

  private hasDefaultTenantFallback(operation: TenantScopedOperation): boolean {
    const tenantIds = [
      operation.tenantId,
      operation.requestedTenantId,
      operation.defaultTenantId,
    ].filter((value): value is string => typeof value === "string");

    return tenantIds.some((tenantId) => this.defaultTenantIds.has(tenantId));
  }

  private async allow(
    operation: TenantScopedOperation,
    evidence: TenantIsolationEvidence,
  ): Promise<void> {
    const eventType =
      evidence.status === "bypassed" ? "tenant-isolation.bypassed" : "tenant-isolation.allowed";
    const trace = await this.recordPolicyDecision(
      operation,
      "allow",
      evidence.tenantId,
      evidence.bypassReason?.reason,
    );
    recordEvent(
      eventType,
      toTelemetryAttributes(
        operation,
        evidence.tenantId,
        evidence.bypassReason?.reason,
        undefined,
        trace.decisionId,
      ),
    );
    await this.deliverObservability("tenant-isolation-audit", operation, trace, async () => {
      await this.auditSink?.recordTenantIsolation({
        type: eventType,
        operation: operation.name,
        kind: operation.kind,
        tenantId: evidence.tenantId,
        resource: operation.resource,
        reason: evidence.bypassReason?.reason,
        decisionId: trace.decisionId,
        policyDecisionTrace: trace,
        metadata: operation.metadata,
      });
    });
  }

  private async deny(
    operation: TenantScopedOperation,
    problem:
      | TenantIsolationContextMissingProblem
      | TenantDefaultFallbackProblem
      | TenantAdminBypassReasonRequiredProblem
      | TenantUnsafeQueryProblem,
    tenantId: string | null,
  ): Promise<never> {
    const trace = await this.recordPolicyDecision(
      operation,
      "deny",
      tenantId,
      problem.detail ?? problem.message,
      problem.code,
    );
    addPolicyDecisionIdExtension(problem, trace.decisionId);
    recordEvent(
      "tenant-isolation.denied",
      toTelemetryAttributes(
        operation,
        tenantId,
        problem.detail ?? problem.message,
        problem.code,
        trace.decisionId,
      ),
    );
    await this.deliverObservability("tenant-isolation-audit", operation, trace, async () => {
      await this.auditSink?.recordTenantIsolation({
        type: "tenant-isolation.denied",
        operation: operation.name,
        kind: operation.kind,
        tenantId,
        resource: operation.resource,
        reason: problem.detail ?? problem.message,
        problemCode: problem.code,
        decisionId: trace.decisionId,
        policyDecisionTrace: trace,
        metadata: operation.metadata,
      });
    });
    throw problem;
  }

  private async recordPolicyDecision(
    operation: TenantScopedOperation,
    result: "allow" | "deny",
    tenantId: string | null,
    reason?: string,
    problemCode?: string,
  ): Promise<PolicyDecisionTrace> {
    const trace = createPolicyDecisionTrace({
      policyKind: "tenant-isolation",
      result,
      ruleId: operation.ruleId ?? `tenant-isolation:${operation.kind}:${operation.name}`,
      subjectRef: operation.bypass?.actorId ? `actor:${operation.bypass.actorId}` : undefined,
      resourceRef: operation.resource,
      tenantId: tenantId ?? undefined,
      sourceLocation: operation.sourceLocation,
      reason,
      inputs: {
        operation: operation.name,
        kind: operation.kind,
        isolation: operation.isolation ?? "tenant-scoped",
        requestedTenantId: operation.requestedTenantId,
        defaultTenantId: operation.defaultTenantId,
        resource: operation.resource,
        problemCode,
        bypass: operation.bypass,
        metadata: operation.metadata,
        ...operation.inputs,
      },
    });
    await this.deliverObservability("policy-decision-trace", operation, trace, async () => {
      await recordPolicyDecisionTrace(trace, { auditSink: this.policyDecisionTraceSink });
    });

    return trace;
  }

  private async deliverObservability(
    sink: "policy-decision-trace" | "tenant-isolation-audit",
    operation: TenantScopedOperation,
    trace: PolicyDecisionTrace,
    deliver: () => Promise<void>,
  ): Promise<void> {
    try {
      await deliver();
    } catch (error) {
      recordEvent("tenant-isolation.observability-delivery-failed", {
        "tenant.operation": operation.name,
        "tenant.operation.kind": operation.kind,
        "tenant.policy_result": trace.result,
        "tenant.observability_sink": sink,
        "tenant.policy_decision_id": trace.decisionId,
      });

      if (trace.result === "allow" && this.observabilityFailureMode === "fail-closed") {
        throw error;
      }
    }
  }
}

export function createTenantIsolationEnforcer(
  options: TenantIsolationEnforcerOptions = {},
): TenantIsolationEnforcer {
  return new TenantIsolationEnforcer(options);
}

export function createTenantRepositoryBoundary(
  enforcer: TenantIsolationEnforcer,
  defaults: Partial<TenantScopedOperation> = {},
): TenantRepositoryBoundary {
  return enforcer.createRepositoryBoundary(defaults);
}

export function createCrossTenantLeakFixture<TRecord extends CrossTenantLeakFixtureRecord>(
  options: CrossTenantLeakFixtureOptions<TRecord>,
): CrossTenantLeakFixture<TRecord> {
  const tenantIds = options.tenantIds ?? ["tenant-a", "tenant-b"];
  const tenantKey = options.tenantKey ?? ("tenantId" as keyof TRecord & string);
  const recordsPerTenant = options.recordsPerTenant ?? 1;
  const records = tenantIds.flatMap((tenantId) =>
    Array.from({ length: recordsPerTenant }, (_, index) => {
      if (options.createRecord) {
        return options.createRecord(tenantId, index);
      }

      return {
        id: `${tenantId}-${index + 1}`,
        [tenantKey]: tenantId,
      } as unknown as TRecord;
    }),
  );

  return {
    operation: options.operation,
    tenantIds,
    tenantKey,
    records,
    expectedRowsForTenant(tenantId) {
      return records.filter((record) => record[tenantKey] === tenantId);
    },
    assertNoCrossTenantRows(tenantId, rows) {
      const leakedRecord = rows.find((record) => record[tenantKey] !== tenantId);
      if (!leakedRecord) {
        return;
      }

      const leakedTenantId = String(leakedRecord[tenantKey]);
      recordEvent("tenant-isolation.leak-detected", {
        "tenant.operation": options.operation,
        "tenant.id": tenantId,
        "tenant.leaked_id": leakedTenantId,
      });
      throw new TenantCrossTenantLeakProblem(options.operation, tenantId, leakedTenantId);
    },
  };
}

function hasBypassReason(bypass: TenantBypassReason | undefined): bypass is TenantBypassReason {
  return typeof bypass?.reason === "string" && bypass.reason.trim().length > 0;
}

function isTenantIsolationProblem(
  error: unknown,
): error is
  | TenantIsolationContextMissingProblem
  | TenantDefaultFallbackProblem
  | TenantAdminBypassReasonRequiredProblem
  | TenantUnsafeQueryProblem {
  return (
    error instanceof TenantIsolationContextMissingProblem ||
    error instanceof TenantDefaultFallbackProblem ||
    error instanceof TenantAdminBypassReasonRequiredProblem ||
    error instanceof TenantUnsafeQueryProblem
  );
}

function normalizePredicateValues(value: TenantQueryPredicate["value"]): readonly string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function hasExactTenantPredicate(
  predicate: TenantQueryPredicate,
  activeTenantId: string,
  values: readonly string[],
): boolean {
  if (predicate.operator === "=") {
    return values.length === 1 && values[0] === activeTenantId;
  }

  if (predicate.operator === "in") {
    return values.length > 0 && values.every((value) => value === activeTenantId);
  }

  return false;
}

function toTelemetryAttributes(
  operation: TenantScopedOperation,
  tenantId: string | null,
  reason?: string,
  problemCode?: string,
  decisionId?: string,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    "tenant.operation": operation.name,
    "tenant.operation.kind": operation.kind,
  };

  if (tenantId) {
    attributes["tenant.id"] = tenantId;
  }

  if (operation.resource) {
    attributes["tenant.resource"] = operation.resource;
  }

  if (reason) {
    attributes["tenant.reason"] = reason;
  }

  if (problemCode) {
    attributes["tenant.problem_code"] = problemCode;
  }

  if (decisionId) {
    attributes["tenant.policy_decision_id"] = decisionId;
  }

  return attributes;
}
