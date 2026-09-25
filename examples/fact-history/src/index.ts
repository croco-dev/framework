import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFactHistoryOperations } from "@croco/admin-core/fact-history-operations";
import { FactHistoryPanel } from "@croco/admin-react";
import { FactHistoryProblem, FactHistoryService } from "@croco/analytics-core";
import { createFactHistory, DrizzleFactHistoryStore } from "@croco/analytics-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type {
  FactDefinition,
  FactHistoryPolicy,
  FactScope,
  FactSubject,
} from "@croco/analytics-core";

const connectionString = process.env.FACT_HISTORY_DATABASE_URL;
if (!connectionString)
  throw new FactHistoryProblem(
    "invalid-input",
    "Set FACT_HISTORY_DATABASE_URL to a disposable PostgreSQL database",
  );

const scope: FactScope = {
  app: "fact-history-example",
  environment: "demo",
  tenantId: "demo-tenant",
};
const subject: FactSubject = { kind: "user", id: "demo-customer" };
const definitions: readonly FactDefinition[] = [
  { id: "plan", version: "1", validate: (value) => typeof value === "string" },
  { id: "subscriptionStatus", version: "1", validate: (value) => typeof value === "string" },
];
const policy: FactHistoryPolicy = {
  authorize(request) {
    if (
      request.scope.app !== scope.app ||
      request.scope.environment !== scope.environment ||
      request.scope.tenantId !== scope.tenantId ||
      request.subject.kind !== subject.kind ||
      request.subject.id !== subject.id ||
      (request.actor !== undefined && request.actor !== "demo-operator")
    ) {
      throw new FactHistoryProblem("denied", "The demonstration scope is required");
    }
  },
  mask: (row) => row,
};

async function main(): Promise<void> {
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const db = drizzle(pool);
    await createFactHistory(db);
    const service = new FactHistoryService(
      new DrizzleFactHistoryStore(db),
      definitions,
      policy,
      () => new Date("2026-09-21T12:00:00.000Z"),
    );

    await service.appendFacts({
      scope,
      source: "subscription",
      sourceEventId: "demo-subscription-updated-1",
      sourceFingerprint: createHash("sha256")
        .update(
          JSON.stringify({ event: "demo-subscription-updated-1", plan: "paid", status: "active" }),
        )
        .digest("hex"),
      rows: [
        {
          subject,
          definitionId: "plan",
          definitionVersion: "1",
          projectionId: "subscription.v1",
          projectionRowKey: "plan",
          materializationRevision: "1",
          value: "paid",
          validFrom: "2026-09-21T11:00:00.000Z",
        },
        {
          subject,
          definitionId: "subscriptionStatus",
          definitionVersion: "1",
          projectionId: "subscription.v1",
          projectionRowKey: "status",
          materializationRevision: "1",
          value: "active",
          validFrom: "2026-09-21T11:00:00.000Z",
        },
      ],
    });

    const operations = createFactHistoryOperations(service, "demo-operator");
    const request = {
      scope,
      subject,
      definitionId: "plan",
      definitionVersion: "1",
      materializationRevision: "1",
      effectiveAt: "2026-09-21T11:30:00.000Z",
      knownAt: "2026-09-21T11:30:00.000Z",
      compareEffectiveAt: "2026-09-21T11:30:00.000Z",
      compareKnownAt: "2026-09-21T12:30:00.000Z",
      limit: 20,
    } as const;
    const state = await operations.compare(request);
    const panel = renderToStaticMarkup(
      createElement(FactHistoryPanel, {
        state,
        request,
        actor: "demo-operator",
        canCorrect: false,
        onCompare: async (input) => {
          await operations.compare(input);
        },
        onCorrect: async (input) => {
          await operations.correct(input);
        },
      }),
    );
    console.log(
      JSON.stringify(
        {
          before: "snapshot" in state ? state.snapshot.before : state.kind,
          after: "snapshot" in state ? state.snapshot.after : state.kind,
          panel,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
