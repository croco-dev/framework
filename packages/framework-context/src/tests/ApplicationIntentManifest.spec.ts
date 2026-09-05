import { describe, expect, it } from "vitest";

import { validateApplicationIntentManifest } from "../index";

const workerManifest = {
  schemaVersion: 1,
  projectName: "worker-app",
  scope: "@test",
  goal: "worker",
  preset: "ddd-vike-fullstack",
  runtimeTarget: "cloudflare-workers",
  protocol: "rest",
  providers: ["cloudflare-workers", "meta-vite"],
  storage: [],
  auth: "none",
  billing: "none",
  telemetry: "none",
  deploymentPreset: "cloudflare-workers",
  qualityGates: ["install", "typecheck", "build", "ssr-worker:presentation:smoke"],
} as const;

describe("ApplicationIntentManifest", () => {
  it("validates the generated v1 worker intent contract", () => {
    expect(validateApplicationIntentManifest(workerManifest)).toEqual({
      ok: true,
      manifest: workerManifest,
    });
  });

  it("distinguishes version, goal, runtime, provider, and shape failures", () => {
    expect(validateApplicationIntentManifest({ ...workerManifest, schemaVersion: 2 })).toEqual({
      ok: false,
      issues: [{ kind: "version-unsupported", field: "schemaVersion", actual: 2 }],
    });
    expect(validateApplicationIntentManifest({ ...workerManifest, goal: "unknown" })).toEqual({
      ok: false,
      issues: [{ kind: "goal-unsupported", field: "goal", actual: "unknown" }],
    });
    expect(
      validateApplicationIntentManifest({ ...workerManifest, runtimeTarget: "unknown" }),
    ).toEqual({
      ok: false,
      issues: [{ kind: "runtime-unsupported", field: "runtimeTarget", actual: "unknown" }],
    });
    expect(
      validateApplicationIntentManifest({ ...workerManifest, providers: ["unknown"] }),
    ).toEqual({
      ok: false,
      issues: [{ kind: "provider-unsupported", field: "providers[0]", actual: "unknown" }],
    });
    expect(validateApplicationIntentManifest({ ...workerManifest, qualityGates: "build" })).toEqual(
      {
        ok: false,
        issues: [{ kind: "shape-invalid", field: "qualityGates", actual: "build" }],
      },
    );
  });

  it("rejects supported values that contradict the selected goal contract", () => {
    expect(validateApplicationIntentManifest({ ...workerManifest, goal: "saas-api" })).toEqual({
      ok: false,
      issues: [
        {
          kind: "goal-contract-mismatch",
          field: "preset",
          actual: "ddd-vike-fullstack",
          expected: "saas",
        },
        {
          kind: "goal-contract-mismatch",
          field: "runtimeTarget",
          actual: "cloudflare-workers",
          expected: "node",
        },
        {
          kind: "goal-contract-mismatch",
          field: "auth",
          actual: "none",
          expected: "better-auth",
        },
        {
          kind: "goal-contract-mismatch",
          field: "billing",
          actual: "none",
          expected: "polar",
        },
        {
          kind: "goal-contract-mismatch",
          field: "tenantModel",
          actual: undefined,
          expected: "org",
        },
        {
          kind: "goal-contract-mismatch",
          field: "telemetry",
          actual: "none",
          expected: "opentelemetry-otlp",
        },
        {
          kind: "goal-contract-mismatch",
          field: "deploymentPreset",
          actual: "cloudflare-workers",
          expected: "node-api",
        },
        {
          kind: "goal-contract-mismatch",
          field: "providers",
          actual: ["cloudflare-workers", "meta-vite"],
          expected: [
            "in-memory-tenant",
            "in-memory-metering",
            "in-memory-events",
            "better-auth",
            "drizzle-transaction",
            "polar-billing",
            "qstash-tasks",
            "cloudinary-storage",
            "node-telemetry",
          ],
        },
        {
          kind: "goal-contract-mismatch",
          field: "storage",
          actual: [],
          expected: ["cloudinary"],
        },
        {
          kind: "goal-contract-mismatch",
          field: "qualityGates",
          actual: ["install", "typecheck", "build", "ssr-worker:presentation:smoke"],
          expected: [
            "install",
            "typecheck",
            "build",
            "test",
            "contract:verify",
            "demo:smoke",
            "failure-drill:smoke",
          ],
        },
      ],
    });
  });
});
