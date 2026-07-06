import { randomUUID } from "node:crypto";
import { Context } from "./Context";

export const DEV_INSPECTOR_TOKEN = Symbol.for("@croco/framework-context/dev-inspector");

export type RuntimeInspectorEventOutcome = "started" | "succeeded" | "failed" | "skipped";
export type RuntimeInspectionOutcome = "running" | "succeeded" | "failed";
export type RuntimeInspectorEventKind =
  | "request.start"
  | "request.context"
  | "request.end"
  | "middleware.start"
  | "middleware.end"
  | "handler.start"
  | "handler.end"
  | "problem"
  | "error"
  | "di.snapshot"
  | "event.publish"
  | "event.handler"
  | "retry.start"
  | "retry.error"
  | "retry.wait"
  | "retry.success"
  | "retry.exhausted"
  | (string & {});

export type RuntimeInspectorOptions = {
  readonly maxRequests?: number;
  readonly maxEventsPerRequest?: number;
  readonly sensitiveKeyPattern?: RegExp;
  readonly maxStringLength?: number;
};

export type RuntimeInspectorRequestStart = {
  readonly requestId: string;
  readonly method?: string;
  readonly path?: string;
  readonly route?: string;
  readonly url?: string;
  readonly headers?: Record<string, unknown>;
  readonly query?: Record<string, unknown>;
  readonly runtime?: Record<string, unknown>;
  readonly trace?: Record<string, unknown>;
};

export type RuntimeInspectorRequestFinish = {
  readonly inspectionId?: string;
  readonly requestId?: string;
  readonly status?: number;
  readonly outcome: Exclude<RuntimeInspectionOutcome, "running">;
  readonly details?: Record<string, unknown>;
};

export type RuntimeInspectorEventInput = {
  readonly inspectionId?: string;
  readonly requestId?: string;
  readonly kind: RuntimeInspectorEventKind;
  readonly outcome?: RuntimeInspectorEventOutcome;
  readonly name?: string;
  readonly durationMs?: number;
  readonly details?: Record<string, unknown>;
};

export type RuntimeInspectorTimelineEvent = {
  readonly at: string;
  readonly offsetMs: number;
  readonly kind: RuntimeInspectorEventKind;
  readonly outcome?: RuntimeInspectorEventOutcome;
  readonly name?: string;
  readonly durationMs?: number;
  readonly details?: Record<string, unknown>;
};

export type RuntimeInspectionRecord = {
  readonly id: string;
  readonly requestId: string;
  readonly method?: string;
  readonly path?: string;
  readonly route?: string;
  readonly url?: string;
  readonly status?: number;
  readonly outcome: RuntimeInspectionOutcome;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly headers?: Record<string, unknown>;
  readonly query?: Record<string, unknown>;
  readonly runtime?: Record<string, unknown>;
  readonly trace?: Record<string, unknown>;
  readonly timeline: readonly RuntimeInspectorTimelineEvent[];
};

export type RuntimeInspectorSnapshot = {
  readonly generatedAt: string;
  readonly activeRequestCount: number;
  readonly requestCount: number;
  readonly requests: readonly RuntimeInspectionRecord[];
};

type MutableRuntimeInspectionRecord = Omit<
  RuntimeInspectionRecord,
  "completedAt" | "durationMs" | "outcome" | "status" | "timeline"
> & {
  completedAt?: string;
  durationMs?: number;
  outcome: RuntimeInspectionOutcome;
  status?: number;
  readonly startedAtMs: number;
  readonly timeline: RuntimeInspectorTimelineEvent[];
};

