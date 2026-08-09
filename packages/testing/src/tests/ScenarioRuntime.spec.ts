import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";

import {
  createScenarioRuntime,
  duplicateDelivery,
  failExporter,
  interruptProcess,
  loseResponse,
  replayScenarioRuntime,
  retryableFailure,
  SCENARIO_REPORT_SCHEMA_VERSION,
  ScenarioContractProblem,
  serializeScenarioReport,
  terminalFailure,
  timeout,
} from "../index";

describe("ScenarioRuntime", () => {
  it("preserves idempotency across commit success, response loss, and retry", async () => {
    const committed = new Map<string, string>();
    const events: string[] = [];
    const scenario = createScenarioRuntime({
      scenarioId: "checkout-response-loss",
      seed: "checkout",
    })
      .at(
        "billing.checkout",
        "transaction",
        loseResponse(
          ProblemFactory.internalServerError(
            "billing/checkout-pending",
            "Checkout committed but its response was lost.",
          ),
        ),
      )
      .expectProblem("billing/checkout-pending")
      .expectEventOnce("subscription.activated")
      .expectEvidence("audit", "checkout.recovered")
      .expectEvidence("recovery", "retry.checkout");

    const checkout = async (): Promise<string> => {
      const existing = committed.get("checkout-1");
      if (existing) return existing;
      committed.set("checkout-1", "subscription-1");
      events.push("subscription.activated");
      scenario.recordEvidence("event", "subscription.activated");
      return "subscription-1";
    };

    const report = await scenario.run(async () => {
      await expect(
        scenario.execute("billing.checkout", "transaction", checkout),
      ).rejects.toMatchObject({
        code: "billing/checkout-pending",
      });
      const result = await scenario.execute("billing.checkout", "transaction", checkout);
      expect(result).toBe("subscription-1");
      scenario.recordEvidence("audit", "checkout.recovered");
      scenario.recordEvidence("recovery", "retry.checkout");
    });

    expect(committed.size).toBe(1);
    expect(events).toEqual(["subscription.activated"]);
    expect(report.schemaVersion).toBe(SCENARIO_REPORT_SCHEMA_VERSION);
    expect(report.replay).toMatchObject({
      scenarioId: "checkout-response-loss",
      seed: "checkout",
      virtualTime: "2026-01-01T00:00:00.000Z",
    });
  });

  it("models duplicate webhook delivery without duplicating the app side effect", async () => {
    const deliveries: string[] = [];
    const handled = new Set<string>();
    const scenario = createScenarioRuntime({ scenarioId: "duplicate-webhook" })
      .at("webhook.receive", "trigger", duplicateDelivery(2))
      .expectEvidence("audit", "webhook.delivery", 2)
      .expectEventOnce("subscription.activated");

    const report = await scenario.run(async () => {
      await scenario.execute("webhook.receive", "trigger", () => {
        deliveries.push("delivery-1");
        scenario.recordEvidence("audit", "webhook.delivery");
        if (!handled.has("delivery-1")) {
          handled.add("delivery-1");
          scenario.recordEvidence("event", "subscription.activated");
        }
      });
    });

    expect(deliveries).toHaveLength(2);
    expect(handled.size).toBe(1);
    expect(report.evidence.filter(({ kind }) => kind === "event")).toHaveLength(1);
  });

  it("composes every supported failure kind across Croco boundary names", async () => {
    const retryProblem = ProblemFactory.internalServerError("qstash/timeout", "QStash timed out.");
    const scenario = createScenarioRuntime({ scenarioId: "boundary-catalog", seed: "catalog" })
      .at("provider.call", "provider", terminalFailure(retryProblem))
      .at("retry.wait", "retry", retryableFailure(retryProblem))
      .at("task.publish", "task", timeout(retryProblem, "30s"))
      .at("event.publish", "event", interruptProcess(retryProblem))
      .at("telemetry.flush", "telemetry", failExporter(retryProblem))
      .expectProblem("qstash/timeout", 5)
      .expectTask("task.retry")
      .expectEvidence("diagnostic", "telemetry.flush.failed")
      .expectEvidence("telemetry", "scenario.failed");

    const report = await scenario.run(async () => {
      for (const [point, boundary] of [
        ["provider.call", "provider"],
        ["retry.wait", "retry"],
        ["task.publish", "task"],
        ["event.publish", "event"],
        ["telemetry.flush", "telemetry"],
      ] as const) {
        await expect(scenario.execute(point, boundary, () => undefined)).rejects.toMatchObject({
          code: "qstash/timeout",
        });
      }
      scenario.recordEvidence("task", "task.retry");
      scenario.recordEvidence("diagnostic", "telemetry.flush.failed");
      scenario.recordEvidence("telemetry", "scenario.failed");
    });

    expect(report.replay.virtualTime).toBe("2026-01-01T00:00:30.000Z");
    expect(report.replay.timeline.map(({ kind }) => kind)).toEqual([
      "terminal-failure",
      "retryable-failure",
      "timeout",
      "process-interruption",
      "exporter-failure",
    ]);
  });

  it("replays the same seed and failure timeline into an identical report", async () => {
    const original = createScenarioRuntime({ scenarioId: "replayable", seed: "stable-seed" }).at(
      "task.publish",
      "task",
      retryableFailure(
        ProblemFactory.businessRuleViolation("task/rejected", "retry later", {
          instance: "/tasks/task-1",
          extensions: { authorization: "Bearer secret-token", reason: "policy" },
        }),
      ),
    );
    const first = await original.run(async (runtime) => {
      await expect(runtime.execute("task.publish", "task", () => undefined)).rejects.toMatchObject({
        code: "task/rejected",
      });
    });
    const replay = replayScenarioRuntime(first.replay);
    const second = await replay.run(async (runtime) => {
      const replayFailure = runtime.execute("task.publish", "task", () => undefined);
      await expect(replayFailure).rejects.toBeInstanceOf(Problem);
      await expect(replayFailure).rejects.toMatchObject({
        category: ProblemCategory.BusinessRuleViolation,
        code: "task/rejected",
        extensions: { authorization: "[Redacted]", reason: "policy" },
        instance: "/tasks/task-1",
      });
    });

    expect(first.problems[0]).toMatchObject({
      instance: "/tasks/task-1",
      reason: "policy",
      status: 422,
      title: "Business Rule Violation",
    });
    expect(serializeScenarioReport(first)).not.toContain("secret-token");
    expect(second).toEqual(first);
    expect(serializeScenarioReport(second)).toBe(serializeScenarioReport(first));
  });

  it("canonicalizes timeout replay and records nested injected Problems once", async () => {
    const failure = ProblemFactory.internalServerError("provider/timeout", "Provider timed out.");
    const original = createScenarioRuntime({ scenarioId: "nested-timeout" })
      .at("provider.call", "provider", timeout(failure, "30s"))
      .expectProblem("provider/timeout");
    const first = await original.run((runtime) =>
      runtime.execute("transaction.commit", "transaction", () =>
        runtime.execute("provider.call", "provider", () => undefined),
      ),
    );
    const replay = replayScenarioRuntime(first.replay).expectProblem("provider/timeout");
    const second = await replay.run((runtime) =>
      runtime.execute("transaction.commit", "transaction", () =>
        runtime.execute("provider.call", "provider", () => undefined),
      ),
    );

    expect(first.problems).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it("reserves a lost-response occurrence before awaiting concurrent operations", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstOperation = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const scenario = createScenarioRuntime({ scenarioId: "concurrent-response-loss" })
      .at(
        "billing.checkout",
        "transaction",
        loseResponse(ProblemFactory.internalServerError("billing/response-lost", "Lost.")),
      )
      .expectProblem("billing/response-lost");

    const reportPromise = scenario.run(async (runtime) => {
      const first = runtime.execute("billing.checkout", "transaction", () => firstOperation);
      await expect(
        runtime.execute("billing.checkout", "transaction", () => "second"),
      ).resolves.toBe("second");
      releaseFirst?.();
      await expect(first).rejects.toMatchObject({ code: "billing/response-lost" });
    });

    await expect(reportPromise).resolves.toMatchObject({ status: "passed" });
  });

  it("rejects unexpected Problems and preserves ordered-point diagnostics", async () => {
    const unexpected = createScenarioRuntime({ scenarioId: "unexpected" });
    await expect(
      unexpected.run(async (runtime) => {
        await runtime.execute("provider.call", "provider", () => {
          throw ProblemFactory.internalServerError("provider/unplanned", "unexpected");
        });
      }),
    ).rejects.toMatchObject({ code: "provider/unplanned" });

    const ordered = createScenarioRuntime({ scenarioId: "ordered" })
      .at(
        "transaction.commit",
        "transaction",
        terminalFailure(ProblemFactory.internalServerError("tx/failed", "failed")),
      )
      .at(
        "event.publish",
        "event",
        terminalFailure(ProblemFactory.internalServerError("event/failed", "failed")),
      );
    await expect(
      ordered.run(async (runtime) => {
        await runtime.execute("event.publish", "event", () => undefined);
      }),
    ).rejects.toThrow("before ordered failure point 'transaction.commit'");
  });

  it("rejects repeated runs before scenario state can accumulate", async () => {
    const scenario = createScenarioRuntime({ scenarioId: "one-shot" });

    await expect(scenario.run(async () => undefined)).resolves.toMatchObject({ status: "passed" });
    await expect(scenario.run(async () => undefined)).rejects.toMatchObject({
      code: "testing/scenario-contract-invalid",
    });
  });

  it("preserves the original boundary Problem when reporting its details fails", async () => {
    const original = ProblemFactory.internalServerError("provider/unsafe", "unsafe", {
      extensions: { unsafe: new Map() },
    });
    const scenario = createScenarioRuntime({ scenarioId: "reporting-failure" });

    let received: unknown;
    try {
      await scenario.run((runtime) =>
        runtime.execute("provider.call", "provider", () => {
          throw original;
        }),
      );
    } catch (error) {
      received = error;
    }

    expect(received).toBe(original);
    expect(original.cause).toBeInstanceOf(ScenarioContractProblem);
  });

  it("omits undefined object properties while rejecting undefined array entries", async () => {
    const optional = ProblemFactory.internalServerError("provider/optional", "optional", {
      extensions: { omitted: undefined },
    });
    const scenario = createScenarioRuntime({ scenarioId: "optional-problem-property" })
      .at("provider.call", "provider", terminalFailure(optional))
      .expectProblem("provider/optional");
    const report = await scenario.run((runtime) =>
      runtime.execute("provider.call", "provider", () => undefined),
    );

    expect(report.problems[0]).not.toHaveProperty("omitted");
    expect(() =>
      createScenarioRuntime({ scenarioId: "invalid-array-entry" }).at(
        "provider.call",
        "provider",
        terminalFailure(
          ProblemFactory.internalServerError("provider/invalid-array", "invalid", {
            extensions: { values: [undefined] },
          }),
        ),
      ),
    ).toThrow("JSON-compatible");
  });

  it("rejects malformed replay steps and non-serializable Problem evidence", async () => {
    const report = await createScenarioRuntime({ scenarioId: "valid-replay" }).run(
      async () => undefined,
    );
    expect(() =>
      replayScenarioRuntime({
        ...report.replay,
        timeline: [
          {
            boundary: "trigger",
            deliveries: 0,
            kind: "duplicate-delivery",
            point: "webhook.receive",
          },
        ],
      }),
    ).toThrow("positive safe integer");

    expect(() =>
      replayScenarioRuntime({
        ...report.replay,
        timeline: [null],
      }),
    ).toThrow("timeline steps must be objects");
    expect(() => createScenarioRuntime({ scenarioId: "empty-seed", seed: "" })).toThrow(
      "scenario seed must not be empty",
    );

    for (const unsafeValue of [BigInt(1), new Date(), new Map()]) {
      expect(() =>
        createScenarioRuntime({ scenarioId: "unsafe-evidence" }).at(
          "provider.call",
          "provider",
          loseResponse(
            ProblemFactory.internalServerError("provider/unsafe", "unsafe", {
              extensions: { unsafeValue },
            }),
          ),
        ),
      ).toThrow(/JSON-compatible|plain JSON objects/);
    }

    const timed = createScenarioRuntime({ scenarioId: "invalid-replay-time" }).at(
      "task.publish",
      "task",
      timeout(ProblemFactory.internalServerError("task/timeout", "timeout"), "1s"),
    );
    const timedReport = await timed.run(async (runtime) => {
      await expect(runtime.execute("task.publish", "task", () => undefined)).rejects.toMatchObject({
        code: "task/timeout",
      });
    });
    const [timedStep] = timedReport.replay.timeline;
    if (!timedStep || timedStep.kind === "duplicate-delivery") {
      throw new ScenarioContractProblem("Timed replay fixture is invalid.");
    }
    expect(() =>
      replayScenarioRuntime({
        ...timedReport.replay,
        timeline: [{ ...timedStep, virtualTimeAdvanceMs: -1 }],
      }),
    ).toThrow("non-negative safe integer");
  });

  it("rejects durations that cannot advance virtual time deterministically", async () => {
    const problem = ProblemFactory.internalServerError("task/timeout", "timeout");

    for (const duration of [-1, 1.5, Number.NaN]) {
      expect(() =>
        createScenarioRuntime({ scenarioId: "invalid-timeout" }).at(
          "task.publish",
          "task",
          timeout(problem, duration),
        ),
      ).toThrow("non-negative safe integer");
    }

    expect(() =>
      createScenarioRuntime({ scenarioId: "overflowing-timeout" }).at(
        "task.publish",
        "task",
        timeout(problem, "9007199254740991m"),
      ),
    ).toThrow("resolve to a non-negative safe integer");

    const scenario = createScenarioRuntime({ scenarioId: "invalid-advance" });
    await expect(scenario.advanceBy(-1)).rejects.toMatchObject({
      code: "testing/scenario-contract-invalid",
    });
  });
});
