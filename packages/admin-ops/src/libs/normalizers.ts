import type {
  AuditTimelineExtension,
  AuditTimelineSource,
  DomainEventTimelineExtension,
  DomainEventTimelineSource,
  LifecycleRunTimelineExtension,
  LifecycleRunTimelineSource,
  OperationsTimelineActor,
  OperationsTimelineEntity,
  OperationsTimelineEvent,
  OperationsTimelineProblem,
  OperationsTimelineRetry,
  OperationsTimelineSeverity,
  TaskFailureTimelineExtension,
  TaskFailureTimelineSource,
  WorkflowExecutionTimelineExtension,
  WorkflowExecutionTimelineSource,
} from "./types";

export function normalizeAuditLogEntry(
  entry: AuditTimelineSource,
): OperationsTimelineEvent<"audit", AuditTimelineExtension> {
  const metadata = entry.metadata;
  const problem = readProblem(metadata.problem);
  const retry = readRetry(metadata.retry);
  const primaryEntity = {
    type: entry.resourceType,
    id: entry.resourceId,
  };

  return {
    id: `audit:${entry.id}`,
    source: "audit",
    timestamp: toDate(entry.createdAt),
    severity: readSeverity(metadata.severity, problem ? "error" : "info"),
    title: `${entry.action} ${entry.resourceType}`,
    summary: `Audit action ${entry.action} by ${entry.actorId}`,
    tenantId: entry.tenantId,
    customerId: readString(metadata.customerId),
    correlationId: readCorrelationId(metadata),
    actor: {
      id: entry.actorId,
      type: readString(metadata.actorType),
      displayName: readString(metadata.actorDisplayName),
    },
    primaryEntity,
    entities: [primaryEntity],
    ...(problem ? { problem } : {}),
    ...(retry ? { retry } : {}),
    ...readRecoveryAction(metadata, `Review audit entry '${entry.id}'.`),
    extension: {
      source: "audit",
      entry,
    },
  };
}

export function normalizeDomainEvent(
  event: DomainEventTimelineSource,
): OperationsTimelineEvent<"domain-event", DomainEventTimelineExtension> {
  const metadata = event.metadata ?? {};
  const problem = readProblem(metadata.problem);
  const retry = readRetry(metadata.retry);
  const primaryEntity = readPrimaryEntity(metadata, event.aggregateId);

  return {
    id: `domain-event:${event.eventId}`,
    source: "domain-event",
    timestamp: toDate(readDomainEventTimestamp(event)),
    severity: readSeverity(metadata.severity, problem ? "error" : "info"),
    title: event.eventName,
    summary: readString(metadata.summary),
    tenantId: readString(metadata.tenantId),
    customerId: readString(metadata.customerId),
    correlationId: readCorrelationId(metadata),
    actor: readActor(metadata),
    ...(primaryEntity ? { primaryEntity, entities: [primaryEntity] } : { entities: [] }),
    ...(problem ? { problem } : {}),
    ...(retry ? { retry } : {}),
    ...readRecoveryAction(metadata, `Inspect handlers for domain event '${event.eventName}'.`),
    extension: {
      source: "domain-event",
      event,
    },
  };
}

function readDomainEventTimestamp(event: DomainEventTimelineSource): Date | string {
  return event.timestamp ?? event.occurredAt;
}

export function normalizeTaskFailureExecution(
  execution: TaskFailureTimelineSource,
): OperationsTimelineEvent<"task", TaskFailureTimelineExtension> {
  const metadata = execution.metadata ?? {};
  const taskEntity = {
    type: "task",
    id: execution.type,
  };
  const executionEntity = {
    type: "execution",
    id: execution.id,
  };
  const retryable = execution.error?.retryable;
  const problem = readProblem({
    code: execution.error?.code,
    message: execution.error?.message,
    retryable,
    details: execution.error?.stack ? { stack: execution.error.stack } : undefined,
  });
  const retry = readRetry({
    attempt: execution.attempts,
    maxAttempts: execution.maxAttempts,
    retryable,
    nextRetryAt: metadata.nextRetryAt,
  });

  return {
    id: `task:${execution.id}`,
    source: "task",
    timestamp: toDate(execution.completedAt ?? execution.startedAt ?? execution.createdAt),
    severity: execution.status === "timed_out" ? "critical" : "error",
    title: `Task failed: ${execution.type}`,
    summary: execution.error?.message,
    tenantId: readString(metadata.tenantId),
    customerId: readString(metadata.customerId),
    correlationId: readCorrelationId(metadata),
    actor: readActor(metadata),
    primaryEntity: taskEntity,
    entities: [taskEntity, executionEntity, ...readMetadataEntities(metadata)],
    ...(problem ? { problem } : {}),
    ...(retry ? { retry } : {}),
    ...readRecoveryAction(
      metadata,
      retryable === true
        ? `Retry task '${execution.type}' after inspecting execution '${execution.id}'.`
        : `Inspect execution '${execution.id}' before retrying '${execution.type}'.`,
    ),
    extension: {
      source: "task",
      execution,
    },
  };
}

