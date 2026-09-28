import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { ExperienceAdminProblem, ExperienceOperations } from "@croco/admin-core";
import { PublishedCohortReader, cohortContentHash } from "@croco/cohort-core";
import {
  definePlacement,
  dismissExperience,
  evaluatePlacement,
  ExperienceInvalidProblem,
  recordExposure,
} from "@croco/experience-core";
import { PostgresExperienceStore } from "@croco/experience-drizzle";
import { DemoApp } from "./App";
import type { IncomingMessage } from "node:http";
import type { ExperienceAdminState } from "@croco/admin-core";
import type { ExperienceConfig, ExposureHandle, ExperienceScope } from "@croco/experience-core";
import type { ExperiencePgDatabase, ExperiencePgExecutor } from "@croco/experience-drizzle";
import type { DemoBootstrap } from "./App";

const databaseUrl = process.env.EXPERIENCE_DATABASE_URL;
if (!databaseUrl) throw new Error("EXPERIENCE_DATABASE_URL is required for the example");

const pool = new Pool({ connectionString: databaseUrl });
pool.on("error", (failure) => {
  process.stderr.write(`Experience database connection unavailable: ${String(failure)}\n`);
});
const dialect = new PgDialect();
function executor(client: Pick<Pool, "query">): ExperiencePgExecutor {
  return {
    execute: (statement) => {
      const query = dialect.sqlToQuery(statement);
      return client.query(query.sql, query.params) as Promise<{ rows: Record<string, unknown>[] }>;
    },
  };
}
const database: ExperiencePgDatabase = {
  ...executor(pool),
  transaction: async (work) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(executor(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

const scope: ExperienceScope = {
  appId: "example-shop",
  environment: "local",
  tenantId: "demo-tenant",
};
const subject = { kind: "customer", id: "customer-1" };
const context = { plan: "paid" };
const placement = definePlacement({
  id: "checkout.assurance",
  schema: {
    contextFields: { plan: "string" },
    content: { locales: ["en"], maxTitleLength: 120, maxBodyLength: 1000, allowActionUrl: true },
  },
  allowedRenderers: ["banner", "card", "modal"],
});
const store = new PostgresExperienceStore(database);
const now = new Date();
const snapshot = {
  snapshotId: "experience-demo-audience",
  scope,
  subjectKind: subject.kind,
  definitionId: "demo-buyers",
  definitionVersion: 1,
  schemaVersion: 1 as const,
  sourceSnapshotRefs: ["demo-source-v1"],
  asOf: new Date(now.getTime() - 60_000).toISOString(),
  generatedAt: now.toISOString(),
  validUntil: new Date(now.getTime() + 3_600_000).toISOString(),
  contentHash: cohortContentHash([subject.id]),
  publicationRevision: 1,
  privacyVersion: "demo-privacy-v1",
  membershipRef: "demo-members-v1",
};
const cohortReader = new PublishedCohortReader(
  {
    read: async (id) =>
      id === snapshot.snapshotId
        ? { snapshot, subjectIds: [subject.id], withdrawn: false }
        : undefined,
  },
  { currentVersion: async () => snapshot.privacyVersion, isAllowed: async () => true },
);
const access = {
  scope,
  actorId: "demo-operator",
  permissions: [
    "experience.read",
    "experience.preview",
    "experience.write",
    "experience.publish",
  ] as const,
  fields: [
    "renderer",
    "content.locale",
    "content.title",
    "content.body",
    "content.actionUrl",
    "targeting.context",
    "targeting.staticSubjectIds",
    "targeting.cohortSnapshotId",
    "priority",
    "startAt",
    "endAt",
    "frequency",
    "context.plan",
  ],
};
const operations = new ExperienceOperations(store, { [placement.id]: placement }, cohortReader);
const seedConfig: ExperienceConfig = {
  id: "checkout-safety",
  placementId: placement.id,
  scope,
  revision: 1,
  status: "published",
  renderer: "banner",
  content: { locale: "en", title: "A safer checkout", body: "Your payment is protected." },
  targeting:
    process.env.EXPERIENCE_AUDIENCE_MODE === "cohort"
      ? { cohortSnapshotId: snapshot.snapshotId }
      : {
          context: [{ field: "plan", operator: "eq", value: "paid" }],
          staticSubjectIds: [subject.id],
        },
  priority: 10,
  frequency: { maxDisplays: 20, windowSeconds: 3600 },
};

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 32_768) throw new ExperienceInvalidProblem("Request exceeds 32 KiB");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch (failure) {
    if (failure instanceof SyntaxError) throw new ExperienceInvalidProblem("JSON body is invalid");
    throw failure;
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ExperienceInvalidProblem("Object body is required");
  return value as Record<string, unknown>;
}

async function main(): Promise<void> {
  const migrated = await pool.query("SELECT to_regclass('croco_experience_current') AS table_name");
  if (!migrated.rows[0]?.table_name)
    await pool.query(
      readFileSync(
        resolve(
          __dirname,
          "../../../packages/experience-drizzle/migrations/0001_experience.up.sql",
        ),
        "utf8",
      ),
    );
  const existing = await store.listConfigs(scope, placement.id);
  if (existing.length === 0) {
    await operations.save(seedConfig, access, {
      expectedRevision: null,
      reason: "Start local example",
      idempotencyKey: "initial",
    });
  }
  const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
  const browser = readFileSync(resolve(__dirname, "../dist/browser.global.js"));
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/browser.js") {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(browser);
        return;
      }
      if (request.method === "GET" && request.url === "/favicon.ico") {
        response.statusCode = 204;
        response.end();
        return;
      }
      if (request.method === "GET" && request.url === "/") {
        let config = seedConfig;
        let adminState: ExperienceAdminState;
        try {
          const configs = await operations.list(placement.id, access);
          if (!configs[0]) throw new Error("Example configuration is missing");
          config = configs[0];
          adminState = { kind: "ready", configs };
        } catch (failure) {
          process.stderr.write(`Experience configuration unavailable: ${String(failure)}\n`);
          adminState = {
            kind: "failed",
            code: "Experience storage unavailable; refresh after recovery",
          };
        }
        const evaluation =
          adminState.kind === "ready"
            ? await evaluatePlacement({
                placement,
                scope,
                subject,
                context,
                locale: "en",
                store,
                cohortReader,
                onUnavailable: (cause) =>
                  process.stderr.write(`Experience decision unavailable: ${String(cause)}\n`),
                onInvalidStoredConfig: (configId, cause) =>
                  process.stderr.write(`Invalid stored experience ${configId}: ${String(cause)}\n`),
              })
            : { reason: "unavailable" as const, decision: null };
        const initial: DemoBootstrap = { config, placement, evaluation, adminState };
        const markup = renderToString(h(DemoApp, { initial }));
        const serialized = JSON.stringify(initial).replace(/</g, "\\u003c");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          html
            .replace("<!--APP-->", markup)
            .replace(
              "<!--BOOTSTRAP-->",
              `<script>window.__EXPERIENCE_BOOTSTRAP__=${serialized}</script>`,
            ),
        );
        return;
      }
      if (request.method !== "POST") {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`)
        throw new ExperienceInvalidProblem("Cross-origin requests are rejected");
      const body = object(await readBody(request));
      let result: unknown;
      if (request.url === "/api/preview")
        result = await operations.preview(
          body.config as ExperienceConfig,
          subject,
          context,
          access,
        );
      else if (request.url === "/api/config")
        result = await operations.save(body.config as ExperienceConfig, access, {
          expectedRevision: body.expectedRevision as number | null,
          reason: body.reason as string,
          idempotencyKey: body.idempotencyKey as string,
        });
      else if (request.url === "/api/decision")
        result = await evaluatePlacement({
          placement,
          scope,
          subject,
          context,
          locale: "en",
          store,
          cohortReader,
          onUnavailable: (cause) =>
            process.stderr.write(`Experience decision unavailable: ${String(cause)}\n`),
          onInvalidStoredConfig: (configId, cause) =>
            process.stderr.write(`Invalid stored experience ${configId}: ${String(cause)}\n`),
        });
      else if (request.url === "/api/exposure")
        result = {
          result: await recordExposure(store, {
            scope,
            subject,
            handle: body.handle as ExposureHandle,
            at: new Date().toISOString(),
          }),
        };
      else if (request.url === "/api/dismiss") {
        await dismissExperience(store, {
          scope,
          subject,
          handle: body.handle as ExposureHandle,
          at: new Date().toISOString(),
        });
        result = { saved: true };
      } else {
        response.statusCode = 404;
        result = { code: "NOT_FOUND" };
      }
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(result));
    } catch (failure) {
      const validation =
        failure instanceof ExperienceAdminProblem || failure instanceof ExperienceInvalidProblem;
      response.statusCode = validation ? 400 : 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      if (!validation) process.stderr.write(`Experience request failed: ${String(failure)}\n`);
      response.end(
        JSON.stringify({
          code: validation ? failure.code : "EXAMPLE_REQUEST_FAILED",
          detail: validation ? failure.message : "Request failed",
        }),
      );
    }
  });
  const port = Number(process.env.PORT ?? 4177);
  server.listen(port, "127.0.0.1", () => process.stdout.write(`http://127.0.0.1:${port}\n`));
  process.on("SIGINT", () => {
    server.close();
    void pool.end();
  });
}

void main().catch(async (failure: unknown) => {
  process.stderr.write(`${String(failure)}\n`);
  await pool.end();
  process.exitCode = 1;
});
