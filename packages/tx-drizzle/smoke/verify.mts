import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { readSmokeBody } from "./protocol.mts";

type Target = "local" | "remote";
export type SmokeOptions = {
  url: string;
  target: Target;
  token: string;
  databaseUrl: string;
};
type Row = { id: string; tenant: string; value: number };
type Check = { name: string; status: "passed" | "failed" | "not-run" };
export type SmokeReport = {
  schemaVersion: "croco.hyperdrive-smoke/v1";
  target: Target;
  runId: string;
  status: "passed" | "failed";
  checks: Check[];
  // HTTP/SQL observations never attest provider identity, deployment configuration or certification.
  cloudflareDeployment: "not-verified";
  proxyPoolingCacheFailover: "not-verified";
  certification: "not-certified";
};

class SmokeCheckProblem extends Problem {
  readonly code = "HYPERDRIVE_SMOKE_CHECK_FAILED";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      "HYPERDRIVE_SMOKE_CHECK_FAILED",
      ProblemCategory.InternalServerError,
      "Smoke check failed.",
    );
  }
}

function requireCheck(value: unknown): asserts value {
  if (!value) throw new SmokeCheckProblem();
}

/** No tokens in URLs; redirects never receive the smoke credential. */
export function validateSmokeOptions(options: SmokeOptions): URL {
  const url = new URL(options.url);
  requireCheck(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      options.token.length >= 32 &&
      options.databaseUrl.length > 0,
  );
  if (options.target === "local") {
    requireCheck(
      url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname),
    );
  } else {
    requireCheck(options.target === "remote" && url.protocol === "https:");
  }
  const databaseUrl = new URL(options.databaseUrl);
  requireCheck(["postgres:", "postgresql:"].includes(databaseUrl.protocol));
  return url;
}

