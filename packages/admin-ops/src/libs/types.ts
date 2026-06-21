export type OperationsTimelineSource =
  | "audit"
  | "domain-event"
  | "task"
  | "workflow"
  | "lifecycle"
  | (string & {});

export type OperationsTimelineSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type TimelineOrder = "asc" | "desc";

export type OperationsTimelineEntity = {
  readonly type: string;
  readonly id: string;
  readonly label?: string;
};

export type OperationsTimelineActor = {
  readonly id: string;
  readonly type?: string;
  readonly displayName?: string;
};

export type OperationsTimelineProblem = {
  readonly code?: string;
  readonly category?: string;
  readonly message?: string;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
};

export type OperationsTimelineRetry = {
  readonly attempt?: number;
  readonly maxAttempts?: number;
  readonly retryable?: boolean;
  readonly nextRetryAt?: Date;
};

export type OperationsTimelineEvent<
  TSource extends OperationsTimelineSource = OperationsTimelineSource,
  TExtension extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly id: string;
  readonly source: TSource;
  readonly timestamp: Date;
  readonly severity: OperationsTimelineSeverity;
  readonly title: string;
  readonly summary?: string;
  readonly tenantId?: string;
  readonly customerId?: string;
  readonly correlationId?: string;
  readonly actor?: OperationsTimelineActor;
  readonly primaryEntity?: OperationsTimelineEntity;
  readonly entities: readonly OperationsTimelineEntity[];
  readonly problem?: OperationsTimelineProblem;
  readonly retry?: OperationsTimelineRetry;
  readonly recoveryAction?: string;
  readonly extension: Readonly<TExtension & { readonly source: TSource }>;
};

export type OperationsTimelineQuery = {
  readonly tenantId?: string;
  readonly customerId?: string;
  readonly entity?: OperationsTimelineEntity;
  readonly sources?: readonly OperationsTimelineSource[];
  readonly severities?: readonly OperationsTimelineSeverity[];
  readonly order?: TimelineOrder;
  readonly limit?: number;
};

export interface OperationsTimelineSourceAdapter {
  readonly source: OperationsTimelineSource;
  collect(query?: OperationsTimelineQuery): Promise<readonly OperationsTimelineEvent[]>;
}

export type OperationsTimelineRenderRow = {
  readonly key: string;
  readonly source: OperationsTimelineSource;
  readonly timestamp: Date;
  readonly badge: string;
  readonly severity: OperationsTimelineSeverity;
  readonly title: string;
  readonly subtitle: string;
  readonly recoveryAction?: string;
  readonly problemCode?: string;
  readonly correlationId?: string;
};

export type AuditTimelineSource = {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly payload: Record<string, unknown>;
  readonly diff: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date | string;
  readonly sequence?: number;
  readonly parentHash?: string;
  readonly integrityHash?: string;
};

export type AuditTimelineExtension = {
  readonly source: "audit";
  readonly entry: AuditTimelineSource;
};

export type DomainEventTimelineSourceBase = {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId?: string;
  readonly payload?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
};

export type DomainEventTimelineSourceWithTimestamp = DomainEventTimelineSourceBase & {
  readonly timestamp: Date | string;
  readonly occurredAt?: Date | string;
};

export type DomainEventTimelineSourceWithOccurredAt = DomainEventTimelineSourceBase & {
  readonly timestamp?: never;
  readonly occurredAt: Date | string;
};

export type DomainEventTimelineSource =
  | DomainEventTimelineSourceWithTimestamp
  | DomainEventTimelineSourceWithOccurredAt;

export type DomainEventTimelineExtension = {
  readonly source: "domain-event";
  readonly event: DomainEventTimelineSource;
};