const DEFAULT_MAX_REQUESTS = 50;
const DEFAULT_MAX_EVENTS_PER_REQUEST = 200;
const DEFAULT_MAX_STRING_LENGTH = 500;
const SENSITIVE_ASSIGNMENT_KEY_PATTERN_SOURCE = [
  "credential",
  "password",
  "secret",
  "token",
  "api[-_]?key",
  "private[-_]?key",
  "access[-_]?key",
  "database[-_]?url",
  "connection[-_]?string",
  "dsn",
].join("|");
const DEFAULT_SENSITIVE_KEY_PATTERN = new RegExp(
  [
    "authorization",
    "cookie",
    SENSITIVE_ASSIGNMENT_KEY_PATTERN_SOURCE,
    "redis[-_]?url",
    "mongo(?:db)?[-_]?url",
    "postgres(?:ql)?[-_]?url",
  ].join("|"),
  "i",
);
const COOKIE_ASSIGNMENT_VALUE_PATTERN = new RegExp(
  [
    "(\\b(?:set[-_]?cookie|cookie)\\s*[:=]\\s*)",
    `(?:(?!\\s+\\b(?:${SENSITIVE_ASSIGNMENT_KEY_PATTERN_SOURCE})\\s*[:=])[^\\n])+`,
  ].join(""),
  "gi",
);
const DEFAULT_SENSITIVE_VALUE_PATTERN = new RegExp(
  [
    "((?:(?:authorization|cookie)\\s*[:=]\\s*(?:(?:bearer|basic)\\s+)?",
    `|(?:${SENSITIVE_ASSIGNMENT_KEY_PATTERN_SOURCE})\\s*[:=]\\s*))[^\\s,;&]+`,
    "|((?:bearer|basic)\\s+)[^\\s,;]+",
    "|((?:postgres(?:ql)?|mysql|mongodb(?:\\+srv)?|redis):\\/\\/)[^\\s]+",
  ].join(""),
  "gi",
);

export class RuntimeInspector {
  private readonly maxRequests: number;
  private readonly maxEventsPerRequest: number;
  private readonly sensitiveKeyPattern: RegExp;
  private readonly maxStringLength: number;
  private readonly requests: MutableRuntimeInspectionRecord[] = [];
  private readonly activeRequestIds = new Map<string, string[]>();

  constructor(options: RuntimeInspectorOptions = {}) {
    this.maxRequests = Math.max(1, Math.trunc(options.maxRequests ?? DEFAULT_MAX_REQUESTS));
    this.maxEventsPerRequest = Math.max(
      1,
      Math.trunc(options.maxEventsPerRequest ?? DEFAULT_MAX_EVENTS_PER_REQUEST),
    );
    this.sensitiveKeyPattern = options.sensitiveKeyPattern ?? DEFAULT_SENSITIVE_KEY_PATTERN;
    this.maxStringLength = Math.max(
      1,
      Math.trunc(options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH),
    );
  }

  startRequest(input: RuntimeInspectorRequestStart): RuntimeInspectionRecord {
    const startedAtMs = Date.now();
    const request: MutableRuntimeInspectionRecord = {
      id: randomUUID(),
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      route: input.route,
      url: this.sanitizeUrl(input.url),
      outcome: "running",
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      headers: this.sanitizeRecord(input.headers),
      query: this.sanitizeRecord(input.query),
      runtime: this.sanitizeRecord(input.runtime),
      trace: this.sanitizeRecord(input.trace),
      timeline: [],
    };

    this.requests.unshift(request);
    this.activateRequest(input.requestId, request.id);
    this.trimRequests();
    this.recordEvent({
      inspectionId: request.id,
      kind: "request.start",
      outcome: "started",
      details: {
        method: input.method,
        path: input.path,
        route: input.route,
        runtime: input.runtime,
        trace: input.trace,
      },
    });

    return this.toSnapshotRecord(request);
  }

  recordEvent(input: RuntimeInspectorEventInput): void {
    const request = this.resolveRequestFromInput(input);
    if (!request) {
      return;
    }

    const timelineEvent: RuntimeInspectorTimelineEvent = {
      at: new Date().toISOString(),
      offsetMs: Date.now() - request.startedAtMs,
      kind: input.kind,
      outcome: input.outcome,
      name: input.name,
      durationMs: input.durationMs,
      details: this.sanitizeRecord(input.details),
    };

    request.timeline.push(timelineEvent);
    this.trimTimeline(request);
  }

