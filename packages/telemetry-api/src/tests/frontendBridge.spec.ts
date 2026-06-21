import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createFrontendInteractionId,
  createFrontendTelemetryBridge,
  type FrontendTelemetryEvent,
} from "../libs/frontendBridge";

describe("frontend telemetry bridge", () => {
  it("creates browser-safe correlation and trace headers", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-1",
      interactionId: "interaction-1",
      traceparent: "00-00000000000000000000000000000001-0000000000000001-01",
    });

    const headers = bridge.createHeaders({
      routeId: "UsersController.getUser",
      operationId: "UsersController_getUser",
      methodName: "getUser",
      method: "GET",
      path: "/users/:id",
      routeKind: "query",
    });

    expect(headers).toEqual({
      traceparent: "00-00000000000000000000000000000001-0000000000000001-01",
      "x-croco-correlation-id": "corr-1",
      "x-croco-interaction-id": "interaction-1",
    });
  });

  it("lets request-local ids override bridge defaults", () => {
    const bridge = createFrontendTelemetryBridge({
      correlationId: "corr-default",
      interactionId: "interaction-default",
      traceparent: "00-00000000000000000000000000000001-0000000000000001-01",
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

    bridge.record(event);

    expect(record).toHaveBeenCalledWith(event);
  });

  it("generates stable-prefixed interaction ids without Node-only imports", () => {
    const interactionId = createFrontendInteractionId("checkout");
    const source = fs.readFileSync(path.join(__dirname, "../libs/frontendBridge.ts"), "utf-8");

    expect(interactionId).toMatch(/^checkout-/);
    expect(source).not.toContain("node:");
    expect(source).not.toContain("@croco/telemetry-sdk-node");
  });
});
