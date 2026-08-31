import { Container as TypeDIContainer } from "typedi";
import {
  Context as FrameworkContext,
  createRuntimeCapabilityManifest,
  LOGGER_TOKEN,
} from "@croco/framework-context";
import type { RuntimeCapabilityManifest, RuntimeContext } from "@croco/framework-context";
import { buildContractGraph } from "@croco/protocols-core";
import {
  CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES,
  CONTRACT_TEST_PROFILES,
  createContractCaseArbitrary,
  createTestKernel,
  runContractFuzz,
  runContractRuntimeDifferential,
} from "@croco/testing";
import type {
  ContractExecutionObservation,
  ContractGeneratedCase,
  ContractLifecycleObservation,
  ContractLifecycleOutcome,
  ContractRuntimeLifecycleCapability,
} from "@croco/testing";
import type { MiddlewareFunction } from "@croco/transports-http";
import { beforeEach, describe, expect, it } from "vitest";
import { createCrocoApp } from "../app";
import { JobsController } from "../controllers/JobsController";
import { SaasDemoSmokeProblem } from "../problems";

const route = getJobsListRoute();

const nodeManifest = createRuntimeCapabilityManifest("node");
const lambdaManifest = createRuntimeCapabilityManifest("lambda");
const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

type RuntimeEvidence = {
  abortSignalPresent: boolean;
  deadlineRemaining: number | undefined;
  flushReturned: boolean;
  lifecycleRequested: boolean;
  shutdownOutcome: ContractLifecycleOutcome | undefined;
  tracePropagation: unknown;
  waitUntilWorkCompleted: boolean;
};

type TypeDIContainerRegistry = {
  readonly instances: readonly { readonly id: string }[];
};

const runtimeEvidence = new Map<string, RuntimeEvidence>();

describe("generated contract verification", () => {
  beforeEach(() => {
    runtimeEvidence.clear();
  });

  it("runs bounded route fuzzing and Node/Lambda parity through the production bootstrap", async () => {
    const nodeApp = createCrocoApp({ additionalMiddlewares: [runtimeEvidenceMiddleware] });
    const lambdaApp = createCrocoApp({ additionalMiddlewares: [runtimeEvidenceMiddleware] });
    const nodeScopeId = nodeApp.applicationRuntime.scopeId;
    const lambdaScopeId = lambdaApp.applicationRuntime.scopeId;
    const nodeScope = TypeDIContainer.of(nodeScopeId);
    const lambdaScope = TypeDIContainer.of(lambdaScopeId);

    expect(nodeScope.has(LOGGER_TOKEN)).toBe(true);
    expect(lambdaScope.has(LOGGER_TOKEN)).toBe(true);

    {
      await using node = await createTestKernel({
        adapter: "node",
        applicationRuntime: nodeApp.applicationRuntime,
        bootstrap: () => nodeApp,
        fidelity: "adapter",
        validation: { di: "warn" },
      });
      await using lambda = await createTestKernel({
        adapter: "lambda",
        applicationRuntime: lambdaApp.applicationRuntime,
        bootstrap: () => lambdaApp,
        fidelity: "adapter",
        validation: { di: "warn" },
      });

      const fuzzCases = createContractCaseArbitrary(route).map((testCase) => ({
        ...testCase,
        input: {
          ...testCase.input,
          transportHeaders: { ...testCase.input.transportHeaders, traceparent: TRACEPARENT },
        },
      }));
      const profile = "pr";
      const fuzz = await runContractFuzz({
        route,
        runtime: "node",
        profile,
        arbitrary: fuzzCases,
        execute: async (testCase) => {
          const request = createRequest(testCase);
          return observe(
            "node",
            testCase.canarySecret,
            await node.http.get(request.path, request.options),
            nodeManifest,
          );
        },
      });

      expect(fuzz).toMatchObject({
        status: "passed",
        numRuns: CONTRACT_TEST_PROFILES[profile].numRuns,
        runtime: "node",
      });

      const parityCase: ContractGeneratedCase = {
        canarySecret: "croco-canary-generated-app",
        input: {
          headers: { "x-croco-fuzz-canary": "croco-canary-generated-app" },
          query: {},
          transportHeaders: {
            traceparent: TRACEPARENT,
            "x-croco-lifecycle-observation": "true",
          },
        },
        kind: "valid",
      };
      const differential = await runContractRuntimeDifferential({
        route,
        testCase: parityCase,
        targets: [
          {
            runtime: "node",
            capabilities: nodeManifest,
            execute: async () => {
              const request = createRequest(parityCase);
              return observe(
                "node",
                parityCase.canarySecret,
                await node.http.get(request.path, request.options),
                nodeManifest,
              );
            },
          },
          {
            runtime: "lambda",
            capabilities: lambdaManifest,
            execute: async () => {
              const request = createRequest(parityCase);
              return observe(
                "lambda",
                parityCase.canarySecret,
                await lambda.http.get(request.path, request.options),
                lambdaManifest,
              );
            },
          },
        ],
      });

      expect(differential.status).toBe("passed");
    }

    expect(() => nodeApp.applicationRuntime.run(() => undefined)).toThrow(/already been disposed/);
    expect(() => lambdaApp.applicationRuntime.run(() => undefined)).toThrow(
      /already been disposed/,
    );
    expect(nodeScope.has(LOGGER_TOKEN)).toBe(false);
    expect(lambdaScope.has(LOGGER_TOKEN)).toBe(false);
    const activeScopeIds = getTypeDIContainerScopeIds();
    expect(activeScopeIds).not.toContain(nodeScopeId);
    expect(activeScopeIds).not.toContain(lambdaScopeId);
  });
});

