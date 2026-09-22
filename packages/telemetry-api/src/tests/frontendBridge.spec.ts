import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  createTraceState,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import type { Tracer } from "@opentelemetry/api";
import {
  createFrontendInteractionId,
  createFrontendTelemetryBridge,
  type FrontendTelemetryEvent,
  type FrontendTelemetryHeaderNames,
} from "../libs/frontendBridge";

const TRACEPARENT = "00-00000000000000000000000000000001-0000000000000001-01";

const REQUEST_CONTEXT = {
  routeId: "UsersController.getUser",
  operationId: "UsersController_getUser",
  methodName: "getUser",
  method: "GET",
  path: "/users/:id",
  routeKind: "query",
} as const;

const FRONTEND_EVENT: FrontendTelemetryEvent = {
  ...REQUEST_CONTEXT,
  kind: "rpc.request.problem",
  timestamp: 1,
};

describe("frontend telemetry bridge", () => {
  it("creates browser-safe correlation and trace headers", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-1",
      interactionId: "interaction-1",
      traceparent: TRACEPARENT,
    });

    const headers = bridge.createHeaders(REQUEST_CONTEXT);

    expect(headers).toEqual({
      traceparent: TRACEPARENT,
      "x-croco-correlation-id": "corr-1",
      "x-croco-interaction-id": "interaction-1",
    });
  });

  it("lets request-local ids override bridge defaults", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-default",
      interactionId: "interaction-default",
      traceparent: TRACEPARENT,
    });

    const headers = bridge.createHeaders({
      routeId: "UsersController.create",
      operationId: "UsersController_create",
      methodName: "create",
      method: "POST",
      path: "/users",
      routeKind: "mutation",
      correlationId: "corr-request",
      interactionId: "interaction-request",
      traceparent: "00-00000000000000000000000000000002-0000000000000002-01",
    });

    expect(headers).toMatchObject({
      traceparent: "00-00000000000000000000000000000002-0000000000000002-01",
      "x-croco-correlation-id": "corr-request",
      "x-croco-interaction-id": "interaction-request",
    });
  });

  it("records provider-neutral frontend telemetry events", () => {
    const record = vi.fn<(event: FrontendTelemetryEvent) => void>();
    const bridge = createFrontendTelemetryBridge({ sink: { record } });
    const event: FrontendTelemetryEvent = {
      kind: "rpc.request.problem",
      routeId: "UsersController.getUser",
      operationId: "UsersController_getUser",
      methodName: "getUser",
      method: "GET",
      path: "/users/:id",
      routeKind: "query",
      timestamp: 1,
      durationMs: 12,
      status: 404,
      problem: {
        code: "USER_NOT_FOUND",
        status: 404,
        category: "NotFound",
        type: "https://errors.example.com/not-found",
        title: "Not Found",
      },
    };

    const result = bridge.record(event);

    expect(record).toHaveBeenCalledWith(event);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no telemetry sink is configured", () => {
    expect(createFrontendTelemetryBridge().record(FRONTEND_EVENT)).toBeUndefined();
  });

  it("preserves synchronous sink failures", () => {
    const failure = new TypeError("sink unavailable");
    const bridge = createFrontendTelemetryBridge({
      sink: {
        record: () => {
          throw failure;
        },
      },
    });

    expect(() => bridge.record(FRONTEND_EVENT)).toThrow(failure);
  });

  it("returns asynchronous sink completion by identity", async () => {
    let resolveSink!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveSink = resolve;
    });
    const bridge = createFrontendTelemetryBridge({ sink: { record: () => completion } });

    const result = bridge.record(FRONTEND_EVENT);

    expect(result).toBe(completion);
    resolveSink();
    await expect(result).resolves.toBeUndefined();
  });

  it("exposes asynchronous rejection and allows caller recovery", async () => {
    const failure = new TypeError("export failed");
    const record = vi
      .fn<(event: FrontendTelemetryEvent) => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const bridge = createFrontendTelemetryBridge({ sink: { record } });

    await expect(bridge.record(FRONTEND_EVENT)).rejects.toBe(failure);
    await expect(bridge.record(FRONTEND_EVENT)).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("uses every configured frontend telemetry header name", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-custom",
      interactionId: "interaction-custom",
      traceparent: TRACEPARENT,
      headerNames: {
        correlationId: "x-app-correlation",
        interactionId: "x-app-interaction",
        traceparent: "x-app-traceparent",
      },
    });

    expect(bridge.createHeaders(REQUEST_CONTEXT)).toEqual({
      "x-app-correlation": "corr-custom",
      "x-app-interaction": "interaction-custom",
      "x-app-traceparent": TRACEPARENT,
    });
  });

  it.each([
    ["correlationId", "x-app-correlation", ["x-croco-interaction-id", "traceparent"]],
    ["interactionId", "x-app-interaction", ["x-croco-correlation-id", "traceparent"]],
    ["traceparent", "x-app-traceparent", ["x-croco-correlation-id", "x-croco-interaction-id"]],
  ] as const)(
    "uses defaults for header names omitted alongside %s",
    (field, customName, defaultNames) => {
      const headerNames: FrontendTelemetryHeaderNames = { [field]: customName };
      const bridge = createFrontendTelemetryBridge({
        correlationId: "corr-partial",
        interactionId: "interaction-partial",
        traceparent: TRACEPARENT,
        headerNames,
      });

      const headers = bridge.createHeaders(REQUEST_CONTEXT);

      expect(headers).toHaveProperty(customName);
      expect(headers).toHaveProperty(defaultNames[0]);
      expect(headers).toHaveProperty(defaultNames[1]);
    },
  );

  it("associates request-local values with configured header names", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-default",
      interactionId: "interaction-default",
      traceparent: TRACEPARENT,
      headerNames: {
        correlationId: "x-app-correlation",
        interactionId: "x-app-interaction",
        traceparent: "x-app-traceparent",
      },
    });

    expect(
      bridge.createHeaders({
        ...REQUEST_CONTEXT,
        correlationId: "corr-request",
        interactionId: "interaction-request",
        traceparent: "00-00000000000000000000000000000002-0000000000000002-01",
      }),
    ).toEqual({
      "x-app-correlation": "corr-request",
      "x-app-interaction": "interaction-request",
      "x-app-traceparent": "00-00000000000000000000000000000002-0000000000000002-01",
    });
  });

  it("generates stable-prefixed interaction ids without Node-only imports", () => {
    const interactionId = createFrontendInteractionId("checkout");
    const source = fs.readFileSync(path.join(__dirname, "../libs/frontendBridge.ts"), "utf-8");

    expect(interactionId).toMatch(/^checkout-/);
    expect(source).not.toContain("node:");
    expect(source).not.toContain("@croco/telemetry-sdk-node");
  });
});

