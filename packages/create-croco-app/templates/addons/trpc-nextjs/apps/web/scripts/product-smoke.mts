import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { migrateProduct } from "../src/server/product/migrateProduct";
import type { AppRouter } from "../src/server/routers/index";

const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "croco-product-smoke-"));
const databasePath = join(directory, "product.sqlite");
migrateProduct(databasePath);

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function startServer(demo: boolean, observationFailure = false) {
  const port = await unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    CROCO_PRODUCT_DATABASE: databasePath,
  };
  delete env.CROCO_WEB_DEMO;
  if (demo) env.CROCO_WEB_DEMO = "local";
  if (observationFailure) {
    const fixture = fileURLToPath(new URL("./fixtures/observation-failure.cjs", import.meta.url));
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(fixture)}`;
  }
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    logs += String(chunk);
  });
  let spawnError: Error | undefined;
  child.on("error", (error) => {
    spawnError = error;
  });
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  try {
    const deadline = Date.now() + 45_000;
    while (true) {
      if (spawnError) throw spawnError;
      assert(
        child.exitCode === null && child.signalCode === null,
        `Next exited during startup:\n${logs}`,
      );
      let ready = false;
      try {
        ready = (
          await fetch(`${origin}/products/launch-brief`, { signal: AbortSignal.timeout(2_000) })
        ).ok;
      } catch {
        /* The process may still be opening its listening socket. */
      }
      if (ready) break;
      assert(Date.now() < deadline, `Next did not become ready:\n${logs}`);
      await delay(100);
    }
    return { origin, stop, logs: () => logs };
  } catch (error) {
    await stop();
    throw error;
  }
}

type Server = Awaited<ReturnType<typeof startServer>>;

function client(server: Server, cookie = "") {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${server.origin}/api/trpc`,
        transformer: superjson,
        fetch(url, options) {
          const headers = new Headers(options?.headers);
          headers.set("origin", server.origin);
          headers.set("cookie", cookie);
          return fetch(url, { ...options, headers });
        },
      }),
    ],
  });
}

async function login(server: Server, identity: "alice" | "bob" | "carol") {
  const response: Response = await fetch(`${server.origin}/api/local-session`, {
    method: "POST",
    headers: { origin: server.origin },
    body: new URLSearchParams({ identity }),
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "Login must issue a cookie");
  return cookie;
}

async function denied(
  operation: Promise<unknown>,
  code: string,
  status: number,
  privateValues: string[] = [],
) {
  await assert.rejects(operation, (error: unknown) => {
    assert(error instanceof TRPCClientError);
    assert.equal(error.data?.code, code);
    assert.equal(error.data?.httpStatus, status);
    const body = JSON.stringify(error.meta?.responseJSON ?? error.shape);
    for (const value of privateValues) assert(!body.includes(value));
    return true;
  });
}

function counts() {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return {
      results: database.prepare("SELECT count(*) AS n FROM product_trials").get()?.n,
      facts: database.prepare("SELECT count(*) AS n FROM product_trial_facts").get()?.n,
    };
  } finally {
    database.close();
  }
}

function assertCommitted(result: { id: string; eventId: string; correlationId: string }) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const fact = database
      .prepare(
        "SELECT result_id, tenant_id, user_id, correlation_id FROM product_trial_facts WHERE event_id = ?",
      )
      .get(result.eventId);
    assert.deepEqual(
      { ...fact },
      {
        result_id: result.id,
        tenant_id: "studio-a",
        user_id: "alice",
        correlation_id: result.correlationId,
      },
    );
    assert.equal(
      database.prepare("SELECT event_id FROM product_trials WHERE id = ?").get(result.id)?.event_id,
      result.eventId,
    );
  } finally {
    database.close();
  }
}

function observationCount(server: Server) {
  return server.logs().split('"eventName":"product.trial.committed"').length - 1;
}

