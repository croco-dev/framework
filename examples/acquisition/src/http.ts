import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  AcquisitionProblem,
  AcquisitionService,
  parseAcquisitionContext,
} from "@croco/analytics-core/acquisition";
import { DrizzleAcquisitionStore, createAcquisition } from "@croco/analytics-drizzle";
import { createAcquisitionOperations } from "@croco/admin-core/acquisition";
import type { AcquisitionContext } from "@croco/analytics-core/acquisition";
import { urls, scope, origin } from "./config";

/** Loopback-only synthetic principal. Production apps must supply their own authentication and consent. */
export async function createDemoServer(databaseUrl: string, root: string) {
  if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/acquisition$/.test(databaseUrl))
    throw new AcquisitionProblem("invalid");
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  // Migration is an explicit demo startup step, never hidden in AcquisitionService or its adapter.
  await createAcquisition(db);
  const sessions = new Map<string, { anonymousRef: string; subjectRef?: string }>();
  const store = new DrizzleAcquisitionStore(db);
  const createService = (session: { anonymousRef: string; subjectRef?: string }) =>
    new AcquisitionService(store, {
      actor: "synthetic-operator",
      urls,
      retentionMs: 7 * 86400000,
      claimCodes: ["friend", "podcast"],
      clock: () => new Date(),
      policy: {
        authorize(request) {
          if (
            request.scope.app !== scope.app ||
            request.scope.environment !== scope.environment ||
            request.scope.tenantId !== scope.tenantId
          )
            throw new AcquisitionProblem("denied");
          if (
            request.action === "record" &&
            request.identity?.kind === "anonymous" &&
            request.identity.ref !== session.anonymousRef
          )
            throw new AcquisitionProblem("denied");
          if (
            request.action === "link" &&
            (request.anonymousRef !== session.anonymousRef ||
              session.subjectRef !== request.identity?.ref)
          )
            throw new AcquisitionProblem("denied");
          if (request.identity?.kind === "subject" && request.identity.ref !== "synthetic-user")
            throw new AcquisitionProblem("denied");
        },
        mask: (row) => ({ ...row, identity: { ...row.identity, ref: "masked" } }),
      },
    });
  const bootstrap = createService({ anonymousRef: "bootstrap" });
  for (const model of ["first-touch", "last-observed-touch"] as const)
    await bootstrap.define(scope, {
      id: model,
      model,
      modelVersion: "1",
      revision: 1,
      windowMs: 7 * 86400000,
      reason: "demo-initial",
      idempotencyKey: model,
    });
  const direct = parseAcquisitionContext({ url: origin, referrerAvailable: true }, urls);
  const server = createServer(async (req, res) => {
    // No request URL, headers, bodies or private causes are logged.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const cookie = /(?:^|; )acquisition_demo=([a-f0-9-]+)/.exec(req.headers.cookie ?? "")?.[1];
    const sessionId = cookie && sessions.has(cookie) ? cookie : randomUUID();
    if (!sessions.has(sessionId)) sessions.set(sessionId, { anonymousRef: randomUUID() });
    res.setHeader("Set-Cookie", `acquisition_demo=${sessionId}; HttpOnly; SameSite=Strict; Path=/`);
    const session = sessions.get(sessionId);
    if (!session) {
      res.writeHead(500);
      res.end();
      return;
    }
    try {
      const path = new URL(req.url ?? "/", origin).pathname;
      if (req.method === "GET" && path === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === "GET" && path === "/") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acquisition evidence</title><div id="root"></div><script src="/browser.js" defer></script></html>',
        );
        return;
      }
      if (req.method === "GET" && path === "/browser.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(await readFile(join(root, "dist/browser.global.js")));
        return;
      }
      if (
        req.method !== "POST" ||
        req.url !== path ||
        req.headers.origin !== origin ||
        req.headers["content-type"] !== "application/json"
      )
        throw new AcquisitionProblem("denied");
      let text = "";
      for await (const chunk of req) {
        text += chunk.toString();
        if (text.length > 8192) throw new AcquisitionProblem("invalid");
      }
      const body = JSON.parse(text || "{}") as AcquisitionContext;
      const service = createService(session);
      const identity = session.subjectRef
        ? { kind: "subject" as const, ref: session.subjectRef }
        : { kind: "anonymous" as const, ref: session.anonymousRef };
      let result: unknown = { ok: true };
      if (path === "/api/collect") {
        await service.recordTouchpoint({
          id: randomUUID(),
          scope,
          source: "browser",
          identity,
          occurredAt: new Date().toISOString(),
          sourceKind: "observed",
          context: body,
          coverage: "partial",
        });
      } else if (path === "/api/login") {
        session.subjectRef = "synthetic-user";
        await service.linkKnownSubject({
          scope,
          id: session.anonymousRef,
          anonymousRef: session.anonymousRef,
          subjectRef: session.subjectRef,
          provenance: "demo-authenticated-session",
        });
      } else if (path === "/api/logout") {
        // New opaque session identity; an old anonymous identity is never assigned to another user.
        session.anonymousRef = randomUUID();
        delete session.subjectRef;
      } else if (path === "/api/declarations") {
        if (!session.subjectRef) throw new AcquisitionProblem("denied");
        for (const claim of ["friend", "podcast"])
          await service.recordTouchpoint({
            id: randomUUID(),
            scope,
            source: "customer-response",
            identity,
            occurredAt: new Date().toISOString(),
            sourceKind: "self-reported",
            context: direct,
            claim,
            coverage: "partial",
          });
      } else if (path === "/api/delete") {
        if (!session.subjectRef) throw new AcquisitionProblem("denied");
        await service.deleteIdentity(scope, identity);
      } else if (path === "/api/compare") {
        const operations = createAcquisitionOperations(service, scope);
        result = await operations.compare({
          conversion: {
            ref: "synthetic-purchase",
            identity: { kind: "subject", ref: "synthetic-user" },
            occurredAt: new Date().toISOString(),
          },
          definitions: [
            { id: "first-touch", revision: 1 },
            { id: "last-observed-touch", revision: 1 },
          ],
          limit: 100,
        });
      } else {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (cause) {
      const status = cause instanceof AcquisitionProblem ? cause.status : 500;
      res.writeHead(status, { "Content-Type": "application/problem+json" });
      res.end(
        JSON.stringify({
          code: cause instanceof AcquisitionProblem ? cause.code : "demo/unavailable",
        }),
      );
    }
  });
  return { server, close: () => pool.end() };
}
