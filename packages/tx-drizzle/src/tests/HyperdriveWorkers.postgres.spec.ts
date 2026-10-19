import { resolve } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { once } from "node:events";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { parseConfigFileTextToJson } from "typescript";
import { Pool } from "pg";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runHyperdriveSmoke } from "../../smoke/verify.mts";

// This is local workerd → PostgreSQL. It does not exercise the deployed Hyperdrive proxy/cache.
const workers: Miniflare[] = [];
describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "Hyperdrive local Worker PostgreSQL",
  () => {
    let container: StartedTestContainer;
    let pool: Pool;
    let connectionString: string;
    let script: string;
    let smokeScript: string;
    let observerUrl: string;
    let smokeCompatibility: { compatibilityDate: string; compatibilityFlags: string[] };
    async function smokeWorker(token: string): Promise<string> {
      const instance = new Miniflare({
        modules: true,
        script: smokeScript,
        port: 0,
        host: "127.0.0.1",
        ...smokeCompatibility,
        hyperdrives: {
          HYPERDRIVE: connectionString.replace("worker_login", "croco_hyperdrive_smoke_worker"),
        },
        bindings: { HYPERDRIVE_SMOKE_TOKEN: token },
      });
      workers.push(instance);
      return (await instance.ready).origin;
    }
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
      // Direct Vitest and package lane commands must both exercise the current published entrypoint.
      await promisify(execFile)("pnpm", ["run", "build"], {
        cwd: resolve(import.meta.dirname, "../.."),
        timeout: 60_000,
      });
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
      observerUrl = `postgres://fixture:fixture-secret@${host}:${port}/fixture`;
      pool = new Pool({ connectionString: observerUrl });
      await pool.query(`create role worker_login login password 'worker-secret' nosuperuser nobypassrls;
      create table hyperdrive_claims (id text primary key, tenant text not null, value int not null);
      alter table hyperdrive_claims enable row level security;
      create policy isolated_tenant on hyperdrive_claims
        using (tenant = current_setting('croco.tenant', true))
        with check (tenant = current_setting('croco.tenant', true));
      grant select, insert, update on hyperdrive_claims to worker_login;`);
      await pool.query(
        "create role croco_hyperdrive_smoke_worker login password 'worker-secret' nosuperuser nobypassrls",
      );
      await pool.query(
        await readFile(resolve(import.meta.dirname, "../../smoke/setup.sql"), "utf8"),
      );
      await pool.query(
        "create role smoke_observer_readonly login password 'observer-secret' nosuperuser bypassrls",
      );
      await pool.query("grant usage on schema croco_hyperdrive_smoke to smoke_observer_readonly");
      await pool.query("grant select on croco_hyperdrive_smoke.claims to smoke_observer_readonly");
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
      const directory = await mkdtemp(resolve(tmpdir(), "croco-hyperdrive-bundle-"));
      try {
        const parsed = parseConfigFileTextToJson(
          "wrangler.jsonc",
          await readFile(resolve(import.meta.dirname, "../../smoke/wrangler.jsonc"), "utf8"),
        );
        if (parsed.error) throw new Error("Invalid smoke Wrangler JSONC");
        const configuration = parsed.config;
        smokeCompatibility = {
          compatibilityDate: configuration.compatibility_date,
          compatibilityFlags: configuration.compatibility_flags,
        };
        await promisify(execFile)(
          "pnpm",
          [
            "exec",
            "wrangler",
            "deploy",
            "--dry-run",
            "--config",
            resolve(import.meta.dirname, "../../smoke/wrangler.jsonc"),
            "--outdir",
            directory,
          ],
          {
            cwd: resolve(import.meta.dirname, "../.."),
            env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
            timeout: 60_000,
          },
        );
        smokeScript = await readFile(resolve(directory, "worker.js"), "utf8");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }, 180_000);
    beforeEach(async () => {
      await pool.query("truncate hyperdrive_claims");
    });
    afterAll(async () => {
      await Promise.all(workers.splice(0).map((item) => item.dispose()));
      await pool?.end();
      await container?.stop();
    }, 180_000);

    it("runs the deployment Worker and CLI over local HTTP with an independent SQL oracle and scoped cleanup", async () => {
      const token = "dedicated-smoke-token-with-at-least-32-characters";
      const url = await smokeWorker(token);
      const spectator = "dc54bbbf-c6d1-4ca5-9db0-f4aa4601bbba";
      await pool.query(
        "insert into croco_hyperdrive_smoke.claims values ($1, 'unrelated', 'tenant-b', 109)",
        [spectator],
      );
      const directory = await mkdtemp(resolve(tmpdir(), "croco-hyperdrive-cli-"));
      try {
        expect((await fetch(`${url}/health`)).status).toBe(401);
        expect(
          (
            await fetch(`${url}/transaction`, {
              method: "POST",
              headers: { authorization: `Bearer ${token}` },
              body: '{"runId":"unsafe","tenant":"a","action":"read"}',
            })
          ).status,
        ).toBe(400);
        const output = resolve(directory, "evidence.json");
        const result = await promisify(execFile)(
          process.execPath,
          [
            "--experimental-strip-types",
            resolve(import.meta.dirname, "../../smoke/verify.mts"),
            "--url",
            url,
            "--target",
            "local",
            "--output",
            output,
          ],
          {
            env: {
              ...process.env,
              HYPERDRIVE_SMOKE_TOKEN: token,
              HYPERDRIVE_SMOKE_DATABASE_URL: observerUrl,
            },
            timeout: 120_000,
          },
        );
        expect(result.stdout).toContain(
          "Hyperdrive smoke: passed; target=local; deployment=not-verified",
        );
        const evidence = JSON.parse(await readFile(output, "utf8"));
        expect(evidence).toMatchObject({
          schemaVersion: "croco.hyperdrive-smoke/v1",
          status: "passed",
          target: "local",
          cloudflareDeployment: "not-verified",
          certification: "not-certified",
        });
        expect(
          evidence.checks.every((check: { status: string }) => check.status === "passed"),
        ).toBe(true);
        expect(JSON.stringify(evidence)).not.toMatch(
          /fixture-secret|worker-secret|dedicated-smoke-token|postgres:/,
        );
        expect(
          (await pool.query("select id, value from croco_hyperdrive_smoke.claims")).rows,
        ).toEqual([{ id: "unrelated", value: 109 }]);
        const denied = await runHyperdriveSmoke({
          url,
          target: "local",
          token,
          databaseUrl: connectionString,
        });
        expect(denied.status).toBe("failed");
        expect(denied.checks[0].status).toBe("failed");
      } finally {
        await pool.query("delete from croco_hyperdrive_smoke.claims where run_id = $1", [
          spectator,
        ]);
        await rm(directory, { recursive: true, force: true });
      }
    }, 120_000);

    it("fails the report when the observer cannot clean up, without hiding persisted rows", async () => {
      const token = "cleanup-smoke-token-with-at-least-32-characters";
      const url = await smokeWorker(token);
      const report = await runHyperdriveSmoke({
        url,
        target: "local",
        token,
        databaseUrl: observerUrl.replace(
          "fixture:fixture-secret@",
          "smoke_observer_readonly:observer-secret@",
        ),
      });
      try {
        expect(report.status).toBe("failed");
        expect(report.checks.filter(({ status }) => status === "failed")).toEqual([
          { name: "cleanup", status: "failed" },
        ]);
        expect(
          (
            await pool.query(
              "select id from croco_hyperdrive_smoke.claims where run_id = $1 order by id",
              [report.runId],
            )
          ).rows,
        ).toEqual([{ id: "outer" }, { id: "shared" }]);
        expect(JSON.stringify(report)).not.toContain("observer-secret");
      } finally {
        await pool.query("delete from croco_hyperdrive_smoke.claims where run_id = $1", [
          report.runId,
        ]);
      }
    }, 120_000);

    it("fails closed for absent, short and non-string smoke credentials", async () => {
      for (const token of [undefined, "short", { token: "private-structured-token" }]) {
        const instance = new Miniflare({
          modules: true,
          script: smokeScript,
          ...smokeCompatibility,
          ...(token === undefined ? {} : { bindings: { HYPERDRIVE_SMOKE_TOKEN: token } }),
        });
        workers.push(instance);
        const response = await instance.dispatchFetch("https://fixture/health", {
          headers: { authorization: "Bearer [object Object]" },
        });
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ code: "HYPERDRIVE_SMOKE_DISABLED" });
      }
    }, 30_000);

    it("rejects missing, truncated and same-length incorrect bearer credentials", async () => {
      const token = "auth-smoke-token-with-at-least-32-characters";
      const url = await smokeWorker(token);
      for (const authorization of [
        undefined,
        `Bearer ${token.slice(1)}`,
        `Bearer X${token.slice(1)}`,
      ]) {
        const response = await fetch(`${url}/health`, {
          headers: authorization === undefined ? {} : { authorization },
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ code: "HYPERDRIVE_SMOKE_UNAUTHORIZED" });
      }
      const response = await fetch(`${url}/health`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ protocol: "croco.hyperdrive-smoke/v1" });
    }, 30_000);

    it.each(["counts", "persistence", "redirect"])(
      "rejects a misleading HTTP endpoint: %s",
      async (fault) => {
        let claims = 0;
        let redirected = false;
        const token = "negative-smoke-token-with-at-least-32-characters";
        const server = createHttpServer((request, response) => {
          response.setHeader("content-type", "application/json");
          if (request.url === "/credential-sink") {
            redirected = true;
            response.end(JSON.stringify({ protocol: "croco.hyperdrive-smoke/v1" }));
          } else if (fault === "redirect") {
            response.writeHead(302, { location: "/credential-sink" });
            response.end();
          } else if (request.headers.authorization !== `Bearer ${token}`) {
            response.writeHead(401);
            response.end(JSON.stringify({ code: "HYPERDRIVE_SMOKE_UNAUTHORIZED" }));
          } else if (request.url === "/health") {
            response.end(JSON.stringify({ protocol: "croco.hyperdrive-smoke/v1" }));
          } else {
            response.end(JSON.stringify({ count: fault === "counts" || claims++ === 0 ? 1 : 0 }));
          }
        });
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        try {
          const address = server.address();
          if (!address || typeof address === "string") throw new Error("Missing local HTTP port");
          const report = await runHyperdriveSmoke({
            url: `http://127.0.0.1:${address.port}`,
            target: "local",
            token,
            databaseUrl: observerUrl,
          });
          expect(report.status).toBe("failed");
          expect(redirected).toBe(false);
          expect(report.checks.find(({ status }) => status === "failed")?.name).toBe(
            fault === "redirect" ? "protocol" : "claim",
          );
          expect(report.checks.find(({ name }) => name === "cleanup")?.status).toBe("passed");
          expect(JSON.stringify(report)).not.toMatch(
            /negative-smoke-token|fixture-secret|postgres:/,
          );
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      },
      30_000,
    );

    it("commits only one competing claim and CAS, isolates tenants across requests and isolates", async () => {
      const first = await worker();
      const second = await worker();
      const claimed = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          (index % 2 ? first : second).dispatchFetch("https://fixture/claim").then((response) => {
            expect(response.status).toBe(200);
            return response.json();
          }),
        ),
      );
      expect(claimed.map((result) => (result as { claimed: number }).claimed).sort()).toEqual([
        0, 0, 0, 0, 0, 1,
      ]);
      const cas = await Promise.all(
        [first, second].map((item) =>
          item.dispatchFetch("https://fixture/cas").then((response) => {
            expect(response.status).toBe(200);
            return response.json();
          }),
        ),
      );
      expect(cas.map((result) => (result as { changed: number }).changed).sort()).toEqual([0, 1]);
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
      await vi.waitFor(async () => {
        const sessions = await pool.query(
          "select count(*)::int as count from pg_stat_activity where usename = 'worker_login'",
        );
        expect(sessions.rows).toEqual([{ count: 0 }]);
      });
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
