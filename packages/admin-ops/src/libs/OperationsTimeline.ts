import type {
  OperationsTimelineEvent,
  OperationsTimelineQuery,
  OperationsTimelineRenderRow,
  OperationsTimelineSource,
  OperationsTimelineSourceAdapter,
} from "./types";

export class InMemoryOperationsTimelineSourceAdapter implements OperationsTimelineSourceAdapter {
  constructor(
    readonly source: OperationsTimelineSource,
    private readonly events: readonly OperationsTimelineEvent[],
  ) {}

  async collect(query: OperationsTimelineQuery = {}): Promise<readonly OperationsTimelineEvent[]> {
    return createOperationsTimeline(this.events, {
      ...query,
      sources: query.sources ?? [this.source],
    });
  }
}

export async function collectOperationsTimeline(
  adapters: readonly OperationsTimelineSourceAdapter[],
  query: OperationsTimelineQuery = {},
): Promise<readonly OperationsTimelineEvent[]> {
  const eventGroups = await Promise.all(adapters.map((adapter) => adapter.collect(query)));
  return createOperationsTimeline(eventGroups.flat(), query);
}

export function createOperationsTimeline(
  events: readonly OperationsTimelineEvent[],
  query: OperationsTimelineQuery = {},
): readonly OperationsTimelineEvent[] {
  const ordered = [...events]
    .filter((event) => matchesOperationsTimelineQuery(event, query))
    .sort((left, right) => compareTimelineEvents(left, right));

  const result = query.order === "desc" ? ordered.reverse() : ordered;

  if (query.limit === undefined) {
    return result;
  }

  return result.slice(0, Math.max(0, query.limit));
}

export function createOperationsTimelineRows(
  events: readonly OperationsTimelineEvent[],
  query: OperationsTimelineQuery = {},
): readonly OperationsTimelineRenderRow[] {
  return createOperationsTimeline(events, query).map((event) => {
    const entityLabel = event.primaryEntity
      ? `${event.primaryEntity.type}/${event.primaryEntity.id}`
      : "unscoped";
    const tenantLabel = event.tenantId ? `tenant ${event.tenantId}` : "global";
    const problemLabel = event.problem?.code ? ` · ${event.problem.code}` : "";

    return {
      key: event.id,
      source: event.source,
      timestamp: event.timestamp,
      badge: badgeForSource(event.source),
      severity: event.severity,
      title: event.title,
      subtitle: `${tenantLabel} · ${entityLabel}${problemLabel}`,
      ...(event.recoveryAction ? { recoveryAction: event.recoveryAction } : {}),
      ...(event.problem?.code ? { problemCode: event.problem.code } : {}),
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
    };
  });
}

export function matchesOperationsTimelineQuery(
  event: OperationsTimelineEvent,
  query: OperationsTimelineQuery,
): boolean {
  if (query.tenantId && event.tenantId !== query.tenantId) {
    return false;
  }

  if (query.customerId && event.customerId !== query.customerId) {
    return false;
  }

  if (query.sources && !query.sources.includes(event.source)) {
    return false;
  }

  if (query.severities && !query.severities.includes(event.severity)) {
    return false;
  }

  if (query.entity) {
    const expectedEntity = query.entity;
    if (!event.entities.some((entity) => matchesEntity(entity, expectedEntity))) {
      return false;
    }
  }

  return true;
}

function compareTimelineEvents(
  left: OperationsTimelineEvent,
  right: OperationsTimelineEvent,
): number {
  const timestampDiff = left.timestamp.getTime() - right.timestamp.getTime();
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  const sourceDiff = left.source.localeCompare(right.source);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return left.id.localeCompare(right.id);
}

function matchesEntity(
  left: { readonly type: string; readonly id: string },
  right: { readonly type: string; readonly id: string },
): boolean {
  return left.type === right.type && left.id === right.id;
}

function badgeForSource(source: OperationsTimelineSource): string {
  switch (source) {
    case "audit":
      return "Audit";
    case "domain-event":
      return "Event";
    case "task":
      return "Task";
    case "workflow":
      return "Workflow";
    case "lifecycle":
      return "Lifecycle";
    default:
      return source;
  }
}