describe("frontend tracing lifecycle", () => {
  const unsampled = TRACEPARENT.slice(0, -2) + "00";
  const childContext = {
    traceId: "00000000000000000000000000000001",
    spanId: "0000000000000002",
    traceFlags: 0,
    traceState: createTraceState("vendor=value"),
  };
  beforeEach(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    propagation.setGlobalPropagator({
      inject: (ctx, carrier, setter) => {
        const value = trace.getSpanContext(ctx);
        if (!value) return;
        setter.set(
          carrier,
          "traceparent",
          `00-${value.traceId}-${value.spanId}-${value.traceFlags.toString(16).padStart(2, "0")}`,
        );
        if (value.traceState) setter.set(carrier, "tracestate", value.traceState.serialize());
        setter.set(carrier, "baggage", "secret=value");
      },
      extract: (ctx) => ctx,
      fields: () => ["traceparent", "tracestate", "baggage"],
    });
  });
  afterEach(() => {
    context.disable();
    propagation.disable();
    trace.disable();
    vi.unstubAllGlobals();
  });

  it("does not fabricate a trace without a provider or active context", () => {
    const bridge = createFrontendTelemetryBridge();
    expect(bridge.traceparent).toBeUndefined();
    expect(bridge.createHeaders(REQUEST_CONTEXT)).not.toHaveProperty("traceparent");
    expect(
      createFrontendTelemetryBridge({
        spanMode: "client-span",
        traceparent: TRACEPARENT,
      }).startRequest(REQUEST_CONTEXT).traceparent,
    ).toBeUndefined();
    expect(
      createFrontendTelemetryBridge({ spanMode: "client-span" }).startRequest(REQUEST_CONTEXT)
        .traceparent,
    ).toBeUndefined();
  });

  it("requires a global propagator for active context and maps custom tracestate headers", () => {
    propagation.disable();
    context.with(trace.setSpanContext(ROOT_CONTEXT, childContext), () => {
      expect(createFrontendTelemetryBridge().createHeaders(REQUEST_CONTEXT)).not.toHaveProperty(
        "traceparent",
      );
    });
    const lifecycle = createFrontendTelemetryBridge({
      traceparent: TRACEPARENT,
      tracestate: "vendor=value",
      headerNames: { traceparent: "x-trace", tracestate: "x-state" },
    }).startRequest(REQUEST_CONTEXT);
    expect(lifecycle.headers["x-state"]).toBe("vendor=value");
    expect(lifecycle.headers["x-trace"]).toBe(TRACEPARENT);
    expect(lifecycle.propagationHeaderNames).toEqual(["x-trace", "x-state"]);
    expect(lifecycle.traceparent).toBe(TRACEPARENT);
    expect(lifecycle.tracestate).toBe("vendor=value");
  });

  it("records a local span for disallowed origins with the active parent", () => {
    const parent = { ...childContext, spanId: "0000000000000003" };
    const span = trace.wrapSpanContext({ ...childContext, traceFlags: 1 });
    const end = vi.spyOn(span, "end");
    const setAttribute = vi.spyOn(span, "setAttribute");
    const startSpan = vi.fn<Tracer["startSpan"]>(() => span);
    trace.setGlobalTracerProvider({ getTracer: () => ({ startSpan, startActiveSpan: vi.fn() }) });
    context.with(trace.setSpanContext(ROOT_CONTEXT, parent), () => {
      const lifecycle = createFrontendTelemetryBridge({ spanMode: "client-span" }).startRequest({
        ...REQUEST_CONTEXT,
        requestOrigin: "https://untrusted.example",
      });
      expect(lifecycle.headers).toEqual({});
      expect(lifecycle.traceparent).toBeUndefined();
      expect(trace.getSpanContext(startSpan.mock.calls[0]?.[2] ?? ROOT_CONTEXT)).toEqual(parent);
      lifecycle.end({ kind: "external_failure", errorName: "TypeError" });
      expect(setAttribute).toHaveBeenCalledWith("error.type", "TypeError");
      expect(end).toHaveBeenCalledTimes(1);
    });
  });

  it("ends an owned span when propagation setup fails", () => {
    const failure = new Error("propagation unavailable");
    const span = trace.wrapSpanContext(childContext);
    const end = vi.spyOn(span, "end");
    const startSpan = vi.fn<Tracer["startSpan"]>(() => span);
    trace.setGlobalTracerProvider({ getTracer: () => ({ startSpan, startActiveSpan: vi.fn() }) });
    propagation.disable();
    propagation.setGlobalPropagator({
      inject: () => {
        throw failure;
      },
      extract: (ctx) => ctx,
      fields: () => ["traceparent"],
    });
    const bridge = createFrontendTelemetryBridge({
      spanMode: "client-span",
      traceparent: TRACEPARENT,
    });

    expect(() => bridge.startRequest(REQUEST_CONTEXT)).toThrow(failure);
    expect(startSpan).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("propagates non-recording active context and strips unrelated propagator headers", () => {
    context.with(trace.setSpanContext(ROOT_CONTEXT, childContext), () => {
      const headers = createFrontendTelemetryBridge().createHeaders(REQUEST_CONTEXT);
      expect(headers.traceparent).toBe("00-00000000000000000000000000000001-0000000000000002-00");
      expect(headers.tracestate).toBe("vendor=value");
      expect(headers).not.toHaveProperty("baggage");
    });
  });

  it("uses request then default then active context without mixing tracestate", () => {
    context.with(trace.setSpanContext(ROOT_CONTEXT, childContext), () => {
      const bridge = createFrontendTelemetryBridge({
        traceparent: TRACEPARENT,
        tracestate: "default=value",
      });
      expect(bridge.createHeaders(REQUEST_CONTEXT)).toMatchObject({
        traceparent: TRACEPARENT,
        tracestate: "default=value",
      });
      expect(
        bridge.createHeaders({
          ...REQUEST_CONTEXT,
          traceparent: unsampled,
          tracestate: "request=value",
        }),
      ).toMatchObject({ traceparent: unsampled, tracestate: "request=value" });
      expect(
        bridge.createHeaders({ ...REQUEST_CONTEXT, traceparent: unsampled }),
      ).not.toHaveProperty("tracestate");
    });
  });

  it.each([
    "",
    "garbage",
    TRACEPARENT + "\n",
    "00-00000000000000000000000000000000-0000000000000001-01",
    "00-00000000000000000000000000000001-0000000000000000-01",
    TRACEPARENT + "-extra",
    TRACEPARENT.replace("00-", "ff-"),
  ])("rejects invalid explicit/default traceparent %s without fallback", (invalid) => {
    context.with(trace.setSpanContext(ROOT_CONTEXT, childContext), () => {
      expect(
        createFrontendTelemetryBridge({ traceparent: TRACEPARENT }).createHeaders({
          ...REQUEST_CONTEXT,
          traceparent: invalid,
          tracestate: "secret=value",
        }),
      ).not.toHaveProperty("traceparent");
      expect(
        createFrontendTelemetryBridge({ traceparent: invalid }).createHeaders(REQUEST_CONTEXT),
      ).not.toHaveProperty("traceparent");
    });
  });

  it("filters every bridge header by exact origin and permits same-origin and unknown requests", () => {
    vi.stubGlobal("location", { origin: "https://app.example" });
    const bridge = createFrontendTelemetryBridge({
      traceparent: TRACEPARENT,
      tracestate: "vendor=value",
      allowedOrigins: ["https://api.example"],
    });
    for (const requestOrigin of [
      undefined,
      "/relative",
      "https://app.example",
      "https://api.example",
    ]) {
      expect(bridge.createHeaders({ ...REQUEST_CONTEXT, requestOrigin })).toHaveProperty(
        "traceparent",
      );
    }
    for (const requestOrigin of [
      "https://api.example.evil",
      "https://api.example:8443",
      "https://third.example",
    ]) {
      expect(bridge.createHeaders({ ...REQUEST_CONTEXT, requestOrigin })).toEqual({});
      expect(
        bridge.startRequest({ ...REQUEST_CONTEXT, requestOrigin }).traceparent,
      ).toBeUndefined();
    }
  });

  it.each(["succeeded", "problem", "external_failure", "cancelled"] as const)(
    "ends a client span exactly once for %s with safe metadata",
    (kind) => {
      const span = trace.wrapSpanContext(childContext);
      const end = vi.spyOn(span, "end");
      const setAttribute = vi.spyOn(span, "setAttribute");
      const setStatus = vi.spyOn(span, "setStatus");
      const startSpan = vi.fn<Tracer["startSpan"]>(() => span);
      trace.setGlobalTracerProvider({ getTracer: () => ({ startSpan, startActiveSpan: vi.fn() }) });
      const bridge = createFrontendTelemetryBridge({
        spanMode: "client-span",
        traceparent: unsampled,
        tracestate: "vendor=value",
      });
      bridge.createHeaders(REQUEST_CONTEXT);
      expect(startSpan).not.toHaveBeenCalled();
      const lifecycle = bridge.startRequest({
        ...REQUEST_CONTEXT,
        correlationId: "secret-correlation",
        interactionId: "secret-interaction",
        attempt: 2,
      });
      expect(startSpan).toHaveBeenCalledWith(
        "GET /users/:id",
        {
          kind: SpanKind.CLIENT,
          attributes: {
            "rpc.route_id": REQUEST_CONTEXT.routeId,
            "rpc.operation_id": REQUEST_CONTEXT.operationId,
            "http.request.method": "GET",
            "http.route": "/users/:id",
            "rpc.attempt": 2,
          },
        },
        expect.anything(),
      );
      expect(trace.getSpanContext(startSpan.mock.calls[0]?.[2] ?? ROOT_CONTEXT)?.traceFlags).toBe(
        0,
      );
      expect(lifecycle.traceparent).toContain("-0000000000000002-00");
      expect(lifecycle.tracestate).toBe("vendor=value");
      lifecycle.end({
        kind,
        status: 404,
        problem: { code: "NOT_FOUND", status: 404, title: "secret-title" },
        errorName: "secret-ignored",
      });
      lifecycle.end({ kind: "succeeded" });
      expect(end).toHaveBeenCalledTimes(1);
      if (kind === "cancelled") expect(setStatus).not.toHaveBeenCalled();
      else {
        expect(setStatus).toHaveBeenCalledWith({
          code: kind === "succeeded" ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        });
      }
      expect(setAttribute.mock.calls).toEqual([
        ["http.response.status_code", 404],
        ["error.type", "NOT_FOUND"],
        ["rpc.request.outcome", kind],
      ]);
    },
  );
});
