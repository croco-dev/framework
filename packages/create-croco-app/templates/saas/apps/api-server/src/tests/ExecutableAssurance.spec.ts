import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  createExecutableAssuranceGraph,
  createTestEvidenceBundle,
  createTestEvidenceRecord,
  evaluateExecutableAssuranceGraph,
  type ExecutableAssuranceGraphInput,
} from "@croco/testing";

import { createCrocoApp } from "../app";
import { saasDemoSnapshotSchema } from "../controllers/schemas";
import { SAAS_DEMO_ENDPOINTS_ENABLED_ENV, SAAS_PROVIDER_PROFILE_ENV } from "../providerProfiles";

const usageStateDirectory = vi.hoisted(() => {
  const environmentName = "CROCO_DEMO_USAGE_STATE_DIR";
  const previous = process.env[environmentName];
  const temporaryRoot = process.env.TEMP ?? process.env.TMP ?? process.env.TMPDIR ?? "/tmp";
  const directory = `${temporaryRoot}/croco-executable-assurance-${process.pid}-${Date.now()}`;
  process.env[environmentName] = directory;
  return { directory, previous };
});
const projectRoot = resolve(import.meta.dirname, "../../../..");

afterAll(async () => {
  try {
    await rm(usageStateDirectory.directory, { force: true, recursive: true });
  } finally {
    restoreEnvironment("CROCO_DEMO_USAGE_STATE_DIR", usageStateDirectory.previous);
  }
});

