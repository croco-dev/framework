import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { Component, Container, Inject, Token } from "@croco/framework-context";
import { Problem, type ProblemDetails } from "@croco/problems-core";
import { AuthGuard, type ExecutionContext } from "@croco/protocols-rest";
import { withSpan } from "@croco/telemetry-api";
import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import {
  createOperationalFailureDrillMatrix,
  type OperationalFailureDrillDiagnostic,
  type OperationalFailureDrillProblemOutcome,
  type OperationalFailureDrillReport,
  type OperationalFailureDrillScenario,
  renderOperationalFailureDrillMarkdown,
  runOperationalFailureDrills,
  serializeOperationalFailureDrillReport,
} from "@croco/testing";
import {
  createWebhookEventRouter,
  InMemoryIdempotencyStore,
  InvalidWebhookSignatureProblem,
  WebhookGateway,
  type WebhookGatewayStoredResult,
  type WebhookProviderAdapter,
} from "@croco/webhooks-core";
import { createCrocoApp } from "../app";
import { generatedSaasProviderProfileManifest } from "../generatedSaasProviderProfile";
import { assertRealProviderEnv, ProviderProfileEnvMissingError } from "../provider-profile-env";

const PROVIDER_ENV_RECOVERY =
  "Configure every required provider environment variable with a non-placeholder value and rerun the profile check.";
const TELEMETRY_RECOVERY =
  "Restore the OTLP exporter endpoint, inspect telemetry diagnostics, and retry only idempotent operations.";
const DI_PROVIDER_RECOVERY =
  "Register the missing provider token before startup and rerun the DI graph check.";
const DI_SCOPE_RECOVERY =
  "Move request-scoped work behind a request boundary or inject a request-safe factory.";
const ROUTE_VALIDATION_RECOVERY =
  "Correct the request body to match the route contract before retrying.";
const RATE_LIMIT_RECOVERY =
  "Wait for the advertised reset window or reduce request volume before retrying.";
const AUTH_RECOVERY =
  "Restore the authentication verifier and retry only after its health check passes.";
const WEBHOOK_RECOVERY =
  "Reject the delivery, verify the provider secret and raw body, then request a signed redelivery.";
const NORMALIZED_RESET_AT = "<normalized-reset-at>";
const NORMALIZED_RETRY_AFTER_SECONDS = "<normalized-retry-after-seconds>";
const NORMALIZED_REQUEST_ID = "<normalized-request-id>";
const NORMALIZED_TRACE_ID = "<normalized-trace-id>";

export async function runGeneratedOperationalFailureDrills(): Promise<OperationalFailureDrillReport> {
  const report = await runOperationalFailureDrills(
    createOperationalFailureDrillMatrix(createGeneratedOperationalFailureDrillMatrix()),
  );
  const outputDir = join(resolveProjectRoot(), "ci-reports", "failure-drills");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, "operational.json"),
    serializeOperationalFailureDrillReport(report),
  );
  await writeFile(join(outputDir, "operational.md"), renderOperationalFailureDrillMarkdown(report));
  return report;
}

function createGeneratedOperationalFailureDrillMatrix(): readonly OperationalFailureDrillScenario[] {
  return [
    createProviderEnvironmentScenario(),
    createTelemetryExporterScenario(),
    createMissingDiProviderScenario(),
    createDiScopeMismatchScenario(),
    createRouteValidationScenario(),
    createRateLimitScenario(),
    createAuthVerifierScenario(),
    createWebhookSignatureScenario(),
  ];
}

function createProviderEnvironmentScenario(): OperationalFailureDrillScenario {
  const required = generatedSaasProviderProfileManifest.env.required;
  const missingEnv = required
    .map(({ name }) => name)
    .filter((name) => name !== "SAAS_PROVIDER_PROFILE");
  const expectedDiagnostic = {
    code: "CROCO_SAAS_PROFILE_ENV_MISSING",
    fields: { missingEnv },
  } as const;
  const provenance = {
    boundary: "generated-saas.provider-profile-env",
    fixture: "missing-required-provider-environment",
  } as const;

  return {
    id: "provider-environment-missing",
    name: "Missing provider environment",
    description:
      "Runs the generated real-provider environment validator with required values absent.",
    expected: {
      kind: "diagnostic",
      diagnostic: expectedDiagnostic,
      provenance,
      recoveryAction: PROVIDER_ENV_RECOVERY,
    },
    run: () => {
      try {
        assertRealProviderEnv(
          {
            profile: generatedSaasProviderProfileManifest.profile,
            env: { required },
          },
          {
            SAAS_PROVIDER_PROFILE: generatedSaasProviderProfileManifest.profile.name,
          },
        );
      } catch (error) {
        if (!(error instanceof ProviderProfileEnvMissingError)) throw error;
        return {
          kind: "diagnostic",
          diagnostic: error.diagnostic,
          provenance,
          recoveryAction: PROVIDER_ENV_RECOVERY,
        };
      }

      throw new Error("Expected the generated provider environment validator to fail.");
    },
  };
}

function createTelemetryExporterScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "telemetry-sdk-node.TelemetryRuntime.forceFlush",
    fixture: "loopback-otlp-http-503",
  } as const;

  return {
    id: "telemetry-exporter-unavailable",
    name: "Unavailable telemetry exporter",
    description: "Exports one real span to an ephemeral loopback OTLP endpoint returning 503.",
    expected: {
      kind: "problem",
      problem: {
        code: "TELEMETRY_RUNTIME_ERROR",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
      },
      diagnostics: [
        {
          code: "CROCO_FAILURE_DRILL_OTLP_EXPORT_ATTEMPTED",
          fields: { received: true },
        },
      ],
      provenance,
      recoveryAction: TELEMETRY_RECOVERY,
    },
    run: async () => {
      let receivedRequests = 0;
      const server = createServer((_request, response) => {
        receivedRequests += 1;
        setTimeout(() => {
          response.writeHead(503, { "content-type": "text/plain" });
          response.end("collector unavailable");
        }, 1_500);
      });
      await listenOnLoopback(server);
      const address = server.address() as AddressInfo;

      try {
        await TelemetryRuntime.reset();
        const runtime = TelemetryRuntime.getInstance();
        await runtime.init({
          serviceName: "croco-generated-failure-drill",
          trace: {
            enabled: true,
            exporterUrl: `http://127.0.0.1:${address.port}/v1/traces`,
            batchTimeout: 60_000,
            batchCount: 2_048,
            batchSize: 512,
          },
        });
        await withSpan(() => undefined, {
          name: "failure-drill.telemetry-exporter-unavailable",
        });
        const flush = await runtime.forceFlush(1_000);

        if (flush.outcome !== "failed") {
          throw new Error("Expected telemetry forceFlush to surface an unavailable exporter.");
        }
        if (receivedRequests === 0) {
          throw new Error("Telemetry exporter failed without sending loopback OTLP traffic.");
        }

        return {
          kind: "problem",
          problem: flush.error,
          diagnostics: [
            {
              code: "CROCO_FAILURE_DRILL_OTLP_EXPORT_ATTEMPTED",
              fields: { received: true },
            },
          ],
          provenance,
          recoveryAction: TELEMETRY_RECOVERY,
        };
      } finally {
        try {
          await TelemetryRuntime.reset();
        } finally {
          await closeServer(server);
        }
      }
    },
  };
}

function createMissingDiProviderScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "framework-context.Container",
    fixture: "missing-provider-token",
  } as const;
  const expectedDiagnostic = {
    code: "CROCO_DI_001",
    fields: {
      legacyCode: "framework-context/di-missing-provider",
      status: "missing",
    },
  } as const;

  return {
    id: "di-provider-missing",
    name: "Missing DI provider",
    description: "Builds and resolves a real Croco dependency graph with one absent token.",
    expected: {
      kind: "problem",
      problem: {
        code: "framework-context/di-resolution-failed",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
        extensions: { reason: "missing-provider" },
      },
      diagnostics: [expectedDiagnostic],
      provenance,
      recoveryAction: DI_PROVIDER_RECOVERY,
    },
    run: () => {
      const token = new Token<string>("failure-drill.missing-provider");
      class MissingProviderDrill {
        constructor(readonly value: string) {}
      }
      Reflect.defineMetadata("design:paramtypes", [Object], MissingProviderDrill);
      (Inject(token) as ParameterDecorator)(MissingProviderDrill, undefined, 0);
      Component({ scope: "transient" })(MissingProviderDrill);

      try {
        const diagnostic = requireGraphDiagnostic(
          Container.createDependencyGraphManifest({
            roots: [MissingProviderDrill],
          }),
          "CROCO_DI_001",
        );
        const problem = captureProblem(() => Container.get(MissingProviderDrill));
        return {
          kind: "problem",
          problem,
          diagnostics: [toOperationalDiagnostic(diagnostic)],
          provenance,
          recoveryAction: DI_PROVIDER_RECOVERY,
        };
      } finally {
        Container.remove(MissingProviderDrill);
        Container.remove(token);
      }
    },
  };
}

function createDiScopeMismatchScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "framework-context.Container",
    fixture: "singleton-captures-request-scope",
  } as const;
  const expectedDiagnostic = {
    code: "CROCO_DI_003",
    fields: {
      legacyCode: "framework-context/di-scope-mismatch",
      status: "scope-mismatch",
    },
  } as const;

  return {
    id: "di-scope-mismatch",
    name: "DI scope mismatch",
    description: "Resolves a singleton that captures a request-scoped dependency.",
    expected: {
      kind: "problem",
      problem: {
        code: "framework-context/di-scope-mismatch",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
        extensions: { reason: "scope-mismatch" },
      },
      diagnostics: [expectedDiagnostic],
      provenance,
      recoveryAction: DI_SCOPE_RECOVERY,
    },
    run: () => {
      class FailureDrillRequestDependency {}
      class FailureDrillSingleton {
        constructor(readonly dependency: FailureDrillRequestDependency) {}
      }
      Reflect.defineMetadata("design:paramtypes", [], FailureDrillRequestDependency);
      Reflect.defineMetadata(
        "design:paramtypes",
        [FailureDrillRequestDependency],
        FailureDrillSingleton,
      );
      Component({ scope: "request" })(FailureDrillRequestDependency);
      Component()(FailureDrillSingleton);

      try {
        const diagnostic = requireGraphDiagnostic(
          Container.createDependencyGraphManifest({
            roots: [FailureDrillSingleton],
          }),
          "CROCO_DI_003",
        );
        const problem = captureProblem(() => Container.get(FailureDrillSingleton));
        return {
          kind: "problem",
          problem,
          diagnostics: [toOperationalDiagnostic(diagnostic)],
          provenance,
          recoveryAction: DI_SCOPE_RECOVERY,
        };
      } finally {
        Container.remove(FailureDrillSingleton);
        Container.remove(FailureDrillRequestDependency);
      }
    },
  };
}

function createRouteValidationScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "generated-saas.CrocoApp.fetch",
    fixture: "invalid-job-action-body",
  } as const;

  return {
    id: "route-validation-failure",
    name: "Route validation failure",
    description: "Sends an invalid JSON body through the generated route-contract parser.",
    expected: {
      kind: "problem",
      problem: {
        code: "protocols-rest/request-validation-failed",
        status: 422,
        title: "Validation Error",
        type: "about:blank",
        extensions: {
          requestId: NORMALIZED_REQUEST_ID,
          traceId: NORMALIZED_TRACE_ID,
        },
      },
      provenance,
      recoveryAction: ROUTE_VALIDATION_RECOVERY,
    },
    run: () =>
      runWithLoopbackTelemetry(async () => {
        const app = createCrocoApp();
        const response = await app.fetch(
          new Request("http://localhost/ops/jobs/failure-drill/cancel", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": "127.0.0.1",
            },
            body: JSON.stringify({ reason: 42 }),
          }),
        );
        const problem = normalizeHttpProblemEvidence(await readProblemResponse(response));
        if (!Array.isArray(problem.issues) || problem.issues.length === 0) {
          throw new Error("Generated route validation did not expose structured issues.");
        }
        return {
          kind: "problem",
          problem,
          provenance,
          recoveryAction: ROUTE_VALIDATION_RECOVERY,
        };
      }),
  };
}

function createRateLimitScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "generated-saas.rateLimitHttpMiddleware",
    fixture: "101-requests-single-client",
  } as const;

  return {
    id: "rate-limit-exhausted",
    name: "Rate limit exhausted",
    description:
      "Exhausts the generated 100-request sliding-window policy through real HTTP middleware.",
    expected: {
      kind: "problem",
      problem: {
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
        title: "Too Many Requests",
        type: "about:blank",
        extensions: {
          limit: 100,
          remaining: 0,
          requestId: NORMALIZED_REQUEST_ID,
          resetAt: NORMALIZED_RESET_AT,
          retryAfterSeconds: NORMALIZED_RETRY_AFTER_SECONDS,
          traceId: NORMALIZED_TRACE_ID,
        },
      },
      diagnostics: [
        {
          code: "CROCO_FAILURE_DRILL_RATE_LIMIT_HEADERS",
          fields: {
            limit: "100",
            remaining: "0",
            reset: true,
            retryAfter: true,
          },
        },
      ],
      provenance,
      recoveryAction: RATE_LIMIT_RECOVERY,
    },
    run: () =>
      runWithLoopbackTelemetry(async () => {
        const app = createCrocoApp();
        const request = () =>
          new Request("http://localhost/ops/jobs?limit=0", {
            headers: { "x-forwarded-for": "127.0.0.1" },
          });
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const allowed = await app.fetch(request());
          if (allowed.status !== 200) {
            throw new Error(
              `Rate-limit fixture request ${attempt + 1} returned ${allowed.status}.`,
            );
          }
        }
        const response = await app.fetch(request());
        const rawProblem = normalizeHttpProblemEvidence(await readProblemResponse(response));
        const diagnostics = readRateLimitHeaderEvidence(response);
        const problem = {
          ...rawProblem,
          resetAt: NORMALIZED_RESET_AT,
          retryAfterSeconds: NORMALIZED_RETRY_AFTER_SECONDS,
        } satisfies ProblemDetails;

        return {
          kind: "problem",
          problem,
          diagnostics: [diagnostics],
          provenance,
          recoveryAction: RATE_LIMIT_RECOVERY,
        };
      }),
  };
}

function createAuthVerifierScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "protocols-rest.AuthGuard.canActivate",
    fixture: "verifier-econnreset",
  } as const;

  return {
    id: "auth-verifier-unavailable",
    name: "Auth verifier unavailable",
    description: "Executes AuthGuard with a verifier transport outage.",
    expected: {
      kind: "problem",
      problem: {
        code: "protocols-rest/auth-verifier-unavailable",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
      },
      provenance,
      recoveryAction: AUTH_RECOVERY,
    },
    run: async () => {
      const guard = new AuthGuard({
        verifier: () => {
          throw new Error("ECONNRESET");
        },
      });
      const request = new Request("http://localhost/protected", {
        headers: { authorization: "Bearer failure-drill-token" },
      });
      const context: ExecutionContext = {
        getRequest: () => request,
        getClass: () => class FailureDrillController {},
        getHandler: () => "protected",
        getPath: () => "/protected",
        getMethod: () => "GET",
      };

      try {
        await guard.canActivate(context);
      } catch (error) {
        return problemOutcome(error, provenance, AUTH_RECOVERY);
      }
      throw new Error("Expected AuthGuard to reject an unavailable verifier.");
    },
  };
}

function createWebhookSignatureScenario(): OperationalFailureDrillScenario {
  const provenance = {
    boundary: "webhooks-core.WebhookGateway.handle",
    fixture: "invalid-signature-zero-dispatch",
  } as const;

  return {
    id: "webhook-signature-invalid",
    name: "Invalid webhook signature",
    description: "Rejects an invalid signature before the registered handler can dispatch.",
    expected: {
      kind: "problem",
      problem: {
        code: "webhooks-core/invalid-signature",
        status: 400,
        title: "Bad Request",
        type: "about:blank",
        extensions: { provider: "failure-drill" },
      },
      diagnostics: [
        {
          code: "CROCO_FAILURE_DRILL_WEBHOOK_DISPATCH",
          fields: { dispatchCount: 0 },
        },
      ],
      provenance,
      recoveryAction: WEBHOOK_RECOVERY,
    },
    run: async () => {
      let dispatchCount = 0;
      const adapter: WebhookProviderAdapter = {
        provider: "failure-drill",
        verify: () => {
          throw new InvalidWebhookSignatureProblem({
            provider: "failure-drill",
            reason: "invalid signature",
          });
        },
      };
      const router = createWebhookEventRouter<{
        "subscription.created": { payload: unknown; result: undefined };
      }>().register("subscription.created", async () => {
        dispatchCount += 1;
        return undefined;
      });
      const gateway = new WebhookGateway({
        adapter,
        router,
        idempotencyStore: new InMemoryIdempotencyStore<WebhookGatewayStoredResult>(),
        unknownEventPolicy: "fail",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
      });

      try {
        await gateway.handle({
          rawBody: "{}",
          headers: { "Webhook-Signature": "invalid" },
          receivedAt: new Date("2026-07-11T00:00:00.000Z"),
        });
      } catch (error) {
        if (dispatchCount !== 0) {
          throw new Error(`Invalid webhook signature dispatched ${dispatchCount} handler(s).`);
        }
        return problemOutcome(error, provenance, WEBHOOK_RECOVERY, [
          {
            code: "CROCO_FAILURE_DRILL_WEBHOOK_DISPATCH",
            fields: { dispatchCount },
          },
        ]);
      }
      throw new Error("Expected WebhookGateway to reject an invalid signature.");
    },
  };
}

