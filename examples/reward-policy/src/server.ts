import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  RewardService,
  InvalidRewardPolicyProblem,
  RewardUnavailableProblem,
} from "@croco/gamification-core";
import { DrizzleRewardStore } from "@croco/gamification-drizzle";
import { RewardOperations } from "@croco/admin-core";
import { Problem } from "@croco/problems-core";
import type { RewardAdminAccess } from "@croco/admin-core";
import type { RewardPublication } from "@croco/gamification-core";

async function main() {
  if (!process.env.REWARD_EXAMPLE_DATABASE_URL)
    throw new RewardUnavailableProblem("REWARD_EXAMPLE_DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.REWARD_EXAMPLE_DATABASE_URL });
  const store = new DrizzleRewardStore(drizzle(pool));
  const scope = { appId: "reward-example", environmentId: "test", tenantId: "demo" };
  const subject = "local-demo-member";
  const session = randomUUID();
  const access: RewardAdminAccess = {
    scope,
    actorId: "local-demo-operator",
    permissions: ["reward.read", "reward.publish", "reward.test"],
  };
  const service = new RewardService(
    store,
    {
      verify: async (key) => {
        const result = await pool.query(
          "select id from reward_example_reports where id=$1 and subject=$2 and tenant_id=$3 and app_id=$4 and environment_id=$5",
          [
            key.evidenceRef,
            key.subject,
            key.scope.tenantId,
            key.scope.appId,
            key.scope.environmentId,
          ],
        );
        return result.rowCount === 1;
      },
    },
    {
      authorizeSubject: async (candidate, member) =>
        candidate.appId === scope.appId &&
        candidate.tenantId === scope.tenantId &&
        candidate.environmentId === scope.environmentId &&
        member === subject,
      authorizePublication: async (input) =>
        input.scope.appId === scope.appId &&
        input.scope.tenantId === scope.tenantId &&
        input.scope.environmentId === scope.environmentId &&
        input.actorId === access.actorId,
    },
  );
  const operations = new RewardOperations(service);
  if (!(await service.getPolicy(scope, "first-report", subject)))
    await operations.publish(
      {
        scope,
        actorId: access.actorId,
        expectedRevision: 0,
        idempotencyKey: "initial",
        reason: "Initial local example",
        policy: {
          id: "first-report",
          version: "v1",
          title: "First report reward",
          mode: "fixed",
          rewardEntries: [
            {
              id: "points",
              kind: "points",
              unit: "achievement-point",
              amount: 10,
              title: "Report points",
            },
          ],
          budgetUnit: "achievement-grant",
          cap: 100,
          fallback: { kind: "no-reward" },
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          effectiveUntil: "2099-01-01T00:00:00.000Z",
        },
      },
      access,
    );
  const html = await readFile("index.html");
  const browser = await readFile("dist/browser.global.js");
  const server = createServer(async (request, response) => {
    const json = (status: number, payload: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(payload));
    };
    try {
      if (request.method === "GET" && request.url === "/") {
        response.writeHead(200, {
          "content-type": "text/html",
          "set-cookie": `reward-session=${session}; HttpOnly; SameSite=Strict; Path=/`,
        });
        response.end(html);
        return;
      }
      if (request.method === "GET" && request.url === "/browser.js") {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end(browser);
        return;
      }
      if (!request.headers.cookie?.split("; ").includes(`reward-session=${session}`)) {
        json(403, { error: "Session denied" });
        return;
      }
      if (request.method === "GET" && request.url === "/api/state") {
        json(200, {
          access,
          publication: await service.getPolicy(scope, "first-report", subject),
          account: await service.getAccount(scope, subject),
        });
        return;
      }
      if (request.method !== "POST" || request.headers.origin !== "http://127.0.0.1:4321") {
        json(403, { error: "Origin denied" });
        return;
      }
      const chunks: Buffer[] = [];
      let byteLength = 0;
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        byteLength += chunk.length;
        if (byteLength > 32768) {
          response.setHeader("connection", "close");
          json(413, { error: "Request too large" });
          return;
        }
        chunks.push(chunk);
      }
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks, byteLength).toString("utf8"));
      } catch (cause) {
        if (!(cause instanceof SyntaxError)) throw cause;
        json(400, { error: "Invalid JSON" });
        return;
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new InvalidRewardPolicyProblem("Expected object");
      if (request.url === "/api/publish") {
        json(200, await operations.publish(input as RewardPublication, access));
        return;
      }
      if (request.url === "/api/report") {
        if (
          !("title" in input) ||
          typeof input.title !== "string" ||
          !input.title.trim() ||
          input.title.length > 120
        )
          throw new InvalidRewardPolicyProblem("Report title is required (maximum 120 characters)");
        const evidenceRef = `${subject}:first-report`;
        await pool.query(
          "insert into reward_example_reports(id,subject,tenant_id,app_id,environment_id,title) values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing",
          [evidenceRef, subject, scope.tenantId, scope.appId, scope.environmentId, input.title],
        );
        const publication = await service.getPolicy(scope, "first-report", subject);
        if (!publication) throw new RewardUnavailableProblem("Policy missing");
        json(
          200,
          await service.grantForEvidence({
            scope,
            subject,
            evidenceRef,
            policyId: publication.policy.id,
            policyVersion: publication.policy.version,
          }),
        );
        return;
      }
      json(404, { error: "Not found" });
    } catch (cause) {
      if (cause instanceof Problem) {
        json(cause.status, { error: cause.message, code: cause.code });
      } else {
        json(500, { error: "Request failed" });
      }
    }
  });
  server.listen(4321, "127.0.0.1", () => console.log("Reward example http://127.0.0.1:4321"));
}
void main().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});