export function normalizeWorkflowExecution(
  execution: WorkflowExecutionTimelineSource,
): OperationsTimelineEvent<"workflow", WorkflowExecutionTimelineExtension> {
  const metadata = execution.metadata ?? {};
  const workflowEntity = {
    type: "workflow",
    id: execution.workflow,
  };
  const problem = readProblem(execution.error);

  return {
    id: `workflow:${execution.id}`,
    source: "workflow",
    timestamp: toDate(execution.completedAt ?? execution.startedAt ?? execution.createdAt),
    severity: problem ? "error" : "info",
    title: `Workflow ${execution.status ?? "updated"}: ${execution.workflow}`,
    summary: execution.error?.message,
    tenantId: execution.tenantId ?? readString(metadata.tenantId),
    customerId: readString(metadata.customerId),
    correlationId: readCorrelationId(metadata),
    actor: readActor(metadata),
    primaryEntity: workflowEntity,
    entities: [
      workflowEntity,
      { type: "execution", id: execution.id },
      ...readMetadataEntities(metadata),
    ],
    ...(problem ? { problem } : {}),
    ...readRecoveryAction(metadata, `Inspect workflow execution '${execution.id}'.`),
    extension: {
      source: "workflow",
      execution,
    },
  };
}

export function normalizeLifecycleRun(
  run: LifecycleRunTimelineSource,
): OperationsTimelineEvent<"lifecycle", LifecycleRunTimelineExtension> {
  const ruleEntity = {
    type: "lifecycle-rule",
    id: run.ruleId,
  };
  const problem = readProblem(run.error);

  return {
    id: `lifecycle:${run.id}`,
    source: "lifecycle",
    timestamp: toDate(run.completedAt),
    severity: normalizeLifecycleSeverity(run.severity, problem),
    title: `Lifecycle ${run.status}: ${run.ruleId}`,
    summary: problem?.message,
    tenantId: run.tenantId,
    primaryEntity: ruleEntity,
    entities: [
      ruleEntity,
      ...(run.signalId ? [{ type: "lifecycle-signal", id: run.signalId }] : []),
    ],
    ...(problem ? { problem } : {}),
    recoveryAction: problem
      ? `Inspect lifecycle run '${run.id}' and failed action results.`
      : `Review lifecycle run '${run.id}'.`,
    extension: {
      source: "lifecycle",
      run,
    },
  };
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function readProblem(value: unknown): OperationsTimelineProblem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const code = readString(value.code);
  const category = readString(value.category);
  const message = readString(value.message);
  const retryable = readBoolean(value.retryable);
  const details = readRecord(value.details);

  if (!code && !category && !message && retryable === undefined && !details) {
    return undefined;
  }

  return {
    ...(code ? { code } : {}),
    ...(category ? { category } : {}),
    ...(message ? { message } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
    ...(details ? { details } : {}),
  };
}

function readRetry(value: unknown): OperationsTimelineRetry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const attempt = readNumber(value.attempt);
  const maxAttempts = readNumber(value.maxAttempts);
  const retryable = readBoolean(value.retryable);
  const nextRetryAt = readOptionalDate(value.nextRetryAt);

  if (
    attempt === undefined &&
    maxAttempts === undefined &&
    retryable === undefined &&
    nextRetryAt === undefined
  ) {
    return undefined;
  }

  return {
    ...(attempt !== undefined ? { attempt } : {}),
    ...(maxAttempts !== undefined ? { maxAttempts } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
    ...(nextRetryAt ? { nextRetryAt } : {}),
  };
}

function readCorrelationId(metadata: Record<string, unknown>): string | undefined {
  const traceContext = readRecord(metadata.traceContext);
  return (
    readString(metadata.correlationId) ??
    readString(metadata.correlation_id) ??
    readString(metadata.traceId) ??
    (traceContext ? readString(traceContext.traceId) : undefined)
  );
}

function readActor(metadata: Record<string, unknown>): OperationsTimelineActor | undefined {
  const actor = readRecord(metadata.actor);
  const id = actor ? readString(actor.id) : readString(metadata.actorId);

  if (!id) {
    return undefined;
  }

  return {
    id,
    type: (actor ? readString(actor.type) : undefined) ?? readString(metadata.actorType),
    displayName:
      (actor ? readString(actor.displayName) : undefined) ?? readString(metadata.actorDisplayName),
  };
}

function readPrimaryEntity(
  metadata: Record<string, unknown>,
  aggregateId: string | undefined,
): OperationsTimelineEntity | undefined {
  const entity = readRecord(metadata.entity);
  const entityType =
    (entity ? readString(entity.type) : undefined) ?? readString(metadata.entityType);
  const entityId =
    (entity ? readString(entity.id) : undefined) ?? readString(metadata.entityId) ?? aggregateId;

  if (!entityType && !entityId) {
    return undefined;
  }

  return {
    type: entityType ?? "aggregate",
    id: entityId ?? "unknown",
    label: entity ? readString(entity.label) : undefined,
  };
}

function readMetadataEntities(
  metadata: Record<string, unknown>,
): readonly OperationsTimelineEntity[] {
  const entity = readPrimaryEntity(metadata, undefined);
  if (!entity) {
    return [];
  }

  return [entity];
}

function readRecoveryAction(
  metadata: Record<string, unknown>,
  fallback: string,
): { readonly recoveryAction: string } {
  return {
    recoveryAction: readString(metadata.recoveryAction) ?? fallback,
  };
}

function readSeverity(
  value: unknown,
  fallback: OperationsTimelineSeverity,
): OperationsTimelineSeverity {
  switch (value) {
    case "debug":
    case "info":
    case "warning":
    case "error":
    case "critical":
      return value;
    case "warn":
      return "warning";
    default:
      return fallback;
  }
}

function normalizeLifecycleSeverity(
  value: string,
  problem: OperationsTimelineProblem | undefined,
): OperationsTimelineSeverity {
  switch (value) {
    case "critical":
      return "critical";
    case "high":
      return "error";
    case "medium":
    case "low":
      return "warning";
    case "info":
      return problem ? "error" : "info";
    default:
      return problem ? "error" : "info";
  }
}

function readOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    return new Date(value);
  }

  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
