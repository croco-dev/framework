import { FactHistoryProblem } from "@croco/analytics-core";
import { describe, expect, it } from "vitest";
import { DrizzleFactHistoryStore } from "../index";
import { persistenceFailure } from "../libs/persistenceFailure";

const scope = { app: "test", environment: "test", tenantId: null };
const subject = { kind: "user" as const, id: "user" };

describe("Persistence errors", () => {
  it.each(["append", "read", "revision", "delete"])(
    "exposes %s failure with its original cause",
    async (operation) => {
      const cause = new Error("Connection lost");
      const store = new DrizzleFactHistoryStore({
        execute: () => Promise.reject(cause),
        transaction: () => Promise.reject(cause),
      });
      const call =
        operation === "append"
          ? store.appendFacts(
              {
                scope,
                source: "source",
                sourceEventId: "event",
                sourceFingerprint: "hash",
                rows: [
                  {
                    subject,
                    definitionId: "plan",
                    definitionVersion: "1",
                    projectionId: "plan",
                    projectionRowKey: "plan",
                    materializationRevision: "1",
                    value: "active",
                    validFrom: "2026-09-25T11:00:00Z",
                  },
                ],
              },
              "2026-09-25T12:00:00Z",
            )
          : operation === "read"
            ? store.readHistory({
                scope,
                subject,
                definitionId: "plan",
                definitionVersion: "1",
                materializationRevision: "1",
                knownAt: "2026-09-25T12:00:00Z",
                limit: 10,
              })
            : operation === "revision"
              ? store.getRevision(scope)
              : store.deleteSubject(scope, subject);
      await expect(call).rejects.toMatchObject({
        code: "analytics/fact-history/persistence-failed",
        cause,
      });
    },
  );

  it("preserves domain Problems and non-Error causes", () => {
    const problem = new FactHistoryProblem("revision-conflict", "Revision changed");
    expect(() => persistenceFailure(problem)).toThrow(problem);
    try {
      persistenceFailure("connection lost");
    } catch (error) {
      expect(error).toMatchObject({
        code: "analytics/fact-history/persistence-failed",
        cause: "connection lost",
      });
    }
  });
});
