import { CustomerExplorerProblem, explorerScopeKey } from "@croco/admin-core";
import { operationsTimelineEventFromEngagementDispatch } from "./engagementAdapters";
import type { OperationsTimelineEvent, OperationsTimelineSourceAdapter } from "./types";
import type {
  ExplorerScope,
  ExplorerSourceStatus,
  ExplorerSubject,
  TimelineItem,
  TimelineRequest,
  TimelineSource,
  TimelineSourcePage,
} from "@croco/admin-core";

function microseconds(value: string): bigint {
  const milliseconds = Date.parse(value);
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "";
  if (!Number.isFinite(milliseconds) || fraction.length > 6)
    throw new CustomerExplorerProblem("input", "Invalid timeline timestamp precision");
  return BigInt(milliseconds) * 1000n + BigInt(fraction.slice(3).padEnd(3, "0"));
}
function validateRequest(request: TimelineRequest): void {
  explorerScopeKey(request.scope);
  if (
    typeof request.subject?.kind !== "string" ||
    !request.subject.kind.trim() ||
    typeof request.subject.id !== "string" ||
    !request.subject.id.trim() ||
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > 200 ||
    !Number.isFinite(Date.parse(request.from)) ||
    !Number.isFinite(Date.parse(request.to)) ||
    microseconds(request.from) > microseconds(request.to)
  )
    throw new CustomerExplorerProblem("input", "Invalid timeline request");
}
async function checkReferenceAccess(
  status: (request: TimelineRequest) => Promise<ExplorerSourceStatus>,
  scope: ExplorerScope,
  subject: ExplorerSubject,
  eventId: string,
): Promise<void> {
  const request = {
    scope,
    subject,
    from: "0001-01-01T00:00:00.000Z",
    to: "9999-12-31T23:59:59.999Z",
    limit: 1,
  };
  validateRequest(request);
  if (typeof eventId !== "string" || !eventId.trim())
    throw new CustomerExplorerProblem("input", "Event id required");
  const availability = await status(request);
  if (availability === "denied" || availability === "failed")
    throw new CustomerExplorerProblem(
      availability === "denied" ? "denied" : "source-failed",
      "Reference source unavailable",
    );
}
function cursorKey(id: string, request: Omit<TimelineRequest, "limit" | "cursor">): string {
  return JSON.stringify([
    id,
    explorerScopeKey(request.scope),
    request.subject.kind,
    request.subject.id,
    request.from,
    request.to,
  ]);
}
function decodeCursor(cursor: string, key: string): [string, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cursor);
  } catch {
    throw new CustomerExplorerProblem("input", "Invalid timeline cursor");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    parsed[0] !== key ||
    typeof parsed[1] !== "string" ||
    !Number.isFinite(Date.parse(parsed[1])) ||
    typeof parsed[2] !== "string"
  )
    throw new CustomerExplorerProblem("input", "Cursor does not match source query");
  return [parsed[1], parsed[2]];
}
export type ExplorerEngagementDispatch = Readonly<{
  id: string;
  tenantId: string;
  recipientId: string;
  messageId: string;
  channel: "email" | "push";
  outcome: Readonly<{
    kind: "queued" | "suppressed" | "unavailable" | "skipped" | "failed";
    retryable?: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}>;
export interface ExplorerEngagementStore {
  listByRecipient(
    tenantId: string,
    recipientId: string,
    options: Readonly<{ limit: number; after?: Readonly<{ updatedAt: Date; dispatchId: string }> }>,
  ): Promise<
    Readonly<{
      items: readonly ExplorerEngagementDispatch[];
      nextCursor?: Readonly<{ updatedAt: Date; dispatchId: string }>;
    }>
  >;
  getDispatch(
    tenantId: string,
    dispatchId: string,
  ): Promise<ExplorerEngagementDispatch | undefined>;
}
export type EngagementExplorerSourceOptions = Readonly<{
  id: string;
  scope: ExplorerScope;
  subjectKind: string;
  store: ExplorerEngagementStore;
  status(request: TimelineRequest): Promise<ExplorerSourceStatus>;
}>;
export class EngagementCustomerExplorerSource implements TimelineSource {
  readonly id: string;
  constructor(private readonly options: EngagementExplorerSourceOptions) {
    this.id = options.id;
    explorerScopeKey(options.scope);
  }
  private check(scope: ExplorerScope, subject: ExplorerSubject): void {
    if (
      explorerScopeKey(scope) !== explorerScopeKey(this.options.scope) ||
      subject.kind !== this.options.subjectKind
    )
      throw new CustomerExplorerProblem("denied", "Engagement source scope mismatch");
  }
  private item(
    dispatch: ExplorerEngagementDispatch,
    subject: ExplorerSubject,
    completeness: TimelineItem["completeness"],
  ): TimelineItem {
    if (dispatch.tenantId !== this.options.scope.tenantId || dispatch.recipientId !== subject.id)
      throw new CustomerExplorerProblem(
        "source-failed",
        "Engagement store returned another recipient",
      );
    const event = operationsTimelineEventFromEngagementDispatch({
      dispatchId: dispatch.id,
      tenantId: dispatch.tenantId,
      recipientId: dispatch.recipientId,
      messageId: dispatch.messageId,
      channel: dispatch.channel,
      status: dispatch.outcome.kind === "unavailable" ? "skipped" : dispatch.outcome.kind,
      providerAccepted: false,
      retryable: dispatch.outcome.retryable === true,
      createdAt: dispatch.createdAt,
      updatedAt: dispatch.updatedAt,
    });
    return {
      source: this.id,
      eventId: JSON.stringify([dispatch.id, event.id, dispatch.outcome.kind, dispatch.channel]),
      occurredAt: event.timestamp.toISOString(),
      observedAt: dispatch.updatedAt.toISOString(),
      kind: `engagement.${dispatch.outcome.kind}`,
      subject,
      safeProperties: { channel: dispatch.channel, status: dispatch.outcome.kind },
      completeness,
    };
  }
  async read(request: TimelineRequest): Promise<TimelineSourcePage> {
    validateRequest(request);
    this.check(request.scope, request.subject);
    const key = cursorKey(this.id, request);
    const after = request.cursor ? decodeCursor(request.cursor, key) : undefined;
    const status = await this.options.status(request);
    if (status === "denied" || status === "failed") return { items: [], status, truncated: false };
    const page = await this.options.store.listByRecipient(
      request.scope.tenantId,
      request.subject.id,
      {
        limit: request.limit,
        ...(after ? { after: { updatedAt: new Date(after[0]), dispatchId: after[1] } } : {}),
      },
    );
    if (page.items.length > request.limit)
      throw new CustomerExplorerProblem("source-failed", "Engagement store exceeded page limit");
    const items = page.items
      .map((dispatch) => this.item(dispatch, request.subject, status))
      .filter(
        (item) =>
          microseconds(item.occurredAt) >= microseconds(request.from) &&
          microseconds(item.occurredAt) <= microseconds(request.to),
      );
    return {
      items,
      status,
      truncated: !!page.nextCursor,
      ...(page.nextCursor
        ? {
            nextCursor: JSON.stringify([
              key,
              page.nextCursor.updatedAt.toISOString(),
              page.nextCursor.dispatchId,
            ]),
          }
        : {}),
    };
  }
  async resolve(
    scope: ExplorerScope,
    subject: ExplorerSubject,
    eventId: string,
  ): Promise<TimelineItem | undefined> {
    await checkReferenceAccess((request) => this.options.status(request), scope, subject, eventId);
    this.check(scope, subject);
    let identity: unknown;
    try {
      identity = JSON.parse(eventId);
    } catch {
      throw new CustomerExplorerProblem("input", "Invalid engagement event reference");
    }
    if (
      !Array.isArray(identity) ||
      identity.length !== 4 ||
      identity.some((value) => typeof value !== "string")
    )
      throw new CustomerExplorerProblem("input", "Invalid engagement event reference");
    const dispatch = await this.options.store.getDispatch(scope.tenantId, identity[0]);
    if (!dispatch || dispatch.recipientId !== subject.id) return undefined;
    const at = dispatch.updatedAt.toISOString();
    const status = await this.options.status({ scope, subject, from: at, to: at, limit: 1 });
    if (status === "failed" || status === "denied")
      throw new CustomerExplorerProblem(
        status === "denied" ? "denied" : "source-failed",
        "Engagement source unavailable",
      );
    const item = this.item(dispatch, subject, status);
    return item.eventId === eventId ? item : undefined;
  }
}
export type OperationsExplorerSourceOptions = Readonly<{
  id: string;
  scope: ExplorerScope;
  subjectKind: string;
  adapter: OperationsTimelineSourceAdapter;
  status(request: TimelineRequest): Promise<ExplorerSourceStatus>;
}>;
export class OperationsCustomerExplorerSource implements TimelineSource {
  readonly id: string;
  constructor(private readonly options: OperationsExplorerSourceOptions) {
    this.id = options.id;
    explorerScopeKey(options.scope);
  }
  private async events(
    scope: ExplorerScope,
    subject: ExplorerSubject,
  ): Promise<readonly OperationsTimelineEvent[]> {
    if (
      explorerScopeKey(scope) !== explorerScopeKey(this.options.scope) ||
      subject.kind !== this.options.subjectKind
    )
      throw new CustomerExplorerProblem("denied", "Operations source scope mismatch");
    const events = await this.options.adapter.collect({
      tenantId: scope.tenantId,
      customerId: subject.id,
      order: "asc",
    });
    if (
      events.some((event) => event.tenantId !== scope.tenantId || event.customerId !== subject.id)
    )
      throw new CustomerExplorerProblem(
        "source-failed",
        "Operations adapter returned another customer",
      );
    return events;
  }
  private item(
    event: OperationsTimelineEvent,
    subject: ExplorerSubject,
    completeness: TimelineItem["completeness"],
  ): TimelineItem {
    return {
      source: this.id,
      eventId: JSON.stringify([event.source, event.id]),
      occurredAt: event.timestamp.toISOString(),
      observedAt: event.timestamp.toISOString(),
      kind: event.source,
      subject,
      safeProperties: { severity: event.severity },
      completeness,
    };
  }
  async read(request: TimelineRequest): Promise<TimelineSourcePage> {
    validateRequest(request);
    const key = cursorKey(this.id, request);
    const cursor = request.cursor ? decodeCursor(request.cursor, key) : undefined;
    const status = await this.options.status(request);
    if (status === "failed" || status === "denied") return { items: [], status, truncated: false };
    const events = await this.events(request.scope, request.subject);
    const items = events
      .map((event) => this.item(event, request.subject, status))
      .filter(
        (item) =>
          microseconds(item.occurredAt) >= microseconds(request.from) &&
          microseconds(item.occurredAt) <= microseconds(request.to) &&
          (!cursor ||
            microseconds(item.occurredAt) > microseconds(cursor[0]) ||
            (microseconds(item.occurredAt) === microseconds(cursor[0]) &&
              item.eventId > cursor[1])),
      )
      .sort((a, b) =>
        a.occurredAt < b.occurredAt
          ? -1
          : a.occurredAt > b.occurredAt
            ? 1
            : a.eventId < b.eventId
              ? -1
              : a.eventId > b.eventId
                ? 1
                : 0,
      );
    const truncated = items.length > request.limit;
    const page = items.slice(0, request.limit);
    const last = page.at(-1);
    return {
      items: page,
      status,
      truncated,
      ...(truncated && last
        ? { nextCursor: JSON.stringify([key, last.occurredAt, last.eventId]) }
        : {}),
    };
  }
  async resolve(
    scope: ExplorerScope,
    subject: ExplorerSubject,
    eventId: string,
  ): Promise<TimelineItem | undefined> {
    await checkReferenceAccess((request) => this.options.status(request), scope, subject, eventId);
    const event = (await this.events(scope, subject)).find(
      (value) => JSON.stringify([value.source, value.id]) === eventId,
    );
    if (!event) return undefined;
    const at = event.timestamp.toISOString();
    const status = await this.options.status({ scope, subject, from: at, to: at, limit: 1 });
    if (status === "failed" || status === "denied")
      throw new CustomerExplorerProblem(
        status === "denied" ? "denied" : "source-failed",
        "Operations source unavailable",
      );
    return this.item(event, subject, status);
  }
}