describe("generated SaaS executable assurance", () => {
  it("keeps a passing production bootstrap test below production assurance when validation is overridden", async () => {
    const contractGraph = readJson<NonNullable<ExecutableAssuranceGraphInput["contractGraph"]>>(
      "contract-graph.snapshot.json",
    );
    const projectMap =
      readJson<NonNullable<ExecutableAssuranceGraphInput["projectMap"]>>("croco.project-map.json");
    const runtimeCapability = readJson<
      NonNullable<ExecutableAssuranceGraphInput["runtimeCapability"]>
    >("croco-runtime-capability.manifest.json");
    const route = contractGraph.routes.find(({ operationId }) => operationId === "smokeSaasDemo");
    expect(route).toBeDefined();
    if (!route) return;

    const previousDemo = process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
    const previousProfile = process.env[SAAS_PROVIDER_PROFILE_ENV];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV] = "true";
    process.env[SAAS_PROVIDER_PROFILE_ENV] = "in-memory";

    try {
      const app = createCrocoApp();
      const response = await app.fetch(new Request("http://localhost/saas/demo/smoke"));
      const responseContract = saasDemoSnapshotSchema.safeParse(await response.clone().json());
      const policy = app.describeBootstrapValidationPolicy();
      const evidence = createTestEvidenceRecord({
        id: "generated-saas/saas-demo-smoke",
        runner: "generated-app",
        intent: {
          contractIds: [`route:${route.routeId}`],
          description: "The generated SaaS smoke route returns its public response.",
        },
        observed: {
          contractIds: responseContract.success ? [`route:${route.routeId}#response`] : [],
          routeIds: [route.routeId],
        },
        fidelity: {
          boot: "application",
          dependency: "fake",
          isolation: "fake",
          runtime: "node",
          validation:
            policy.di === "enforce" && policy.security === "enforce" ? "production" : "overridden",
        },
        replay: { command: "pnpm --filter @smoke/api-server test" },
        resources: { leaks: [], status: "clean" },
        attempts: [
          { attempt: 1, outcome: response.ok && responseContract.success ? "passed" : "failed" },
        ],
      });
      const graph = createExecutableAssuranceGraph({
        contractGraph,
        projectMap,
        runtimeCapability,
      });
      const report = evaluateExecutableAssuranceGraph(graph, createTestEvidenceBundle([evidence]));
      const routeAssessment = report.contradictory.find(
        (entry) =>
          "obligation" in entry && entry.obligation.behaviorId === `route:${route.routeId}`,
      );

      expect(response.status).toBe(200);
      expect(responseContract.success).toBe(true);
      expect(policy).toEqual({ di: "warn", security: "enforce" });
      expect(routeAssessment).toMatchObject({
        status: "contradictory",
        reasons: expect.arrayContaining([
          expect.stringContaining(
            "validation is 'overridden', which does not satisfy 'production'",
          ),
        ]),
      });
    } finally {
      restoreEnvironment(SAAS_DEMO_ENDPOINTS_ENABLED_ENV, previousDemo);
      restoreEnvironment(SAAS_PROVIDER_PROFILE_ENV, previousProfile);
      warn.mockRestore();
    }
  });

  it("classifies generated declarations, observations, and removed behavior against real artifacts", async () => {
    const contractGraph = readJson<NonNullable<ExecutableAssuranceGraphInput["contractGraph"]>>(
      "contract-graph.snapshot.json",
    );
    const projectMap =
      readJson<NonNullable<ExecutableAssuranceGraphInput["projectMap"]>>("croco.project-map.json");
    const route = contractGraph.routes.find(({ operationId }) => operationId === "smokeSaasDemo");
    expect(route).toBeDefined();
    if (!route) return;

    const previousDemo = process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
    const previousProfile = process.env[SAAS_PROVIDER_PROFILE_ENV];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    delete process.env[SAAS_DEMO_ENDPOINTS_ENABLED_ENV];
    process.env[SAAS_PROVIDER_PROFILE_ENV] = "in-memory";

    try {
      const response = await createCrocoApp().fetch(
        new Request("http://localhost/saas/demo/smoke"),
      );
      const body = (await response.json()) as { readonly code?: unknown };
      const disabledCode = "saas-demo/demo-endpoint-disabled";
      const evidenceRecords = [
        createTestEvidenceRecord({
          id: "generated-saas/disabled-problem",
          runner: "generated-app",
          intent: {
            contractIds: [`problem:${disabledCode}`],
            description: "The disabled demo endpoint returns its declared public Problem.",
          },
          observed: {
            contractIds: [],
            problemCodes: body.code === disabledCode ? [disabledCode] : [],
          },
          fidelity: generatedApplicationFidelity(),
          replay: { command: "pnpm --filter @smoke/api-server test" },
          resources: { leaks: [], status: "clean" },
          attempts: [
            {
              attempt: 1,
              outcome: response.status === 403 && body.code === disabledCode ? "passed" : "failed",
            },
          ],
        }),
        createTestEvidenceRecord({
          id: "generated-saas/declaration-only",
          runner: "generated-app",
          intent: {
            contractIds: ["problem:saas-demo/smoke-failed"],
            description: "A declaration without runtime observation remains unsatisfied.",
          },
          observed: { contractIds: [] },
          fidelity: generatedApplicationFidelity(),
          replay: { command: "pnpm --filter @smoke/api-server test" },
          resources: { leaks: [], status: "clean" },
          attempts: [{ attempt: 1, outcome: "passed" }],
        }),
        createTestEvidenceRecord({
          id: "generated-saas/observation-only",
          runner: "generated-app",
          intent: { contractIds: [], description: "An undeclared route observation is not proof." },
          observed: { contractIds: [], routeIds: [route.routeId] },
          fidelity: generatedApplicationFidelity(),
          replay: { command: "pnpm --filter @smoke/api-server test" },
          resources: { leaks: [], status: "clean" },
          attempts: [{ attempt: 1, outcome: "passed" }],
        }),
        createTestEvidenceRecord({
          id: "generated-saas/removed-route",
          runner: "generated-app",
          intent: {
            contractIds: ["route:RemovedController.read"],
            description: "A removed route is stale evidence.",
          },
          observed: { contractIds: ["route:RemovedController.read"] },
          fidelity: generatedApplicationFidelity(),
          replay: { command: "pnpm --filter @smoke/api-server test" },
          resources: { leaks: [], status: "clean" },
          attempts: [{ attempt: 1, outcome: "passed" }],
        }),
      ];
      const report = evaluateExecutableAssuranceGraph(
        createExecutableAssuranceGraph({ contractGraph, projectMap }),
        createTestEvidenceBundle(evidenceRecords),
      );

      expect(response.status).toBe(403);
      expect(report.satisfied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            obligation: expect.objectContaining({ behaviorId: `problem:${disabledCode}` }),
          }),
        ]),
      );
      expect(report.contradictory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            obligation: expect.objectContaining({ behaviorId: "problem:saas-demo/smoke-failed" }),
          }),
          expect.objectContaining({
            evidenceId: "generated-saas/observation-only",
            observation: { field: "routeIds", id: route.routeId },
          }),
        ]),
      );
      expect(report.stale).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            evidenceId: "generated-saas/removed-route",
            unknownId: "route:RemovedController.read",
          }),
        ]),
      );
    } finally {
      restoreEnvironment(SAAS_DEMO_ENDPOINTS_ENABLED_ENV, previousDemo);
      restoreEnvironment(SAAS_PROVIDER_PROFILE_ENV, previousProfile);
      warn.mockRestore();
    }
  });
});

function generatedApplicationFidelity() {
  return {
    boot: "application",
    dependency: "fake",
    isolation: "fake",
    runtime: "node",
    validation: "production",
  } as const;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(projectRoot, path), "utf8")) as T;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
