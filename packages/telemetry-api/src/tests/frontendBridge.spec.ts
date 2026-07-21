import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
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