  finishRequest(input: RuntimeInspectorRequestFinish): RuntimeInspectionRecord | undefined {
    const request = this.resolveFinishedRequest(input);
    if (!request) {
      return undefined;
    }

    const completedAtMs = Date.now();
    request.status = input.status;
    request.outcome = input.outcome;
    request.completedAt = new Date(completedAtMs).toISOString();
    request.durationMs = completedAtMs - request.startedAtMs;
    this.deactivateRequest(request);
    this.recordEvent({
      inspectionId: request.id,
      kind: "request.end",
      outcome: input.outcome === "succeeded" ? "succeeded" : "failed",
      durationMs: request.durationMs,
      details: {
        status: input.status,
        ...input.details,
      },
    });

    return this.toSnapshotRecord(request);
  }

  snapshot(): RuntimeInspectorSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      activeRequestCount: this.activeRequestCount(),
      requestCount: this.requests.length,
      requests: this.requests.map((request) => this.toSnapshotRecord(request)),
    };
  }

  clear(): void {
    this.requests.length = 0;
    this.activeRequestIds.clear();
  }

  private activateRequest(requestId: string, inspectionId: string): void {
    const activeIds = this.activeRequestIds.get(requestId) ?? [];
    activeIds.push(inspectionId);
    this.activeRequestIds.set(requestId, activeIds);
  }

  private deactivateRequest(request: MutableRuntimeInspectionRecord): void {
    const activeIds = this.activeRequestIds.get(request.requestId);
    if (!activeIds) {
      return;
    }

    const nextActiveIds = activeIds.filter((activeId) => activeId !== request.id);
    if (nextActiveIds.length === 0) {
      this.activeRequestIds.delete(request.requestId);
      return;
    }

    this.activeRequestIds.set(request.requestId, nextActiveIds);
  }

  private activeRequestCount(): number {
    let count = 0;
    for (const activeIds of this.activeRequestIds.values()) {
      count += activeIds.length;
    }
    return count;
  }

  private resolveRequestFromInput(
    input: Pick<RuntimeInspectorEventInput, "inspectionId" | "requestId">,
  ): MutableRuntimeInspectionRecord | undefined {
    const context = Context.get();
    const inspectionId = input.inspectionId ?? context?.inspectionId;
    if (inspectionId) {
      return this.resolveRequestByInspectionId(inspectionId);
    }

    return this.resolveRequestByRequestId(input.requestId ?? context?.requestId ?? undefined);
  }

  private resolveFinishedRequest(
    input: Pick<RuntimeInspectorRequestFinish, "inspectionId" | "requestId">,
  ): MutableRuntimeInspectionRecord | undefined {
    const context = Context.get();
    const inspectionId = input.inspectionId ?? context?.inspectionId;
    if (inspectionId) {
      return this.resolveRequestByInspectionId(inspectionId);
    }

    return this.resolveRequestByRequestId(input.requestId ?? context?.requestId ?? undefined);
  }

  private resolveRequestByInspectionId(
    inspectionId: string,
  ): MutableRuntimeInspectionRecord | undefined {
    return this.requests.find((request) => request.id === inspectionId);
  }

  private resolveRequestByRequestId(
    requestId: string | undefined,
  ): MutableRuntimeInspectionRecord | undefined {
    if (!requestId) {
      return undefined;
    }

    const requestRecordIds = this.activeRequestIds.get(requestId);
    const latestActiveId =
      requestRecordIds && requestRecordIds.length > 0
        ? requestRecordIds[requestRecordIds.length - 1]
        : undefined;
    if (latestActiveId) {
      return this.resolveRequestByInspectionId(latestActiveId);
    }

    return this.requests.find((request) => request.requestId === requestId);
  }

  private trimRequests(): void {
    while (this.requests.length > this.maxRequests) {
      const removed = this.requests.pop();
      if (removed) {
        this.deactivateRequest(removed);
      }
    }
  }

  private trimTimeline(request: MutableRuntimeInspectionRecord): void {
    while (request.timeline.length > this.maxEventsPerRequest) {
      if (request.timeline.length > 1 && request.timeline[0].kind === "request.start") {
        request.timeline.splice(1, 1);
        continue;
      }

      request.timeline.shift();
    }
  }

  private sanitizeRecord(
    value: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    return this.sanitizeValue(value) as Record<string, unknown>;
  }

  private sanitizeValue(value: unknown, depth = 0): unknown {
    if (depth > 5) {
      return "[Truncated]";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.sanitizeString(value.message),
      };
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeValue(entry, depth + 1));
    }

    if (typeof value !== "object" || value === null) {
      return typeof value === "string" ? this.sanitizeString(value) : value;
    }

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      try {
        const entry = (value as Record<string, unknown>)[key];
        output[key] = this.isSensitiveKey(key)
          ? "[Redacted]"
          : this.sanitizeValue(entry, depth + 1);
      } catch {
        output[key] = "[Unavailable]";
      }
    }
    return output;
  }

  private sanitizeString(value: string): string {
    const cookieScrubbed = value.replace(
      COOKIE_ASSIGNMENT_VALUE_PATTERN,
      (_match, assignmentPrefix) => `${assignmentPrefix}[Redacted]`,
    );
    const scrubbed = cookieScrubbed.replace(
      DEFAULT_SENSITIVE_VALUE_PATTERN,
      (_match, assignmentPrefix, authPrefix, urlPrefix) =>
        `${assignmentPrefix ?? authPrefix ?? urlPrefix ?? ""}[Redacted]`,
    );

    if (scrubbed.length <= this.maxStringLength) {
      return scrubbed;
    }

    return `${scrubbed.slice(0, this.maxStringLength)}...[Truncated]`;
  }

  private sanitizeUrl(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const isAbsolute = /^[a-z][a-z\d+\-.]*:/i.test(value);
      const url = new URL(value, "http://localhost");

      for (const key of Array.from(url.searchParams.keys())) {
        const values = url.searchParams.getAll(key);
        url.searchParams.delete(key);
        for (const entry of values) {
          url.searchParams.append(
            key,
            this.isSensitiveKey(key) ? "[Redacted]" : this.sanitizeString(entry),
          );
        }
      }

      if (isAbsolute) {
        return url.toString();
      }

      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return undefined;
    }
  }

  private toSnapshotRecord(request: MutableRuntimeInspectionRecord): RuntimeInspectionRecord {
    return {
      id: request.id,
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      route: request.route,
      url: request.url,
      status: request.status,
      outcome: request.outcome,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      durationMs: request.durationMs,
      headers: request.headers,
      query: request.query,
      runtime: request.runtime,
      trace: request.trace,
      timeline: [...request.timeline],
    };
  }

  private isSensitiveKey(key: string): boolean {
    this.sensitiveKeyPattern.lastIndex = 0;
    return this.sensitiveKeyPattern.test(key);
  }
}

