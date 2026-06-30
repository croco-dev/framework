import { describe, expect, it } from "vitest";
import {
  assertProblemCodeRegistryValid,
  createProblemRegistrySnapshot,
  createProblemCodeRegistry,
  defineProblemRegistry,
  getProblemCookbookPath,
  ProblemCategory,
  ProblemRegistryValidationProblem,
  slugifyProblemCode,
  stringifyProblemRegistrySnapshot,
  type ProblemCodeDiscovery,
} from "../index";

describe("Problem code registry", () => {
  it("creates deterministic registry entries with recovery metadata", () => {
    const registry = createProblemCodeRegistry([
      discovery("storage/file-not-found", ProblemCategory.NotFound, "packages/storage/src/a.ts", 8),
      discovery("auth/not-allowed", ProblemCategory.Forbidden, "packages/auth/src/a.ts", 4),
      discovery(
        "storage/upload-failed",
        ProblemCategory.InternalServerError,
        "packages/storage/src/b.ts",
        12,
      ),
    ]);

    expect(registry.version).toBe("croco.problem-code-registry.v1");
    expect(registry.problemCount).toBe(3);
    expect(registry.problems.map((problem) => problem.code)).toEqual([
      "auth/not-allowed",
      "storage/file-not-found",
      "storage/upload-failed",
    ]);
    expect(registry.problems[0]).toMatchObject({
      category: ProblemCategory.Forbidden,
      status: 403,
      title: "Forbidden",
      cookbookPath: "/reference/problem-recovery-cookbook/#auth-not-allowed",
      recovery: {
        cause: expect.stringContaining("not allowed"),
        retryability: "not-retryable",
        redactionPolicy: "safe-message",
        telemetry: {
          eventName: "croco.problem.warning",
          severity: "warning",
          attributes: ["problem.code", "problem.category", "problem.status"],
        },
      },
    });
    expect(registry.problems[1]?.sources.map((source) => source.file)).toEqual([
      "packages/storage/src/a.ts",
    ]);
  });

  it("defines package ProblemRegistry manifests with visibility and redaction metadata", () => {
    const registry = defineProblemRegistry({
      package: "@croco/billing-polar",
      problems: {
        BILLING_POLAR_MISSING_CONFIG: {
          category: ProblemCategory.BadRequest,
          retryable: false,
          public: true,
          status: 400,
          redaction: "safe",
        },
      },
    });

    expect(registry).toEqual({
      version: "croco.problem-registry.v1",
      package: "@croco/billing-polar",
      packagePrefix: "BILLING_POLAR",
      problemCount: 1,
      problems: [
        {
          package: "@croco/billing-polar",
          code: "BILLING_POLAR_MISSING_CONFIG",
          category: ProblemCategory.BadRequest,
          status: 400,
          retryable: false,
          retryability: "not-retryable",
          public: true,
          visibility: "public",
          redaction: "safe",
          cookbookPath: "/reference/problem-recovery-cookbook/#billing-polar-missing-config",
        },
      ],
    });

    const snapshot = createProblemRegistrySnapshot([registry]);

    expect(JSON.parse(stringifyProblemRegistrySnapshot(snapshot))).toEqual(snapshot);
    expect(snapshot).toMatchObject({
      snapshotVersion: "croco.problem-registry.snapshot.v1",
      registryVersion: "croco.problem-registry.v1",
      packageCount: 1,
      problemCount: 1,
      packages: [
        {
          package: "@croco/billing-polar",
          packagePrefix: "BILLING_POLAR",
          problemCodes: ["BILLING_POLAR_MISSING_CONFIG"],
        },
      ],
    });
  });

  it("rejects package ProblemRegistry prefix and duplicate-code drift", () => {
    expect(() =>
      defineProblemRegistry({
        package: "@croco/billing-polar",
        problems: {
          MISSING_CONFIG: {
            category: ProblemCategory.BadRequest,
            retryable: false,
            public: true,
            status: 400,
            redaction: "safe",
          },
        },
      }),
    ).toThrow(ProblemRegistryValidationProblem);

    const registry = defineProblemRegistry({
      package: "@croco/billing-polar",
      problems: {
        BILLING_POLAR_MISSING_CONFIG: {
          category: ProblemCategory.BadRequest,
          retryable: false,
          public: true,
          status: 400,
          redaction: "safe",
        },
      },
    });

    expect(() => createProblemRegistrySnapshot([registry, registry])).toThrow(
      ProblemRegistryValidationProblem,
    );
  });

  it("rejects a discovered code that is declared more than once", () => {
    expect(() =>
      createProblemCodeRegistry([
        discovery("shared/problem-code", ProblemCategory.NotFound, "packages/a/src/problems.ts", 1),
        discovery("shared/problem-code", ProblemCategory.NotFound, "packages/b/src/problems.ts", 2),
      ]),
    ).toThrow(ProblemRegistryValidationProblem);
  });

  it("rejects a discovered code that drifts across categories", () => {
    expect(() =>
      createProblemCodeRegistry([
        discovery("shared/problem-code", ProblemCategory.NotFound, "packages/a/src/problems.ts", 1),
        discovery(
          "shared/problem-code",
          ProblemCategory.InternalServerError,
          "packages/b/src/problems.ts",
          2,
        ),
      ]),
    ).toThrow(ProblemRegistryValidationProblem);
  });

  it("rejects duplicate registry entries and missing recovery metadata", () => {
    const registry = createProblemCodeRegistry([
      discovery("auth/not-allowed", ProblemCategory.Forbidden, "packages/auth/src/a.ts", 4),
    ]);
    const [entry] = registry.problems;

    if (!entry) {
      throw new Error("expected registry fixture entry");
    }

    expect(() =>
      assertProblemCodeRegistryValid({
        ...registry,
        problemCount: 2,
        problems: [
          entry,
          {
            ...entry,
            recovery: {
              ...entry.recovery,
              userAction: "",
            },
          },
        ],
      }),
    ).toThrow(ProblemRegistryValidationProblem);
  });

  it("builds stable cookbook anchors from code strings", () => {
    expect(slugifyProblemCode("STORAGE_R2_EMPTY_BODY")).toBe("storage-r2-empty-body");
    expect(getProblemCookbookPath("billing-polar/retryable-upstream", "/docs/problems")).toBe(
      "/docs/problems/#billing-polar-retryable-upstream",
    );
  });
});

function discovery(
  code: string,
  category: ProblemCategory,
  file: string,
  line: number,
): ProblemCodeDiscovery {
  return {
    code,
    category,
    sources: [
      {
        file,
        line,
        column: 5,
        kind: "problem-constructor",
      },
    ],
  };
}