function captureProblem(run: () => unknown): Problem {
  try {
    run();
  } catch (error) {
    if (error instanceof Problem) return error;
    throw error;
  }
  throw new Error("Expected the DI container to throw a Problem.");
}

function problemOutcome(
  error: unknown,
  provenance: OperationalFailureDrillProblemOutcome["provenance"],
  recoveryAction: string,
  diagnostics?: readonly OperationalFailureDrillDiagnostic[],
): OperationalFailureDrillProblemOutcome {
  if (!(error instanceof Problem)) throw error;
  return {
    kind: "problem",
    problem: error,
    ...(diagnostics === undefined ? {} : { diagnostics }),
    provenance,
    recoveryAction,
  };
}

function requireGraphDiagnostic(
  manifest: ReturnType<typeof Container.createDependencyGraphManifest>,
  code: "CROCO_DI_001" | "CROCO_DI_003",
) {
  const diagnostic = manifest.diagnostics.find((candidate) => candidate.code === code);
  if (!diagnostic) {
    throw new Error(`Dependency graph did not emit ${code}.`);
  }
  return diagnostic;
}

function toOperationalDiagnostic(
  diagnostic: ReturnType<typeof requireGraphDiagnostic>,
): OperationalFailureDrillDiagnostic {
  return {
    code: diagnostic.code,
    fields: {
      legacyCode: diagnostic.legacyCode,
      path: diagnostic.path,
      status: diagnostic.status,
    },
  };
}

async function readProblemResponse(response: Response): Promise<ProblemDetails> {
  const value = (await response.json()) as unknown;
  if (!isProblemDetails(value)) {
    throw new Error(`Expected Problem Details response, received HTTP ${response.status}.`);
  }
  if (value.status !== response.status) {
    throw new Error(
      `Problem Details status ${value.status} did not match HTTP ${response.status}.`,
    );
  }
  return value;
}

function readRateLimitHeaderEvidence(response: Response): OperationalFailureDrillDiagnostic {
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const reset = response.headers.get("X-RateLimit-Reset");
  const retryAfter = response.headers.get("Retry-After");
  if (limit !== "100" || remaining !== "0" || !reset || !retryAfter) {
    throw new Error("Rate-limit response did not expose the required recovery headers.");
  }
  return {
    code: "CROCO_FAILURE_DRILL_RATE_LIMIT_HEADERS",
    fields: { limit, remaining, reset: true, retryAfter: true },
  };
}

function normalizeHttpProblemEvidence(problem: ProblemDetails): ProblemDetails {
  if (
    typeof problem.requestId !== "string" ||
    problem.requestId.length === 0 ||
    typeof problem.traceId !== "string" ||
    problem.traceId.length === 0
  ) {
    throw new Error("Generated HTTP failure did not expose requestId and traceId evidence.");
  }
  return {
    ...problem,
    requestId: NORMALIZED_REQUEST_ID,
    traceId: NORMALIZED_TRACE_ID,
  };
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).code === "string" &&
    typeof (value as Record<string, unknown>).status === "number" &&
    typeof (value as Record<string, unknown>).title === "string" &&
    typeof (value as Record<string, unknown>).type === "string"
  );
}

async function listenOnLoopback(server: Server): Promise<void> {
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

async function runWithLoopbackTelemetry<T>(run: () => Promise<T>): Promise<T> {
  const server = createServer((_request, response) => {
    response.writeHead(200);
    response.end();
  });
  await listenOnLoopback(server);
  const address = server.address() as AddressInfo;

  try {
    await TelemetryRuntime.reset();
    await TelemetryRuntime.getInstance().init({
      serviceName: "croco-generated-failure-drill",
      trace: {
        enabled: true,
        exporterUrl: `http://127.0.0.1:${address.port}/v1/traces`,
      },
    });
    return await run();
  } finally {
    try {
      await TelemetryRuntime.reset();
    } finally {
      await closeServer(server);
    }
  }
}

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (basename(cwd) === "api-server" && basename(dirname(cwd)) === "apps") {
    return resolve(cwd, "../..");
  }
  return cwd;
}
