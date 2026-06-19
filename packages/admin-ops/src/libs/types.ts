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
