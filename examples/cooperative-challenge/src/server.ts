import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Membership } from "@croco/membership-core";
import {
  ChallengeService,
  ChallengeInvalidProblem,
  ChallengeAccessDeniedProblem,
  ChallengeEvidenceProblem,
} from "@croco/gamification-core";
import {
  DrizzleChallengeStore,
  challengeSchema,
  createChallengeSchema,
} from "@croco/gamification-drizzle";
import { Problem } from "@croco/problems-core";
import type {
  ChallengeAccess,
  ChallengeDefinition,
  ChallengeEvidence,
} from "@croco/gamification-core";

const scope = { app: "cooperative-example", environment: "local", tenantId: "synthetic-team" };
const challengeId = "team-learning";
const subjects = ["member-a", "member-b", "operator"];

async function main(): Promise<void> {
  const connectionString = process.env.CHALLENGE_EXAMPLE_DATABASE_URL;
  if (!connectionString)
    throw new ChallengeInvalidProblem("CHALLENGE_EXAMPLE_DATABASE_URL is required");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema: challengeSchema });
  const store = new DrizzleChallengeStore(db);
  const access = (subjectId: string, reason = "Explicit local user request"): ChallengeAccess => ({
    scope,
    challengeId,
    subjectId,
    actor: { id: subjectId, reason },
  });
  const currentMembership = async (
    tenantId: string,
    userId: string,
  ): Promise<Membership | null> => {
    const result = await pool.query<Membership>(
      'select id, tenant_id as "tenantId", user_id as "userId", role, created_at as "createdAt", updated_at as "updatedAt" from memberships where tenant_id=$1 and user_id=$2 limit 1',
      [tenantId, userId],
    );
    return result.rows[0] ?? null;
  };
  const service = new ChallengeService({
    store,
    clock: () => new Date(),
    authorize: async (target, action) =>
      target.scope.app === scope.app &&
      target.scope.environment === scope.environment &&
      target.scope.tenantId === scope.tenantId &&
      target.challengeId === challengeId &&
      subjects.includes(target.subjectId) &&
      target.actor.id === target.subjectId &&
      (["create", "updateDefinition", "close"].includes(action)
        ? target.subjectId === "operator"
        : true),
    isMember: async (target) =>
      (await currentMembership(target.scope.tenantId, target.subjectId)) !== null,
    sources: {
      learning: async (target, eventId): Promise<ChallengeEvidence> => {
        const rows = await pool.query<{ subject_id: string; occurred_at: Date }>(
          "select subject_id, occurred_at from challenge_example_learning where app=$1 and environment=$2 and tenant_id=$3 and event_id=$4",
          [target.scope.app, target.scope.environment, target.scope.tenantId, eventId],
        );
        const row = rows.rows[0];
        if (!row || row.subject_id !== target.subjectId)
          throw new ChallengeEvidenceProblem("Server learning receipt is unavailable");
        return {
          subjectId: row.subject_id,
          occurredAt: row.occurred_at,
          amount: 1,
          revision: 1,
          correctionOf: null,
        };
      },
    },
  });
  if (process.argv.includes("--migrate")) {
    await createChallengeSchema(db);
    // The example reuses the membership provider's tenant/user identity table.
    await db.execute(sql`create sequence if not exists membership_seat_ordinal_seq`);
    await db.execute(sql`create table if not exists memberships (
      id text primary key, tenant_id text not null, user_id text not null, role text not null,
      seat_ordinal bigint not null default -nextval('membership_seat_ordinal_seq'),
      created_at timestamp not null default now(), updated_at timestamp not null default now(),
      unique(tenant_id,user_id), unique(tenant_id,seat_ordinal))`);
    for (const subjectId of subjects)
      await pool.query(
        "insert into memberships(id,tenant_id,user_id,role) values ($1,$2,$3,$4) on conflict do nothing",
        [
          `challenge-example-${subjectId}`,
          scope.tenantId,
          subjectId,
          subjectId === "operator" ? "admin" : "member",
        ],
      );
    await db.execute(sql`create table if not exists challenge_example_learning (
      app text not null, environment text not null, tenant_id text not null, event_id text not null,
      subject_id text not null, occurred_at timestamptz not null default now(),
      primary key(app,environment,tenant_id,event_id))`);
    const existing = await store.transact(scope, challengeId, async (tx) => tx.challenge);
    if (!existing) {
      const start = new Date(Date.now() + 1000);
      await service.create({
        ...access("operator", "Initialize synthetic cooperative goal"),
        idempotencyKey: "initial-definition",
        definition: {
          scope,
          id: challengeId,
          version: 1,
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          goal: 4,
          memberCap: 2,
          minMembers: 2,
          lateAllowanceMs: 60_000,
          visibility: "aggregate",
          leavePolicy: "retain",
        },
      });
    }
    await pool.end();
    return;
  }
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (path === "/" || path === "/dist/browser.global.js") {
        const content = await readFile(
          join(process.cwd(), path === "/" ? "index.html" : "dist/browser.global.js"),
        );
        response
          .writeHead(200, {
            "content-type":
              path === "/" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
          })
          .end(content);
        return;
      }
      // Fixed synthetic identities on loopback. A production host supplies authenticated access.
      const header = request.headers["x-example-subject"];
      if (typeof header !== "string" || !subjects.includes(header))
        throw new ChallengeAccessDeniedProblem();
      if (path === "/api/challenge" && request.method === "GET") {
        const view = await service.read(access(header));
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(view));
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 16_384) throw new ChallengeInvalidProblem("Request body exceeds 16 KiB");
        chunks.push(bytes);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
      if (!idempotencyKey.trim()) throw new ChallengeInvalidProblem("Idempotency key is required");
      const command = {
        ...access(header, typeof body.reason === "string" ? body.reason : undefined),
        idempotencyKey,
      };
      switch (path) {
        case "/api/join":
          await service.join({
            ...command,
            consentVersion: Number(body.consentVersion),
            leavePolicy: body.leavePolicy as ChallengeDefinition["leavePolicy"],
            publicConsent: body.publicConsent as boolean,
          });
          break;
        case "/api/leave":
          await service.leave(command);
          break;
        case "/api/learn":
          if (!(await currentMembership(scope.tenantId, header)))
            throw new ChallengeAccessDeniedProblem();
          await pool.query(
            "insert into challenge_example_learning(app,environment,tenant_id,event_id,subject_id) values ($1,$2,$3,$4,$5) on conflict do nothing",
            [scope.app, scope.environment, scope.tenantId, idempotencyKey, header],
          );
          await service.contribute({ ...command, sourceId: "learning", eventId: idempotencyKey });
          break;
        case "/api/close":
          await service.close({ ...command, expectedVersion: Number(body.expectedVersion) });
          break;
        case "/api/save": {
          const input = body.definition as Record<string, unknown>;
          if (!input || typeof input !== "object")
            throw new ChallengeInvalidProblem("Definition is required");
          const definition = {
            ...input,
            scope,
            id: challengeId,
            start: new Date(String(input.start)),
            end: new Date(String(input.end)),
          } as ChallengeDefinition;
          if (body.kind === "create") await service.create({ ...command, definition });
          else if (body.kind === "update")
            await service.updateDefinition({
              ...command,
              definition,
              expectedVersion: Number(body.expectedVersion),
            });
          else throw new ChallengeInvalidProblem("Unknown definition operation");
          break;
        }
        default:
          response.writeHead(404).end();
          return;
      }
      const view = await service.read(access(header));
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(view));
    } catch (error) {
      response
        .writeHead(error instanceof Problem ? error.status : 500, {
          "content-type": "application/json",
        })
        .end(
          JSON.stringify({
            code: error instanceof Problem ? error.code : "challenge-example/request-failed",
            detail: error instanceof Error ? error.message : "Request failed",
          }),
        );
    }
  });
  server.listen(4182, "127.0.0.1", () =>
    console.log("Cooperative challenge: http://127.0.0.1:4182/"),
  );
  const stop = () => {
    server.close();
    void pool.end();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
