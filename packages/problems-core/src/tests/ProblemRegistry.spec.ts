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
      lifecycle: { status: "active" },
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

  it("models runtime-configurable statuses without weakening fixed entries", () => {
    const policy = {
      kind: "runtime-configurable",
      defaultStatus: 413,
      configuration: "bodyLimitMiddleware.statusCode",
    } as const;
    const registry = createProblemCodeRegistry(
      [
        discovery(
          "transports-http/request-body-too-large",
          ProblemCategory.PayloadTooLarge,
          "packages/transports-http/src/problems.ts",
          8,
        ),
      ],
      {
        statusPolicies: {
          "transports-http/request-body-too-large": policy,
        },
      },
    );

    expect(registry.problems[0]).toMatchObject({
      status: 413,
      statusPolicy: policy,
    });

    const [entry] = registry.problems;

    if (!entry) {
      throw new Error("expected registry fixture entry");
    }

    expect(() =>
      assertProblemCodeRegistryValid({
        ...registry,
        problems: [
          {
            ...entry,
            statusPolicy: { ...policy, defaultStatus: 422 },
          },
        ],
      }),
    ).toThrow(ProblemRegistryValidationProblem);

    expect(() =>
      createProblemCodeRegistry([], {
        statusPolicies: {
          "transports-http/renamed-body-too-large": policy,
        },
      }),
    ).toThrow(
      "Status policy references unknown Problem code 'transports-http/renamed-body-too-large'.",
    );
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

  it("retains runtime-configurable status policy in package registry manifests", () => {
    const registry = defineProblemRegistry({
      package: "@croco/transports-http",
      problems: {
        TRANSPORTS_HTTP_REQUEST_BODY_TOO_LARGE: {
          category: ProblemCategory.PayloadTooLarge,
          retryable: false,
          public: true,
          status: 413,
          statusPolicy: {
            kind: "runtime-configurable",
            defaultStatus: 413,
            configuration: "bodyLimitMiddleware.statusCode",
          },
          redaction: "public",
        },
      },
    });

    expect(registry.problems[0]?.statusPolicy).toEqual({
      kind: "runtime-configurable",
      defaultStatus: 413,
      configuration: "bodyLimitMiddleware.statusCode",
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

  it("allows deprecated registry entries without source locations when migration metadata is present", () => {
    const registry = createProblemCodeRegistry([
      discovery("auth/not-allowed", ProblemCategory.Forbidden, "packages/auth/src/a.ts", 4),
      discovery("auth/not-allowed-v2", ProblemCategory.Forbidden, "packages/auth/src/b.ts", 6),
    ]);
    const entry = registry.problems.find((problem) => problem.code === "auth/not-allowed");

    if (!entry) {
      throw new Error("expected registry fixture entry");
    }

    expect(() =>
      assertProblemCodeRegistryValid({
        ...registry,
        problems: [
          {
            ...entry,
            lifecycle: {
              status: "deprecated",
              deprecation: {
                reason: "The Problem code was replaced by a package-scoped code.",
                migrationNote: "Use auth/not-allowed-v2 for new client branches.",
                replacementCode: "auth/not-allowed-v2",
              },
            },
            sources: [],
          },
          ...registry.problems.filter((problem) => problem.code !== "auth/not-allowed"),
        ],
      }),
    ).not.toThrow();
  });

  it("allows deprecated registry entries without replacements when a no-replacement reason is present", () => {
    const registry = createProblemCodeRegistry([
      discovery("auth/removed", ProblemCategory.Gone, "packages/auth/src/a.ts", 4),
    ]);
    const [entry] = registry.problems;

    if (!entry) {
      throw new Error("expected registry fixture entry");
    }

    expect(() =>
      assertProblemCodeRegistryValid({
        ...registry,
        problems: [
          {
            ...entry,
            lifecycle: {
              status: "deprecated",
              deprecation: {
                reason: "The Problem code represented a retired capability.",
                migrationNote: "Stop branching on auth/removed in generated clients.",
                noReplacementReason: "The retired capability has no supported equivalent.",
              },
            },
            sources: [],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects deprecated registry entries without migration metadata", () => {
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
        problems: [
          {
            ...entry,
            lifecycle: { status: "deprecated" },
            sources: [],
          },
        ],
      }),
    ).toThrow(ProblemRegistryValidationProblem);
  });

  it("rejects deprecated registry entries with incomplete or invalid replacement guidance", () => {
    const registry = createProblemCodeRegistry([
      discovery("auth/self", ProblemCategory.Gone, "packages/auth/src/a.ts", 4),
      discovery("auth/unknown", ProblemCategory.Gone, "packages/auth/src/b.ts", 5),
      discovery("auth/old-target", ProblemCategory.Gone, "packages/auth/src/c.ts", 6),
      discovery("auth/deprecated-target", ProblemCategory.Gone, "packages/auth/src/d.ts", 7),
    ]);

    expect(() =>
      assertProblemCodeRegistryValid({
        ...registry,
        problems: registry.problems.map((problem) => {
          const deprecation = {
            reason: "The code was retired.",
            migrationNote: "Follow the replacement guidance before removing branches.",
          };

          if (problem.code === "auth/self") {
            return {
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation: { ...deprecation, replacementCode: "auth/self" },
              },
            };
          }

          if (problem.code === "auth/unknown") {
            return {
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation: { ...deprecation, replacementCode: "auth/missing" },
              },
            };
          }

          if (problem.code === "auth/old-target") {
            return {
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation: { ...deprecation, replacementCode: "auth/deprecated-target" },
              },
            };
          }

          return {
            ...problem,
            lifecycle: {
              status: "deprecated",
              deprecation: {
                ...deprecation,
                noReplacementReason: "The deprecated target has no active equivalent.",
              },
            },
          };
        }),
      }),
    ).toThrow(ProblemRegistryValidationProblem);

    expect(
      (() => {
        try {
          assertProblemCodeRegistryValid({
            ...registry,
            problems: registry.problems.map((problem) => ({
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation:
                  problem.code === "auth/deprecated-target"
                    ? {
                        reason: "The code was retired.",
                        migrationNote: "Stop branching on the deprecated target.",
                        noReplacementReason: "The deprecated target has no active equivalent.",
                      }
                    : {
                        reason: "The code was retired.",
                        migrationNote: "Follow replacement guidance.",
                        replacementCode:
                          problem.code === "auth/self"
                            ? "auth/self"
                            : problem.code === "auth/unknown"
                              ? "auth/missing"
                              : "auth/deprecated-target",
                      },
              },
            })),
          });
        } catch (error) {
          return error instanceof ProblemRegistryValidationProblem ? error.errors : [];
        }

        return [];
      })(),
    ).toEqual([
      "Deprecated Problem code 'auth/old-target' replacementCode 'auth/deprecated-target' points to a deprecated Problem code.",
      "Deprecated Problem code 'auth/self' replacementCode must reference a different Problem code.",
      "Deprecated Problem code 'auth/unknown' replacementCode 'auth/missing' is not registered.",
    ]);
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