export type TaskFailureTimelineSource = {
  readonly id: string;
  readonly type: string;
  readonly status?: string;
  readonly error?: {
    readonly message: string;
    readonly code?: string;
    readonly stack?: string;
    readonly retryable?: boolean;
  };
  readonly attempts?: number;
  readonly maxAttempts?: number;
  readonly createdAt: Date | string;
  readonly startedAt?: Date | string;
  readonly completedAt?: Date | string;
  readonly parentId?: string;
  readonly metadata?: Record<string, unknown>;
};

export type TaskFailureTimelineExtension = {
  readonly source: "task";
  readonly execution: TaskFailureTimelineSource;
};

export type WorkflowExecutionTimelineSource = {
  readonly id: string;
  readonly workflow: string;
  readonly status?: string;
  readonly tenantId?: string;
  readonly createdAt: Date | string;
  readonly startedAt?: Date | string;
  readonly completedAt?: Date | string;
  readonly error?: {
    readonly message: string;
    readonly code?: string;
    readonly retryable?: boolean;
  };
  readonly steps?: readonly {
    readonly name: string;
    readonly task: string;
    readonly status?: string;
  }[];
  readonly metadata?: Record<string, unknown>;
};

export type WorkflowExecutionTimelineExtension = {
  readonly source: "workflow";
  readonly execution: WorkflowExecutionTimelineSource;
};

export type LifecycleRunTimelineSource = {
  readonly id: string;
  readonly ruleId: string;
  readonly tenantId: string;
  readonly signalType: string;
  readonly signalId?: string;
  readonly severity: "info" | "low" | "medium" | "high" | "critical" | (string & {});
  readonly status: string;
  readonly actionResults: readonly {
    readonly actionId: string;
    readonly type: string;
    readonly status: string;
    readonly message?: string;
    readonly error?: {
      readonly code?: string;
      readonly message: string;
    };
    readonly metadata?: Record<string, unknown>;
  }[];
  readonly error?: {
    readonly code?: string;
    readonly message: string;
  };
  readonly startedAt: Date | string;
  readonly completedAt: Date | string;
};

export type LifecycleRunTimelineExtension = {
  readonly source: "lifecycle";
  readonly run: LifecycleRunTimelineSource;
};

export type RetryConsoleSourceKind =
  | "task"
  | "workflow"
  | "lifecycle"
  | "batch"
  | "execution"
  | (string & {});

export type RetryConsoleItemState =
  | "running"
  | "succeeded"
  | "retryable"
  | "non_retryable"
  | "terminal_failed";

export type RetryConsoleRecoveryActionKind = "retry" | "replay" | "inspect" | "wait" | "none";

export type RetryConsoleProblemMetadata = {
  readonly code: string;
  readonly message: string;
  readonly title?: string;
  readonly status?: number;
  readonly type?: string;
  readonly detail?: string;
  readonly retryable?: boolean;
  readonly stack?: string;
  readonly extensions?: Record<string, unknown>;
};

export type RetryConsoleTimestamps = {
  readonly createdAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt?: string;
};

export type RetryConsoleCorrelationIds = {
  readonly executionId?: string;
  readonly parentExecutionId?: string;
  readonly replayOf?: string;
  readonly workflowExecutionId?: string;
  readonly workflowName?: string;
  readonly taskName?: string;
  readonly batchName?: string;
  readonly lifecycleRunId?: string;
  readonly lifecycleRuleId?: string;
  readonly tenantId?: string;
  readonly signalId?: string;
  readonly traceId?: string;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly [key: string]: string | undefined;
};

export type RetryConsolePermissionDescriptor = {
  readonly action: string;
  readonly resource: string;
  readonly scope?: string;
  readonly reason?: string;
};

export type RetryConsolePermissionGrant = {
  readonly descriptor?: RetryConsolePermissionDescriptor;
  readonly granted: boolean;
  readonly checkedAt?: string;
  readonly deniedReason?: string;
};

export type RetryConsoleAuditDescriptor = {
  readonly actorId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly ticketId?: string;
  readonly metadata?: Record<string, unknown>;
};

