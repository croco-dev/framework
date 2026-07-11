import { type ProblemDetails, ProblemFactory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  createFailureDrillCatalog,
  createOperationalFailureDrillMatrix,
  FAILURE_DRILL_SCENARIO_IDS,
  OPERATIONAL_FAILURE_DRILL_OUTCOME_KINDS,
  OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS,
  OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION,
  type OperationalFailureDrillOutcome,
  type OperationalFailureDrillScenario,
  renderOperationalFailureDrillMarkdown,
  runOperationalFailureDrills,
  serializeOperationalFailureDrillReport,
} from "../index";

const RECOVERY_ACTION = "Restore the failed boundary and retry the operation.";

function createProblem(id: string): ProblemDetails {
  return {
    code: `testing/${id}`,
    detail: `${id} failed as expected`,
    incident: { attempts: 1, injected: true },
    status: 500,
    title: "Internal Server Error",
    type: `https://docs.croco.dev/problems/testing/${id}`,
  };
}

function createScenario(
  id: (typeof OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS)[number],
): OperationalFailureDrillScenario {
  const provenance = {
    boundary: `testing.${id}`,
    fixture: `fixture:${id}`,
  };

  if (OPERATIONAL_FAILURE_DRILL_OUTCOME_KINDS[id] === "diagnostic") {
    return {
      description: `Exercises ${id}.`,
      expected: {
        diagnostic: {
          code: "CROCO_SAAS_PROFILE_ENV_MISSING",
          fields: { missing: ["API_KEY"], profile: "real" },
        },
        kind: "diagnostic",
        provenance,
        recoveryAction: RECOVERY_ACTION,
      },
      id,
      name: id,
      run: () => ({
        diagnostic: {
          code: "CROCO_SAAS_PROFILE_ENV_MISSING",
          fields: { profile: "real", missing: ["API_KEY"] },
        },
        kind: "diagnostic",
        provenance,
        recoveryAction: RECOVERY_ACTION,
      }),
    };
  }

  const problem = createProblem(id);
  return {
    description: `Exercises ${id}.`,
    expected: {
      kind: "problem",
      problem: {
        code: problem.code,
        extensions: { incident: { injected: true, attempts: 1 } },
        status: problem.status,
        title: problem.title,
        type: problem.type,
      },
      provenance,
      recoveryAction: RECOVERY_ACTION,
    },
    id,
    name: id,
    run: () => ({
      kind: "problem",
      problem:
        id === "telemetry-exporter-unavailable"
          ? ProblemFactory.internalServerError(problem.code, problem.detail, {
              extensions: { incident: { attempts: 1, injected: true } },
              type: problem.type,
            })
          : problem,
      provenance,
      recoveryAction: RECOVERY_ACTION,
    }),
  };
}

function createCompleteMatrix(): readonly OperationalFailureDrillScenario[] {
  return OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS.map(createScenario);
}

