import "reflect-metadata";
import {
  Container,
  Context as FrameworkContext,
  createRuntimeCapabilityManifest,
  RUNTIME_CAPABILITY_NAMES,
  RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE,
  type KnownRuntimePlatform,
  type RuntimeCapabilities,
} from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type CrocoApp } from "../libs/CrocoApp";
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

  it("emits stable diagnostics for unsupported requirements on every runtime manifest", () => {
    for (const platform of ["node", "lambda", "cloudflare-workers"] as const) {
      const manifest = createRuntimeCapabilityManifest(platform, {
        requirements: RUNTIME_CAPABILITY_NAMES.map((capability) => ({
          capability,
          source: { file: `fixtures/${platform}.ts` },
        })),
      });
      const unsupportedCapabilities = RUNTIME_CAPABILITY_NAMES.filter(
        (capability) => !manifest.capabilities[capability],
      ).sort();

      expect(
        manifest.diagnostics.map(({ code, platform: diagnosticPlatform, capability, source }) => ({
          code,
          platform: diagnosticPlatform,
          capability,
          source,
        })),
      ).toEqual(
        unsupportedCapabilities.map((capability) => ({
          code: RUNTIME_CAPABILITY_UNSUPPORTED_DIAGNOSTIC_CODE,
          platform,
          capability,
          source: { file: `fixtures/${platform}.ts` },
        })),
      );
    }
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
