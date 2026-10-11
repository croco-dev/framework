import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertActivationGuidePreviewRequest,
  assertActivationGuidePublishRequest,
} from "@croco/admin-core";
import { GoalManager, GoalReceiptInvalidProblem } from "@croco/onboarding-core";
import type { GoalDefinition, GoalDefinitionPublication, GoalScope } from "@croco/onboarding-core";
import { DrizzleGoalStore, addOnboardingGoals } from "@croco/onboarding-drizzle";
import type { DrizzleGoalClient } from "@croco/onboarding-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ActivationGuidePreviewRequest,
  ActivationGuidePublishRequest,
} from "@croco/admin-core";

async function main(): Promise<void> {
  const databaseUrl = process.env.ONBOARDING_EXAMPLE_DATABASE_URL;
  if (!databaseUrl) throw new Error("ONBOARDING_EXAMPLE_DATABASE_URL is required");

  const schemaName = `onboarding_goals_example_${randomUUID().replaceAll("-", "")}`;
  const setupPool = new Pool({ connectionString: databaseUrl });
  await setupPool.query(`create schema "${schemaName}"`);
  await setupPool.end();

  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  const db = drizzle(pool) as unknown as DrizzleGoalClient;
  const txManager = new TxManager(createDrizzleTxAdapter(db));
  const store = new DrizzleGoalStore(db, txManager);

  const reports = pgTable("activation_reports", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    appId: text("app_id").notNull(),
    environmentId: text("environment_id").notNull(),
    subjectId: text("subject_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  });

  await pool.query(`
  create table croco_outbox_messages (
    id varchar(128) primary key,
    event_id varchar(128) not null,
    event_type text not null,
    aggregate_id text,
    idempotency_key varchar(255) not null unique,
    payload jsonb not null,
    metadata jsonb not null,
    trace_context jsonb,
    attempts integer not null default 0,
    max_attempts integer not null default 3,
    status text not null,
    visible_at timestamp not null,
    occurred_at timestamp not null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    locked_until timestamp,
    published_at timestamp,
    last_error jsonb,
    dead_lettered_at timestamp,
    dead_letter_reason text,
    diagnostics jsonb not null
  )
`);
  await addOnboardingGoals({ execute: (query) => db.execute(query as SQL) });
  await pool.query(`
  create table activation_reports (
    id text primary key,
    tenant_id text not null,
    app_id text not null,
    environment_id text not null,
    subject_id text not null,
    name text not null,
    created_at timestamptz not null
  )
`);

  const scope: GoalScope = { tenantId: "demo-tenant", appId: "demo-app", environmentId: "local" };
  const subject = { id: "demo-member", verified: true } as const;
  const episodeId = "signup-1";
  const definition: GoalDefinition = {
    id: "first-report",
    version: "v1",
    anchor: "signup",
    actionId: "report.saved",
    windowMs: 7 * 86_400_000,
    allowedLatenessMs: 86_400_000,
    timezone: "Asia/Seoul",
    countMode: "events",
    threshold: 1,
    deletedObjectPolicy: "retain",
    title: "Save your first report",
    description: "Create a report with a name and save it.",
    nextActionHref: "/reports/new#new-report",
    guidanceSteps: [{ id: "report", title: "Create a report", href: "/reports/new#new-report" }],
  };
  const access = {
    scope,
    actor: "demo-operator",
    permissions: ["onboarding.goal.read", "onboarding.goal.preview", "onboarding.goal.publish"],
  };

  const manager = new GoalManager(
    store,
    {
      verify: async ({ key, receipt }) => {
        if ("correction" in receipt || !receipt.objectId)
          throw new GoalReceiptInvalidProblem("domain-evidence-missing");
        const client = txManager.getClient() ?? db;
        const matching = await client
          .select({ id: reports.id })
          .from(reports)
          .where(
            and(
              eq(reports.id, receipt.objectId),
              eq(reports.tenantId, key.scope.tenantId),
              eq(reports.appId, key.scope.appId),
              eq(reports.environmentId, key.scope.environmentId),
              eq(reports.subjectId, key.subject.id),
            ),
          )
          .limit(1);
        if (!matching[0] || receipt.confirmation.evidenceId !== matching[0].id) {
          throw new GoalReceiptInvalidProblem("domain-evidence-missing");
        }
      },
    },
    { authorize: async (publication) => publication.actorId === access.actor },
    {
      verify: async ({ scope: candidateScope, subject: candidateSubject }) =>
        candidateScope.tenantId === scope.tenantId &&
        candidateScope.appId === scope.appId &&
        candidateScope.environmentId === scope.environmentId &&
        candidateSubject.id === subject.id,
    },
  );

  await manager.publishDefinition({
    scope,
    definition,
    revision: 1,
    actorId: access.actor,
    reason: "Demo activation guide",
    idempotencyKey: "initial-v1",
    publishedAt: new Date(),
  });
  await manager.beginEpisode({
    id: episodeId,
    scope,
    subject,
    definitionId: definition.id,
    anchor: "signup",
    startedAt: new Date(),
  });

  function json(response: ServerResponse, status: number, payload: unknown): void {
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(payload));
  }

  async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
    let text = "";
    for await (const chunk of request) {
      text += String(chunk);
      if (text.length > 32_768) throw new Error("Request is too large");
    }
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Expected JSON object");
    return parsed as Record<string, unknown>;
  }

  async function bootstrap() {
    const publication = await store.getPublishedDefinition(scope, definition.id);
    if (!publication) throw new Error("Published definition missing");
    const progress = await manager.getProgress({ scope, subject, episodeId, asOf: new Date() });
    return {
      access,
      definition: publication.definition,
      state: {
        kind: "ready" as const,
        published: {
          definition: publication.definition,
          revision: publication.revision,
          actor: publication.actorId,
          reason: publication.reason,
        },
      },
      progress,
      episodeId,
      subjectId: subject.id,
    };
  }

  const html = await readFile(join(process.cwd(), "index.html"));
  const browser = await readFile(join(process.cwd(), "dist/browser.global.js"));
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method === "GET" && (path === "/" || path === "/reports/new")) {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }
      if (request.method === "GET" && path === "/browser.js") {
        response.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
        response.end(browser);
        return;
      }
      if (request.method === "GET" && path === "/api/bootstrap") {
        json(response, 200, await bootstrap());
        return;
      }
      if (request.method !== "POST") {
        json(response, 404, { error: "Not found" });
        return;
      }
      if (request.headers.origin && request.headers.origin !== "http://127.0.0.1:4320") {
        json(response, 403, { error: "Origin denied" });
        return;
      }
      const input = await body(request);
      if (path === "/api/preview") {
        const preview = input as ActivationGuidePreviewRequest;
        assertActivationGuidePreviewRequest(preview, access);
        if (preview.subject.id !== subject.id || preview.episodeId !== episodeId) {
          throw new Error("Preview target denied");
        }
        json(
          response,
          200,
          await manager.getProgress({
            scope: preview.scope,
            subject: preview.subject,
            episodeId: preview.episodeId,
            asOf: new Date(preview.asOf),
          }),
        );
        return;
      }
      if (path === "/api/publish") {
        const publish = input as ActivationGuidePublishRequest;
        assertActivationGuidePublishRequest(publish, access);
        const publication: GoalDefinitionPublication = {
          scope: publish.scope,
          definition: publish.definition,
          revision: publish.expectedRevision + 1,
          actorId: publish.actor,
          reason: publish.reason,
          idempotencyKey: publish.idempotencyKey,
          publishedAt: new Date(),
        };
        await manager.publishDefinition(publication);
        json(response, 200, (await bootstrap()).state);
        return;
      }
      if (path === "/api/reports") {
        if (
          typeof input.commandId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(input.commandId) ||
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 120
        ) {
          throw new Error("Report command and name are required");
        }
        const reportId = input.commandId;
        const result = await txManager.run(async () => {
          const client = txManager.getClient();
          if (!client) throw new Error("Transaction unavailable");
          await client
            .insert(reports)
            .values({
              id: reportId,
              tenantId: scope.tenantId,
              appId: scope.appId,
              environmentId: scope.environmentId,
              subjectId: subject.id,
              name: input.name as string,
              createdAt: new Date(),
            })
            .onConflictDoNothing();
          const rows = await client.select().from(reports).where(eq(reports.id, reportId)).limit(1);
          const report = rows[0];
          if (!report || report.name !== input.name || report.subjectId !== subject.id)
            throw new Error("Report identity conflict");
          return manager.observeAction({
            scope,
            subject,
            episodeId,
            receipt: {
              eventId: `report.saved:${reportId}`,
              actionId: "report.saved",
              objectId: reportId,
              occurredAt: report.createdAt,
              confirmation: { source: "server", evidenceId: reportId },
            },
            receivedAt: new Date(),
          });
        });
        json(response, 200, { status: result.status, progress: result.episode.progress });
        return;
      }
      json(response, 404, { error: "Not found" });
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Request failed" });
    }
  });

  server.listen(4320, "127.0.0.1", () => {
    process.stdout.write(`Activation guide: http://127.0.0.1:4320/ (schema ${schemaName})\n`);
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