function getTypeDIContainerScopeIds(): readonly string[] {
  const registry = TypeDIContainer as unknown as TypeDIContainerRegistry;
  return registry.instances.map((instance) => instance.id);
}

function createRequest(testCase: ContractGeneratedCase): {
  readonly options: {
    readonly headers?: Record<string, string>;
    readonly query?: Record<
      string,
      | string
      | number
      | boolean
      | null
      | undefined
      | readonly (string | number | boolean | null | undefined)[]
    >;
  };
  readonly path: string;
} {
  const query: Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly (string | number | boolean | null | undefined)[]
  > = isRecord(testCase.input.query) ? normalizeRecord(testCase.input.query) : {};

  return {
    path: route.path,
    options: {
      headers: isRecord(testCase.input.headers)
        ? {
            ...normalizeHeaders(testCase.input.headers),
            ...testCase.input.transportHeaders,
          }
        : testCase.input.transportHeaders,
      query: Object.keys(query).length > 0 ? query : undefined,
    },
  };
}

async function observe(
  runtime: "node" | "lambda",
  evidenceId: string,
  response: Response,
  manifest: RuntimeCapabilityManifest,
): Promise<ContractExecutionObservation> {
  const text = await response.text();
  const evidence = requireRuntimeEvidence(runtime, evidenceId);
  const observation = {
    status: response.status,
    body: readResponseBody(response, text),
    headers: Object.fromEntries(response.headers.entries()),
    tracePropagation: evidence.tracePropagation,
  } satisfies ContractExecutionObservation;
  if (!evidence.lifecycleRequested) return observation;
  if (!evidence.shutdownOutcome) {
    throw new SaasDemoSmokeProblem(["Runtime shutdown observation was not recorded."]);
  }
  return {
    ...observation,
    lifecycle: createLifecycleObservations(manifest, {
      streamingResponse:
        runtime === "node"
          ? response.body instanceof ReadableStream
            ? succeeded("response-stream-consumed")
            : failed("response-stream-missing")
          : unsupported("adapter-buffered-response"),
      deadline:
        evidence.deadlineRemaining === undefined
          ? runtime === "lambda"
            ? failed("remaining-time-missing")
            : unsupported("native-deadline-absent")
          : succeeded("remaining-time-observed"),
      abortSignal: evidence.abortSignalPresent
        ? succeeded("request-signal-observed")
        : unsupported("request-signal-absent"),
      waitUntil:
        runtime === "lambda"
          ? evidence.waitUntilWorkCompleted
            ? succeeded("work-completed")
            : failed("work-incomplete")
          : unsupported("runtime-wait-unavailable"),
      flush:
        runtime === "lambda"
          ? evidence.flushReturned
            ? succeeded("runtime-flush-completed")
            : failed("runtime-flush-incomplete")
          : unsupported("runtime-flush-unavailable"),
      shutdown: evidence.shutdownOutcome,
    }),
  };
}

function readResponseBody(response: Response, text: string): unknown {
  if (text.length === 0) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const trimmed = text.trimStart();
  if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(text);
  }

  return text;
}

function createLifecycleObservations(
  manifest: RuntimeCapabilityManifest,
  outcomes: Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>>,
): Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleObservation>> {
  return Object.fromEntries(
    CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES.map((capability) => [
      capability,
      {
        supported: manifest.capabilities[capability],
        outcome: outcomes[capability],
      },
    ]),
  ) as Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleObservation>>;
}