export type RuntimeInspectorFailureReporter = (error: Error) => void;

type RuntimeInspectionEventRecorder = {
  recordEvent(input: RuntimeInspectorEventInput): void;
};

export function startRuntimeInspectionRequest(
  inspector: RuntimeInspector | undefined,
  input: RuntimeInspectorRequestStart,
  onFailure?: RuntimeInspectorFailureReporter,
): RuntimeInspectionRecord | undefined {
  if (!inspector) {
    return undefined;
  }

  try {
    return inspector.startRequest(input);
  } catch (error) {
    reportRuntimeInspectorFailure(error, onFailure);
    return undefined;
  }
}

export function recordRuntimeInspectionEvent(
  inspector: RuntimeInspectionEventRecorder | undefined,
  input: RuntimeInspectorEventInput,
  onFailure?: RuntimeInspectorFailureReporter,
): void {
  if (!inspector) {
    return;
  }

  try {
    inspector.recordEvent(input);
  } catch (error) {
    reportRuntimeInspectorFailure(error, onFailure);
  }
}

export function finishRuntimeInspectionRequest(
  inspector: RuntimeInspector | undefined,
  input: RuntimeInspectorRequestFinish,
  onFailure?: RuntimeInspectorFailureReporter,
): RuntimeInspectionRecord | undefined {
  if (!inspector) {
    return undefined;
  }

  try {
    return inspector.finishRequest(input);
  } catch (error) {
    reportRuntimeInspectorFailure(error, onFailure);
    return undefined;
  }
}

function reportRuntimeInspectorFailure(
  error: unknown,
  onFailure: RuntimeInspectorFailureReporter | undefined,
): void {
  if (!onFailure) {
    return;
  }

  try {
    onFailure(error instanceof Error ? error : new Error(String(error)));
  } catch {
    /* instrumentation failure reporters must not affect application behavior */
  }
}
