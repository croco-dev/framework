import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  HyperdriveTransactionProblem,
  withHyperdriveTransaction,
} from "@croco/tx-drizzle/hyperdrive";
import type { HyperdriveBinding } from "@croco/tx-drizzle/hyperdrive";
import { readSmokeBody } from "./protocol.mts";

type Bindings = {
  HYPERDRIVE?: HyperdriveBinding;
  HYPERDRIVE_SMOKE_TOKEN?: string;
};

const actions = [
  "claim",
  "cas",
  "read",
  "rollback",
  "savepoint",
  "abort",
  "pre-abort",
  "timeout",
] as const;
type Action = (typeof actions)[number];
type Command = { runId: string; tenant: "a" | "b"; action: Action };

function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<Command>;
  return (
    typeof command.runId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.runId) &&
    (command.tenant === "a" || command.tenant === "b") &&
    actions.some((action) => action === command.action)
  );
}

function failure(code: string, status: number): Response {
  return Response.json({ code }, { status, headers: { "cache-control": "no-store" } });
}

/** Dedicated smoke principal: synthetic tenant selection is not application authorization. */
export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    if (typeof env.HYPERDRIVE_SMOKE_TOKEN !== "string" || env.HYPERDRIVE_SMOKE_TOKEN.length < 32)
      return failure("HYPERDRIVE_SMOKE_DISABLED", 503);
    const encoder = new TextEncoder();
    const supplied = encoder.encode(request.headers.get("authorization") ?? "");
    const expected = encoder.encode(`Bearer ${env.HYPERDRIVE_SMOKE_TOKEN}`);
    if (supplied.byteLength !== expected.byteLength || !timingSafeEqual(supplied, expected))
      return failure("HYPERDRIVE_SMOKE_UNAUTHORIZED", 401);
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health")
      return Response.json(
        { protocol: "croco.hyperdrive-smoke/v1" },
        { headers: { "cache-control": "no-store" } },
      );
    if (request.method !== "POST" || path !== "/transaction")
      return failure("HYPERDRIVE_SMOKE_NOT_FOUND", 404);
    // Fixed small commands; no caller-supplied SQL, schema, timeout or connection string.
    let command: unknown;
    try {
      const text = await readSmokeBody(request.body, 512);
      if (text === undefined) return failure("HYPERDRIVE_SMOKE_INVALID_REQUEST", 400);
      command = JSON.parse(text);
    } catch {
      return failure("HYPERDRIVE_SMOKE_INVALID_REQUEST", 400);
    }
    if (!isCommand(command)) return failure("HYPERDRIVE_SMOKE_INVALID_REQUEST", 400);
    const { runId, action } = command;
    const tenant = command.tenant === "a" ? "tenant-a" : "tenant-b";
    const controller = new AbortController();
    if (action === "pre-abort") controller.abort();
    try {
      const result = await withHyperdriveTransaction(
        env.HYPERDRIVE,
        async (tx) => {
          await tx.execute(sql`select set_config('croco.tenant', ${tenant}, true)`);
          if (action === "claim") {
            const inserted = await tx.execute(sql`insert into croco_hyperdrive_smoke.claims
              (run_id, id, tenant, value) values (${runId}::uuid, 'shared', ${tenant}, 73)
              on conflict do nothing returning id`);
            return { count: inserted.rowCount };
          }
          if (action === "cas") {
            const updated = await tx.execute(sql`update croco_hyperdrive_smoke.claims set value = 91
              where run_id = ${runId}::uuid and id = 'shared' and value = 73 returning id`);
            return { count: updated.rowCount };
          }
          if (action === "timeout") await tx.execute(sql`select pg_sleep(1)`);
          if (action === "rollback" || action === "abort") {
            await tx.execute(sql`insert into croco_hyperdrive_smoke.claims
              (run_id, id, tenant, value) values (${runId}::uuid, ${action}, ${tenant}, 29)`);
            if (action === "abort") {
              controller.abort();
              await tx.execute(sql`select 1`);
            } else {
              await tx.execute(sql`select smoke_private_parameter from smoke_private_table`);
            }
          }
          if (action === "savepoint") {
            await tx.execute(sql`insert into croco_hyperdrive_smoke.claims
              (run_id, id, tenant, value) values (${runId}::uuid, 'outer', ${tenant}, 31)`);
            try {
              await tx.transaction(async (nested) => {
                await nested.execute(sql`insert into croco_hyperdrive_smoke.claims
                  (run_id, id, tenant, value) values (${runId}::uuid, 'inner', ${tenant}, 47)`);
                await nested.execute(sql`select 1/0`);
              });
            } catch {
              // The independent observer must prove only the inner work was rolled back.
            }
          }
          const rows = await tx.execute(sql`select id, value from croco_hyperdrive_smoke.claims
            where run_id = ${runId}::uuid order by id`);
          return { rows: rows.rows };
        },
        {
          signal: controller.signal,
          connectionTimeoutMs: 5000,
          statementTimeoutMs: action === "timeout" ? 50 : 5000,
        },
      );
      return Response.json(result, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof HyperdriveTransactionProblem)
        return Response.json(
          { code: error.code, ...error.extensions },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      return failure("HYPERDRIVE_SMOKE_FAILED", 500);
    }
  },
};