export type RetryConsoleRecoveryAction = {
  readonly id: string;
  readonly kind: RetryConsoleRecoveryActionKind;
  readonly label: string;
  readonly allowed: boolean;
  readonly reason: string;
  readonly permission: RetryConsolePermissionDescriptor;
  readonly requiresAudit: boolean;
  readonly requiresIdempotencyKey: boolean;
};

export type RetryConsoleSourceMetadata = {
  readonly kind: RetryConsoleSourceKind;
  readonly label: string;
  readonly target?: string;
};

export type RetryConsoleItem = {
  readonly id: string;
  readonly source: RetryConsoleSourceMetadata;
  readonly state: RetryConsoleItemState;
  readonly title: string;
  readonly retryable: boolean;
  readonly problem?: RetryConsoleProblemMetadata;
  readonly attempts: {
    readonly current: number;
    readonly max?: number;
  };
  readonly timestamps: RetryConsoleTimestamps;
  readonly correlationIds: RetryConsoleCorrelationIds;
  readonly recoveryActions: readonly RetryConsoleRecoveryAction[];
  readonly details?: Record<string, unknown>;
};

export type RetryConsoleListOptions = {
  readonly states?: readonly RetryConsoleItemState[];
  readonly sourceKinds?: readonly RetryConsoleSourceKind[];
  readonly includeSucceeded?: boolean;
};

export type RetryConsoleRecoveryInputById = {
  readonly itemId: string;
  readonly actionId: string;
  readonly actionKind?: never;
  readonly permission: RetryConsolePermissionGrant;
  readonly audit: RetryConsoleAuditDescriptor;
  readonly payload?: unknown;
  readonly metadata?: Record<string, unknown>;
};

export type RetryConsoleRecoveryInputByKind = {
  readonly itemId: string;
  readonly actionId?: never;
  readonly actionKind: RetryConsoleRecoveryActionKind;
  readonly permission: RetryConsolePermissionGrant;
  readonly audit: RetryConsoleAuditDescriptor;
  readonly payload?: unknown;
  readonly metadata?: Record<string, unknown>;
};

export type RetryConsoleRecoveryInput = {
  readonly itemId: string;
  readonly actionId?: string;
  readonly actionKind?: RetryConsoleRecoveryActionKind;
  readonly permission: RetryConsolePermissionGrant;
  readonly audit: RetryConsoleAuditDescriptor;
  readonly payload?: unknown;
  readonly metadata?: Record<string, unknown>;
};

export type RetryConsoleSourceRecoveryResult = {
  readonly item?: RetryConsoleItem;
  readonly providerResult?: unknown;
};

export type RetryConsoleRecoveryResult =
  | {
      readonly status: "succeeded";
      readonly action: RetryConsoleRecoveryAction;
      readonly item: RetryConsoleItem;
      readonly audit: RetryConsoleAuditDescriptor;
      readonly providerResult?: unknown;
    }
  | {
      readonly status: "denied";
      readonly action?: RetryConsoleRecoveryAction;
      readonly item?: RetryConsoleItem;
      readonly problem: RetryConsoleProblemMetadata;
    }
  | {
      readonly status: "failed";
      readonly action: RetryConsoleRecoveryAction;
      readonly item: RetryConsoleItem;
      readonly problem: RetryConsoleProblemMetadata;
    };

export interface RetryConsoleSource {
  readonly kind: RetryConsoleSourceKind;
  list(options?: RetryConsoleListOptions): Promise<readonly RetryConsoleItem[]>;
  recover(
    item: RetryConsoleItem,
    request: RetryConsoleRecoveryInput,
    action: RetryConsoleRecoveryAction,
  ): Promise<RetryConsoleSourceRecoveryResult>;
}

export interface RetryConsole {
  list(options?: RetryConsoleListOptions): Promise<readonly RetryConsoleItem[]>;
  show(itemId: string): Promise<RetryConsoleItem | null>;
  recover(request: RetryConsoleRecoveryInput): Promise<RetryConsoleRecoveryResult>;
}