/** One bounded run; all mutations and observer cleanup are scoped to a fresh UUID. */
export async function runHyperdriveSmoke(options: SmokeOptions): Promise<SmokeReport> {
  const names = [
    "configuration",
    "protocol",
    "authorization",
    "claim",
    "cas",
    "tenant-isolation",
    "rollback",
    "savepoint",
    "abort",
    "pre-abort",
    "timeout",
    "reconnect",
    "cleanup",
  ];
  const report: SmokeReport = {
    schemaVersion: "croco.hyperdrive-smoke/v1",
    target: options.target,
    runId: randomUUID(),
    status: "failed",
    checks: names.map((name) => ({ name, status: "not-run" })),
    cloudflareDeployment: "not-verified",
    proxyPoolingCacheFailover: "not-verified",
    certification: "not-certified",
  };
  let current: Check | undefined = report.checks[0];
  let database: Pool | undefined;
  let observerTransportFailed = false;
  let cleanupNeeded = false;
  const checked = async (name: string, operation: () => Promise<void>) => {
    current = report.checks.find((check) => check.name === name);
    requireCheck(current);
    await operation();
    current.status = "passed";
  };
  try {
    const url = validateSmokeOptions(options);
    database = new Pool({
      connectionString: options.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
      statement_timeout: 5000,
      max: 1,
    });
    database.on("error", () => {
      observerTransportFailed = true;
    });
    const observer = database;
    await checked("configuration", async () => {
      // Refuse RLS-filtered observer views: a tenant leak/rollback oracle must see all rows.
      const role = await observer.query<{ visible: boolean }>(`select
        (rolsuper or rolbypassrls) as visible from pg_roles where rolname = current_user`);
      requireCheck(role.rows[0]?.visible === true);
    });
    const signal = AbortSignal.timeout(120_000);
    const request = async (path: string, body?: object, authenticated = true) => {
      const response = await fetch(new URL(path, url), {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: {
          ...(authenticated ? { authorization: `Bearer ${options.token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await readSmokeBody(response.body, 8192);
      requireCheck(
        text !== undefined && !text.includes(options.token) && !text.includes(options.databaseUrl),
      );
      const value: unknown = JSON.parse(text);
      requireCheck(value && typeof value === "object");
      return { status: response.status, value: value as Record<string, unknown> };
    };
    const transaction = (action: string, tenant = "a") =>
      request("/transaction", { runId: report.runId, tenant, action });
    const rows = async () =>
      (
        await observer.query<Row>(
          "select id, tenant, value from croco_hyperdrive_smoke.claims where run_id = $1 order by id",
          [report.runId],
        )
      ).rows;
    const expected = [{ id: "shared", tenant: "tenant-a", value: 91 }];
    const same = (actual: unknown, wanted: unknown) =>
      requireCheck(isDeepStrictEqual(actual, wanted));
    await checked("protocol", async () => {
      const response = await request("/health");
      requireCheck(response.status === 200);
      same(response.value, { protocol: "croco.hyperdrive-smoke/v1" });
    });
    await checked("authorization", async () => {
      const response = await request("/health", undefined, false);
      requireCheck(response.status === 401);
      same(response.value, { code: "HYPERDRIVE_SMOKE_UNAUTHORIZED" });
    });
    await checked("claim", async () => {
      cleanupNeeded = true;
      const responses = await Promise.all(Array.from({ length: 6 }, () => transaction("claim")));
      requireCheck(responses.every((response) => response.status === 200));
      same(responses.map((response) => response.value.count).sort(), [0, 0, 0, 0, 0, 1]);
      same(await rows(), [{ id: "shared", tenant: "tenant-a", value: 73 }]);
    });
    await checked("cas", async () => {
      const responses = await Promise.all([transaction("cas"), transaction("cas")]);
      requireCheck(responses.every((response) => response.status === 200));
      same(responses.map((response) => response.value.count).sort(), [0, 1]);
      same(await rows(), expected);
    });
    await checked("tenant-isolation", async () => {
      const b = await transaction("read", "b");
      requireCheck(b.status === 200);
      same(b.value, { rows: [] });
      const a = await transaction("read");
      requireCheck(a.status === 200);
      same(a.value, { rows: [{ id: "shared", value: 91 }] });
    });
    const failure = async (action: string) => {
      const response = await transaction(action);
      requireCheck(response.status === 503);
      same(response.value, {
        code: "tx-drizzle/hyperdrive-transaction-failed",
        phase: action === "pre-abort" ? "connect" : "transaction",
        outcome: action === "pre-abort" ? "not-started" : "unknown",
        aborted: action === "abort" || action === "pre-abort",
        cleanupFailed: false,
        retryable: false,
      });
      same(await rows(), expected);
    };
    await checked("rollback", () => failure("rollback"));
    await checked("savepoint", async () => {
      const response = await transaction("savepoint");
      requireCheck(response.status === 200);
      expected.unshift({ id: "outer", tenant: "tenant-a", value: 31 });
      same(await rows(), expected);
      same(response.value, {
        rows: [
          { id: "outer", value: 31 },
          { id: "shared", value: 91 },
        ],
      });
    });
    for (const action of ["abort", "pre-abort", "timeout"])
      await checked(action, () => failure(action));
    await checked("reconnect", async () => {
      const response = await transaction("read");
      requireCheck(response.status === 200);
      same(response.value, { rows: expected.map(({ id, value }) => ({ id, value })) });
      same(await rows(), expected);
    });
  } catch {
    if (current) current.status = "failed";
  } finally {
    const cleanup = report.checks.find((check) => check.name === "cleanup");
    if (database) {
      try {
        if (cleanupNeeded) {
          await database.query("delete from croco_hyperdrive_smoke.claims where run_id = $1", [
            report.runId,
          ]);
          const remaining = await database.query(
            "select 1 from croco_hyperdrive_smoke.claims where run_id = $1",
            [report.runId],
          );
          requireCheck(remaining.rowCount === 0);
        }
        await database.end();
        requireCheck(!observerTransportFailed);
        if (cleanup) cleanup.status = "passed";
      } catch {
        if (cleanup) cleanup.status = "failed";
        await database.end().catch(() => undefined);
      }
    }
  }
  report.status = report.checks.every((check) => check.status === "passed") ? "passed" : "failed";
  return report;
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      target: { type: "string" },
      output: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  requireCheck(
    values.url && (values.target === "local" || values.target === "remote") && values.output,
  );
  const report = await runHyperdriveSmoke({
    url: values.url,
    target: values.target,
    token: process.env.HYPERDRIVE_SMOKE_TOKEN ?? "",
    databaseUrl: process.env.HYPERDRIVE_SMOKE_DATABASE_URL ?? "",
  });
  await writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(
    `Hyperdrive smoke: ${report.status}; target=${report.target}; deployment=not-verified\n`,
  );
  process.exitCode = report.status === "passed" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    process.stderr.write(
      "HYPERDRIVE_SMOKE_CHECK_FAILED: check configuration or the safe report.\n",
    );
    process.exitCode = 1;
  });
}
