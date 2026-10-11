import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertMissionPublication } from "@croco/admin-core";
import {
  MissionService,
  ServerActionVerifier,
  MissionInvalidProblem,
  MissionConflictProblem,
  MissionAccessDeniedProblem,
  missionLocalDate,
  missionPeriod,
} from "@croco/gamification-core";
import { DrizzleMissionStore } from "@croco/gamification-drizzle";
import { Problem } from "@croco/problems-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { reports, sessions, episodeCommands, scope, subjectId, missionId } from "./domain";
import { missionOutbox } from "./outbox";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MissionPublication } from "@croco/gamification-core";
import type { DrizzleMissionClient } from "@croco/gamification-drizzle";

async function main(): Promise<void> {
  const connectionString = process.env.GAMIFICATION_POSTGRES_URL;
  if (!connectionString) throw new MissionInvalidProblem("GAMIFICATION_POSTGRES_URL is required");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool) as unknown as DrizzleMissionClient;
  const txManager = new TxManager(createDrizzleTxAdapter(db));
  const store = new DrizzleMissionStore(db, txManager, missionOutbox(db, txManager).outbox);
  const client = () => txManager.getClient() ?? db;
  const service = new MissionService({
    store,
    authorization: {
      authorize: async (request) =>
        request.scope.tenantId === scope.tenantId &&
        request.scope.appId === scope.appId &&
        request.scope.environmentId === scope.environmentId &&
        (request.operation === "publish"
          ? request.actor.id === "demo-operator"
          : request.actor.id === subjectId && request.subjectId === subjectId),
    },
    verifier: new ServerActionVerifier({
      find: async (input) => {
        const rows = await client()
          .select()
          .from(reports)
          .where(
            and(
              eq(reports.id, input.eventId),
              eq(reports.tenantId, input.scope.tenantId),
              eq(reports.appId, input.scope.appId),
              eq(reports.environmentId, input.scope.environmentId),
              eq(reports.subjectId, input.subjectId),
            ),
          )
          .limit(1);
        const row = rows[0];
        return row
          ? {
              scope: input.scope,
              subjectId: row.subjectId,
              missionId,
              version: row.version,
              episodeId: row.episodeId,
              eventId: row.id,
              actionId: "report.saved",
              occurredAt: row.occurredAt.toISOString(),
            }
          : undefined;
      },
    }),
  });

  async function session(lock = false) {
    const query = client().select().from(sessions).where(eq(sessions.id, subjectId)).limit(1);
    const rows = lock ? await query.for("update") : await query;
    if (!rows[0]) throw new MissionInvalidProblem("Run the explicit migrate command first");
    return rows[0];
  }
  async function command(
    version?: number,
    episodeId?: string,
    occurredAt = new Date().toISOString(),
  ) {
    const current = await session();
    const selectedVersion = version ?? current.activeVersion;
    const publication = await store.getDefinition(scope, missionId, selectedVersion);
    if (!publication) throw new MissionInvalidProblem("Published mission missing");
    return {
      actor: { id: subjectId },
      key: {
        scope,
        subjectId,
        missionId,
        version: selectedVersion,
        episodeId: episodeId ?? current.episodeId,
        periodKey: missionPeriod(
          publication.definition,
          missionLocalDate(occurredAt, publication.definition.timezone),
        ).periodKey,
      },
    };
  }
  async function bootstrap(version?: number, episodeId?: string) {
    const current = await session();
    const publication = await store.getDefinition(
      scope,
      missionId,
      version ?? current.latestVersion,
    );
    if (!publication) throw new MissionInvalidProblem("Published mission missing");
    return {
      progress: await service.getProgress(
        await command(version ?? current.activeVersion, episodeId ?? current.episodeId),
      ),
      publication,
      access: { scope, actorId: "demo-operator", permissions: ["mission.publish"] },
      actions: ["report.saved"],
    };
  }

  function json(response: ServerResponse, status: number, payload: unknown): void {
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(payload));
  }
  async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
    let contents = "";
    for await (const chunk of request) {
      contents += String(chunk);
      if (contents.length > 32768) throw new MissionInvalidProblem("Request too large");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new MissionInvalidProblem("Invalid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new MissionInvalidProblem("Expected JSON object");
    return parsed as Record<string, unknown>;
  }
  const html = await readFile(join(process.cwd(), "index.html"));
  const browser = await readFile(join(process.cwd(), "dist/browser.global.js"));
  await bootstrap();
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url ?? "/", "http://127.0.0.1:4315").pathname;
      if (request.method === "GET" && path === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }
      if (request.method === "GET" && path === "/browser.js") {
        response.writeHead(200, { "content-type": "application/javascript" });
        response.end(browser);
        return;
      }
      if (request.method === "GET" && path === "/api/bootstrap") {
        json(response, 200, await bootstrap());
        return;
      }
      if (request.method === "GET" && path === "/api/progress") {
        json(response, 200, await service.getProgress(await command()));
        return;
      }
      if (request.method !== "POST") {
        json(response, 404, { error: "Not found" });
        return;
      }
      if (request.headers.origin && request.headers.origin !== "http://127.0.0.1:4315")
        throw new MissionAccessDeniedProblem();
      const input = await body(request);
      if (path === "/api/reports") {
        if (
          Object.keys(input).some((key) => !["commandId", "name"].includes(key)) ||
          typeof input.commandId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(input.commandId) ||
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 120
        ) {
          throw new MissionInvalidProblem("Report command and name required");
        }
        const id = input.commandId;
        const name = input.name;
        const result = await txManager.run(async () => {
          const current = await session(true);
          await client()
            .insert(reports)
            .values({
              id,
              name,
              ...scope,
              subjectId,
              version: current.activeVersion,
              episodeId: current.episodeId,
              occurredAt: new Date(),
            })
            .onConflictDoNothing();
          const rows = await client().select().from(reports).where(eq(reports.id, id)).limit(1);
          const report = rows[0];
          if (
            !report ||
            report.name !== name ||
            report.subjectId !== subjectId ||
            report.tenantId !== scope.tenantId ||
            report.appId !== scope.appId ||
            report.environmentId !== scope.environmentId
          ) {
            throw new MissionConflictProblem("Report command identity conflict");
          }
          return service.ingestEvidence({
            ...(await command(report.version, report.episodeId, report.occurredAt.toISOString())),
            evidence: {
              eventId: id,
              actionId: "report.saved",
              occurredAt: report.occurredAt.toISOString(),
            },
          });
        });
        json(response, 200, result);
        return;
      }
      if (path === "/api/definition") {
        const publication = input as MissionPublication;
        assertMissionPublication(
          publication,
          { scope, actorId: "demo-operator", permissions: ["mission.publish"] },
          ["report.saved"],
        );
        const saved = await txManager.run(async () => {
          const current = await session(true);
          const result = await service.publishDefinition({
            actor: { id: "demo-operator" },
            publication,
          });
          if (result.definition.id !== missionId)
            throw new MissionInvalidProblem("Unknown mission");
          if (result.revision > current.latestRevision) {
            await client()
              .update(sessions)
              .set({ latestVersion: result.definition.version, latestRevision: result.revision })
              .where(eq(sessions.id, subjectId));
          }
          return result;
        });
        json(response, 200, saved);
        return;
      }
      if (path === "/api/episodes") {
        const committed = await txManager.run(async () => {
          const current = await session(true);
          if (
            Object.keys(input).some((key) => !["version", "commandId"].includes(key)) ||
            typeof input.commandId !== "string" ||
            !/^[0-9a-f-]{36}$/i.test(input.commandId)
          ) {
            throw new MissionInvalidProblem("Episode command identity required");
          }
          const existing = await client()
            .select()
            .from(episodeCommands)
            .where(eq(episodeCommands.commandId, input.commandId))
            .limit(1);
          if (existing[0]) {
            if (existing[0].version !== input.version)
              throw new MissionConflictProblem("Episode command payload changed");
            return bootstrap(existing[0].version, existing[0].episodeId);
          }
          if (input.version !== current.latestVersion) {
            throw new MissionInvalidProblem(
              "Select the latest published version; episode identity is server-owned",
            );
          }
          const episodeId = randomUUID();
          await client()
            .insert(episodeCommands)
            .values({ commandId: input.commandId, version: current.latestVersion, episodeId });
          await client()
            .update(sessions)
            .set({ activeVersion: current.latestVersion, episodeId })
            .where(eq(sessions.id, subjectId));
          return bootstrap(current.latestVersion, episodeId);
        });
        json(response, 200, committed);
        return;
      }
      json(response, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof Problem)
        json(response, error.status, { error: error.detail, code: error.code });
      else
        json(response, 500, {
          error: "Mission provider unavailable",
          code: "example/provider-unavailable",
        });
    }
  });
  server.listen(4315, "127.0.0.1", () =>
    process.stdout.write("Recurring missions: http://127.0.0.1:4315/\n"),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      server.close(() => {
        void pool.end();
      });
    });
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