function succeeded(value: unknown): ContractLifecycleOutcome {
  return { status: "succeeded", value };
}

function unsupported(reason: unknown): ContractLifecycleOutcome {
  return { status: "unsupported", reason };
}

function failed(message: string): ContractLifecycleOutcome {
  return { status: "failed", error: message };
}

const runtimeEvidenceMiddleware: MiddlewareFunction = async (context, next) => {
  const runtime = FrameworkContext.getRuntimeContext();
  const platform = runtime?.platform;
  if (!runtime || !isObservedRuntime(platform)) {
    throw new SaasDemoSmokeProblem([
      "Generated contract verification requires a Node or Lambda runtime context.",
    ]);
  }
  const evidenceId = context.header("x-croco-fuzz-canary");
  if (!evidenceId) {
    throw new SaasDemoSmokeProblem([
      "Generated contract verification requires an x-croco-fuzz-canary header.",
    ]);
  }
  const lifecycleRequested = context.header("x-croco-lifecycle-observation") === "true";
  const evidence = captureRuntimeEvidence(runtime, lifecycleRequested);
  runtimeEvidence.set(evidenceKey(platform, evidenceId), evidence);
  const response = await next();
  if (!lifecycleRequested) return response;
  runtime.waitUntil(
    new Promise<void>((resolve) => {
      setTimeout(() => {
        evidence.waitUntilWorkCompleted = true;
        resolve();
      }, 0);
    }),
  );
  await runtime.flush();
  evidence.flushReturned = true;
  evidence.shutdownOutcome = await observeRuntimeShutdown(runtime);
  return response;
};

function isObservedRuntime(value: unknown): value is "node" | "lambda" {
  return value === "node" || value === "lambda";
}

function captureRuntimeEvidence(
  runtime: RuntimeContext,
  lifecycleRequested: boolean,
): RuntimeEvidence {
  return {
    abortSignalPresent: runtime.abortSignal !== undefined,
    deadlineRemaining: readLambdaRemainingTime(runtime.native),
    flushReturned: false,
    lifecycleRequested,
    shutdownOutcome: undefined,
    tracePropagation: runtime.trace,
    waitUntilWorkCompleted: false,
  };
}

async function observeRuntimeShutdown(runtime: RuntimeContext): Promise<ContractLifecycleOutcome> {
  try {
    await runtime.shutdown();
    return runtime.capabilities.shutdown
      ? succeeded("runtime-shutdown-completed")
      : unsupported("runtime-shutdown-call-returned-without-support");
  } catch (error) {
    return { status: "failed", error };
  }
}

function readLambdaRemainingTime(
  native: Readonly<Record<string, unknown>> | undefined,
): number | undefined {
  const lambdaContext = native?.lambdaContext;
  if (
    typeof lambdaContext !== "object" ||
    lambdaContext === null ||
    !("getRemainingTimeInMillis" in lambdaContext) ||
    typeof lambdaContext.getRemainingTimeInMillis !== "function"
  ) {
    return undefined;
  }
  return lambdaContext.getRemainingTimeInMillis();
}

function requireRuntimeEvidence(runtime: "node" | "lambda", evidenceId: string): RuntimeEvidence {
  const key = evidenceKey(runtime, evidenceId);
  const evidence = runtimeEvidence.get(key);
  if (!evidence) {
    throw new SaasDemoSmokeProblem([
      `The ${runtime} adapter did not expose correlated runtime contract evidence.`,
    ]);
  }
  runtimeEvidence.delete(key);
  return evidence;
}

function evidenceKey(runtime: "node" | "lambda", evidenceId: string): string {
  return `${runtime}:${evidenceId}`;
}

function normalizeHeaders(value: Record<string, unknown>): Record<string, string> | undefined {
  const headers = Object.fromEntries(
    Object.entries(value).map(([name, headerValue]) => [name, String(headerValue)]),
  );
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function normalizeRecord(
  value: Record<string, unknown>,
): Record<
  string,
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[]
> {
  return Object.fromEntries(
    Object.entries(value).map(([name, entry]) => [
      name,
      Array.isArray(entry)
        ? entry.map((item) => normalizeQueryValue(item))
        : normalizeQueryValue(entry),
    ]),
  );
}

function normalizeQueryValue(value: unknown): string | number | boolean | null | undefined {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getJobsListRoute() {
  const candidate = buildContractGraph([JobsController]).routes.find(
    (graphRoute) => graphRoute.routeId === "JobsController.list",
  );
  if (!candidate) {
    throw new Error("Generated SaaS app is missing the jobs list contract.");
  }
  return candidate;
}