describe("OperationalFailureDrill", () => {
  it("keeps the generic catalog unchanged and declares the exact operational incident order", () => {
    expect(FAILURE_DRILL_SCENARIO_IDS).toEqual([
      "provider-timeout",
      "webhook-duplicate",
      "outbox-relay-crash",
      "telemetry-exporter-failure",
      "tenant-context-missing",
      "quota-exceeded",
    ]);
    expect(createFailureDrillCatalog()).toHaveLength(6);
    expect(OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS).toEqual([
      "provider-environment-missing",
      "telemetry-exporter-unavailable",
      "di-provider-missing",
      "di-scope-mismatch",
      "route-validation-failure",
      "rate-limit-exhausted",
      "auth-verifier-unavailable",
      "webhook-signature-invalid",
    ]);
  });

  it("rejects incomplete, duplicate, unexpected, and reordered matrices", () => {
    const complete = createCompleteMatrix();
    const first = complete[0];
    const second = complete[1];
    const last = complete[7];
    if (!first || !second || !last) {
      throw new TypeError("Operational failure drill fixtures are incomplete.");
    }

    expect(() => createOperationalFailureDrillMatrix(complete.slice(1))).toThrow(
      "missing required scenario 'provider-environment-missing'",
    );
    expect(() => createOperationalFailureDrillMatrix([...complete.slice(0, -1), first])).toThrow(
      "duplicates scenario 'provider-environment-missing'",
    );
    expect(() =>
      createOperationalFailureDrillMatrix([
        ...complete.slice(0, -1),
        { ...last, id: "unknown-incident" },
      ] as readonly OperationalFailureDrillScenario[]),
    ).toThrow("contains unexpected scenario 'unknown-incident'");
    expect(() =>
      createOperationalFailureDrillMatrix([second, first, ...complete.slice(2)]),
    ).toThrow("expected scenario 'provider-environment-missing' at index 0");
  });

  it("runs all incidents in schema order and preserves diagnostic and Problem outcomes", async () => {
    const report = await runOperationalFailureDrills(
      createOperationalFailureDrillMatrix(createCompleteMatrix()),
    );

    expect(report.schemaVersion).toBe(OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION);
    expect(report.status).toBe("passed");
    expect(report.scenarioIds).toEqual([...OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS]);
    expect(report.outcomeKinds).toEqual([
      "diagnostic",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
    ]);
    expect(report.results.map(({ id }) => id)).toEqual([...OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS]);
    expect(report.results.map(({ outcome }) => outcome.kind)).toEqual([
      "diagnostic",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
      "problem",
    ]);
    expect(report.results[0]).toMatchObject({
      outcome: {
        diagnostic: {
          code: "CROCO_SAAS_PROFILE_ENV_MISSING",
          fields: { missing: ["API_KEY"], profile: "real" },
        },
      },
    });
  });

  it("rejects outcome-kind drift, structured evidence drift, and missing recovery evidence", async () => {
    const [diagnosticScenario, problemScenario] = createCompleteMatrix();
    if (!diagnosticScenario || !problemScenario) {
      throw new TypeError("Operational failure drill fixtures are incomplete.");
    }

    await expect(
      runOperationalFailureDrills([
        {
          ...diagnosticScenario,
          run: () => ({
            kind: "problem",
            problem: createProblem(diagnosticScenario.id),
            provenance: diagnosticScenario.expected.provenance,
            recoveryAction: RECOVERY_ACTION,
          }),
        },
        ...createCompleteMatrix().slice(1),
      ]),
    ).rejects.toThrow("expected outcome kind 'diagnostic', received 'problem'");

    await expect(
      runOperationalFailureDrills([
        diagnosticScenario,
        {
          ...problemScenario,
          run: () => ({
            kind: "problem",
            problem: {
              ...createProblem(problemScenario.id),
              incident: { attempts: 2, injected: true },
            },
            provenance: problemScenario.expected.provenance,
            recoveryAction: RECOVERY_ACTION,
          }),
        },
        ...createCompleteMatrix().slice(2),
      ]),
    ).rejects.toThrow("expected Problem extension 'incident'");

    await expect(
      runOperationalFailureDrills([
        {
          ...diagnosticScenario,
          run: async () => {
            const output = await diagnosticScenario.run();
            return { ...output, recoveryAction: "" };
          },
        },
        ...createCompleteMatrix().slice(1),
      ]),
    ).rejects.toThrow("did not return a recovery action");
  });

  it("rejects diagnostic-field and provenance drift", async () => {
    const [scenario] = createCompleteMatrix();
    if (!scenario) {
      throw new TypeError("Operational failure drill fixture is missing.");
    }

    await expect(
      runOperationalFailureDrills([
        {
          ...scenario,
          run: async () => {
            const outcome = await scenario.run();
            if (outcome.kind !== "diagnostic") {
              throw new TypeError("Expected a diagnostic fixture.");
            }
            return {
              ...outcome,
              diagnostic: {
                ...outcome.diagnostic,
                fields: { missing: [], profile: "real" },
              },
            };
          },
        },
        ...createCompleteMatrix().slice(1),
      ]),
    ).rejects.toThrow("expected diagnostic field 'missing'");

    await expect(
      runOperationalFailureDrills([
        {
          ...scenario,
          run: async () => ({
            ...(await scenario.run()),
            provenance: {
              boundary: "synthetic",
              fixture: "fixture:unexpected",
            },
          }),
        },
        ...createCompleteMatrix().slice(1),
      ]),
    ).rejects.toThrow("expected provenance boundary");

    await expect(
      runOperationalFailureDrills([
        {
          ...scenario,
          run: async () => {
            const { provenance: _provenance, ...outcome } = await scenario.run();
            return outcome as OperationalFailureDrillOutcome;
          },
        },
        ...createCompleteMatrix().slice(1),
      ]),
    ).rejects.toThrow("did not return fixture provenance");
  });

  it("serializes timestamp-free JSON and Markdown deterministically", async () => {
    const report = await runOperationalFailureDrills(createCompleteMatrix());
    const json = serializeOperationalFailureDrillReport(report);
    const markdown = renderOperationalFailureDrillMarkdown(report);

    expect(serializeOperationalFailureDrillReport(report)).toBe(json);
    expect(renderOperationalFailureDrillMarkdown(report)).toBe(markdown);
    expect(json).toContain(`"schemaVersion": "${OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION}"`);
    expect(json).not.toMatch(/timestamp|createdAt|\d{4}-\d{2}-\d{2}T/);
    expect(markdown).toContain(
      `# Operational failure drills\n\nSchema: \`${OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION}\``,
    );
    expect(markdown).toContain("| provider-environment-missing | diagnostic |");
    expect(markdown).not.toMatch(/timestamp|created at|\d{4}-\d{2}-\d{2}T/i);
  });
});
