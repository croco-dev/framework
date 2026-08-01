import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { Reporter } from "vitest/node";
import PlaywrightEvidenceReporter from "../playwright-reporter";
import VitestEvidenceReporter from "../vitest-reporter";

import {
  assertNoTestEvidenceSecrets,
  assertTestEvidenceBundle,
  assertTestEvidenceFidelity,
  classifyTestEvidenceOutcome,
  createTestEvidenceBundle,
  createTestEvidenceFileWriter,
  createTestKernelEvidenceRecord,
  createTestEvidenceRecord,
  CrocoPlaywrightEvidenceReporter,
  CrocoVitestEvidenceReporter,
  renderTestEvidenceMarkdown,
  serializeTestEvidence,
  TEST_EVIDENCE_SCHEMA_VERSION,
  TestEvidenceContractError,
  TestEvidenceFidelityError,
  type TestEvidenceFidelity,
  type TestEvidenceRecord,
} from "../index";

const isolatedFidelity: TestEvidenceFidelity = {
  boot: "isolated",
  dependency: "fake",
  isolation: "fake",
  runtime: "node",
  validation: "isolated",
};

function record(
  overrides: Partial<Parameters<typeof createTestEvidenceRecord>[0]> = {},
): TestEvidenceRecord {
  return createTestEvidenceRecord({
    id: "testing/unit/example",
    runner: "vitest",
    intent: { contractIds: ["route/users.get"], description: "returns a user" },
    observed: { contractIds: ["route/users.get"], routeIds: ["GET /users/:id"] },
    fidelity: isolatedFidelity,
    replay: { command: 'pnpm --filter @croco/testing test -- -t "returns a user"', seed: "7" },
    resources: { leaks: [], status: "clean" },
    attempts: [{ attempt: 1, outcome: "passed", durationMs: 4 }],
    ...overrides,
  });
}