const input = {
  commandId: randomUUID(),
  title: "Synthetic orchard planner",
  audience: "Synthetic garden clubs",
};
let server: Server | undefined;
try {
  server = await startServer(true);
  const publicResponse = await fetch(`${server.origin}/products/launch-brief`);
  assert.equal(publicResponse.status, 200);
  const publicHtml = await publicResponse.text();
  assert.match(publicHtml, /Turn a product idea and audience into a private, saved launch brief/);
  assert.match(publicHtml, /href="\/sign-in"/);
  assert.equal((await fetch(`${server.origin}/products/missing`)).status, 404);
  for (const path of ["/try", `/results/${randomUUID()}`]) {
    const response: Response = await fetch(`${server.origin}${path}`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/sign-in");
    assert(!(await response.text()).includes(input.title));
  }
  await denied(client(server).product.create.mutate(input), "UNAUTHORIZED", 401);
  const aliceCookie = await login(server, "alice");
  const alice = client(server, aliceCookie);
  const result = await alice.product.create.mutate(input);
  assert.equal(result.observation, "succeeded");
  assert.equal(result.title, input.title);
  assert.match(result.brief, /Synthetic garden clubs/);
  assert(result.eventId && result.correlationId);
  assertCommitted(result);
  await delay(50);
  assert.equal(observationCount(server), 1);
  assert.deepEqual(counts(), { results: 1, facts: 1 });
  const duplicate = await alice.product.create.mutate(input);
  assert.deepEqual(duplicate, { ...result, observation: "not-repeated" });
  await denied(alice.product.create.mutate({ ...input, title: "Changed input" }), "CONFLICT", 409);
  assert.deepEqual(counts(), { results: 1, facts: 1 });
  await delay(50);
  assert.equal(observationCount(server), 1);
  const privateValues = [input.title, input.audience, result.eventId, result.correlationId];
  await denied(
    client(server).product.get.query({ id: result.id }),
    "UNAUTHORIZED",
    401,
    privateValues,
  );
  const anonymousResult = await fetch(`${server.origin}/results/${result.id}`, {
    redirect: "manual",
  });
  assert.equal(anonymousResult.status, 307);
  assert.equal(anonymousResult.headers.get("location"), "/sign-in");
  assert(!(await anonymousResult.text()).includes(input.title));
  for (const identity of ["bob", "carol"] as const) {
    const cookie = await login(server, identity);
    await denied(
      client(server, cookie).product.get.query({ id: result.id }),
      "NOT_FOUND",
      404,
      privateValues,
    );
    const response: Response = await fetch(`${server.origin}/results/${result.id}`, {
      headers: { cookie },
    });
    assert.equal(response.status, 404);
    const html = await response.text();
    assert(!html.includes(input.title));
    assert(!html.includes(input.audience));
    assert(!html.includes(result.eventId));
  }
  for (let reload = 0; reload < 2; reload++) {
    const response: Response = await fetch(`${server.origin}/results/${result.id}`, {
      headers: { cookie: aliceCookie },
    });
    assert.equal(response.status, 200);
    assert((await response.text()).includes(input.title));
  }
  const { observation: _observation, ...saved } = result;
  assert.deepEqual(await alice.product.get.query({ id: result.id }), saved);
  await server.stop();
  server = await startServer(true);
  const restartedCookie = await login(server, "alice");
  assert.deepEqual(
    await client(server, restartedCookie).product.get.query({ id: result.id }),
    saved,
  );
  const restoredPage = await fetch(`${server.origin}/results/${result.id}`, {
    headers: { cookie: restartedCookie },
  });
  assert.equal(restoredPage.status, 200);
  assert((await restoredPage.text()).includes(input.title));
  assert.deepEqual(counts(), { results: 1, facts: 1 });
  await server.stop();
  server = await startServer(false);
  assert.equal(
    (
      await fetch(`${server.origin}/api/local-session`, {
        method: "POST",
        headers: { origin: server.origin },
        body: new URLSearchParams({ identity: "alice" }),
      })
    ).status,
    404,
  );
  await denied(
    client(server, restartedCookie).product.get.query({ id: result.id }),
    "UNAUTHORIZED",
    401,
  );
  await server.stop();
  server = await startServer(true, true);
  const faultAlice = client(server, await login(server, "alice"));
  const faultInput = { ...input, commandId: randomUUID(), title: "Synthetic observation failure" };
  const faultResult = await faultAlice.product.create.mutate(faultInput);
  assert.equal(faultResult.observation, "failed");
  assertCommitted(faultResult);
  assert.deepEqual(counts(), { results: 2, facts: 2 });
  assert.equal(
    (await faultAlice.product.get.query({ id: faultResult.id })).eventId,
    faultResult.eventId,
  );
  const faultDuplicate = await faultAlice.product.create.mutate(faultInput);
  assert.deepEqual(faultDuplicate, { ...faultResult, observation: "not-repeated" });
  assert.deepEqual(counts(), { results: 2, facts: 2 });
  await delay(50);
  assert.equal(observationCount(server), 1);
  console.info(
    "Product HTTP smoke passed: SSR, authentication, isolation, idempotency, restart persistence, and post-commit observation failure.",
  );
} catch (error) {
  if (server) console.error(server.logs());
  throw error;
} finally {
  await server?.stop();
  await rm(directory, { recursive: true, force: true });
}
