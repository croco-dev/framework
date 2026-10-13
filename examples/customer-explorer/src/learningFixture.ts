import { Pool } from "pg";
import { LearningRegistry, LearningRegistryProblem } from "@croco/admin-core";
import { PostgresLearningRepository } from "@croco/admin-postgres";
import type { LearningField, LearningRecord, LearningPolicy } from "@croco/admin-core";

// Synthetic loopback example, deliberately independent of CustomerExplorer and Experiment services.
const url = process.env.LEARNING_EXAMPLE_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new LearningRegistryProblem(
    "input",
    "LEARNING_EXAMPLE_DATABASE_URL must name a local disposable PostgreSQL database",
  );
export const scope = { appId: "learning-example", environment: "local", tenantId: "synthetic" };
export const access = { scope, actor: "synthetic-operator", principal: "loopback-example" };
export const pool = new Pool({ connectionString: url, options: "-c search_path=learning_example" });
const fields: readonly LearningField[] = [
  "question",
  "desiredOutcome",
  "facts",
  "hypotheses",
  "evidenceRefs",
  "decision",
  "nextActions",
  "owner",
  "status",
  "tags",
];
const policy: LearningPolicy = {
  authorize: async (session) => session.principal === "loopback-example",
  fields: async () => fields,
  assertSafe: async (content, _session, reason) => {
    if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(JSON.stringify([content, reason])))
      throw new LearningRegistryProblem(
        "input",
        "Synthetic example rejects customer email text; use an opaque reference",
      );
    if (
      content.evidenceRefs.some((ref) =>
        ref.snapshot?.metrics.some((metric) => metric.metricId !== "conversion"),
      )
    )
      throw new LearningRegistryProblem(
        "input",
        "Synthetic example imports only the approved conversion aggregate",
      );
  },
};
export const registry = new LearningRegistry(new PostgresLearningRepository(pool), policy, [
  {
    id: "synthetic-report",
    resolve: async (ref) => ({
      state: ref.id === "checkout" ? "available" : "deleted",
      version: "v1",
    }),
  },
]);
export function newDraft(id: string): LearningRecord {
  return {
    id,
    scope,
    revision: 0,
    question: "Does a shorter checkout help?",
    desiredOutcome: "Less abandonment",
    facts: [],
    hypotheses: [],
    evidenceRefs: [],
    nextActions: [],
    owner: "synthetic-owner",
    status: "draft",
    tags: { action: ["checkout"], target: [], metric: ["conversion"] },
  };
}