describe("croco.test-evidence/v1", () => {
  it("publishes a JSON schema matching the public TypeScript version", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../../schemas/test-evidence-v1.schema.json"),
        "utf8",
      ),
    ) as { $id: string; properties: { schemaVersion: { const: string } } };
    expect(schema.$id).toBe("https://schemas.croco.dev/testing/test-evidence-v1.schema.json");
    expect(schema.properties.schemaVersion.const).toBe(TEST_EVIDENCE_SCHEMA_VERSION);
    const bundleSchema = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../../schemas/test-evidence-bundle-v1.schema.json"),
        "utf8",
      ),
    ) as {
      $id: string;
      properties: { records: { items: { $ref: string } }; schemaVersion: { const: string } };
    };
    expect(bundleSchema.$id).toBe(
      "https://schemas.croco.dev/testing/test-evidence-bundle-v1.schema.json",
    );
    expect(bundleSchema.properties.schemaVersion.const).toBe(TEST_EVIDENCE_SCHEMA_VERSION);
    expect(bundleSchema.properties.records.items.$ref).toBe("test-evidence-v1.schema.json");
  });

  it("keeps declared intent separate from observed runtime contracts", () => {
    const evidence = record({
      intent: { contractIds: ["declared-but-not-observed"], description: "declares a contract" },
      observed: { contractIds: [] },
    });
    expect(evidence.intent.contractIds).toEqual(["declared-but-not-observed"]);
    expect(evidence.observed.contractIds).toEqual([]);
  });

  it("classifies retry-then-pass as flaky and retains every attempt", () => {
    const evidence = record({
      attempts: [
        {
          attempt: 1,
          outcome: "failed",
          diagnostics: [{ code: "UPSTREAM_TIMEOUT", recoveryAction: "Retry." }],
        },
        { attempt: 2, outcome: "passed" },
      ],
    });
    expect(evidence.outcome).toBe("flaky");
    expect(evidence.attempts).toHaveLength(2);
    expect(evidence.diagnostics).toEqual([{ code: "UPSTREAM_TIMEOUT", recoveryAction: "Retry." }]);
  });

  it("rejects non-contiguous attempts and fidelity promotion", () => {
    expect(() => record({ attempts: [{ attempt: 2, outcome: "passed" }] })).toThrow(
      TestEvidenceContractError,
    );
    expect(() =>
      assertTestEvidenceFidelity(record(), { boot: "application", isolation: "commit" }),
    ).toThrow(TestEvidenceFidelityError);
  });

  it("accepts unordered valid attempts and stores them canonically", () => {
    const evidence = record({
      attempts: [
        { attempt: 2, outcome: "passed" },
        { attempt: 1, outcome: "failed" },
      ],
    });
    expect(evidence.attempts.map(({ attempt }) => attempt)).toEqual([1, 2]);
    expect(evidence.outcome).toBe("flaky");
    expect(
      classifyTestEvidenceOutcome([
        { attempt: 2, outcome: "passed" },
        { attempt: 1, outcome: "failed" },
      ]),
    ).toBe("flaky");
  });

  it("models contract failures as RFC 7807 Problems", () => {
    let thrown: unknown;
    try {
      createTestEvidenceBundle([null as unknown as TestEvidenceRecord]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Problem);
    expect(thrown).toMatchObject({
      category: ProblemCategory.ValidationError,
      code: "CROCO_TEST_EVIDENCE_CONTRACT_INVALID",
      message: expect.stringContaining("Evidence record must be an object"),
    });
  });

  it("rejects malformed external records with a stable contract error", () => {
    const malformed = { ...record(), observed: { contractIds: "not-an-array" } };
    expect(() => createTestEvidenceBundle([malformed as unknown as TestEvidenceRecord])).toThrow(
      TestEvidenceContractError,
    );
  });

  it("rejects cyclic metadata with a stable contract Problem at every boundary", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(() => record({ metadata: cyclic as TestEvidenceRecord["metadata"] })).toThrow(
      TestEvidenceContractError,
    );
    expect(() =>
      createTestEvidenceBundle([
        { ...record(), metadata: cyclic } as unknown as TestEvidenceRecord,
      ]),
    ).toThrow(TestEvidenceContractError);
  });

  it("rejects malformed creator inputs with a stable contract Problem", () => {
    for (const malformed of [
      { ...record(), intent: undefined },
      { ...record(), observed: undefined },
      { ...record(), replay: undefined },
      { ...record(), attempts: undefined },
    ]) {
      expect(() =>
        createTestEvidenceRecord(
          malformed as unknown as Parameters<typeof createTestEvidenceRecord>[0],
        ),
      ).toThrow(TestEvidenceContractError);
    }
  });

  it("rejects additional properties and bundle summary drift", () => {
    expect(() =>
      assertTestEvidenceBundle({
        ...createTestEvidenceBundle([record()]),
        summary: { failed: 0, flaky: 0, passed: 0, skipped: 0, total: 0 },
      }),
    ).toThrow("does not match derived");
    expect(() =>
      createTestEvidenceBundle([
        { ...record(), unexpected: true } as unknown as TestEvidenceRecord,
      ]),
    ).toThrow("unsupported field");
    expect(() =>
      assertTestEvidenceBundle({
        ...createTestEvidenceBundle([record()]),
        missingArtifacts: [{ path: "missing.json", recordId: "unknown", required: true }],
        status: "failed",
      }),
    ).toThrow("references unknown record");
  });

  it("derives application and real-resource fidelity from TestKernel evidence", () => {
    const evidence = createTestKernelEvidenceRecord({
      id: "testing/application/postgres",
      runner: "runtime-smoke",
      kernelFidelity: {
        boot: "application",
        runtime: "node",
        validation: "production",
      },
      resourceEvidence: [
        {
          diagnostics: [],
          fidelity: {
            id: "postgres",
            image: "postgres@sha256:fixture",
            isolation: "database-per-worker",
            kind: "postgres",
            mode: "commit",
          },
        },
      ],
      intent: { contractIds: ["transaction/after-commit"], description: "commits an outbox event" },
      observed: { contractIds: ["transaction/after-commit"], eventIds: ["outbox.published"] },
      replay: { command: "pnpm --filter @croco/testing-resources test:real" },
      resources: { leaks: [], status: "clean" },
      attempts: [{ attempt: 1, outcome: "passed" }],
    });
    expect(evidence.fidelity).toEqual({
      boot: "application",
      dependency: "local-real",
      isolation: "commit",
      runtime: "node",
      validation: "production",
    });
  });

  it("rejects mixed TestKernel isolation modes instead of promoting the combined record", () => {
    expect(() =>
      createTestKernelEvidenceRecord({
        id: "testing/application/mixed-resources",
        runner: "runtime-smoke",
        kernelFidelity: { boot: "application", runtime: "node", validation: "production" },
        resourceEvidence: ["rollback", "commit"].map((mode, index) => ({
          diagnostics: [],
          fidelity: {
            id: `postgres-${index}`,
            image: "postgres@sha256:fixture",
            isolation: "database-per-worker" as const,
            kind: "postgres",
            mode: mode as "rollback" | "commit",
          },
        })),
        intent: { contractIds: [], description: "mixed resources" },
        observed: { contractIds: [] },
        replay: { command: "pnpm test:real" },
        resources: { leaks: [], status: "clean" },
        attempts: [{ attempt: 1, outcome: "passed" }],
      }),
    ).toThrow("emit one evidence record per fidelity");
  });

  it("redacts sensitive keys and secret-like strings before evidence leaves the process", () => {
    const evidence = record({
      metadata: {
        authorization: "Bearer definitely-secret-token",
        endpoint: "https://service.example/callback?access_token=definitely-secret-token&safe=1",
        note: "api_key=definitely-secret-token",
        nested: { password: "definitely-secret-token" },
      },
    });
    expect(evidence.metadata).toEqual({
      authorization: "[Redacted]",
      endpoint: "https://service.example/callback?[Redacted]&safe=1",
      note: "[Redacted]",
      nested: { password: "[Redacted]" },
    });
    expect(() => assertNoTestEvidenceSecrets(evidence, ["definitely-secret-token"])).not.toThrow();
    expect(() =>
      assertNoTestEvidenceSecrets({ raw: "definitely-secret-token" }, ["definitely-secret-token"]),
    ).toThrow(TestEvidenceContractError);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => assertNoTestEvidenceSecrets(cyclic, [])).toThrow(
      "Evidence must be JSON-serializable",
    );
    expect(() => assertNoTestEvidenceSecrets(undefined, [])).toThrow(
      "Evidence must serialize to a JSON value",
    );
  });

  it("redacts structured tokens and private keys from ordinary string fields", () => {
    const evidence = record({
      metadata: {
        log: [
          "github_pat_abcdefghijklmnopqrstuvwxyz123456",
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_value",
          "-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----",
          "AKIAIOSFODNN7EXAMPLE", // AWS documentation example credential; intentionally exercises redaction.
        ].join(" "),
      },
    });
    expect(evidence.metadata?.log).toBe("[Redacted] [Redacted] [Redacted] [Redacted]");
  });

  it("serializes deterministically and reports required missing artifacts in JSON and Markdown", () => {
    const evidence = record({
      id: "b",
      attachments: [
        { kind: "report", path: "ci-reports/provider.json", schemaVersion: "croco.provider/v1" },
      ],
    });
    const first = createTestEvidenceBundle([evidence], () => false);
    const second = createTestEvidenceBundle([evidence], () => false);
    expect(serializeTestEvidence(first)).toBe(serializeTestEvidence(second));
    expect(first.status).toBe("failed");
    expect(first.missingArtifacts).toEqual([
      { path: "ci-reports/provider.json", recordId: "b", required: true },
    ]);
    expect(renderTestEvidenceMarkdown(first)).toContain(
      "Record ID: b; path: ci-reports/provider.json",
    );
  });

  it("escapes Markdown control characters in record and missing artifact values", () => {
    const bundle = createTestEvidenceBundle(
      [
        record({
          id: "row|`id\nnext",
          attachments: [{ kind: "report", path: "report|`path\nnext" }],
        }),
      ],
      () => false,
    );
    const markdown = renderTestEvidenceMarkdown(bundle);
    expect(markdown).toContain("row\\|&#96;id<br>next");
    expect(markdown).toContain("report\\|&#96;path<br>next");
    expect(markdown).not.toContain("`row");
  });

  it("canonicalizes unordered evidence and re-redacts records at the bundle boundary", () => {
    const first = record({
      attachments: [
        { kind: "trace", path: "z.trace" },
        { kind: "log", path: "a.log" },
      ],
      intent: { contractIds: ["z", "a"], description: "canonical evidence" },
      metadata: { token: "external-secret" },
      observed: { contractIds: ["z", "a"], routeIds: ["z", "a"] },
    });
    const external = {
      ...first,
      attachments: [...first.attachments].reverse(),
      intent: { ...first.intent, contractIds: [...first.intent.contractIds].reverse() },
      metadata: { token: "external-secret" },
      observed: {
        ...first.observed,
        contractIds: [...first.observed.contractIds].reverse(),
        routeIds: [...(first.observed.routeIds ?? [])].reverse(),
      },
    };
    const firstBundle = createTestEvidenceBundle([first]);
    const externalBundle = createTestEvidenceBundle([external]);
    expect(serializeTestEvidence(externalBundle)).toBe(serializeTestEvidence(firstBundle));
    expect(externalBundle.records[0]?.metadata).toEqual({ token: "[Redacted]" });
  });

  it("normalizes records by stable id ordering", () => {
    const bundle = createTestEvidenceBundle([record({ id: "z" }), record({ id: "a" })]);
    expect(bundle.records.map(({ id }) => id)).toEqual(["a", "z"]);
  });

  it("combines package, application, real-resource, failure-drill, and Playwright evidence", () => {
    const evidence = [
      record({ id: "package/vitest" }),
      record({
        id: "application/route",
        fidelity: { ...isolatedFidelity, boot: "application", validation: "production" },
      }),
      record({
        id: "resource/postgres",
        fidelity: {
          boot: "adapter",
          dependency: "local-real",
          isolation: "commit",
          runtime: "node",
          validation: "production",
        },
      }),
      record({
        id: "failure-drill/timeout",
        runner: "failure-drill",
        attachments: [
          {
            kind: "report",
            path: "ci-reports/failure-drill.json",
            schemaVersion: "croco.operational-failure-drill/v1",
          },
        ],
      }),
      record({
        id: "playwright/create-user",
        runner: "playwright",
        fidelity: { ...isolatedFidelity, boot: "adapter", runtime: "browser" },
      }),
    ];
    const bundle = createTestEvidenceBundle(evidence);
    expect(bundle.summary).toEqual({ failed: 0, flaky: 0, passed: 5, skipped: 0, total: 5 });
    expect(bundle.records[1]?.attachments[0]?.schemaVersion).toBe(
      "croco.operational-failure-drill/v1",
    );
  });
});

