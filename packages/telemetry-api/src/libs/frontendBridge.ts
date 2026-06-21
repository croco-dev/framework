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
};

export type FrontendTelemetryBridgeOptions = {
  readonly sink?: FrontendTelemetrySink;
  readonly interactionId?: string;
  readonly correlationId?: string;
  readonly traceparent?: string;
  readonly headerNames?: FrontendTelemetryHeaderNames;
};

export type FrontendTelemetryBridge = {
  readonly interactionId: string;
  readonly correlationId: string;
  readonly traceparent: string;
  readonly createHeaders: (context: FrontendTelemetryRequestContext) => Record<string, string>;
  readonly record: (event: FrontendTelemetryEvent) => void;
};

const DEFAULT_CORRELATION_HEADER = "x-croco-correlation-id";
const DEFAULT_INTERACTION_HEADER = "x-croco-interaction-id";
const DEFAULT_TRACEPARENT_HEADER = "traceparent";
const TRACE_ID_BYTES = 16;
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
  const traceparent = options.traceparent ?? createTraceparent();
  const headerNames = {
    correlationId: options.headerNames?.correlationId ?? DEFAULT_CORRELATION_HEADER,
    interactionId: options.headerNames?.interactionId ?? DEFAULT_INTERACTION_HEADER,
    traceparent: options.headerNames?.traceparent ?? DEFAULT_TRACEPARENT_HEADER,
  };

  return {
    interactionId,
    correlationId,
    traceparent,
    createHeaders: (context) => ({
      [headerNames.correlationId]: context.correlationId ?? correlationId,
      [headerNames.interactionId]: context.interactionId ?? interactionId,
      [headerNames.traceparent]: context.traceparent ?? traceparent,
    }),
    record: (event) => {
      options.sink?.record(event);
    },
  };
}

function createTraceparent(): string {
  return `00-${randomHex(TRACE_ID_BYTES)}-${randomHex(SPAN_ID_BYTES)}-01`;
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
