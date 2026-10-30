import { resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { Request as MiniflareRequest } from "miniflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createEngagementSchema } from "@croco/engagement-drizzle";

const apiKey = "re_worker_synthetic_private_key";
const address = "private-recipient@example.com";
const workers: Miniflare[] = [];

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "Resend Worker durable Engagement receipts",
  () => {
    let container: StartedTestContainer;
    let pool: Pool;
    let connectionString: string;
    let script: string;

    beforeAll(async () => {
      container = await new GenericContainer("postgres:17-alpine")
        .withEnvironment({
          POSTGRES_USER: "fixture",
          POSTGRES_PASSWORD: "fixture-secret",
          POSTGRES_DB: "fixture",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
        .start();
      connectionString = `postgres://fixture:fixture-secret@${container.getHost()}:${container.getMappedPort(5432)}/fixture`;
      pool = new Pool({ connectionString });
      await createEngagementSchema(drizzle(pool));
      // Mirrors the existing execution-drizzle PostgreSQL fixture's public schema.
      await pool.query(`create table executions (
        id varchar(26) primary key, type text not null, status text not null,
        payload json, result json, error json, attempts integer not null default 0,
        max_attempts integer not null default 1, created_at timestamp not null default now(),
        started_at timestamp, completed_at timestamp, scheduled_for timestamp, timeout bigint,
        idempotency_key varchar(255), request_fingerprint varchar(64), replay_of varchar(26),
        logs jsonb, parent_id varchar(26), metadata json, checkpoints json, progress json,
        continuation jsonb
      ); create unique index executions_idempotency_key_idx on executions (idempotency_key)`);
      const bundle = await build({
        entryPoints: [resolve(import.meta.dirname, "fixtures/resendEngagementWorker.ts")],
        bundle: true,
        write: false,
        format: "esm",
        platform: "node",
        conditions: ["workerd", "module"],
        external: ["node:*", "cloudflare:sockets", "pg-native"],
        banner: {
          js: "import { createRequire } from 'node:module'; const require = createRequire('/');",
        },
        alias: Object.fromEntries(
          [
            "diagnostics-core",
            "engagement-core",
            "engagement-drizzle",
            "events-core",
            "execution-core",
            "execution-drizzle",
            "framework-context",
            "notifications-core",
            "problems-core",
            "protocols-core",
            "retry-core",
            "tasks-core",
            "telemetry-api",
            "tx-core",
            "tx-drizzle",
          ].map((name) => [
            `@croco/${name}`,
            resolve(import.meta.dirname, `../../../${name}/src/index.ts`),
          ]),
        ),
      });
      const output = bundle.outputFiles[0];
      if (!output) throw new Error("Missing Resend Engagement Worker bundle");
      script = output.text;
    }, 180_000);

    beforeEach(async () => {
      await pool.query(`truncate executions, engagement_delivery_events,
        engagement_dispatch_targets, engagement_dispatches, engagement_preferences,
        engagement_suppressions, engagement_contact_endpoints,
        engagement_contact_policy_reservations, engagement_contact_policy_buckets`);
      await pool.query(
        `insert into engagement_contact_endpoints
        (tenant_id, id, recipient_id, kind, address, last_seen_at, version, created_at, updated_at)
        values ('tenant-a', 'email', 'recipient', 'email', $1, now(), 1, now(), now()),
               ('tenant-b', 'email', 'recipient', 'email', $1, now(), 1, now(), now())`,
        [address],
      );
    });

    afterAll(async () => {
      await Promise.all(workers.splice(0).map((worker) => worker.dispose()));
      await pool?.end();
      await container?.stop();
    }, 180_000);

    function upstream(mode: "accepted" | "lost-response") {
      const requests: string[] = [];
      const accepted = new Map<string, string>();
      return {
        requests,
        accepted,
        async fetch(request: MiniflareRequest) {
          expect(request.url).toBe("https://api.resend.com/emails");
          expect(request.method).toBe("POST");
          expect(request.headers.get("Authorization")).toBe(`Bearer ${apiKey}`);
          expect(await request.json()).toMatchObject({
            from: "sender@example.com",
            to: address,
            subject: "Welcome private-recipient-name",
            html: "<p>Hello private-recipient-name</p>",
            text: "Hello private-recipient-name",
          });
          const key = request.headers.get("Idempotency-Key");
          expect(key).toBeTruthy();
          if (!key) throw new Error("Missing fixture idempotency key");
          requests.push(key);
          if (!accepted.has(key)) accepted.set(key, `email-${accepted.size + 1}`);
          if (mode === "lost-response") {
            // Upstream has accepted once, but the caller cannot establish that from this response.
            return Response.json(
              { name: "internal_server_error", message: "Provider response lost after acceptance" },
              { status: 503 },
            );
          }
          return Response.json({ id: accepted.get(key) });
        },
      };
    }

    async function worker(service: ReturnType<typeof upstream>): Promise<Miniflare> {
      const instance = new Miniflare({
        modules: true,
        script,
        compatibilityDate: "2026-03-12",
        compatibilityFlags: ["nodejs_compat"],
        hyperdrives: { HYPERDRIVE: connectionString },
        bindings: { RESEND_API_KEY: apiKey, RESEND_FROM: "sender@example.com" },
        outboundService: (request: MiniflareRequest) => service.fetch(request),
      });
      workers.push(instance);
      await instance.ready;
      return instance;
    }

    it("persists accepted receipts, replays after a fresh Worker, and keeps tenant identity separate", async () => {
      const provider = upstream("accepted");
      const firstWorker = await worker(provider);
      const firstResponse = await firstWorker.dispatchFetch("https://fixture/send?key=receipt");
      expect(firstResponse.status).toBe(200);
      const first = await firstResponse.json();
      expect(first).toMatchObject({ status: "queued" });
      const reopened = await worker(provider);
      const replay = await reopened.dispatchFetch("https://fixture/send?key=receipt");
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual(first);
      expect(provider.requests).toHaveLength(1);
      expect(provider.accepted.size).toBe(1);

      const inspected = await reopened.dispatchFetch("https://fixture/inspect?key=receipt");
      const evidence = await inspected.json();
      expect(evidence).toMatchObject({
        dispatch: {
          tenantId: "tenant-a",
          outcome: { kind: "queued" },
          targets: [{ provider: "resend", providerMessageId: "email-1" }],
        },
        events: [{ type: "accepted", provider: "resend" }],
        reservations: [{ state: "committed" }],
      });
      const observed = await pool.query("select type from engagement_delivery_events");
      expect(observed.rows).toEqual([{ type: "accepted" }]);
      const otherTenant = await reopened.dispatchFetch("https://fixture/send?key=receipt&tenant=b");
      expect(otherTenant.status).toBe(200);
      expect(provider.requests).toHaveLength(2);
      expect(new Set(provider.requests).size).toBe(2);
      expect(
        (await pool.query("select tenant_id from engagement_dispatches order by tenant_id")).rows,
      ).toEqual([{ tenant_id: "tenant-a" }, { tenant_id: "tenant-b" }]);
    });

    it("retains unknown acceptance across fresh Workers and does not blindly send again", async () => {
      const provider = upstream("lost-response");
      const firstWorker = await worker(provider);
      const response = await firstWorker.dispatchFetch("https://fixture/send?key=unknown");
      expect(response.status).toBeGreaterThanOrEqual(400);
      const failure = await response.text();
      expect(failure).toContain("engagement-core/contact-policy-acceptance-unknown");
      expect(failure).not.toContain(apiKey);
      expect(failure).not.toContain(address);
      expect(failure).not.toContain("private-recipient-name");
      expect(provider.requests).toHaveLength(3);
      expect(new Set(provider.requests).size).toBe(1);
      expect(provider.accepted.size).toBe(1);

      const reopened = await worker(provider);
      const replay = await reopened.dispatchFetch("https://fixture/send?key=unknown");
      expect(replay.status).toBe(409);
      expect(await replay.text()).toContain("engagement-core/contact-policy-conflict");
      expect(provider.requests).toHaveLength(3);
      const observed = await pool.query(
        "select state, execution_ids from engagement_contact_policy_reservations",
      );
      expect(observed.rows).toEqual([{ state: "unknown", execution_ids: [] }]);
      expect((await pool.query("select type from engagement_delivery_events")).rows).toEqual([]);
      const dispatch = await pool.query("select outcome from engagement_dispatches");
      expect(dispatch.rows).toMatchObject([
        {
          outcome: {
            kind: "failed",
            retryable: false,
            failureCode: "engagement-core/contact-policy-acceptance-unknown",
          },
        },
      ]);
    });

    it.each(["preference", "suppression"] as const)(
      "honors a durable denied %s before sending",
      async (kind) => {
        if (kind === "preference") {
          await pool.query(`insert into engagement_preferences
          (tenant_id, scope, recipient_key, topic, channel, state, source, changed_at)
          values ('tenant-a', 'recipient', 'recipient', 'welcome', 'email', 'deny', 'fixture', now())`);
        } else {
          await pool.query(`insert into engagement_suppressions
          (tenant_id, id, recipient_id, endpoint_id, channel, reason, source, created_at)
          values ('tenant-a', 'suppressed', 'recipient', 'email', 'email', 'unsubscribe', 'fixture', now())`);
        }
        const provider = upstream("accepted");
        const instance = await worker(provider);
        const response = await instance.dispatchFetch(`https://fixture/send?key=${kind}`);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ status: "suppressed", reason: kind });
        expect(provider.requests).toEqual([]);
        expect((await pool.query("select id from executions")).rows).toEqual([]);
      },
    );
  },
);
