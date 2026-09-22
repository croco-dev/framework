import {
  context as otelContext,
  createTraceState,
  isSpanContextValid,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { Context } from "@opentelemetry/api";

export type FrontendTelemetryRouteKind = "query" | "mutation";

export type FrontendTelemetryEventKind =
  | "rpc.request.started"
  | "rpc.request.retry"
  | "rpc.request.succeeded"
  | "rpc.request.problem"
  | "rpc.request.external_failure"
  | "rpc.request.cancelled"
  | "rpc.mutation.started"
  | "rpc.mutation.succeeded"
  | "rpc.mutation.problem"
  | "rpc.mutation.external_failure"
  | "rpc.mutation.cancelled";

export type FrontendTelemetryProblemSummary = {
  readonly code: string;
  readonly status: number;
  readonly category?: string;
  readonly type?: string;
  readonly title?: string;
};

export type FrontendTelemetryRequestContext = {
  readonly routeId: string;
  readonly operationId: string;
  readonly methodName: string;
  readonly method: string;
  readonly path: string;
  readonly routeKind: FrontendTelemetryRouteKind;
  readonly interactionId?: string;
  readonly correlationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly requestOrigin?: string;
  readonly attempt?: number;
};

export type FrontendTelemetryEvent = FrontendTelemetryRequestContext & {
  readonly kind: FrontendTelemetryEventKind;
  readonly timestamp: number;
  readonly durationMs?: number;
  readonly status?: number;
  readonly problem?: FrontendTelemetryProblemSummary;
  readonly errorName?: string;
  readonly errorMessage?: string;
};

export type FrontendTelemetrySink = {
  readonly record: (event: FrontendTelemetryEvent) => void | Promise<void>;
};

export type FrontendTelemetryHeaderNames = {
  readonly correlationId?: string;
  readonly interactionId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
};

export type FrontendTelemetrySpanMode = "propagate" | "client-span";

export type FrontendTelemetryRequestOutcome = {
  readonly kind: "succeeded" | "problem" | "external_failure" | "cancelled";
  readonly status?: number;
  readonly problem?: FrontendTelemetryProblemSummary;
  readonly errorName?: string;
};

export type FrontendTelemetryRequestLifecycle = {
  readonly headers: Record<string, string>;
  readonly propagationHeaderNames: readonly string[];
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly run: <T>(operation: () => Promise<T>) => Promise<T>;
  readonly end: (outcome: FrontendTelemetryRequestOutcome) => void;
};

export type FrontendTelemetryBridgeOptions = {
  readonly sink?: FrontendTelemetrySink;
  readonly interactionId?: string;
  readonly correlationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly spanMode?: FrontendTelemetrySpanMode;
  readonly allowedOrigins?: readonly string[];
  readonly headerNames?: FrontendTelemetryHeaderNames;
};

export type FrontendTelemetryBridge = {
  readonly interactionId: string;
  readonly correlationId: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly createHeaders: (context: FrontendTelemetryRequestContext) => Record<string, string>;
  readonly startRequest: (
    context: FrontendTelemetryRequestContext,
  ) => FrontendTelemetryRequestLifecycle;
  readonly record: (event: FrontendTelemetryEvent) => void | Promise<void>;
};

const DEFAULT_CORRELATION_HEADER = "x-croco-correlation-id";
const DEFAULT_INTERACTION_HEADER = "x-croco-interaction-id";
const DEFAULT_TRACEPARENT_HEADER = "traceparent";
const SPAN_ID_BYTES = 8;

type CryptoLike = {
  readonly randomUUID?: () => string;
  readonly getRandomValues?: <T extends Uint8Array>(array: T) => T;
};

export function createFrontendInteractionId(prefix = "croco-fe"): string {
  const crypto = getCrypto();
  const randomId = crypto?.randomUUID?.();

  if (randomId) {
    return `${prefix}-${randomId}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${randomHex(SPAN_ID_BYTES)}`;
}

export function createFrontendTelemetryBridge(
  options: FrontendTelemetryBridgeOptions = {},
): FrontendTelemetryBridge {
  const interactionId = options.interactionId ?? createFrontendInteractionId();
  const correlationId = options.correlationId ?? interactionId;
  const headerNames = {
    correlationId: options.headerNames?.correlationId ?? DEFAULT_CORRELATION_HEADER,
    interactionId: options.headerNames?.interactionId ?? DEFAULT_INTERACTION_HEADER,
    traceparent: options.headerNames?.traceparent ?? DEFAULT_TRACEPARENT_HEADER,
    tracestate: options.headerNames?.tracestate ?? "tracestate",
  };

  const selectParent = (request: FrontendTelemetryRequestContext) => {
    if (request.traceparent !== undefined) {
      return explicitParent(request.traceparent, request.tracestate);
    }
    if (options.traceparent !== undefined) {
      return explicitParent(options.traceparent, options.tracestate);
    }
    const parent = otelContext.active();
    return { parent, carrier: injectTrace(parent) };
  };
  const headersFor = (
    request: FrontendTelemetryRequestContext,
    carrier: Record<string, string>,
  ): Record<string, string> => {
    if (!isAllowedOrigin(request.requestOrigin, options.allowedOrigins)) return {};
    return {
      [headerNames.correlationId]: request.correlationId ?? correlationId,
      [headerNames.interactionId]: request.interactionId ?? interactionId,
      ...(carrier["traceparent"] ? { [headerNames.traceparent]: carrier["traceparent"] } : {}),
      ...(carrier["tracestate"] ? { [headerNames.tracestate]: carrier["tracestate"] } : {}),
    };
  };

  return {
    interactionId,
    correlationId,
    ...(options.traceparent !== undefined ? { traceparent: options.traceparent } : {}),
    ...(options.tracestate !== undefined ? { tracestate: options.tracestate } : {}),
    createHeaders: (request) => headersFor(request, selectParent(request).carrier),
    startRequest: (request) => {
      const selected = selectParent(request);
      const span =
        options.spanMode === "client-span"
          ? trace.getTracer("@croco/telemetry-api").startSpan(
              `${request.method} ${request.path}`,
              {
                kind: SpanKind.CLIENT,
                attributes: {
                  "rpc.route_id": request.routeId,
                  "rpc.operation_id": request.operationId,
                  "http.request.method": request.method,
                  "http.route": request.path,
                  ...(request.attempt !== undefined ? { "rpc.attempt": request.attempt } : {}),
                },
              },
              selected.parent,
            )
          : undefined;
      try {
        const spanContext = span?.spanContext();
        const parentContext = trace.getSpanContext(selected.parent);
        const operationContext =
          span &&
          spanContext &&
          isSpanContextValid(spanContext) &&
          spanContext.spanId !== parentContext?.spanId
            ? trace.setSpan(selected.parent, span)
            : selected.parent;
        const carrier = span
          ? operationContext !== selected.parent
            ? injectTrace(operationContext)
            : {}
          : selected.carrier;
        const headers = headersFor(request, carrier);
        const traceparent = headers[headerNames.traceparent];
        const tracestate = headers[headerNames.tracestate];
        let ended = false;
        return {
          headers,
          propagationHeaderNames: [headerNames.traceparent, headerNames.tracestate],
          ...(traceparent !== undefined ? { traceparent } : {}),
          ...(tracestate !== undefined ? { tracestate } : {}),
          run: (operation) => otelContext.with(operationContext, operation),
          end: (outcome) => {
            if (ended) return;
            ended = true;
            if (!span) return;
            if (outcome.status !== undefined)
              span.setAttribute("http.response.status_code", outcome.status);
            if (outcome.problem) span.setAttribute("error.type", outcome.problem.code);
            else if (outcome.errorName) span.setAttribute("error.type", outcome.errorName);
            span.setAttribute("rpc.request.outcome", outcome.kind);
            if (outcome.kind === "succeeded") span.setStatus({ code: SpanStatusCode.OK });
            else if (outcome.kind !== "cancelled") span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
          },
        };
      } catch (error) {
        endSpanAfterSetupFailure(span);
        throw error;
      }
    },
    record: (event) => options.sink?.record(event),
  };
}

function explicitParent(
  traceparent: string,
  tracestate?: string,
): { parent: Context; carrier: Record<string, string> } {
  const match = /^(?!ff)([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(.*)$/.exec(
    traceparent,
  );
  if (!match || match[0] !== traceparent) {
    return { parent: ROOT_CONTEXT, carrier: {} };
  }
  const [, version, traceId, spanId, traceFlagsHex, suffix] = match;
  if (
    !version ||
    !traceId ||
    !spanId ||
    !traceFlagsHex ||
    suffix === undefined ||
    (version === "00" ? suffix !== "" : suffix !== "" && !/^-[\x21-\x7e]+$/.test(suffix))
  ) {
    return { parent: ROOT_CONTEXT, carrier: {} };
  }
  const spanContext = {
    traceId,
    spanId,
    traceFlags: Number.parseInt(traceFlagsHex, 16),
    isRemote: true,
    ...(tracestate ? { traceState: createTraceState(tracestate) } : {}),
  };
  if (!isSpanContextValid(spanContext)) return { parent: ROOT_CONTEXT, carrier: {} };
  const state = spanContext.traceState?.serialize();
  return {
    parent: trace.setSpanContext(ROOT_CONTEXT, spanContext),
    carrier: { traceparent, ...(state ? { tracestate: state } : {}) },
  };
}

function injectTrace(parent: Context): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(parent, carrier);
  const traceparent = carrier["traceparent"];
  return traceparent ? explicitParent(traceparent, carrier["tracestate"]).carrier : {};
}

function endSpanAfterSetupFailure(span: { end(): void } | undefined): void {
  try {
    span?.end();
  } catch {
    return;
  }
}

function isAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[] = [],
): boolean {
  if (!requestOrigin || !/^[a-z][a-z\d+.-]*:\/\//i.test(requestOrigin)) return true;
  const browserOrigin = (globalThis as { readonly location?: { readonly origin: string } }).location
    ?.origin;
  return requestOrigin === browserOrigin || allowedOrigins.includes(requestOrigin);
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  const crypto = getCrypto();

  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getCrypto(): CryptoLike | undefined {
  return (globalThis as { readonly crypto?: CryptoLike }).crypto;
}
