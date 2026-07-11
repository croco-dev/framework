import "reflect-metadata";
import { getDiagnosticCodeDefinition } from "@croco/diagnostics-core";
import {
  Container,
  checkPolicyTableRuntimeCapabilityManifest,
  checkRuntimeCapabilityRequirements,
  compilePolicyTable,
  createPolicyTarget,
  createRuntimeCapabilityManifest,
  definePolicy,
  Context as FrameworkContext,
  type KnownRuntimePlatform,
  POLICY_CAPABILITY_UNAVAILABLE_CODE,
  RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE,
  type RuntimeCapabilities,
  type RuntimeCapabilityRequirement,
} from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CrocoApp, createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import type { LambdaContext, LambdaEvent } from "../libs/types";

const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const RUNTIME_CONFORMANCE_PATH = "/runtime-capability-conformance/snapshot";

let queuedRuntimeWorkCompleted = false;

type RuntimeCapabilitySnapshot = {
  readonly platform: KnownRuntimePlatform | null;
  readonly requestId: string | null;
  readonly capabilities: RuntimeCapabilities | null;
};

@Controller("/runtime-capability-conformance")
class RuntimeCapabilityConformanceController {
  @Get("/snapshot")
  snapshot(): RuntimeCapabilitySnapshot {
    const runtime = FrameworkContext.getRuntimeContext();

    if (runtime?.capabilities.waitUntil) {
      runtime.waitUntil(
        Promise.resolve().then(() => {
          queuedRuntimeWorkCompleted = true;
        }),
      );
    }

    return {
      platform: (runtime?.platform as KnownRuntimePlatform | undefined) ?? null,
      requestId: runtime?.requestId ?? null,
      capabilities: runtime?.capabilities ?? null,
    };
  }
}

describe("runtime capability conformance", () => {
  beforeEach(() => {
    Container.reset();
    queuedRuntimeWorkCompleted = false;

    const logger = createTestLogger();
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  it("proves the Node request path matches the runtime capability manifest", async () => {
    const app = createConformanceApp();
    const response = await app.fetch(
      new Request(`http://localhost${RUNTIME_CONFORMANCE_PATH}`, {
        headers: createConformanceHeaders("node-conformance-req"),
      }),
    );

    const snapshot = await readRuntimeCapabilitySnapshot(response);

    expect(snapshot.requestId).toBe("node-conformance-req");
    expectRuntimeSnapshotToMatchManifest("node", snapshot);
    expect(queuedRuntimeWorkCompleted).toBe(false);
  });

  it("proves the Lambda adapter path matches the runtime capability manifest", async () => {
    const app = createConformanceApp();
    const handler = app.lambdaHandler({ logger: createTestLogger() });

    const response = await handler(
      createLambdaEvent("lambda-conformance-req"),
      createLambdaContext("aws-lambda-conformance-req"),
    );

    expect(response.statusCode).toBe(200);
    const snapshot = JSON.parse(response.body ?? "{}") as RuntimeCapabilitySnapshot;

    expect(snapshot.requestId).toBe("lambda-conformance-req");
    expectRuntimeSnapshotToMatchManifest("lambda", snapshot);
    expect(queuedRuntimeWorkCompleted).toBe(true);
  });

  it("proves the Cloudflare Workers fetch path matches the runtime capability manifest", async () => {
    const app = createConformanceApp();
    const waitUntil = vi.fn();
    const response = await app.fetch(
      new Request(`http://localhost${RUNTIME_CONFORMANCE_PATH}`, {
        headers: createConformanceHeaders("workers-conformance-req"),
      }),
      undefined,
      {
        env: { WORKER_ENV: "test" },
        executionContext: { waitUntil } as never,
      },
    );

    const snapshot = await readRuntimeCapabilitySnapshot(response);

    expect(snapshot.requestId).toBe("workers-conformance-req");
    expectRuntimeSnapshotToMatchManifest("cloudflare-workers", snapshot);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "Lambda streaming response route",
      platform: "lambda",
      capability: "streamingResponse",
      targetKind: "route",
      targetId: "StreamingController",
      operation: "download",
      file: "fixtures/lambda/StreamingController.ts",
      symbol: "StreamingController.download",
    },
    {
      label: "Node deferred event handler",
      platform: "node",
      capability: "waitUntil",
      targetKind: "event-handler",
      targetId: "DeferredWorkHook",
      operation: "enqueue",
      file: "fixtures/node/DeferredWorkHook.ts",
      symbol: "DeferredWorkHook.enqueue",
    },
    {
      label: "Node telemetry flush hook",
      platform: "node",
      capability: "flush",
      targetKind: "service",
      targetId: "TelemetryFlushHook",
      operation: "flush",
      file: "fixtures/node/TelemetryFlushHook.ts",
      symbol: "TelemetryFlushHook.flush",
    },
    {
      label: "Workers filesystem provider",
      platform: "cloudflare-workers",
      capability: "filesystem",
      targetKind: "service",
      targetId: "AssetProvider",
      operation: "read",
      file: "fixtures/workers/AssetProvider.ts",
      symbol: "AssetProvider.read",
    },
    {
      label: "Workers Node API route",
      platform: "cloudflare-workers",
      capability: "nodeApi",
      targetKind: "route",
      targetId: "AdminController",
      operation: "inspect",
      file: "fixtures/workers/AdminController.ts",
      symbol: "AdminController.inspect",
    },
  ] as const)("rejects the $label with stable recovery guidance", (drill) => {
    const target = createPolicyTarget(drill.targetKind, drill.targetId, {
      operation: drill.operation,
      source: { file: drill.file, symbol: drill.symbol },
    });
    const table = compilePolicyTable([
      definePolicy(
        target,
        { kind: "retry", maxAttempts: 2 },
        { requiredCapabilities: [drill.capability] },
      ),
    ]);
    const manifest = createRuntimeCapabilityManifest(drill.platform);
    const entry = table.plans[0]?.entries[0];

    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }

    expect(entry.target).toEqual(target);
    expect(entry.requiredCapabilities).toEqual([drill.capability]);

    expect(checkPolicyTableRuntimeCapabilityManifest(table, manifest)).toEqual([
      expect.objectContaining({
        code: POLICY_CAPABILITY_UNAVAILABLE_CODE,
        target,
        targetRuntime: drill.platform,
        capability: drill.capability,
        source: { file: drill.file, symbol: drill.symbol },
      }),
    ]);

    const source = entry.source ?? entry.target.source;
    const requirements: RuntimeCapabilityRequirement[] = entry.requiredCapabilities.map(
      (capability) => ({
        capability,
        source: source?.file ? { file: source.file } : undefined,
      }),
    );

    expect(checkRuntimeCapabilityRequirements(manifest, requirements)).toEqual([
      {
        code: RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE,
        severity: "error",
        platform: drill.platform,
        capability: drill.capability,
        message: `Runtime platform '${drill.platform}' does not support capability '${drill.capability}'.`,
        source: { file: drill.file },
      },
    ]);
    expect(
      getDiagnosticCodeDefinition(RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE)?.action,
    ).toBe(
      "Choose a runtime that supports the capability, remove the requirement, or move the code behind an adapter that declares a supported capability.",
    );
  });
});

