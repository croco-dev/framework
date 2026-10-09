import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { Problem, ProblemFactory } from "@croco/problems-core";
import {
  CancellationAuthorizationProblem,
  CancellationConflictProblem,
  CancellationInputProblem,
  hashCheckoutValue,
  planVersionRef,
  stableStringify,
  validateCancellationSnapshot,
} from "@croco/billing-core";
import { DrizzleBillingStore } from "@croco/billing-drizzle";
import { createCancellationExample } from "./index";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CancellationAuthority,
  CancellationIdentity,
  CancellationSnapshot,
  CheckoutResult,
  Subscription,
} from "@croco/billing-core";
import { parseDecision, parsePolicyEdit } from "./requestValidation";

async function main(): Promise<void> {
  const connectionString = process.env.CANCELLATION_DATABASE_URL;
  if (!connectionString)
    throw new CancellationInputProblem("CANCELLATION_DATABASE_URL is required");
  const pool = new Pool({ connectionString, max: 8 });
  const admissionPool = new Pool({ connectionString, max: 2 });
  const database = drizzle(pool);
  const scope = {
    appId: "cancellation-example",
    environment: "sandbox",
    tenantId: "sandbox-customer",
  };
  const identity: CancellationIdentity = {
    ...scope,
    subject: "synthetic-customer",
    subscriptionRef: "synthetic-subscription",
  };
  const billingStore = new DrizzleBillingStore(database, scope);
  const admittedKey = JSON.stringify(["cancellation-example-admission", scope]);

  async function snapshot(): Promise<CancellationSnapshot> {
    const account = await billingStore.findAccountByTenantId(scope.tenantId);
    const subscription = account ? await billingStore.findSubscription(account.id) : null;
    if (!subscription || subscription.id !== identity.subscriptionRef)
      throw new CancellationAuthorizationProblem();
    const result = await pool.query<{ data: Omit<CancellationSnapshot, "revision" | "status"> }>(
      "SELECT data FROM cancellation_sandbox_quotes WHERE subscription_ref = $1",
      [identity.subscriptionRef],
    );
    const quoted = result.rows[0]?.data;
    if (
      !quoted ||
      quoted.appId !== identity.appId ||
      quoted.environment !== identity.environment ||
      quoted.tenantId !== identity.tenantId ||
      quoted.subject !== identity.subject ||
      quoted.subscriptionRef !== identity.subscriptionRef
    )
      throw new CancellationAuthorizationProblem();
    return {
      ...quoted,
      revision: hashCheckoutValue(
        stableStringify({
          ...subscription,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          lastSyncedAt: subscription.lastSyncedAt.toISOString(),
          providerModifiedAt: subscription.providerModifiedAt?.toISOString() ?? null,
        }),
      ),
      status:
        subscription.status === "canceled" || subscription.status === "revoked"
          ? "ended"
          : subscription.cancelAtPeriodEnd
            ? "cancellation_scheduled"
            : "active",
    };
  }

  const authority: CancellationAuthority = {
    authorize: async (candidate) => {
      if (
        candidate.appId !== identity.appId ||
        candidate.environment !== identity.environment ||
        candidate.tenantId !== identity.tenantId ||
        candidate.subject !== identity.subject ||
        candidate.subscriptionRef !== identity.subscriptionRef
      )
        throw new CancellationAuthorizationProblem();
    },
    authorizePolicy: async (candidate, actor) => {
      if (stableStringify(candidate) !== stableStringify(scope) || actor !== "synthetic-operator")
        throw new CancellationAuthorizationProblem();
    },
    snapshot,
    admit: async (candidate, pinned, operation) => {
      await authority.authorize(candidate);
      const connection = await admissionPool.connect();
      try {
        await connection.query("SELECT pg_advisory_lock(hashtext($1), 2814)", [admittedKey]);
        validateCancellationSnapshot(identity, await snapshot(), new Date(), pinned);
        return await operation();
      } finally {
        await connection.query("SELECT pg_advisory_unlock(hashtext($1), 2814)", [admittedKey]);
        connection.release();
      }
    },
  };

  const gateway = {
    ensureCustomer: async () => {
      throw new CancellationInputProblem("Sandbox checkout is unavailable");
    },
    createCheckout: async () => {
      throw new CancellationInputProblem("Sandbox checkout is unavailable");
    },
    reconcileCheckout: async () => null,
    getCustomerPortalUrl: async () => {
      throw new CancellationInputProblem("Sandbox portal is unavailable");
    },
    cancelSubscription: async (
      ref: string,
      _immediate: boolean,
      options: { idempotencyKey: string },
    ) => {
      await pool.query(
        "INSERT INTO cancellation_sandbox_provider_commands(id,subscription_ref,action) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [options.idempotencyKey, ref, "cancel"],
      );
    },
    resumeSubscription: async (ref: string, options: { idempotencyKey: string }) => {
      await pool.query(
        "INSERT INTO cancellation_sandbox_provider_commands(id,subscription_ref,action) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [options.idempotencyKey, ref, "resume"],
      );
    },
  };
  const app = createCancellationExample({
    database,
    scope,
    gateway,
    checkoutIdempotencyStore: new InMemoryIdempotencyStore<CheckoutResult>(),
    authority,
    actor: async () => "synthetic-operator",
  });

  async function seed(): Promise<void> {
    const account = await billingStore.findAccountByTenantId(scope.tenantId);
    if (!account) {
      await billingStore.saveAccount({
        id: "synthetic-account",
        tenantId: scope.tenantId,
        externalCustomerId: "synthetic-provider-customer",
        email: "sandbox@example.invalid",
        createdAt: new Date(),
      });
      const subscription: Subscription = {
        id: identity.subscriptionRef,
        billingAccountId: "synthetic-account",
        externalSubscriptionId: "synthetic-provider-subscription",
        planId: "sandbox-plan",
        planVersionRef: planVersionRef("sandbox-plan-v1"),
        status: "active",
        currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        lastSyncedAt: new Date(),
      };
      await billingStore.saveSubscription(subscription);
    }
    if (!(await app.store.getPolicy(scope))) {
      await app.service.updatePolicy(
        scope,
        [
          {
            choiceId: "resume",
            label: "Resume subscription",
            order: 0,
            enabled: true,
            billingPeriods: ["initial", "renewal"],
            refundKinds: ["none", "partial", "full"],
          },
          {
            choiceId: "lower-plan",
            label: "Change to a lower plan",
            order: 1,
            enabled: true,
            billingPeriods: ["initial", "renewal"],
            refundKinds: ["none", "partial", "full"],
          },
        ],
        {
          actor: "synthetic-operator",
          reason: "Initialize synthetic sandbox policy",
          expectedRevision: 0,
          idempotencyKey: "sandbox-policy-v1",
          at: new Date().toISOString(),
        },
      );
    }
  }

  function sessionId(request: IncomingMessage): string | undefined {
    return request.headers.cookie
      ?.split("; ")
      .find((value) => value.startsWith("cancellation_session="))
      ?.slice("cancellation_session=".length);
  }
  async function loadSession(
    request: IncomingMessage,
    response: ServerResponse,
    newIntent = false,
  ) {
    const id = sessionId(request);
    const prior = id ? await app.store.getSession(scope, id) : undefined;
    if (prior?.decision) {
      const settled = await app.service.reconcile(identity, prior.id);
      if (!newIntent) return settled;
      const outcome = settled.commandReceipt?.providerOutcome;
      if (outcome === "pending" || outcome === "indeterminate")
        throw new CancellationConflictProblem(await snapshot());
    }
    if (prior && !prior.decision) {
      try {
        validateCancellationSnapshot(identity, await snapshot(), new Date(), prior.snapshot);
        return prior;
      } catch (error) {
        if (!(error instanceof CancellationConflictProblem)) throw error;
      }
    }
    const created = await app.service.createSession(identity, randomUUID());
    response.setHeader(
      "set-cookie",
      `cancellation_session=${created.id}; HttpOnly; SameSite=Strict; Path=/`,
    );
    return created;
  }
  async function body(request: IncomingMessage): Promise<unknown> {
    let text = "";
    for await (const chunk of request) {
      text += String(chunk);
      if (text.length > 16_384) throw new CancellationInputProblem("Request is too large");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new CancellationInputProblem("A JSON request body is required");
    }
  }

  await seed();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/session" && request.method === "GET") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await loadSession(request, response)));
      } else if (url.pathname === "/api/session/new" && request.method === "POST") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await loadSession(request, response, true)));
      } else if (url.pathname === "/api/decision" && request.method === "POST") {
        const id = sessionId(request);
        if (!id) throw new CancellationAuthorizationProblem();
        const decision = parseDecision(await body(request));
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await app.service.decide(identity, id, decision)));
      } else if (url.pathname === "/api/displayed" && request.method === "POST") {
        const id = sessionId(request);
        if (!id) throw new CancellationAuthorizationProblem();
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(await app.service.markDisplayed(identity, id)));
      } else if (url.pathname === "/api/retention") {
        response.setHeader("content-type", "application/json");
        if (request.method === "POST") {
          const edit = parsePolicyEdit(await body(request));
          response.end(JSON.stringify(await app.operations.save(scope, edit)));
        } else if (request.method === "GET")
          response.end(JSON.stringify(await app.operations.load(scope)));
        else response.writeHead(405).end();
      } else if (
        url.pathname === "/" ||
        url.pathname === "/retention" ||
        url.pathname === "/dist/browser.global.js"
      ) {
        const asset =
          url.pathname === "/dist/browser.global.js" ? "dist/browser.global.js" : "index.html";
        response.setHeader("content-type", asset.endsWith(".js") ? "text/javascript" : "text/html");
        response.end(await readFile(join(process.cwd(), asset)));
      } else response.writeHead(404).end();
    } catch (error) {
      const problem =
        error instanceof Problem
          ? error
          : ProblemFactory.internalServerError("sandbox/request-failed", "Sandbox request failed");
      response
        .writeHead(problem.status, { "content-type": "application/problem+json" })
        .end(JSON.stringify(problem.toJSON()));
    }
  });
  server.listen(4184, "127.0.0.1", () =>
    console.log("Cancellation sandbox: http://127.0.0.1:4184/"),
  );
  process.on("SIGTERM", () =>
    server.close(() => {
      void pool.end();
      void admissionPool.end();
    }),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
