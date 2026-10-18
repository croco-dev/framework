import { resolve } from "node:path";
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { once } from "node:events";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { Pool } from "pg";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// This is local workerd → PostgreSQL. It does not exercise the deployed Hyperdrive proxy/cache.
const workers: Miniflare[] = [];
describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "Hyperdrive local Worker PostgreSQL",
  () => {
    let container: StartedTestContainer;
    let pool: Pool;
    let connectionString: string;
    let script: string;
    async function worker(
      binding: string | undefined = connectionString,
      native = true,
    ): Promise<Miniflare> {
      const instance = new Miniflare({
        modules: true,
        script,
        compatibilityDate: "2026-03-12",
        compatibilityFlags: ["nodejs_compat"],
        ...(binding
          ? native
            ? { hyperdrives: { HYPERDRIVE: binding } }
            : { bindings: { HYPERDRIVE: { connectionString: binding } } }
          : {}),
      });
      workers.push(instance);
      await instance.ready;
      return instance;
    }
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
      const host = container.getHost();
      const port = container.getMappedPort(5432);
      pool = new Pool({
        connectionString: `postgres://fixture:fixture-secret@${host}:${port}/fixture`,
      });
      await pool.query(`create role worker_login login password 'worker-secret' nosuperuser nobypassrls;
      create table hyperdrive_claims (id text primary key, tenant text not null, value int not null);
      alter table hyperdrive_claims enable row level security;
      create policy isolated_tenant on hyperdrive_claims
        using (tenant = current_setting('croco.tenant', true))
        with check (tenant = current_setting('croco.tenant', true));
      grant select, insert, update on hyperdrive_claims to worker_login;`);
      connectionString = `postgres://worker_login:worker-secret@${host}:${port}/fixture`;
      const bundle = await build({
        entryPoints: [resolve(import.meta.dirname, "fixtures/hyperdriveWorker.ts")],
        bundle: true,
        write: false,
        platform: "node",
        format: "esm",
        external: ["node:*", "cloudflare:sockets", "pg-native"],
        conditions: ["workerd", "module"],
        banner: {
          js: "import { createRequire } from 'node:module'; const require = createRequire('/');",
        },
        alias: {
          "@croco/problems-core": resolve(
            import.meta.dirname,
            "../../../problems-core/src/index.ts",
          ),
        },
      });
      const output = bundle.outputFiles[0];
      if (!output) throw new Error("Missing Worker bundle");
      script = output.text;
    }, 180_000);
    beforeEach(async () => {
      await pool.query("truncate hyperdrive_claims");
    });
    afterAll(async () => {
      await Promise.all(workers.splice(0).map((item) => item.dispose()));
      await pool?.end();
      await container?.stop();
    }, 180_000);

    it("commits only one competing claim and CAS, isolates tenants across requests and isolates", async () => {
      const first = await worker();
      const second = await worker();
      const claimed = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          (index % 2 ? first : second).dispatchFetch("https://fixture/claim").then((r) => r.json()),
        ),
      );
      expect(
        claimed.filter((result) => (result as { claimed: number }).claimed === 1),
      ).toHaveLength(1);
      const cas = await Promise.all(
        [first, second].map((item) =>
          item.dispatchFetch("https://fixture/cas").then((r) => r.json()),
        ),
      );
      expect(cas.filter((result) => (result as { changed: number }).changed === 1)).toHaveLength(1);
      expect(await (await first.dispatchFetch("https://fixture/read?tenant=b")).json()).toEqual({
        rows: [],
      });
      expect(await (await second.dispatchFetch("https://fixture/read")).json()).toEqual({
        rows: [{ id: "shared", tenant: "tenant-a", value: 91 }],
      });
      expect((await pool.query("select value from hyperdrive_claims")).rows).toEqual([
        { value: 91 },
      ]);
    }, 30_000);

    it("rolls back failed SQL and aborted work, keeps the outer savepoint transaction, reconnects after failure", async () => {
      const instance = await worker();
      for (const action of ["rollback", "abort", "timeout", "pre-abort"]) {
        const response = await instance.dispatchFetch(`https://fixture/${action}`);
        expect(response.status).toBe(503);
        const text = await response.text();
        expect(JSON.parse(text)).toMatchObject({
          phase: action === "pre-abort" ? "connect" : "transaction",
          outcome: action === "pre-abort" ? "not-started" : "unknown",
          aborted: action === "abort" || action === "pre-abort",
        });
        for (const secret of ["worker-secret", "private_", "private-", "postgres://"])
          expect(text).not.toContain(secret);
        expect(
          (await pool.query("select count(*)::int as count from hyperdrive_claims")).rows,
        ).toEqual([{ count: 0 }]);
        expect((await instance.dispatchFetch("https://fixture/read")).status).toBe(200);
      }
      expect((await instance.dispatchFetch("https://fixture/savepoint")).status).toBe(200);
      expect((await pool.query("select id, value from hyperdrive_claims")).rows).toEqual([
        { id: "outer", value: 31 },
      ]);
      const sessions = await pool.query(
        "select count(*)::int as count from pg_stat_activity where usename = 'worker_login'",
      );
      expect(sessions.rows).toEqual([{ count: 0 }]);
    }, 30_000);

    it("recovers from PostgreSQL connection exhaustion without sharing a connection", async () => {
      await pool.query("alter role worker_login connection limit 1");
      const held = new Pool({ connectionString, max: 1 });
      let ended = false;
      try {
        await held.query("select 1");
        const instance = await worker(connectionString, false);
        const response = await instance.dispatchFetch("https://fixture/read");
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ phase: "connect", outcome: "not-started" });
        await held.end();
        ended = true;
        expect((await instance.dispatchFetch("https://fixture/read")).status).toBe(200);
      } finally {
        if (!ended) await held.end();
        await pool.query("alter role worker_login connection limit -1");
      }
    }, 30_000);

    it("bounds a stalled PostgreSQL handshake and closes its socket", async () => {
      const sockets = new Set<Socket>();
      const server = createServer((socket) => {
        sockets.add(socket);
        socket.resume();
        socket.on("error", () => socket.destroy());
        socket.on("close", () => sockets.delete(socket));
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Missing local server port");
        const instance = await worker(
          `postgres://fixture:private-timeout-secret@127.0.0.1:${address.port}/fixture`,
          false,
        );
        const response = await instance.dispatchFetch("https://fixture/connect-timeout");
        expect(response.status).toBe(503);
        const body = await response.text();
        expect(body).not.toContain("private-timeout-secret");
        expect(JSON.parse(body)).toMatchObject({ phase: "connect", outcome: "not-started" });
        await vi.waitFor(() => expect(sockets.size).toBe(0));
      } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }, 30_000);

    it("redacts absent bindings and rejected credentials", async () => {
      const missing = await worker("");
      expect(await (await missing.dispatchFetch("https://fixture/read")).json()).toMatchObject({
        phase: "configuration",
        outcome: "not-started",
      });
      // Direct TCP avoids a Miniflare 4 proxy EPIPE on rejected authentication; the pg path remains real.
      const rejected = await worker(
        connectionString.replace("worker-secret", "wrong-secret"),
        false,
      );
      const response = await rejected.dispatchFetch("https://fixture/read");
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(body).not.toContain("wrong-secret");
      expect(body).not.toContain("worker_login");
      expect(JSON.parse(body)).toMatchObject({ phase: "connect", outcome: "not-started" });
    }, 30_000);
  },
);