function createConformanceApp(): CrocoApp {
  return createApp({
    controllers: [RuntimeCapabilityConformanceController],
    securityValidation: "off",
  });
}

function createTestLogger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  } as unknown as Logger;
}

function createConformanceHeaders(requestId: string): HeadersInit {
  return {
    traceparent: TRACEPARENT,
    "x-request-id": requestId,
  };
}

async function readRuntimeCapabilitySnapshot(
  response: Response,
): Promise<RuntimeCapabilitySnapshot> {
  expect(response.status).toBe(200);
  return (await response.json()) as RuntimeCapabilitySnapshot;
}

function expectRuntimeSnapshotToMatchManifest(
  platform: KnownRuntimePlatform,
  snapshot: RuntimeCapabilitySnapshot,
): void {
  expect(snapshot.platform).toBe(platform);
  expect(snapshot.capabilities).toEqual(createRuntimeCapabilityManifest(platform).capabilities);
}

function createLambdaEvent(requestId: string): LambdaEvent {
  return {
    version: "2.0",
    routeKey: `GET ${RUNTIME_CONFORMANCE_PATH}`,
    rawPath: RUNTIME_CONFORMANCE_PATH,
    rawQueryString: "",
    headers: createConformanceHeaders(requestId) as Record<string, string>,
    requestContext: {
      accountId: "123456789012",
      apiId: "api-123",
      domainName: "example.execute-api.ap-northeast-2.amazonaws.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: RUNTIME_CONFORMANCE_PATH,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId,
      routeKey: "$default",
      stage: "$default",
      time: "17/Mar/2026:12:00:00 +0000",
      timeEpoch: 1710676800000,
    },
    isBase64Encoded: false,
  };
}

function createLambdaContext(awsRequestId: string): LambdaContext {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "runtime-capability-conformance",
    functionVersion: "$LATEST",
    invokedFunctionArn:
      "arn:aws:lambda:ap-northeast-2:123456789012:function:runtime-capability-conformance",
    logGroupName: "/aws/lambda/runtime-capability-conformance",
    logStreamName: "2026/07/06/[$LATEST]abcdef",
    memoryLimitInMB: "128",
    awsRequestId,
    done: () => undefined,
    fail: () => undefined,
    getRemainingTimeInMillis: () => 5000,
    succeed: () => undefined,
  };
}