describe("runner reporters", () => {
  it("adapts Vitest retry results without a custom runner", async () => {
    const write = vi.fn();
    const reporter = new CrocoVitestEvidenceReporter({
      attempts: (context) => [
        {
          attempt: 1,
          diagnostics: [
            {
              code: "FIRST_ATTEMPT_FAILED",
              recoveryAction: `Inspect ${context.runner === "vitest" ? context.fullName : context.title}.`,
            },
          ],
          durationMs: 7,
          outcome: "failed",
        },
        { attempt: 2, durationMs: 3, outcome: "passed" },
      ],
      fidelity: isolatedFidelity,
      observed: (context) => ({
        contractIds: [context.runner === "vitest" ? context.state : context.expectedStatus],
      }),
      write,
    });
    const compatibleReporter: Reporter = reporter;
    expect(compatibleReporter).toBe(reporter);
    expect(VitestEvidenceReporter).toBe(CrocoVitestEvidenceReporter);
    await reporter.onTestCaseResult({
      id: "vitest/example",
      name: "example retries",
      fullName: "example retries",
      diagnostic: () => ({ duration: 3, flaky: true, retryCount: 1 }),
      result: () => ({ state: "passed" }),
    });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: [
          expect.objectContaining({
            diagnostics: [expect.objectContaining({ code: "FIRST_ATTEMPT_FAILED" })],
            durationMs: 7,
            outcome: "failed",
          }),
          expect.objectContaining({ durationMs: 3, outcome: "passed" }),
        ],
        observed: { contractIds: ["passed"] },
        outcome: "flaky",
        runner: "vitest",
      }),
    );
  });

  it("writes deterministic record fragments when a callback is not configured", async () => {
    const outputDirectory = mkdtempSync(resolve(tmpdir(), "croco-evidence-writer-"));
    try {
      const reporter = new CrocoVitestEvidenceReporter({
        fidelity: isolatedFidelity,
        outputDirectory,
      });
      await reporter.onTestCaseResult({
        id: "vitest/file-writer",
        name: "writes evidence",
        fullName: "writes evidence",
        diagnostic: () => ({ duration: 1, flaky: false, retryCount: 0 }),
        result: () => ({ state: "passed" }),
      });
      const files = readdirSync(outputDirectory);
      expect(files).toEqual([
        expect.stringMatching(/^vitest-vitest-file-writer-[a-f0-9]{12}\.json$/),
      ]);
      expect(
        JSON.parse(readFileSync(resolve(outputDirectory, files[0] ?? "missing"), "utf8")),
      ).toMatchObject({ id: "vitest/file-writer", runner: "vitest" });
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("does not overwrite a colliding evidence fragment", () => {
    const outputDirectory = mkdtempSync(resolve(tmpdir(), "croco-evidence-collision-"));
    try {
      const writer = createTestEvidenceFileWriter({ outputDirectory });
      writer(record({ id: "same", metadata: { revision: 1 } }));
      expect(() => writer(record({ id: "same", metadata: { revision: 2 } }))).toThrow(
        "Evidence fragment collision",
      );
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("emits default Vitest failure diagnostics from runner errors", async () => {
    const write = vi.fn();
    const reporter = new CrocoVitestEvidenceReporter({ fidelity: isolatedFidelity, write });
    await reporter.onTestCaseResult({
      id: "vitest/failure",
      name: "fails",
      fullName: "suite fails",
      diagnostic: () => ({ duration: 1, flaky: false, retryCount: 0 }),
      result: () => ({ errors: [new Error("expected true")], state: "failed" }),
    });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "CROCO_VITEST_TEST_FAILED",
            recoveryAction: expect.stringContaining("expected true"),
          }),
        ],
      }),
    );
  });

  it("adapts Playwright attempts and retains failure attachments", async () => {
    const write = vi.fn();
    const reporter = new CrocoPlaywrightEvidenceReporter({
      fidelity: { ...isolatedFidelity, boot: "adapter", runtime: "browser" },
      write,
    });
    const test = { id: "journey/create-user", title: "creates a user" };
    expect(PlaywrightEvidenceReporter).toBe(CrocoPlaywrightEvidenceReporter);
    reporter.onTestEnd(test, { duration: 8, retry: 1, status: "passed" });
    reporter.onTestEnd(test, {
      attachments: [{ name: "trace", path: "test-results/trace.zip" }],
      duration: 10,
      error: new Error("page did not load"),
      errors: [new Error("page did not load")],
      retry: 0,
      status: "failed",
    });
    await reporter.onEnd();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ kind: "trace", path: "test-results/trace.zip" }],
        attempts: [
          expect.objectContaining({
            attachments: [{ kind: "trace", path: "test-results/trace.zip" }],
          }),
          expect.objectContaining({ attachments: [] }),
        ],
        outcome: "flaky",
        runner: "playwright",
        diagnostics: [
          expect.objectContaining({
            code: "CROCO_PLAYWRIGHT_TEST_FAILED",
            recoveryAction: expect.stringContaining("page did not load"),
          }),
        ],
      }),
    );
  });

  it("treats an expected Playwright failure as a passed attempt", async () => {
    const write = vi.fn();
    const reporter = new CrocoPlaywrightEvidenceReporter({ fidelity: isolatedFidelity, write });
    const test = {
      expectedStatus: "failed" as const,
      id: "journey/expected-failure",
      title: "documents a known failure",
    };
    reporter.onTestEnd(test, { duration: 2, retry: 0, status: "failed" });
    await reporter.onEnd();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ outcome: "passed" }));
  });

  it("preserves an expected Playwright skip as skipped evidence", async () => {
    const write = vi.fn();
    const reporter = new CrocoPlaywrightEvidenceReporter({ fidelity: isolatedFidelity, write });
    const test = {
      expectedStatus: "skipped" as const,
      id: "journey/expected-skip",
      title: "skips when a capability is unavailable",
    };
    reporter.onTestEnd(test, { duration: 1, retry: 0, status: "skipped" });
    await reporter.onEnd();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: [expect.objectContaining({ outcome: "skipped" })],
        diagnostics: [],
        outcome: "skipped",
      }),
    );
  });
});
